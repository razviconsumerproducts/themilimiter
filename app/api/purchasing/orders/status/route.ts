import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../../../../lib/supabase-server'

const TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'CANCELLED'],
  APPROVED: ['SENT', 'CANCELLED'],
  SENT: ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
  PARTIALLY_RECEIVED: ['RECEIVED', 'CLOSED', 'CANCELLED'],
  RECEIVED: ['CLOSED', 'CANCELLED'],
  CLOSED: [],
  CANCELLED: [],
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const body = await request.json() as Record<string, unknown>
    const purchaseOrderId = String(body.purchaseOrderId ?? '').trim()
    const nextStatus = String(body.status ?? '').trim().toUpperCase()
    if (!purchaseOrderId || !nextStatus) return NextResponse.json({ error: 'purchaseOrderId and status are required.' }, { status: 400 })

    const { data: order, error: orderError } = await supabase
      .from('purchase_orders')
      .select('id, project_id, purchase_request_id, status')
      .eq('id', purchaseOrderId)
      .maybeSingle()
    if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 })
    if (!order) return NextResponse.json({ error: 'Purchase order not found.' }, { status: 404 })

    if (!(TRANSITIONS[order.status] ?? []).includes(nextStatus)) {
      return NextResponse.json({ error: `Invalid purchase order transition: ${order.status} → ${nextStatus}.` }, { status: 409 })
    }

    if (nextStatus === 'APPROVED' || nextStatus === 'SENT') {
      const { data: requestRow } = await supabase
        .from('purchase_requests')
        .select('id, project_id, status')
        .eq('id', order.purchase_request_id)
        .maybeSingle()
      if (!requestRow || requestRow.project_id !== order.project_id || !['APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED'].includes(requestRow.status)) {
        return NextResponse.json({ error: 'Purchase order requires an approved purchase request.' }, { status: 409 })
      }

      const { data: gate } = await supabase
        .from('commercial_release_gates')
        .select('id, project_id, status, quotation_id')
        .eq('project_id', order.project_id)
        .eq('status', 'RELEASED')
        .limit(1)
        .maybeSingle()
      if (!gate) return NextResponse.json({ error: 'Purchase order requires a released commercial gate.' }, { status: 409 })
    }

    const { data: updated, error: updateError } = await supabase
      .from('purchase_orders')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', purchaseOrderId)
      .eq('status', order.status)
      .select('id, project_id, purchase_request_id, po_code, status, currency, subtotal, tax, total, order_date, expected_date, approved_by, approved_at, created_at, updated_at')
      .maybeSingle()
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 409 })
    if (!updated) return NextResponse.json({ error: 'Purchase order changed concurrently; retry the transition.' }, { status: 409 })

    return NextResponse.json({ purchaseOrder: updated })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update purchase order status.' }, { status: 400 })
  }
}
