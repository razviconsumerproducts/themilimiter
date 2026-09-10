import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../../../lib/supabase-server'

const transitions: Record<string, string[]> = {
  DRAFT: ['RECEIVED', 'CANCELLED'],
  RECEIVED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    const { id } = await context.params
    const body = await request.json() as Record<string, unknown>
    const next = String(body.status ?? '').trim().toUpperCase()
    if (!next) return NextResponse.json({ error: 'status is required.' }, { status: 400 })
    const { data: receipt, error: loadError } = await supabase.from('goods_receipts').select('id,status,project_id').eq('id', id).maybeSingle()
    if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 })
    if (!receipt) return NextResponse.json({ error: 'Goods receipt not found.' }, { status: 404 })
    if (!(transitions[String(receipt.status).toUpperCase()] ?? []).includes(next)) return NextResponse.json({ error: `Invalid goods receipt transition: ${receipt.status} -> ${next}` }, { status: 409 })
    if (next === 'COMPLETED') {
      const { error } = await supabase.rpc('post_goods_receipt', { p_receipt_id: id })
      if (error) return NextResponse.json({ error: error.message }, { status: 409 })
      const { data: updated } = await supabase.from('goods_receipts').select('*').eq('id', id).single()
      return NextResponse.json({ goodsReceipt: updated, changedBy: user.id })
    }
    const { data: updated, error } = await supabase.from('goods_receipts').update({ status: next, updated_at: new Date().toISOString() }).eq('id', id).eq('status', receipt.status).select('*').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 409 })
    return NextResponse.json({ goodsReceipt: updated, changedBy: user.id })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update goods receipt status.' }, { status: 400 })
  }
}
