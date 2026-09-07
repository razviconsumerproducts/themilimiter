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

    const inspected = Number(body.inspectedQuantity)
    const accepted = Number(body.acceptedQuantity)
    const rejected = Number(body.rejectedQuantity)
    const hold = Number(body.holdQuantity)
    if (![inspected, accepted, rejected, hold].every(Number.isFinite) || inspected < 0 || accepted < 0 || rejected < 0 || hold < 0 || accepted + rejected + hold !== inspected) {
      return NextResponse.json({ error: 'QC quantities must be non-negative and accepted + rejected + hold must equal inspected.' }, { status: 400 })
    }

    const { data: item, error: itemError } = await supabase.from('goods_receipt_items').select('id,goods_receipt_id,received_quantity,project_id').eq('id', itemId).eq('goods_receipt_id', id).maybeSingle()
    if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 })
    if (!item) return NextResponse.json({ error: 'Goods receipt item not found.' }, { status: 404 })
    if (inspected !== Number(item.received_quantity)) return NextResponse.json({ error: 'Inspected quantity must equal received quantity before QC completion.' }, { status: 409 })

    const status = String(body.status ?? (accepted === inspected ? 'PASS' : hold > 0 ? 'HOLD' : accepted > 0 ? 'PARTIAL' : 'FAIL')).toUpperCase()
    if (!['PENDING','PASS','PARTIAL','FAIL','HOLD'].includes(status)) return NextResponse.json({ error: 'Invalid QC status.' }, { status: 400 })

    const { data: qc, error } = await supabase.from('goods_receipt_qc').insert({
      goods_receipt_item_id: item.id,
      status,
      inspected_quantity: inspected,
      accepted_quantity: accepted,
      rejected_quantity: rejected,
      hold_quantity: hold,
      defect_code: body.defectCode == null ? null : String(body.defectCode),
      remarks: body.remarks == null ? null : String(body.remarks),
      inspected_by: user.id,
      inspected_at: new Date().toISOString(),
    }).select('*').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 409 })
    return NextResponse.json({ qc }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to record goods receipt QC.' }, { status: 400 })
  }
}
