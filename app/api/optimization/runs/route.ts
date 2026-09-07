import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../../lib/supabase-server'
import { optimizeSheets, type CuttingPart, type Material } from '../../../../lib/millimetre'

function requiredString(value: unknown, field: string) {
  const result = String(value ?? '').trim()
  if (!result) throw new Error(`${field} is required.`)
  return result
}

function nonNegative(value: unknown, field: string) {
  const result = Number(value)
  if (!Number.isFinite(result) || result < 0) throw new Error(`${field} must be non-negative.`)
  return result
}

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    const projectId = new URL(request.url).searchParams.get('projectId')
    if (!projectId) return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })
    const { data, error } = await supabase.from('optimization_runs').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ optimizationRuns: data ?? [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load optimization runs.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const body = await request.json() as Record<string, unknown>
    const projectId = requiredString(body.projectId, 'projectId')
    const cuttingListId = requiredString(body.cuttingListId, 'cuttingListId')
    const optimizationCode = requiredString(body.optimizationCode, 'optimizationCode')
    const version = Number(body.version ?? 1)
    if (!Number.isInteger(version) || version < 1) throw new Error('version must be a positive integer.')
    const kerfMm = nonNegative(body.kerfMm ?? 3, 'kerfMm')
    const trimAllowanceMm = nonNegative(body.trimAllowanceMm ?? 10, 'trimAllowanceMm')

    const { data: cuttingList, error: listError } = await supabase
      .from('cutting_lists')
      .select('id,project_id,calculation_run_id,status')
      .eq('id', cuttingListId)
      .maybeSingle()
    if (listError) throw new Error(listError.message)
    if (!cuttingList) return NextResponse.json({ error: 'Cutting list not found.' }, { status: 404 })
    if (cuttingList.project_id !== projectId || !['APPROVED', 'RELEASED'].includes(cuttingList.status)) {
      return NextResponse.json({ error: 'Optimization requires an approved or released cutting list belonging to the requested project.' }, { status: 409 })
    }

    const { data: rows, error: itemError } = await supabase
      .from('cutting_list_items')
      .select('id,piece_code,part_name,material_id,length_mm,width_mm,thickness_mm,quantity,grain_direction,edge_banding')
      .eq('project_id', projectId)
      .eq('calculation_run_id', cuttingList.calculation_run_id)
      .order('sequence_no', { ascending: true })
    if (itemError) throw new Error(itemError.message)
    if (!rows?.length) return NextResponse.json({ error: 'Cutting list contains no items.' }, { status: 409 })

    const materialIds = [...new Set(rows.map(row => row.material_id).filter(Boolean))]
    const { data: materialsRows, error: materialError } = await supabase
      .from('materials')
      .select('id,code,name,kind,thickness,sheet_width,sheet_height,rate_per_sheet,rate_per_sq_m')
      .in('id', materialIds)
    if (materialError) throw new Error(materialError.message)

    const materials: Material[] = (materialsRows ?? []).map((material) => ({
      id: material.id,
      code: material.code,
      name: material.name,
      kind: material.kind,
      thickness: Number(material.thickness),
      sheetWidth: material.sheet_width == null ? undefined : Number(material.sheet_width),
      sheetHeight: material.sheet_height == null ? undefined : Number(material.sheet_height),
      ratePerSheet: material.rate_per_sheet == null ? undefined : Number(material.rate_per_sheet),
      ratePerSqM: material.rate_per_sq_m == null ? undefined : Number(material.rate_per_sq_m),
    }))

    const parts: CuttingPart[] = rows.map((row) => ({
      id: row.id,
      furnitureId: row.furniture_item_id ?? projectId,
      kind: 'panel',
      name: row.part_name,
      qty: Number(row.quantity),
      length: Number(row.length_mm),
      width: Number(row.width_mm),
      thickness: Number(row.thickness_mm),
      materialId: row.material_id,
      grain: row.grain_direction === 'REQUIRED',
      edge: 'none',
      areaSqM: (Number(row.length_mm) * Number(row.width_mm) * Number(row.quantity)) / 1_000_000,
      edgeLengthM: 0,
    }))

    const result = optimizeSheets({ parts, materials, kerfMm, trimAllowanceMm })
    const { data: run, error: runError } = await supabase
      .from('optimization_runs')
      .insert({
        project_id: projectId,
        cutting_list_id: cuttingListId,
        optimization_code: optimizationCode,
        version,
        status: 'COMPLETED',
        algorithm: result.algorithm,
        kerf_mm: result.kerfMm,
        trim_allowance_mm: result.trimAllowanceMm,
        sheet_count: result.sheets.length,
        total_required_area: result.totalRequiredArea,
        total_sheet_area: result.totalSheetArea,
        waste_area: result.wasteArea,
        utilization_percentage: result.utilizationPercentage,
        completed_at: new Date().toISOString(),
      })
      .select('*')
      .single()
    if (runError) return NextResponse.json({ error: runError.message }, { status: 409 })

    for (const sheet of result.sheets) {
      const { data: persistedSheet, error: sheetError } = await supabase
        .from('optimization_sheets')
        .insert({
          optimization_run_id: run.id,
          sheet_number: sheet.sheetNumber,
          material_id: sheet.materialId,
          length_mm: sheet.length,
          width_mm: sheet.width,
          thickness_mm: sheet.thickness,
          used_area: sheet.usedArea,
          waste_area: sheet.wasteArea,
          utilization_percentage: sheet.utilizationPercentage,
        })
        .select('id')
        .single()
      if (sheetError) return NextResponse.json({ error: sheetError.message, optimizationRunId: run.id }, { status: 409 })

      const placements = sheet.placements.map((placement) => ({
        optimization_sheet_id: persistedSheet.id,
        cutting_list_item_id: rows[placement.partIndex].id,
        piece_instance_id: placement.pieceInstanceId,
        x_mm: placement.x,
        y_mm: placement.y,
        length_mm: placement.length,
        width_mm: placement.width,
        rotation: placement.rotation,
        grain_orientation: rows[placement.partIndex].grain_direction === 'REQUIRED' ? 'LENGTH' : 'NONE',
      }))
      if (placements.length) {
        const { error: placementError } = await supabase.from('optimization_placements').insert(placements)
        if (placementError) return NextResponse.json({ error: placementError.message, optimizationRunId: run.id }, { status: 409 })
      }
    }

    return NextResponse.json({ optimizationRun: run, result }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create optimization run.' }, { status: 400 })
  }
}
