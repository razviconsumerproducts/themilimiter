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
    query = query.in('purchase_order_id', (await supabase.from('purchase_orders').select('id').eq('rfq_id', projectId)).data?.map(x => x.id) ?? [])
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

    const { data: po, error: poError } = await supabase.from('purchase_orders').select('id,rfq_id,status').eq('id', purchaseOrderId).maybeSingle()
    if (poError) return NextResponse.json({ error: poError.message }, { status: 500 })
    if (!po) return NextResponse.json({ error: 'Purchase order not found.' }, { status: 404 })
    if (!['APPROVED','SENT'].includes(String(po.status).toUpperCase())) return NextResponse.json({ error: 'Purchase order must be approved or sent before receipt.' }, { status: 409 })

    const items = rawItems.map((raw, index) => {
      const item = raw as Record<string, unknown>
      const received = Number(item.receivedQty ?? item.receivedQuantity)
      if (!Number.isFinite(received) || received <= 0) throw new Error(`items[${index}].receivedQty must be greater than zero.`)
      const accepted = item.acceptedQty == null ? 0 : Number(item.acceptedQty)
      const rejected = item.rejectedQty == null ? 0 : Number(item.rejectedQty)
      const hold = item.holdQty == null ? 0 : Number(item.holdQty)
      if (![accepted, rejected, hold].every(Number.isFinite) || accepted < 0 || rejected < 0 || hold < 0 || accepted + rejected + hold !== received) throw new Error(`items[${index}] quantities must satisfy accepted + rejected + hold = received.`)
      const productId = required(item.productId, `items[${index}].productId`)
      return {
        goods_receipt_id: '',
        purchase_order_item_id: required(item.purchaseOrderItemId, `items[${index}].purchaseOrderItemId`),
        product_id: productId,
        received_qty: received,
        accepted_qty: accepted,
        rejected_qty: rejected,
        hold_qty: hold,
        qc_status: String(item.qcStatus ?? (accepted === received ? 'ACCEPTED' : hold > 0 ? 'HOLD' : accepted > 0 ? 'PARTIAL' : 'REJECTED')).toUpperCase(),
        qc_notes: item.qcNotes == null ? null : String(item.qcNotes),
        rejection_reason: rejected > 0 ? required(item.rejectionReason, `items[${index}].rejectionReason`) : null,
        hold_reason: hold > 0 ? required(item.holdReason, `items[${index}].holdReason`) : null,
      }
    })

    const { data: receipt, error: receiptError } = await supabase.from('goods_receipts').insert({
      purchase_order_id: purchaseOrderId,
      warehouse_id: warehouseId,
      receipt_no: receiptNo,
      received_at: body.receivedAt == null ? new Date().toISOString() : String(body.receivedAt),
      status: 'RECEIVED',
      supplier_document_no: body.supplierDocumentNo == null ? null : String(body.supplierDocumentNo),
      received_by: user.id,
      notes: body.notes == null ? null : String(body.notes),
    }).select('*').single()
    if (receiptError) return NextResponse.json({ error: receiptError.message }, { status: 409 })

    const dbItems = items.map(({ goods_receipt_id: _, ...item }) => ({ ...item, goods_receipt_id: receipt.id }))
    const { data: inserted, error: itemError } = await supabase.from('goods_receipt_items').insert(dbItems).select('*')
    if (itemError) return NextResponse.json({ error: itemError.message }, { status: 409 })
    return NextResponse.json({ goodsReceipt: receipt, items: inserted ?? [] }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create goods receipt.' }, { status: 400 })
  }
}
