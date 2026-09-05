import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../../lib/supabase-server'
import { createCalculationRun } from '../../../../lib/millimetre'
import type { CalculationInput } from '../../../../lib/millimetre'

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const input = await request.json() as CalculationInput
    if (!input?.furniture?.projectId || !input?.furniture?.id) {
      return NextResponse.json({ error: 'furniture.projectId and furniture.id are required.' }, { status: 400 })
    }

    const run = createCalculationRun(input)
    const { data, error } = await supabase.rpc('persist_calculation_run', {
      p_project_id: run.projectId,
      p_furniture_item_id: run.furnitureId,
      p_engine_version: run.engineVersion,
      p_input_snapshot: run.inputSnapshot,
      p_result: run.outputSnapshot,
      p_status: run.status === 'COMPLETED' ? 'valid' : 'invalid',
      p_warnings: run.warnings,
      p_errors: run.errors,
      p_calculated_at: run.calculatedAt,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ run: { ...run, persistence: data } }, { status: run.status === 'COMPLETED' ? 201 : 422 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create calculation run.' }, { status: 500 })
  }
}
