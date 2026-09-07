import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../../../lib/supabase-server'

const TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['CALCULATED'],
  CALCULATED: ['REVIEW'],
  REVIEW: ['APPROVED'],
  APPROVED: ['LOCKED', 'SUPERSEDED'],
  LOCKED: ['SUPERSEDED'],
  SUPERSEDED: [],
  CANCELLED: [],
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const body = await request.json() as Record<string, unknown>
    const costingRunId = String(body.costingRunId ?? '').trim()
    const nextStatus = String(body.status ?? '').trim().toUpperCase()
    if (!costingRunId || !nextStatus) return NextResponse.json({ error: 'costingRunId and status are required.' }, { status: 400 })

    const { data: run, error: runError } = await supabase
      .from('costing_runs')
      .select('id, project_id, bom_id, optimization_run_id, status')
      .eq('id', costingRunId)
      .maybeSingle()
    if (runError) return NextResponse.json({ error: runError.message }, { status: 500 })
    if (!run) return NextResponse.json({ error: 'Costing run not found.' }, { status: 404 })

    if (!(TRANSITIONS[run.status] ?? []).includes(nextStatus)) {
      return NextResponse.json({ error: `Invalid costing transition: ${run.status} → ${nextStatus}.` }, { status: 409 })
    }

    if (nextStatus === 'APPROVED' || nextStatus === 'LOCKED') {
      const { data: bom, error: bomError } = await supabase
        .from('boms')
        .select('id, project_id, calculation_run_id, status')
        .eq('id', run.bom_id)
        .maybeSingle()
      if (bomError) return NextResponse.json({ error: bomError.message }, { status: 500 })
      if (!bom || bom.project_id !== run.project_id || !['APPROVED', 'RELEASED'].includes(bom.status)) {
        return NextResponse.json({ error: 'Costing approval requires an approved or released BOM in the same project.' }, { status: 409 })
      }

      const { data: optimization, error: optimizationError } = await supabase
        .from('optimization_runs')
        .select('id, project_id, cutting_list_id, status')
        .eq('id', run.optimization_run_id)
        .maybeSingle()
      if (optimizationError) return NextResponse.json({ error: optimizationError.message }, { status: 500 })
      if (!optimization || optimization.project_id !== run.project_id || optimization.status !== 'APPROVED') {
        return NextResponse.json({ error: 'Costing approval requires an approved optimization run in the same project.' }, { status: 409 })
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from('costing_runs')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', costingRunId)
      .eq('status', run.status)
      .select('id, project_id, bom_id, optimization_run_id, costing_code, version, status, currency, subtotal, discount, tax, total_cost, margin, selling_price, created_at, updated_at')
      .maybeSingle()
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 409 })
    if (!updated) return NextResponse.json({ error: 'Costing run changed concurrently; retry the transition.' }, { status: 409 })

    return NextResponse.json({ costingRun: updated })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update costing status.' }, { status: 400 })
  }
}
