import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../../../lib/supabase-server'

const ALLOWED: Record<string, string[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['APPROVED', 'CANCELLED'],
  APPROVED: ['ORDERED', 'CANCELLED'],
  ORDERED: ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
  PARTIALLY_RECEIVED: ['RECEIVED'],
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const { id } = await context.params
    const body = await request.json() as Record<string, unknown>
    const status = String(body.status ?? '').trim().toUpperCase()
    if (!status) return NextResponse.json({ error: 'status is required.' }, { status: 400 })

    const { data: requestRow, error: loadError } = await supabase
      .from('purchase_requests').select('id,status,project_id').eq('id', id).maybeSingle()
    if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 })
    if (!requestRow) return NextResponse.json({ error: 'Purchase request not found.' }, { status: 404 })
    if (!ALLOWED[requestRow.status]?.includes(status)) {
      return NextResponse.json({ error: `Invalid purchase request transition: ${requestRow.status} -> ${status}` }, { status: 409 })
    }

    const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
    if (status === 'APPROVED') {
      patch.approved_by = user.id
      patch.approved_at = new Date().toISOString()
    }

    const { data: updated, error } = await supabase
      .from('purchase_requests').update(patch).eq('id', id).eq('status', requestRow.status).select('*').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 409 })

    return NextResponse.json({ purchaseRequest: updated })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update purchase request status.' }, { status: 400 })
  }
}
