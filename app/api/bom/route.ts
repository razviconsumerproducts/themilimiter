import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../lib/supabase-server'
import { buildBom, type BomItemInput, type BomItemType } from '../../../lib/millimetre'

const ITEM_TYPES = new Set<BomItemType>(['BOARD','LAMINATE','EDGE_BAND','HARDWARE','ACCESSORY','CONSUMABLE','OTHER'])
const required = (value: unknown, field: string) => { const result = String(value ?? '').trim(); if (!result) throw new Error(`${field} is required.`); return result }

type CalculationPart = { id?: string; furnitureId?: string; kind?: string; name?: string; qty?: number; length?: number; width?: number; thickness?: number; materialId?: string; edge?: string; edgeBandMm?: number; notes?: string }

function deriveItemsFromCalculation(result: unknown): BomItemInput[] {
  const snapshot = result && typeof result === 'object' ? result as Record<string, unknown> : {}
  const rawParts = Array.isArray(snapshot.parts) ? snapshot.parts : []
  const parts = rawParts.filter((part): part is CalculationPart => !!part && typeof part === 'object')
  if (!parts.length) throw new Error('Calculation run contains no calculated parts to build the BOM.')
  const items: BomItemInput[] = []
  for (const part of parts) {
    const qty = Number(part.qty ?? 0)
    if (!Number.isFinite(qty) || qty <= 0) continue
    const description = String(part.name ?? part.kind ?? 'Calculated component').trim()
    const dimensions = `${Number(part.length ?? 0)} x ${Number(part.width ?? 0)} x ${Number(part.thickness ?? 0)} mm`
    items.push({ furnitureItemId: part.furnitureId, itemType: part.kind === 'edge_strip' ? 'EDGE_BAND' : 'BOARD', itemId: part.materialId, itemCode: part.materialId, description, quantity: qty, unit: 'PCS', calculationBasis: `Calculation ${String(snapshot.furnitureId ?? '')}; ${dimensions}`, sourceComponentId: part.id, notes: part.edge && part.edge !== 'none' ? `Edge: ${part.edge}${part.edgeBandMm ? `; ${part.edgeBandMm} mm band` : ''}` : part.notes })
  }
  if (!items.length) throw new Error('Calculation run contains no positive-quantity parts to build the BOM.')
  return items
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const projectId = new URL(request.url).searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })
  const { data, error } = await supabase.from('millimetre_boms').select('id,project_id,calculation_run_id,code,title,status,work_order_no,work_order_date,notes,approved_by,approved_at,issued_by,issued_at,created_at,updated_at').eq('project_id', projectId).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const ids = (data ?? []).map(row => row.id)
  const { data: items, error: itemsError } = ids.length ? await supabase.from('millimetre_bom_items').select('*').in('bom_id', ids).order('sequence_no', { ascending: true }) : { data: [], error: null }
  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })
  return NextResponse.json({ boms: data ?? [], items: items ?? [] })
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    const body = await request.json() as Record<string, unknown>
    const projectId = required(body.projectId, 'projectId')
    const calculationRunId = required(body.calculationRunId, 'calculationRunId')
    const bomCode = required(body.bomCode, 'bomCode')
    const version = Number(body.version ?? 1)
    if (!Number.isInteger(version) || version < 1) throw new Error('version must be a positive integer.')
    const { data: run, error: runError } = await supabase.from('calculation_runs').select('id,project_id,furniture_item_id,status,output_snapshot,result').eq('id', calculationRunId).maybeSingle()
    if (runError) throw new Error(runError.message)
    if (!run) return NextResponse.json({ error: 'Calculation run not found.' }, { status: 404 })
    if (run.project_id !== projectId || run.status !== 'valid') return NextResponse.json({ error: 'BOM requires a valid calculation run belonging to the requested project.' }, { status: 409 })
    const rawItems = Array.isArray(body.items) ? body.items : []
    const items: BomItemInput[] = rawItems.length ? rawItems.map((value, index) => {
      if (!value || typeof value !== 'object') throw new Error(`Invalid BOM item at index ${index}.`)
      const item = value as Record<string, unknown>
      const itemType = String(item.itemType ?? '').trim().toUpperCase() as BomItemType
      if (!ITEM_TYPES.has(itemType)) throw new Error(`Invalid BOM item type at index ${index}.`)
      const quantity = Number(item.quantity)
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`items[${index}].quantity must be positive.`)
      return { furnitureItemId: item.furnitureItemId == null ? undefined : String(item.furnitureItemId), itemType, itemId: item.itemId == null ? undefined : String(item.itemId), itemCode: item.itemCode == null ? undefined : String(item.itemCode), description: required(item.description, `items[${index}].description`), quantity, unit: required(item.unit, `items[${index}].unit`), calculationBasis: item.calculationBasis == null ? undefined : String(item.calculationBasis), sourceComponentId: item.sourceComponentId == null ? undefined : String(item.sourceComponentId), notes: item.notes == null ? undefined : String(item.notes) }
    }) : deriveItemsFromCalculation(run.output_snapshot ?? run.result)
    const result = buildBom({ projectId, calculationRunId, version, items })
    const { data: persisted, error: persistError } = await supabase.rpc('persist_bom_run', { p_project_id: projectId, p_calculation_run_id: calculationRunId, p_bom_code: bomCode, p_version: version, p_items: result.items })
    if (persistError) return NextResponse.json({ error: persistError.message }, { status: 409 })
    const bomId = String(persisted?.bom_id ?? '')
    if (!bomId) return NextResponse.json({ error: 'BOM persistence returned no BOM id.' }, { status: 500 })
    const { data: bomItems, error: itemsError } = await supabase.from('millimetre_bom_items').select('*').eq('bom_id', bomId).order('sequence_no', { ascending: true })
    if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })
    const { data: bom, error: bomReadError } = await supabase.from('millimetre_boms').select('*').eq('id', bomId).single()
    if (bomReadError) return NextResponse.json({ error: bomReadError.message }, { status: 500 })
    return NextResponse.json({ bom, items: bomItems ?? [], result, createdBy: user.id, source: rawItems.length ? 'REQUEST' : 'CALCULATION_RUN' }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create BOM.' }, { status: 400 })
  }
}
