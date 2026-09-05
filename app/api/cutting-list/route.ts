import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../lib/supabase-server'

const REVIEWABLE = new Set(['GENERATED', 'REVIEW'])
const TRANSITIONS: Record<string, string[]> = {
  GENERATED: ['REVIEW'],
  REVIEW: ['APPROVED'],
  APPROVED: ['RELEASED'],
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const url = new URL(request.url)
  const projectId = url.searchParams.get('project_id')
  const cuttingListId = url.searchParams.get('id')
  let query = supabase.from('cutting_lists').select('*, cutting_list_items(*)').order('version', { ascending: false })
  if (cuttingListId) query = query.eq('id', cuttingListId)
  if (projectId) query = query.eq('project_id', projectId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ cuttingLists: data ?? [] })
}

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const body = await request.json() as { id?: string; status?: string }
  if (!body.id || !body.status) return NextResponse.json({ error: 'id and status are required.' }, { status: 400 })

  const { data: current, error: readError } = await supabase.from('cutting_lists').select('id,status').eq('id', body.id).single()
  if (readError || !current) return NextResponse.json({ error: readError?.message ?? 'Cutting list not found.' }, { status: 404 })
  if (!REVIEWABLE.has(current.status) && current.status !== 'APPROVED') return NextResponse.json({ error: `Cutting list is ${current.status} and cannot transition.` }, { status: 409 })
  if (!TRANSITIONS[current.status]?.includes(body.status)) return NextResponse.json({ error: `Invalid transition ${current.status} → ${body.status}.` }, { status: 409 })

  const patch: Record<string, unknown> = { status: body.status, updated_at: new Date().toISOString() }
  if (body.status === 'APPROVED') { patch.approved_by = user.id; patch.approved_at = new Date().toISOString() }
  if (body.status === 'RELEASED') { patch.released_by = user.id; patch.released_at = new Date().toISOString() }

  const { data, error } = await supabase.from('cutting_lists').update(patch).eq('id', body.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ cuttingList: data })
}
