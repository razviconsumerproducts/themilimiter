import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../lib/supabase-server'

const quotationStatuses = new Set(['ISSUED', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED'])
const paymentMethods = new Set(['BANK_TRANSFER', 'UPI', 'CARD', 'CASH', 'CHEQUE', 'OTHER'])

function requiredString(value: unknown, field: string): string {
  const result = String(value ?? '').trim()
  if (!result) throw new Error(`${field} is required.`)
  return result
}

function nonNegative(value: unknown, field: string): number {
  const result = Number(value)
  if (!Number.isFinite(result) || result < 0) throw new Error(`${field} must be a non-negative number.`)
  return result
}

async function getQuotation(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, quotationId: string) {
  const { data, error } = await supabase
    .from('quotations')
    .select('id, project_id, customer_id, costing_run_id, status, quotation_date, valid_until, currency, grand_total')
    .eq('id', quotationId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Quotation not found.')
  return data
}

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const quotationId = new URL(request.url).searchParams.get('quotationId')
    if (!quotationId) return NextResponse.json({ error: 'quotationId is required.' }, { status: 400 })

    const quotation = await getQuotation(supabase, quotationId)
    const { data: gate, error: gateError } = await supabase
      .from('commercial_release_gates')
      .select('*')
      .eq('quotation_id', quotation.id)
      .maybeSingle()
    if (gateError) return NextResponse.json({ error: gateError.message }, { status: 500 })

    const [{ data: approvals }, { data: payments }] = await Promise.all([
      supabase.from('project_approvals').select('*').eq('quotation_id', quotation.id).order('created_at', { ascending: false }),
      supabase.from('payments').select('*').eq('quotation_id', quotation.id).order('payment_date', { ascending: false }),
    ])

    return NextResponse.json({ quotation, gate, approvals: approvals ?? [], payments: payments ?? [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load commercial state.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const body = await request.json() as Record<string, unknown>
    const action = requiredString(body.action, 'action').toLowerCase()
    const quotationId = requiredString(body.quotationId, 'quotationId')
    const quotation = await getQuotation(supabase, quotationId)

    if (action === 'quotation_status') {
      const status = requiredString(body.status, 'status').toUpperCase()
      if (!quotationStatuses.has(status)) throw new Error('Unsupported quotation commercial status.')

      const patch: Record<string, unknown> = { status }
      const now = new Date().toISOString()
      if (['ISSUED', 'SENT', 'VIEWED'].includes(status)) patch.issued_at = now
      if (status === 'ACCEPTED') {
        if (quotation.valid_until && quotation.valid_until < now.slice(0, 10)) throw new Error('Quotation has expired and cannot be accepted.')
        patch.accepted_at = now
      }
      if (status === 'REJECTED') patch.rejected_at = now
      if (status === 'EXPIRED') patch.expired_at = now

      const { data, error } = await supabase
        .from('quotations')
        .update(patch)
        .eq('id', quotation.id)
        .select('*')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 409 })
      return NextResponse.json({ quotation: data })
    }

    if (action === 'approve') {
      const approvedAmount = body.approvedAmount == null ? Number(quotation.grand_total) : nonNegative(body.approvedAmount, 'approvedAmount')
      if (approvedAmount > Number(quotation.grand_total)) throw new Error('Approved amount cannot exceed quotation grand total.')

      const approvalCode = requiredString(body.approvalCode, 'approvalCode')
      const approvalType = String(body.approvalType ?? 'CUSTOMER_APPROVAL').toUpperCase()
      if (!['CUSTOMER_APPROVAL', 'INTERNAL_APPROVAL', 'COMMERCIAL_APPROVAL'].includes(approvalType)) throw new Error('Unsupported approval type.')

      const { data, error } = await supabase
        .from('project_approvals')
        .insert({
          project_id: quotation.project_id,
          quotation_id: quotation.id,
          approval_code: approvalCode,
          status: 'APPROVED',
          approval_type: approvalType,
          approved_amount: approvedAmount,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          approval_method: body.approvalMethod == null ? null : String(body.approvalMethod),
          reference: body.reference == null ? null : String(body.reference),
          notes: body.notes == null ? null : String(body.notes),
        })
        .select('*')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 409 })
      return NextResponse.json({ approval: data }, { status: 201 })
    }

    if (action === 'payment') {
      const amount = Number(body.amount)
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Payment amount must be greater than zero.')
      const method = requiredString(body.paymentMethod, 'paymentMethod').toUpperCase()
      if (!paymentMethods.has(method)) throw new Error('Unsupported payment method.')
      const currency = String(body.currency ?? quotation.currency).toUpperCase()
      if (currency !== quotation.currency) throw new Error('Payment currency must match quotation currency.')

      let scheduleId: string | null = body.paymentScheduleId ? String(body.paymentScheduleId) : null
      if (scheduleId) {
        const { data: schedule, error: scheduleError } = await supabase
          .from('payment_schedules')
          .select('id, project_id, quotation_id, amount, status')
          .eq('id', scheduleId)
          .maybeSingle()
        if (scheduleError) throw new Error(scheduleError.message)
        if (!schedule || schedule.project_id !== quotation.project_id || schedule.quotation_id !== quotation.id) throw new Error('Payment schedule must belong to the same project and quotation.')
        if (schedule.status === 'CANCELLED') throw new Error('Cannot record payment against a cancelled payment schedule.')
      }

      const paymentCode = requiredString(body.paymentCode, 'paymentCode')
      const { data, error } = await supabase
        .from('payments')
        .insert({
          project_id: quotation.project_id,
          quotation_id: quotation.id,
          payment_schedule_id: scheduleId,
          payment_code: paymentCode,
          payment_date: body.paymentDate == null ? new Date().toISOString().slice(0, 10) : String(body.paymentDate),
          amount,
          currency,
          payment_method: method,
          reference_number: body.referenceNumber == null ? null : String(body.referenceNumber),
          status: 'RECEIVED',
          received_by: user.id,
          notes: body.notes == null ? null : String(body.notes),
        })
        .select('*')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 409 })
      return NextResponse.json({ payment: data }, { status: 201 })
    }

    if (action === 'verify_payment') {
      const paymentId = requiredString(body.paymentId, 'paymentId')
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .maybeSingle()
      if (paymentError) throw new Error(paymentError.message)
      if (!payment || payment.project_id !== quotation.project_id || payment.quotation_id !== quotation.id) throw new Error('Payment does not belong to the requested quotation.')
      if (!['RECEIVED', 'VERIFIED'].includes(payment.status)) throw new Error('Only received payments can be verified.')

      const { data, error } = await supabase
        .from('payments')
        .update({ status: 'VERIFIED', verified_by: user.id, verified_at: new Date().toISOString() })
        .eq('id', payment.id)
        .select('*')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 409 })
      return NextResponse.json({ payment: data })
    }

    if (action === 'release') {
      const { data: gate, error: gateError } = await supabase
        .from('commercial_release_gates')
        .select('*')
        .eq('quotation_id', quotation.id)
        .maybeSingle()
      if (gateError) throw new Error(gateError.message)
      if (!gate) throw new Error('Commercial release gate not found.')

      const { error: refreshError } = await supabase.rpc('refresh_commercial_release_gate', { p_quotation_id: quotation.id })
      if (refreshError) return NextResponse.json({ error: refreshError.message }, { status: 409 })

      const { data: refreshed, error: refreshedError } = await supabase
        .from('commercial_release_gates')
        .select('*')
        .eq('id', gate.id)
        .single()
      if (refreshedError) throw new Error(refreshedError.message)
      if (refreshed.status !== 'READY') return NextResponse.json({ error: 'Commercial gate is not ready for release.', gate: refreshed }, { status: 409 })

      const { data: released, error: releaseError } = await supabase
        .from('commercial_release_gates')
        .update({ status: 'RELEASED', released_by: user.id, released_at: new Date().toISOString() })
        .eq('id', gate.id)
        .select('*')
        .single()
      if (releaseError) return NextResponse.json({ error: releaseError.message }, { status: 409 })
      return NextResponse.json({ gate: released })
    }

    if (action === 'refresh') {
      const { error } = await supabase.rpc('refresh_commercial_release_gate', { p_quotation_id: quotation.id })
      if (error) return NextResponse.json({ error: error.message }, { status: 409 })
      const { data: gate, error: gateError } = await supabase.from('commercial_release_gates').select('*').eq('quotation_id', quotation.id).maybeSingle()
      if (gateError) throw new Error(gateError.message)
      return NextResponse.json({ gate })
    }

    throw new Error(`Unsupported commercial action: ${action}`)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update commercial state.' }, { status: 400 })
  }
}
