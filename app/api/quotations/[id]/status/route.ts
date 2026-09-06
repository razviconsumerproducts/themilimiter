import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../../../lib/supabase-server'

const ALLOWED: Record<string, string[]> = {
  DRAFT: ['INTERNAL_REVIEW', 'CANCELLED'],
  INTERNAL_REVIEW: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['ISSUED', 'CANCELLED', 'SUPERSEDED'],
  ISSUED: ['SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'SUPERSEDED'],
  SENT: ['VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'SUPERSEDED'],
  VIEWED: ['ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'SUPERSEDED'],
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const { id } = await context.params
    const body = await request.json() as Record<string, unknown>
    const status = String(body.status ?? '').trim().toUpperCase()
    const reason = body.reason == null ? null : String(body.reason).trim()
    if (!status) return NextResponse.json({ error: 'status is required.' }, { status: 400 })

    const { data: quote, error: quoteError } = await supabase
      .from('quotations').select('id,status,issued_at,accepted_at,rejected_at,expired_at').eq('id', id).maybeSingle()
    if (quoteError) return NextResponse.json({ error: quoteError.message }, { status: 500 })
    if (!quote) return NextResponse.json({ error: 'Quotation not found.' }, { status: 404 })
    if (!ALLOWED[quote.status]?.includes(status)) {
      return NextResponse.json({ error: `Invalid quotation transition: ${quote.status} -> ${status}` }, { status: 409 })
    }

    const now = new Date().toISOString()
    const patch: Record<string, unknown> = { status, updated_at: now }
    if (status === 'APPROVED') patch.approved_by = user.id
    if (['ISSUED', 'SENT', 'VIEWED'].includes(status)) patch.issued_at = quote.issued_at ?? now
    if (status === 'ACCEPTED') patch.accepted_at = now
    if (status === 'REJECTED') patch.rejected_at = now
    if (status === 'EXPIRED') patch.expired_at = now

    const { data: updated, error } = await supabase.from('quotations').update(patch).eq('id', id).eq('status', quote.status).select('*').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 409 })

    if (reason) {
      await supabase.from('quotation_status_history').update({ reason }).eq('quotation_id', id).eq('to_status', status).order('changed_at', { ascending: false }).limit(1)
    }

    return NextResponse.json({ quotation: updated })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update quotation status.' }, { status: 400 })
  }
}
