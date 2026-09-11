import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../lib/supabase-server'

const TRANSITIONS: Record<string, string[]> = {
  draft: ['approved'],
  approved: ['issued'],
  issued: ['superseded'],
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
  const { data: current, error: readError } = await supabase.from('cutting_lists').select('id,project_id,status').eq('id', body.id).single()
  if (readError || !current) return NextResponse.json({ error: readError?.message ?? 'Cutting list not found.' }, { status: 404 })
  if (!TRANSITIONS[current.status]?.includes(body.status)) return NextResponse.json({ error: `Invalid transition ${current.status} → ${body.status}.` }, { status: 409 })
  const { data, error } = await supabase.from('cutting_lists').update({ status: body.status, updated_at: new Date().toISOString() }).eq('id', body.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ cuttingList: data })
}
