import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../../../lib/supabase-server'

const ALLOWED: Record<string, string[]> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'CANCELLED'],
  APPROVED: ['SENT', 'CANCELLED'],
  SENT: ['PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED'],
  PARTIALLY_RECEIVED: ['RECEIVED', 'CLOSED'],
  RECEIVED: ['CLOSED'],
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const { id } = await context.params
    const body = await request.json() as Record<string, unknown>
    const status = String(body.status ?? '').trim().toUpperCase()
    if (!status) return NextResponse.json({ error: 'status is required.' }, { status: 400 })

    const { data: order, error: loadError } = await supabase
      .from('purchase_orders').select('id,status,project_id').eq('id', id).maybeSingle()
    if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 })
    if (!order) return NextResponse.json({ error: 'Purchase order not found.' }, { status: 404 })
    if (!ALLOWED[order.status]?.includes(status)) {
      return NextResponse.json({ error: `Invalid purchase order transition: ${order.status} -> ${status}` }, { status: 409 })
    }

    const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
    if (status === 'APPROVED') {
      patch.approved_by = user.id
      patch.approved_at = new Date().toISOString()
    }
    if (status === 'SENT') patch.order_date = body.orderDate == null ? new Date().toISOString().slice(0, 10) : String(body.orderDate)

    const { data: updated, error } = await supabase
      .from('purchase_orders').update(patch).eq('id', id).eq('status', order.status).select('*').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 409 })

    return NextResponse.json({ purchaseOrder: updated })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update purchase order status.' }, { status: 400 })
  }
}
