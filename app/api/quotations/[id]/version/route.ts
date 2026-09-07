import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../../../lib/supabase-server'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const { id } = await context.params
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const reason = body.reason == null ? null : String(body.reason).trim() || null

    const { data: newId, error } = await supabase.rpc('create_quotation_version', {
      p_source_quotation_id: id,
      p_reason: reason,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 409 })

    const { data: quotation, error: quoteError } = await supabase
      .from('quotations').select('*').eq('id', newId).single()
    if (quoteError) return NextResponse.json({ error: quoteError.message }, { status: 500 })

    const { data: items, error: itemError } = await supabase
      .from('quotation_items').select('*').eq('quotation_id', newId).order('sort_order').order('id')
    if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 })

    return NextResponse.json({ quotation, items: items ?? [], created_by: user.id }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create quotation version.' }, { status: 400 })
  }
}
