import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../../lib/supabase-server'
import { optimizeSheets, type CuttingPart, type Material } from '../../../../lib/millimetre'

function requiredString(value: unknown, field: string) { const result = String(value ?? '').trim(); if (!result) throw new Error(`${field} is required.`); return result }
function nonNegative(value: unknown, field: string) { const result = Number(value); if (!Number.isFinite(result) || result < 0) throw new Error(`${field} must be non-negative.`); return result }

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServerClient(); const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    const projectId = new URL(request.url).searchParams.get('projectId'); if (!projectId) return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })
    const { data, error } = await supabase.from('optimization_runs').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 }); return NextResponse.json({ optimizationRuns: data ?? [] })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load optimization runs.' }, { status: 500 }) }
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient(); const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    const body = await request.json() as Record<string, unknown>
    const projectId = requiredString(body.projectId, 'projectId'); const cuttingListId = requiredString(body.cuttingListId, 'cuttingListId'); const optimizationCode = requiredString(body.optimizationCode, 'optimizationCode')
    const version = Number(body.version ?? 1); if (!Number.isInteger(version) || version < 1) throw new Error('version must be a positive integer.')
    const kerfMm = nonNegative(body.kerfMm ?? 3, 'kerfMm'); const trimAllowanceMm = nonNegative(body.trimAllowanceMm ?? 10, 'trimAllowanceMm')

    const { data: cuttingList, error: listError } = await supabase.from('cutting_lists').select('id,project_id,calculation_run_id,status').eq('id', cuttingListId).maybeSingle()
    if (listError) throw new Error(listError.message); if (!cuttingList) return NextResponse.json({ error: 'Cutting list not found.' }, { status: 404 })
    if (cuttingList.project_id !== projectId || !['APPROVED', 'RELEASED'].includes(cuttingList.status)) return NextResponse.json({ error: 'Optimization requires an approved or released cutting list belonging to the requested project.' }, { status: 409 })

    const { data: rows, error: itemError } = await supabase.from('cutting_list_items').select('id,part_name,material_id,length_mm,width_mm,thickness_mm,quantity,grain_direction,furniture_item_id').eq('project_id', projectId).eq('calculation_run_id', cuttingList.calculation_run_id).order('sequence_no', { ascending: true })
    if (itemError) throw new Error(itemError.message); if (!rows?.length) return NextResponse.json({ error: 'Cutting list contains no items.' }, { status: 409 })
    const materialIds = [...new Set(rows.map(row => row.material_id).filter(Boolean))]; if (!materialIds.length) return NextResponse.json({ error: 'Cutting list has no material assignments.' }, { status: 409 })
    const { data: materialsRows, error: materialError } = await supabase.from('materials').select('id,code,name,kind,thickness,sheet_width,sheet_height,rate_per_sheet,rate_per_sq_m').in('id', materialIds)
    if (materialError) throw new Error(materialError.message); if ((materialsRows ?? []).length !== materialIds.length) return NextResponse.json({ error: 'One or more cutting-list materials could not be found.' }, { status: 409 })

    const materials: Material[] = (materialsRows ?? []).map((m) => ({ id: m.id, code: m.code, name: m.name, kind: m.kind, thickness: Number(m.thickness), sheetWidth: m.sheet_width == null ? undefined : Number(m.sheet_width), sheetHeight: m.sheet_height == null ? undefined : Number(m.sheet_height), ratePerSheet: m.rate_per_sheet == null ? undefined : Number(m.rate_per_sheet), ratePerSqM: m.rate_per_sq_m == null ? undefined : Number(m.rate_per_sq_m) }))
    const parts: CuttingPart[] = rows.map((r) => ({ id: r.id, furnitureId: r.furniture_item_id ?? projectId, kind: 'panel', name: r.part_name, qty: Number(r.quantity), length: Number(r.length_mm), width: Number(r.width_mm), thickness: Number(r.thickness_mm), materialId: r.material_id, grain: r.grain_direction === 'REQUIRED', edge: 'none', areaSqM: Number(r.length_mm) * Number(r.width_mm) * Number(r.quantity) / 1_000_000, edgeLengthM: 0 }))
    const result = optimizeSheets({ parts, materials, kerfMm, trimAllowanceMm })
    if (result.unplaced.length) return NextResponse.json({ error: 'Optimization could not place every required piece.', unplaced: result.unplaced, result }, { status: 409 })

    const sheets = result.sheets.map((sheet) => ({ ...sheet, placements: sheet.placements.map((p: any) => ({ ...p, cuttingListItemId: rows[p.partIndex].id, grainOrientation: rows[p.partIndex].grain_direction === 'REQUIRED' ? 'LENGTH' : 'NONE' })) }))
    const { data: persisted, error: persistError } = await supabase.rpc('persist_optimization_run', { p_project_id: projectId, p_cutting_list_id: cuttingListId, p_optimization_code: optimizationCode, p_version: version, p_algorithm: result.algorithm, p_kerf_mm: result.kerfMm, p_trim_allowance_mm: result.trimAllowanceMm, p_sheet_count: result.sheets.length, p_total_required_area: result.totalRequiredArea, p_total_sheet_area: result.totalSheetArea, p_waste_area: result.wasteArea, p_utilization_percentage: result.utilizationPercentage, p_sheets: sheets, p_placements: [] })
    if (persistError) return NextResponse.json({ error: persistError.message }, { status: 409 })
    return NextResponse.json({ optimizationRun: persisted, result, createdBy: user.id }, { status: 201 })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create optimization run.' }, { status: 400 }) }
}
