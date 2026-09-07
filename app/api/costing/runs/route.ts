import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../../lib/supabase-server'
import { calculateCosting, type CostCategory, type CostingItemInput } from '../../../../lib/millimetre'

const CATEGORIES: CostCategory[] = ['MATERIAL','HARDWARE','EDGE_BAND','LABOUR','SERVICE','TRANSPORT','INSTALLATION','OVERHEAD','OTHER']

function requiredString(value: unknown, field: string): string {
  const result = String(value ?? '').trim()
  if (!result) throw new Error(`${field} is required.`)
  return result
}

function numberValue(value: unknown, field: string, allowZero = true): number {
  const n = Number(value)
  if (!Number.isFinite(n) || (allowZero ? n < 0 : n <= 0)) throw new Error(`${field} must be ${allowZero ? 'non-negative' : 'positive'}.`)
  return n
}

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const projectId = new URL(request.url).searchParams.get('projectId')
    if (!projectId) return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })
    const { data, error } = await supabase.from('costing_runs').select('*').eq('project_id', projectId).order('costing_code').order('version', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ costingRuns: data ?? [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load costing runs.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const body = await request.json() as Record<string, unknown>
    const projectId = requiredString(body.projectId, 'projectId')
    const bomId = requiredString(body.bomId, 'bomId')
    const optimizationRunId = requiredString(body.optimizationRunId, 'optimizationRunId')
    const costingCode = requiredString(body.costingCode, 'costingCode')
    const version = Number(body.version)
    if (!Number.isInteger(version) || version < 1) throw new Error('version must be a positive integer.')

    const { data: project, error: projectError } = await supabase.from('projects').select('id').eq('id', projectId).maybeSingle()
    if (projectError) throw new Error(projectError.message)
    if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })

    const { data: bom, error: bomError } = await supabase.from('boms').select('id, project_id, calculation_run_id, status').eq('id', bomId).maybeSingle()
    if (bomError) throw new Error(bomError.message)
    if (!bom) return NextResponse.json({ error: 'BOM not found.' }, { status: 404 })
    if (bom.project_id !== projectId || !['APPROVED','RELEASED'].includes(bom.status)) return NextResponse.json({ error: 'Costing requires an approved or released BOM belonging to the requested project.' }, { status: 409 })

    const { data: optimization, error: optimizationError } = await supabase.from('optimization_runs').select('id, project_id, cutting_list_id, status').eq('id', optimizationRunId).maybeSingle()
    if (optimizationError) throw new Error(optimizationError.message)
    if (!optimization) return NextResponse.json({ error: 'Optimization run not found.' }, { status: 404 })
    if (optimization.project_id !== projectId || optimization.status !== 'APPROVED') return NextResponse.json({ error: 'Costing requires an approved optimization run belonging to the requested project.' }, { status: 409 })

    const { data: cuttingList, error: cuttingListError } = await supabase.from('cutting_lists').select('id, project_id, calculation_run_id, status').eq('id', optimization.cutting_list_id).maybeSingle()
    if (cuttingListError) throw new Error(cuttingListError.message)
    if (!cuttingList || cuttingList.project_id !== projectId || !['APPROVED','RELEASED'].includes(cuttingList.status) || cuttingList.calculation_run_id !== bom.calculation_run_id) {
      return NextResponse.json({ error: 'Optimization, BOM and cutting list lineage do not match.' }, { status: 409 })
    }

    const rawItems = Array.isArray(body.items) ? body.items : []
    if (!rawItems.length) return NextResponse.json({ error: 'At least one costing item is required.' }, { status: 400 })

    const { data: bomItems, error: bomItemsError } = await supabase.from('bom_items').select('id, project_id, bom_id').eq('bom_id', bomId)
    if (bomItemsError) throw new Error(bomItemsError.message)
    const bomItemIds = new Set((bomItems ?? []).map(item => item.id))

    const items: CostingItemInput[] = rawItems.map((raw, index) => {
      if (!raw || typeof raw !== 'object') throw new Error(`Invalid costing item at index ${index}.`)
      const item = raw as Record<string, unknown>
      const category = String(item.category ?? '').trim() as CostCategory
      if (!CATEGORIES.includes(category)) throw new Error(`Invalid costing category at index ${index}.`)
      const description = requiredString(item.description, `items[${index}].description`)
      const sourceType = item.sourceType == null ? undefined : String(item.sourceType).trim() || undefined
      const sourceId = item.sourceId == null ? undefined : String(item.sourceId).trim() || undefined
      if (sourceType === 'BOM_ITEM' && (!sourceId || !bomItemIds.has(sourceId))) throw new Error(`items[${index}] references an invalid BOM item.`)
      return {
        category,
        sourceType,
        sourceId,
        itemCode: item.itemCode == null ? undefined : String(item.itemCode).trim() || undefined,
        description,
        quantity: numberValue(item.quantity, `items[${index}].quantity`),
        unit: requiredString(item.unit, `items[${index}].unit`),
        unitCost: numberValue(item.unitCost, `items[${index}].unitCost`),
        wastageQuantity: item.wastageQuantity == null ? 0 : numberValue(item.wastageQuantity, `items[${index}].wastageQuantity`),
        calculationBasis: item.calculationBasis == null ? undefined : String(item.calculationBasis),
        notes: item.notes == null ? undefined : String(item.notes),
      }
    })

    const result = calculateCosting({
      projectId,
      currency: body.currency == null ? 'INR' : requiredString(body.currency, 'currency'),
      items,
      discount: body.discount == null ? 0 : numberValue(body.discount, 'discount'),
      taxRate: body.taxRate == null ? 0 : numberValue(body.taxRate, 'taxRate'),
      marginType: body.marginType == null ? undefined : body.marginType as 'MARKUP_PERCENT' | 'GROSS_MARGIN_PERCENT' | 'FIXED_MARGIN' | 'FIXED_SELLING_PRICE',
      marginValue: body.marginValue == null ? 0 : numberValue(body.marginValue, 'marginValue'),
    })

    const inputSnapshot = { projectId, bomId, optimizationRunId, costingCode, version, currency: result.currency, items, discount: result.discount, taxRate: body.taxRate ?? 0, marginType: body.marginType ?? null, marginValue: body.marginValue ?? 0, requestedBy: user.id }
    const outputSnapshot = result

    const { data: costingRun, error: persistError } = await supabase.rpc('persist_costing_run', {
      p_project_id: projectId,
      p_bom_id: bomId,
      p_optimization_run_id: optimizationRunId,
      p_costing_code: costingCode,
      p_version: version,
      p_currency: result.currency,
      p_subtotal: result.subtotal,
      p_discount: result.discount,
      p_tax: result.tax,
      p_margin: result.margin,
      p_selling_price: result.sellingPrice,
      p_input_snapshot: inputSnapshot,
      p_output_snapshot: outputSnapshot,
      p_items: result.items,
    })
    if (persistError) return NextResponse.json({ error: persistError.message }, { status: 409 })

    return NextResponse.json({ costingRun, result }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create costing run.' }, { status: 400 })
  }
}
