import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../../../lib/supabase-server'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    const { id } = await context.params
    const body = await request.json() as Record<string, unknown>
    const itemId = String(body.goodsReceiptItemId ?? '').trim()
    if (!itemId) return NextResponse.json({ error: 'goodsReceiptItemId is required.' }, { status: 400 })

    const inspected = Number(body.inspectedQty ?? body.inspectedQuantity)
    const accepted = Number(body.acceptedQty ?? body.acceptedQuantity)
    const rejected = Number(body.rejectedQty ?? body.rejectedQuantity)
    const hold = Number(body.holdQty ?? body.holdQuantity)
    if (![inspected, accepted, rejected, hold].every(Number.isFinite) || inspected <= 0 || accepted < 0 || rejected < 0 || hold < 0 || accepted + rejected + hold !== inspected) {
      return NextResponse.json({ error: 'QC quantities must be valid and accepted + rejected + hold must equal inspected.' }, { status: 400 })
    }

    const { data: item, error: itemError } = await supabase.from('goods_receipt_items').select('id,goods_receipt_id,received_qty,project_id,qc_status').eq('id', itemId).eq('goods_receipt_id', id).maybeSingle()
    if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 })
    if (!item) return NextResponse.json({ error: 'Goods receipt item not found.' }, { status: 404 })
    if (inspected !== Number(item.received_qty)) return NextResponse.json({ error: 'Inspected quantity must equal received quantity.' }, { status: 409 })

    const status = String(body.status ?? (accepted === inspected ? 'ACCEPTED' : hold > 0 ? 'HOLD' : accepted > 0 ? 'PARTIAL' : 'REJECTED')).toUpperCase()
    if (!['PENDING','ACCEPTED','REJECTED','HOLD','PARTIAL'].includes(status)) return NextResponse.json({ error: 'Invalid QC status.' }, { status: 400 })

    const { data: updated, error } = await supabase.from('goods_receipt_items').update({
      qc_status: status,
      accepted_qty: accepted,
      rejected_qty: rejected,
      hold_qty: hold,
      rejection_reason: rejected > 0 ? (body.rejectionReason == null ? null : String(body.rejectionReason)) : null,
      hold_reason: hold > 0 ? (body.holdReason == null ? null : String(body.holdReason)) : null,
      qc_notes: body.qcNotes == null ? null : String(body.qcNotes),
      qc_by: user.id,
      qc_at: new Date().toISOString(),
    }).eq('id', item.id).eq('goods_receipt_id', id).select('*').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 409 })
    return NextResponse.json({ goodsReceiptItem: updated }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to record goods receipt QC.' }, { status: 400 })
  }
}
