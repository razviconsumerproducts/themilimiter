import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../lib/supabase-server'

const required = (value: unknown, field: string) => {
  const v = String(value ?? '').trim()
  if (!v) throw new Error(`${field} is required.`)
  return v
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const projectId = new URL(request.url).searchParams.get('projectId')
  let query = supabase.from('goods_receipts').select('*, goods_receipt_items(*)').order('received_at', { ascending: false })
  if (projectId) {
    query = supabase
      .from('goods_receipts')
      .select('*, goods_receipt_items(*), purchase_orders!inner(rfq_id, millimetre_rfqs!inner(project_id))')
      .eq('purchase_orders.millimetre_rfqs.project_id', projectId)
      .order('received_at', { ascending: false })
  }
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ goodsReceipts: data ?? [] })
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const body = await request.json() as Record<string, unknown>
    const purchaseOrderId = required(body.purchaseOrderId, 'purchaseOrderId')
    const receiptNo = required(body.receiptNo ?? body.receiptCode, 'receiptNo')
    const warehouseId = required(body.warehouseId, 'warehouseId')
    const rawItems = Array.isArray(body.items) ? body.items : []
    if (!rawItems.length) return NextResponse.json({ error: 'At least one receipt item is required.' }, { status: 400 })

    const { data: po, error: poError } = await supabase.from('purchase_orders').select('id,status').eq('id', purchaseOrderId).maybeSingle()
    if (poError) return NextResponse.json({ error: poError.message }, { status: 500 })
    if (!po) return NextResponse.json({ error: 'Purchase order not found.' }, { status: 404 })
    if (String(po.status).toUpperCase() !== 'SENT') return NextResponse.json({ error: 'Purchase order must be SENT before goods receipt.' }, { status: 409 })

    const items: Array<Record<string, unknown>> = []
    for (let index = 0; index < rawItems.length; index++) {
      const item = rawItems[index] as Record<string, unknown>
      const purchaseOrderItemId = required(item.purchaseOrderItemId, `items[${index}].purchaseOrderItemId`)
      const receivedQty = Number(item.receivedQty ?? item.receivedQuantity)
      if (!Number.isFinite(receivedQty) || receivedQty <= 0) throw new Error(`items[${index}].receivedQty must be greater than zero.`)
      const { data: poItem, error: poItemError } = await supabase
        .from('purchase_order_items')
        .select('id,product_id')
        .eq('id', purchaseOrderItemId)
        .eq('purchase_order_id', purchaseOrderId)
        .maybeSingle()
      if (poItemError) throw new Error(poItemError.message)
      if (!poItem) throw new Error(`items[${index}] purchase order item does not belong to the purchase order.`)
      items.push({
        purchase_order_item_id: poItem.id,
        product_id: poItem.product_id,
        received_qty: receivedQty,
        accepted_qty: 0,
        rejected_qty: 0,
        hold_qty: 0,
        qc_status: 'PENDING',
        qc_notes: item.qcNotes == null ? null : String(item.qcNotes),
      })
    }

    const { data: receipt, error: receiptError } = await supabase.from('goods_receipts').insert({
      purchase_order_id: purchaseOrderId,
      warehouse_id: warehouseId,
      receipt_no: receiptNo,
      received_at: body.receivedAt == null ? new Date().toISOString() : String(body.receivedAt),
      status: 'DRAFT',
      supplier_document_no: body.supplierDocumentNo == null ? null : String(body.supplierDocumentNo),
      received_by: user.id,
      notes: body.notes == null ? null : String(body.notes),
    }).select('*').single()
    if (receiptError) return NextResponse.json({ error: receiptError.message }, { status: 409 })

    const { data: inserted, error: itemError } = await supabase.from('goods_receipt_items').insert(items.map(item => ({ ...item, goods_receipt_id: receipt.id }))).select('*')
    if (itemError) {
      await supabase.from('goods_receipts').delete().eq('id', receipt.id)
      return NextResponse.json({ error: itemError.message }, { status: 409 })
    }

    const { data: receivedReceipt, error: statusError } = await supabase.from('goods_receipts').update({ status: 'RECEIVED' }).eq('id', receipt.id).eq('status', 'DRAFT').select('*').single()
    if (statusError) return NextResponse.json({ error: statusError.message }, { status: 409 })
    return NextResponse.json({ goodsReceipt: receivedReceipt, items: inserted ?? [] }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create goods receipt.' }, { status: 400 })
  }
}
