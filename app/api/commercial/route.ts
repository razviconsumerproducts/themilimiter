import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../lib/supabase-server'

const quotationStatuses = new Set(['draft', 'approved', 'sent', 'accepted', 'rejected', 'expired', 'cancelled'])
const paymentMethods = new Set(['BANK_TRANSFER', 'UPI', 'CARD', 'CASH', 'CHEQUE', 'OTHER'])

function requiredString(value: unknown, field: string): string {
  const result = String(value ?? '').trim()
  if (!result) throw new Error(`${field} is required.`)
  return result
}

function nonNegative(value: unknown, field: string): number {
  const result = Number(value)
  if (!Number.isFinite(result) || result < 0) throw new Error(`${field} must be non-negative.`)
  return result
}

async function getQuotation(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, quotationId: string) {
  const { data, error } = await supabase
    .from('millimetre_quotations')
    .select('id,project_id,costing_run_id,quotation_no,version,status,quotation_date,valid_until,currency,subtotal,discount,tax,grand_total,approved_at,approved_by,issued_at,issued_by')
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
    const [{ data: approval, error: approvalError }, { data: milestones, error: milestoneError }] = await Promise.all([
      supabase.from('millimetre_quotation_approvals').select('*').eq('quotation_id', quotation.id).maybeSingle(),
      supabase.from('millimetre_payment_milestones').select('*').eq('quotation_id', quotation.id).order('milestone_no', { ascending: true }),
    ])
    if (approvalError) return NextResponse.json({ error: approvalError.message }, { status: 500 })
    if (milestoneError) return NextResponse.json({ error: milestoneError.message }, { status: 500 })

    const milestoneIds = (milestones ?? []).map(m => m.id)
    const { data: payments, error: paymentError } = milestoneIds.length
      ? await supabase.from('millimetre_payment_records').select('*').in('milestone_id', milestoneIds).order('payment_date', { ascending: false })
      : { data: [], error: null }
    if (paymentError) return NextResponse.json({ error: paymentError.message }, { status: 500 })

    return NextResponse.json({ quotation, approval, paymentMilestones: milestones ?? [], payments: payments ?? [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load commercial state.' }, { status: 400 })
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
      const status = requiredString(body.status, 'status').toLowerCase()
      if (!quotationStatuses.has(status)) throw new Error('Unsupported quotation status.')
      const { data, error } = await supabase.from('millimetre_quotations').update({ status }).eq('id', quotation.id).select('*').single()
      if (error) return NextResponse.json({ error: error.message }, { status: 409 })
      return NextResponse.json({ quotation: data })
    }

    if (action === 'approve') {
      if (!['sent', 'approved'].includes(String(quotation.status).toLowerCase())) throw new Error('Quotation must be sent before customer approval.')
      const customerName = requiredString(body.customerName, 'customerName')
      const { data, error } = await supabase.from('millimetre_quotation_approvals').upsert({
        quotation_id: quotation.id,
        status: 'ACCEPTED',
        customer_name: customerName,
        customer_reference: body.customerReference == null ? null : String(body.customerReference),
        approved_at: new Date().toISOString(),
        approved_by: user.id,
        rejection_reason: null,
      }, { onConflict: 'quotation_id' }).select('*').single()
      if (error) return NextResponse.json({ error: error.message }, { status: 409 })
      return NextResponse.json({ approval: data }, { status: 201 })
    }

    if (action === 'reject') {
      const reason = requiredString(body.rejectionReason, 'rejectionReason')
      const { data, error } = await supabase.from('millimetre_quotation_approvals').upsert({
        quotation_id: quotation.id,
        status: 'REJECTED',
        rejection_reason: reason,
        approved_at: null,
        approved_by: null,
      }, { onConflict: 'quotation_id' }).select('*').single()
      if (error) return NextResponse.json({ error: error.message }, { status: 409 })
      return NextResponse.json({ approval: data }, { status: 201 })
    }

    if (action === 'milestone') {
      const milestoneNo = Number(body.milestoneNo)
      if (!Number.isInteger(milestoneNo) || milestoneNo <= 0) throw new Error('milestoneNo must be a positive integer.')
      const amount = nonNegative(body.amount, 'amount')
      const percentage = nonNegative(body.percentage, 'percentage')
      if (percentage > 100) throw new Error('percentage cannot exceed 100.')
      const name = requiredString(body.name, 'name')
      const { data, error } = await supabase.from('millimetre_payment_milestones').insert({
        project_id: quotation.project_id,
        quotation_id: quotation.id,
        milestone_no: milestoneNo,
        name,
        due_date: body.dueDate == null ? null : String(body.dueDate),
        percentage,
        amount,
        status: 'PENDING',
      }).select('*').single()
      if (error) return NextResponse.json({ error: error.message }, { status: 409 })
      return NextResponse.json({ milestone: data }, { status: 201 })
    }

    if (action === 'payment') {
      const milestoneId = requiredString(body.milestoneId ?? body.paymentScheduleId, 'milestoneId')
      const amount = Number(body.amount)
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Payment amount must be greater than zero.')
      const method = requiredString(body.paymentMethod, 'paymentMethod').toUpperCase()
      if (!paymentMethods.has(method)) throw new Error('Unsupported payment method.')

      const { data: milestone, error: milestoneError } = await supabase
        .from('millimetre_payment_milestones')
        .select('id,project_id,quotation_id,status,amount')
        .eq('id', milestoneId)
        .maybeSingle()
      if (milestoneError) throw new Error(milestoneError.message)
      if (!milestone || milestone.project_id !== quotation.project_id || milestone.quotation_id !== quotation.id) throw new Error('Payment milestone does not belong to this quotation.')
      if (milestone.status === 'CANCELLED' || milestone.status === 'PAID') throw new Error('Payment milestone is not payable.')

      const { data, error } = await supabase.from('millimetre_payment_records').insert({
        milestone_id: milestone.id,
        project_id: quotation.project_id,
        amount,
        payment_date: body.paymentDate == null ? new Date().toISOString().slice(0, 10) : String(body.paymentDate),
        method,
        reference_no: body.referenceNumber == null ? null : String(body.referenceNumber),
        status: 'RECEIVED',
        notes: body.notes == null ? null : String(body.notes),
        recorded_by: user.id,
      }).select('*').single()
      if (error) return NextResponse.json({ error: error.message }, { status: 409 })
      return NextResponse.json({ payment: data }, { status: 201 })
    }

    throw new Error(`Unsupported commercial action: ${action}`)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update commercial state.' }, { status: 400 })
  }
}
