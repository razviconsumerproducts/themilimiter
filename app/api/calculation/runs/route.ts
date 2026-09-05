import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../../lib/supabase-server'
import { createCalculationRun } from '../../../../lib/millimetre'
import type { CalculationInput, Furniture, Material, MaterialKind, FurnitureType } from '../../../../lib/millimetre'

const furnitureTypes = new Set<FurnitureType>([
  'base_cabinet', 'wall_cabinet', 'tall_cabinet', 'wardrobe', 'drawer_unit', 'shelf', 'custom',
])

const materialKinds = new Set<MaterialKind>([
  'board', 'plywood', 'mdf', 'hdf', 'solid_wood', 'glass', 'hardware', 'other',
])

function asMaterialKind(category: unknown): MaterialKind {
  const value = String(category ?? '').trim().toLowerCase().replace(/[- ]/g, '_')
  if (materialKinds.has(value as MaterialKind)) return value as MaterialKind
  if (value.includes('ply')) return 'plywood'
  if (value.includes('mdf')) return 'mdf'
  if (value.includes('hdf')) return 'hdf'
  if (value.includes('glass')) return 'glass'
  if (value.includes('hardware')) return 'hardware'
  if (value.includes('wood')) return 'solid_wood'
  return 'board'
}

function asFurnitureType(type: unknown): FurnitureType {
  const value = String(type ?? '').trim().toLowerCase().replace(/[- ]/g, '_')
  return furnitureTypes.has(value as FurnitureType) ? value as FurnitureType : 'custom'
}

function asPositiveNumber(value: unknown, field: string): number {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${field} must be a positive number.`)
  return number
}

function buildMaterial(row: Record<string, unknown>): Material {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    kind: asMaterialKind(row.category),
    thickness: asPositiveNumber(row.thickness_mm, 'Material thickness'),
    sheetWidth: row.sheet_width_mm == null ? undefined : Number(row.sheet_width_mm),
    sheetHeight: row.sheet_length_mm == null ? undefined : Number(row.sheet_length_mm),
    ratePerSheet: row.unit_cost == null ? undefined : Number(row.unit_cost),
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const body = await request.json() as {
      furniture?: { id?: string; projectId?: string }
      furnitureId?: string
      projectId?: string
      carcassMaterialId?: string
      backMaterialId?: string
      shutterMaterialId?: string
      includeBack?: boolean
      includeShutters?: boolean
      includeShelves?: boolean
      includeDrawers?: boolean
    }

    const furnitureId = body.furnitureId ?? body.furniture?.id
    const requestedProjectId = body.projectId ?? body.furniture?.projectId
    if (!furnitureId) return NextResponse.json({ error: 'furnitureId is required.' }, { status: 400 })

    const { data: furnitureRow, error: furnitureError } = await supabase
      .from('furniture_items')
      .select('id, project_id, name, type, quantity, width_mm, depth_mm, height_mm, configuration')
      .eq('id', furnitureId)
      .maybeSingle()

    if (furnitureError) return NextResponse.json({ error: furnitureError.message }, { status: 500 })
    if (!furnitureRow) return NextResponse.json({ error: 'Furniture item not found.' }, { status: 404 })
    if (requestedProjectId && requestedProjectId !== furnitureRow.project_id) {
      return NextResponse.json({ error: 'Furniture item does not belong to the requested project.' }, { status: 409 })
    }

    const configuration = (furnitureRow.configuration ?? {}) as Record<string, unknown>
    const carcassMaterialId = body.carcassMaterialId ?? String(configuration.carcassMaterialId ?? '')
    if (!carcassMaterialId) return NextResponse.json({ error: 'carcassMaterialId is required.' }, { status: 400 })

    const materialIds = [carcassMaterialId, body.backMaterialId, body.shutterMaterialId].filter(Boolean) as string[]
    const { data: materialRows, error: materialError } = await supabase
      .from('materials')
      .select('id, code, name, category, thickness_mm, sheet_length_mm, sheet_width_mm, unit_cost')
      .in('id', [...new Set(materialIds)])

    if (materialError) return NextResponse.json({ error: materialError.message }, { status: 500 })
    const materials = new Map((materialRows ?? []).map((row) => [row.id, buildMaterial(row as Record<string, unknown>)]))
    const carcassMaterial = materials.get(carcassMaterialId)
    if (!carcassMaterial) return NextResponse.json({ error: 'Canonical carcass material not found.' }, { status: 404 })

    const backMaterial = body.backMaterialId ? materials.get(body.backMaterialId) : undefined
    const shutterMaterial = body.shutterMaterialId ? materials.get(body.shutterMaterialId) : undefined
    if (body.backMaterialId && !backMaterial) return NextResponse.json({ error: 'Canonical back material not found.' }, { status: 404 })
    if (body.shutterMaterialId && !shutterMaterial) return NextResponse.json({ error: 'Canonical shutter material not found.' }, { status: 404 })

    const furniture: Furniture = {
      id: furnitureRow.id,
      projectId: furnitureRow.project_id,
      name: furnitureRow.name,
      code: furnitureRow.id,
      type: asFurnitureType(furnitureRow.type),
      width: asPositiveNumber(furnitureRow.width_mm, 'Furniture width'),
      height: asPositiveNumber(furnitureRow.height_mm, 'Furniture height'),
      depth: asPositiveNumber(furnitureRow.depth_mm, 'Furniture depth'),
      carcassThickness: carcassMaterial.thickness,
      backThickness: backMaterial?.thickness,
      shutterGap: Number(configuration.shutterGap ?? configuration.shutterGapMm ?? 2),
      shelfCount: Number(configuration.shelfCount ?? 0),
      drawerCount: Number(configuration.drawerCount ?? 0),
    }

    const input: CalculationInput = {
      furniture,
      carcassMaterial,
      backMaterial,
      shutterMaterial,
      includeBack: Boolean(body.includeBack),
      includeShutters: Boolean(body.includeShutters),
      includeShelves: Boolean(body.includeShelves),
      includeDrawers: Boolean(body.includeDrawers),
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
