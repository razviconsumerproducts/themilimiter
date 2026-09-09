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
  let query = supabase.from('goods_receipts').select('*, goods_receipt_items(*, goods_receipt_qc(*))').order('created_at', { ascending: false })
  if (projectId) query = query.eq('project_id', projectId)
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
    const projectId = required(body.projectId, 'projectId')
    const purchaseOrderId = required(body.purchaseOrderId, 'purchaseOrderId')
    const receiptCode = required(body.receiptCode, 'receiptCode')
    const rawItems = Array.isArray(body.items) ? body.items : []
    if (!rawItems.length) return NextResponse.json({ error: 'At least one receipt item is required.' }, { status: 400 })

    const { data: po, error: poError } = await supabase.from('purchase_orders').select('id,project_id,status').eq('id', purchaseOrderId).maybeSingle()
    if (poError) return NextResponse.json({ error: poError.message }, { status: 500 })
    if (!po || po.project_id !== projectId) return NextResponse.json({ error: 'Purchase order does not belong to the project.' }, { status: 409 })
    if (!['APPROVED','SENT','PARTIALLY_RECEIVED','RECEIVED'].includes(po.status)) return NextResponse.json({ error: 'Purchase order is not receivable in its current status.' }, { status: 409 })

    const items = rawItems.map((raw, index) => {
      const item = raw as Record<string, unknown>
      const received = Number(item.receivedQuantity)
      if (!Number.isFinite(received) || received <= 0) throw new Error(`items[${index}].receivedQuantity must be greater than zero.`)
      const accepted = item.acceptedQuantity == null ? 0 : Number(item.acceptedQuantity)
      const rejected = item.rejectedQuantity == null ? 0 : Number(item.rejectedQuantity)
      const hold = item.holdQuantity == null ? 0 : Number(item.holdQuantity)
      if (accepted < 0 || rejected < 0 || hold < 0 || accepted + rejected + hold !== received) throw new Error(`items[${index}] quantities must satisfy accepted + rejected + hold = received.`)
      return {
        project_id: projectId,
        purchase_order_item_id: required(item.purchaseOrderItemId, `items[${index}].purchaseOrderItemId`),
        item_code: required(item.itemCode, `items[${index}].itemCode`),
        description: required(item.description, `items[${index}].description`),
        ordered_quantity: Number(item.orderedQuantity),
        received_quantity: received,
        accepted_quantity: accepted,
        rejected_quantity: rejected,
        hold_quantity: hold,
        unit: required(item.unit, `items[${index}].unit`),
        notes: item.notes == null ? null : String(item.notes),
      }
    })

    const { data: receipt, error: receiptError } = await supabase.from('goods_receipts').insert({
      project_id: projectId,
      purchase_order_id: purchaseOrderId,
      receipt_code: receiptCode,
      receipt_date: body.receiptDate == null ? undefined : String(body.receiptDate),
      status: 'RECEIVED',
      supplier_document_no: body.supplierDocumentNo == null ? null : String(body.supplierDocumentNo),
      received_by: user.id,
      notes: body.notes == null ? null : String(body.notes),
    }).select('*').single()
    if (receiptError) return NextResponse.json({ error: receiptError.message }, { status: 409 })

    const dbItems = items.map(item => ({ ...item, goods_receipt_id: receipt.id }))
    const { data: inserted, error: itemError } = await supabase.from('goods_receipt_items').insert(dbItems).select('*')
    if (itemError) {
      await supabase.from('goods_receipts').delete().eq('id', receipt.id)
      return NextResponse.json({ error: itemError.message }, { status: 409 })
    }
    return NextResponse.json({ goodsReceipt: receipt, items: inserted ?? [] }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create goods receipt.' }, { status: 400 })
  }
}
