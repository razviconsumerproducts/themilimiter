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

    const accepted = Number(body.acceptedQty ?? body.acceptedQuantity ?? 0)
    const rejected = Number(body.rejectedQty ?? body.rejectedQuantity ?? 0)
    const hold = Number(body.holdQty ?? body.holdQuantity ?? 0)
    if (![accepted, rejected, hold].every(Number.isFinite) || accepted < 0 || rejected < 0 || hold < 0) {
      return NextResponse.json({ error: 'QC quantities must be non-negative.' }, { status: 400 })
    }

    const { data: item, error: itemError } = await supabase
      .from('goods_receipt_items')
      .select('id,goods_receipt_id,received_qty')
      .eq('id', itemId)
      .eq('goods_receipt_id', id)
      .maybeSingle()
    if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 })
    if (!item) return NextResponse.json({ error: 'Goods receipt item not found.' }, { status: 404 })

    const inspected = Number(body.inspectedQty ?? body.inspectedQuantity ?? item.received_qty)
    if (!Number.isFinite(inspected) || inspected !== Number(item.received_qty)) {
      return NextResponse.json({ error: 'Inspected quantity must equal received quantity.' }, { status: 409 })
    }
    if (accepted + rejected + hold !== inspected) {
      return NextResponse.json({ error: 'accepted + rejected + hold must equal inspected quantity.' }, { status: 400 })
    }

    const status = String(body.qcStatus ?? body.status ?? (accepted === inspected ? 'ACCEPTED' : hold > 0 ? 'HOLD' : accepted > 0 ? 'PARTIAL' : 'REJECTED')).toUpperCase()
    if (!['ACCEPTED','REJECTED','HOLD','PARTIAL'].includes(status)) return NextResponse.json({ error: 'QC status must be ACCEPTED, REJECTED, HOLD, or PARTIAL.' }, { status: 400 })
    if (rejected > 0 && !String(body.rejectionReason ?? '').trim()) return NextResponse.json({ error: 'rejectionReason is required when rejectedQty > 0.' }, { status: 400 })
    if (hold > 0 && !String(body.holdReason ?? '').trim()) return NextResponse.json({ error: 'holdReason is required when holdQty > 0.' }, { status: 400 })

    const { data: updated, error } = await supabase
      .from('goods_receipt_items')
      .update({
        qc_status: status,
        accepted_qty: accepted,
        rejected_qty: rejected,
        hold_qty: hold,
        rejection_reason: rejected > 0 ? String(body.rejectionReason).trim() : null,
        hold_reason: hold > 0 ? String(body.holdReason).trim() : null,
        qc_notes: body.qcNotes == null ? null : String(body.qcNotes),
      })
      .eq('id', item.id)
      .eq('goods_receipt_id', id)
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 409 })

    await supabase.from('goods_receipts').update({ status: 'QC_PENDING' }).eq('id', id).eq('status', 'RECEIVED')
    return NextResponse.json({ goodsReceiptItem: updated, changedBy: user.id }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to record goods receipt QC.' }, { status: 400 })
  }
}
