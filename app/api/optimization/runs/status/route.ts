import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../../../lib/supabase-server'

const ALLOWED = new Set(['APPROVED', 'SUPERSEDED'])

export async function PATCH(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const body = await request.json() as Record<string, unknown>
    const runId = String(body.optimizationRunId ?? '').trim()
    const requestedStatus = String(body.status ?? '').trim().toUpperCase()
    if (!runId) return NextResponse.json({ error: 'optimizationRunId is required.' }, { status: 400 })
    if (!ALLOWED.has(requestedStatus)) return NextResponse.json({ error: 'Only APPROVED or SUPERSEDED transitions are supported.' }, { status: 400 })

    const { data: run, error: runError } = await supabase.from('optimization_runs').select('id,project_id,status,cutting_list_id').eq('id', runId).maybeSingle()
    if (runError) throw new Error(runError.message)
    if (!run) return NextResponse.json({ error: 'Optimization run not found.' }, { status: 404 })

    if (requestedStatus === 'APPROVED') {
      if (!['COMPLETED', 'APPROVED'].includes(run.status)) return NextResponse.json({ error: `Optimization run cannot be approved from ${run.status}.` }, { status: 409 })
      const { data: cuttingList, error: cuttingListError } = await supabase.from('cutting_lists').select('id,project_id,status').eq('id', run.cutting_list_id).maybeSingle()
      if (cuttingListError) throw new Error(cuttingListError.message)
      if (!cuttingList || cuttingList.project_id !== run.project_id || !['APPROVED', 'RELEASED'].includes(cuttingList.status)) return NextResponse.json({ error: 'Optimization can only be approved when its cutting list is approved or released.' }, { status: 409 })
      const { data, error } = await supabase.from('optimization_runs').update({ status: 'APPROVED', approved_by: user.id, approved_at: new Date().toISOString() }).eq('id', run.id).select('*').single()
      if (error) return NextResponse.json({ error: error.message }, { status: 409 })
      return NextResponse.json({ optimizationRun: data })
    }

    if (run.status !== 'APPROVED') return NextResponse.json({ error: `Optimization run cannot be superseded from ${run.status}.` }, { status: 409 })
    const { data, error } = await supabase.from('optimization_runs').update({ status: 'SUPERSEDED' }).eq('id', run.id).select('*').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 409 })
    return NextResponse.json({ optimizationRun: data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update optimization status.' }, { status: 400 })
  }
}
