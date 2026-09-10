import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../../../lib/supabase-server'

const transitions: Record<string, string[]> = {
  draft: ['approved'],
  approved: ['issued'],
  issued: ['superseded'],
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const body = await request.json() as Record<string, unknown>
    const bomId = String(body.bomId ?? '').trim()
    const nextStatus = String(body.status ?? '').trim().toLowerCase()
    if (!bomId || !nextStatus) return NextResponse.json({ error: 'bomId and status are required.' }, { status: 400 })

    const { data: bom, error: readError } = await supabase
      .from('millimetre_boms')
      .select('id,project_id,status,calculation_run_id')
      .eq('id', bomId)
      .maybeSingle()
    if (readError) throw new Error(readError.message)
    if (!bom) return NextResponse.json({ error: 'BOM not found.' }, { status: 404 })

    if (!transitions[bom.status]?.includes(nextStatus)) {
      return NextResponse.json({ error: `Invalid BOM transition: ${bom.status} → ${nextStatus}.` }, { status: 409 })
    }

    if (nextStatus === 'approved' || nextStatus === 'issued') {
      const { count, error: countError } = await supabase
        .from('millimetre_bom_items')
        .select('id', { count: 'exact', head: true })
        .eq('bom_id', bom.id)
      if (countError) throw new Error(countError.message)
      if (!count) return NextResponse.json({ error: 'BOM must contain at least one item.' }, { status: 409 })
    }

    const patch: Record<string, unknown> = { status: nextStatus }
    if (nextStatus === 'approved') { patch.approved_by = user.id; patch.approved_at = new Date().toISOString() }
    if (nextStatus === 'issued') { patch.issued_by = user.id; patch.issued_at = new Date().toISOString() }

    const { data: updated, error: updateError } = await supabase
      .from('millimetre_boms')
      .update(patch)
      .eq('id', bom.id)
      .eq('status', bom.status)
      .select('*')
      .single()
    if (updateError) throw new Error(updateError.message)

    return NextResponse.json({ bom: updated })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update BOM status.' }, { status: 400 })
  }
}
