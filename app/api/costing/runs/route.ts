import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../../lib/supabase-server'
import { calculateCosting, type CostCategory, type CostingItemInput } from '../../../../lib/millimetre'

const CATEGORIES: CostCategory[] = ['MATERIAL','HARDWARE','EDGE_BAND','LABOUR','SERVICE','TRANSPORT','INSTALLATION','OVERHEAD','OTHER']
const required = (v: unknown, f: string) => { const s = String(v ?? '').trim(); if (!s) throw new Error(`${f} is required.`); return s }
const nonNegative = (v: unknown, f: string) => { const n = Number(v ?? 0); if (!Number.isFinite(n) || n < 0) throw new Error(`${f} must be non-negative.`); return n }
const positive = (v: unknown, f: string) => { const n = Number(v); if (!Number.isFinite(n) || n <= 0) throw new Error(`${f} must be positive.`); return n }

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const projectId = new URL(request.url).searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })
  const { data, error } = await supabase.from('millimetre_costing_runs').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ costingRuns: data ?? [] })
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    const body = await request.json() as Record<string, unknown>
    const projectId = required(body.projectId, 'projectId')
    const calculationRunId = required(body.calculationRunId, 'calculationRunId')
    const optimizationRunId = body.optimizationRunId == null ? null : required(body.optimizationRunId, 'optimizationRunId')
    const version = Number(body.version ?? 1)
    if (!Number.isInteger(version) || version < 1) throw new Error('version must be a positive integer.')
    const { data: calc, error: calcError } = await supabase.from('calculation_runs').select('id,project_id,status').eq('id', calculationRunId).maybeSingle()
    if (calcError) throw new Error(calcError.message)
    if (!calc || calc.project_id !== projectId || calc.status !== 'valid') return NextResponse.json({ error: 'Costing requires a valid calculation run belonging to the project.' }, { status: 409 })
    if (optimizationRunId) {
      const { data: opt, error } = await supabase.from('millimetre_optimization_runs').select('id,project_id,calculation_run_id,status').eq('id', optimizationRunId).maybeSingle()
      if (error) throw new Error(error.message)
      if (!opt || opt.project_id !== projectId || opt.calculation_run_id !== calculationRunId || !['completed','approved'].includes(String(opt.status).toLowerCase())) return NextResponse.json({ error: 'Optimization run is invalid or does not belong to the calculation/project.' }, { status: 409 })
    }
    const rawItems = Array.isArray(body.items) ? body.items : []
    if (!rawItems.length) return NextResponse.json({ error: 'At least one costing item is required.' }, { status: 400 })
    const items: CostingItemInput[] = rawItems.map((raw, i) => {
      if (!raw || typeof raw !== 'object') throw new Error(`Invalid costing item at index ${i}.`)
      const item = raw as Record<string, unknown>
      const category = String(item.category ?? '').trim().toUpperCase() as CostCategory
      if (!CATEGORIES.includes(category)) throw new Error(`Invalid costing category at index ${i}.`)
      return { category, sourceType: item.sourceType == null ? undefined : String(item.sourceType), sourceId: item.sourceId == null ? undefined : String(item.sourceId), itemCode: item.itemCode == null ? undefined : String(item.itemCode), description: required(item.description, `items[${i}].description`), quantity: positive(item.quantity, `items[${i}].quantity`), unit: required(item.unit, `items[${i}].unit`), unitCost: nonNegative(item.unitCost, `items[${i}].unitCost`), wastageQuantity: nonNegative(item.wastageQuantity, `items[${i}].wastageQuantity`), calculationBasis: item.calculationBasis == null ? undefined : String(item.calculationBasis), notes: item.notes == null ? undefined : String(item.notes) }
    })
    const result = calculateCosting({ projectId, currency: body.currency == null ? 'INR' : required(body.currency, 'currency'), items, discount: nonNegative(body.discount, 'discount'), taxRate: nonNegative(body.taxRate, 'taxRate'), marginType: body.marginType as CostingItemInput extends never ? never : 'MARKUP_PERCENT' | 'GROSS_MARGIN_PERCENT' | 'FIXED_MARGIN' | 'FIXED_SELLING_PRICE' | undefined, marginValue: nonNegative(body.marginValue, 'marginValue') })
    const inputSnapshot = { projectId, calculationRunId, optimizationRunId, version, items, currency: result.currency, discount: result.discount, taxRate: body.taxRate ?? 0, marginType: body.marginType ?? null, marginValue: body.marginValue ?? 0, requestedBy: user.id }
    const { data, error } = await supabase.rpc('persist_costing_run', { p_project_id: projectId, p_calculation_run_id: calculationRunId, p_optimization_run_id: optimizationRunId, p_currency: result.currency, p_material_cost: result.items.filter(i => i.category === 'MATERIAL').reduce((s,i) => s+i.totalCost,0), p_edge_banding_cost: result.items.filter(i => i.category === 'EDGE_BAND').reduce((s,i) => s+i.totalCost,0), p_hardware_cost: result.items.filter(i => i.category === 'HARDWARE').reduce((s,i) => s+i.totalCost,0), p_manufacturing_cost: result.items.filter(i => ['LABOUR','SERVICE','TRANSPORT','INSTALLATION'].includes(i.category)).reduce((s,i) => s+i.totalCost,0), p_wastage_cost: result.items.reduce((s,i) => s+i.wastageCost,0), p_overhead_cost: result.items.filter(i => i.category === 'OVERHEAD').reduce((s,i) => s+i.totalCost,0), p_total_cost: result.totalCost, p_status: 'calculated', p_result: { ...result, inputSnapshot }, p_items: result.items })
    if (error) return NextResponse.json({ error: error.message }, { status: 409 })
    return NextResponse.json({ costingRun: data, result }, { status: 201 })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create costing run.' }, { status: 400 }) }
}
