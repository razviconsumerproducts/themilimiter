import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../../../lib/supabase-server'
import { calculateCosting, type CostCategory, type CostingItemInput } from '../../../../../lib/millimetre'

const categoryMap: Record<string, CostCategory> = {
  BOARD: 'MATERIAL',
  LAMINATE: 'MATERIAL',
  EDGE_BAND: 'EDGE_BAND',
}

const required = (v: unknown, field: string) => {
  const value = String(v ?? '').trim()
  if (!value) throw new Error(`${field} is required.`)
  return value
}

const nonNegative = (v: unknown, field: string) => {
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) throw new Error(`${field} must be non-negative.`)
  return n
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const body = await request.json() as Record<string, unknown>
    const projectId = required(body.projectId, 'projectId')
    const bomId = required(body.bomId, 'bomId')
    const optimizationRunId = required(body.optimizationRunId, 'optimizationRunId')
    const costingCode = required(body.costingCode, 'costingCode')
    const version = Number(body.version ?? 1)
    if (!Number.isInteger(version) || version < 1) throw new Error('version must be a positive integer.')

    const { data: bom, error: bomError } = await supabase
      .from('boms')
      .select('id,project_id,calculation_run_id,status')
      .eq('id', bomId)
      .maybeSingle()
    if (bomError) throw new Error(bomError.message)
    if (!bom) return NextResponse.json({ error: 'BOM not found.' }, { status: 404 })
    if (bom.project_id !== projectId || !['APPROVED', 'RELEASED'].includes(bom.status)) {
      return NextResponse.json({ error: 'Costing requires an approved or released BOM belonging to the requested project.' }, { status: 409 })
    }

    const { data: optimization, error: optimizationError } = await supabase
      .from('optimization_runs')
      .select('id,project_id,cutting_list_id,status')
      .eq('id', optimizationRunId)
      .maybeSingle()
    if (optimizationError) throw new Error(optimizationError.message)
    if (!optimization) return NextResponse.json({ error: 'Optimization run not found.' }, { status: 404 })
    if (optimization.project_id !== projectId || optimization.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Costing requires an approved optimization run belonging to the requested project.' }, { status: 409 })
    }

    const { data: cuttingList, error: cuttingError } = await supabase
      .from('cutting_lists')
      .select('id,project_id,calculation_run_id,status')
      .eq('id', optimization.cutting_list_id)
      .maybeSingle()
    if (cuttingError) throw new Error(cuttingError.message)
    if (!cuttingList || cuttingList.project_id !== projectId || !['APPROVED', 'RELEASED'].includes(cuttingList.status) || cuttingList.calculation_run_id !== bom.calculation_run_id) {
      return NextResponse.json({ error: 'BOM, optimization and cutting-list lineage do not match.' }, { status: 409 })
    }

    const { data: bomItems, error: itemsError } = await supabase
      .from('bom_items')
      .select('id,item_type,item_id,item_code,description,quantity,unit,calculation_basis,notes')
      .eq('bom_id', bomId)
      .order('sort_order', { ascending: true })
    if (itemsError) throw new Error(itemsError.message)
    if (!bomItems?.length) return NextResponse.json({ error: 'Approved BOM contains no items.' }, { status: 409 })

    const materialIds = bomItems.map(item => item.item_id).filter(Boolean) as string[]
    const { data: materials, error: materialError } = materialIds.length
      ? await supabase.from('materials').select('id,code,name,unit_cost,edge_cost_per_m').in('id', [...new Set(materialIds)])
      : { data: [], error: null }
    if (materialError) throw new Error(materialError.message)
    const materialMap = new Map((materials ?? []).map(material => [material.id, material]))

    const items: CostingItemInput[] = bomItems.map(item => {
      const category = categoryMap[item.item_type]
      if (!category) throw new Error(`BOM item ${item.id} (${item.item_type}) needs an explicit costing rate.`)
      const material = item.item_id ? materialMap.get(item.item_id) : undefined
      if (!material) throw new Error(`BOM item ${item.id} has no resolvable material rate.`)
      const unitCost = item.item_type === 'EDGE_BAND' ? Number(material.edge_cost_per_m ?? 0) : Number(material.unit_cost ?? 0)
      if (!Number.isFinite(unitCost) || unitCost <= 0) throw new Error(`Material ${material.code} has no positive costing rate.`)
      return {
        category,
        sourceType: 'BOM_ITEM',
        sourceId: item.id,
        itemCode: item.item_code ?? material.code,
        description: item.description,
        quantity: nonNegative(item.quantity, `BOM item ${item.id} quantity`),
        unit: item.unit,
        unitCost,
        calculationBasis: item.calculation_basis ?? `BOM ${bomId}`,
        notes: item.notes ?? undefined,
      }
    })

    const result = calculateCosting({
      projectId,
      currency: body.currency == null ? 'INR' : required(body.currency, 'currency'),
      items,
      discount: body.discount == null ? 0 : nonNegative(body.discount, 'discount'),
      taxRate: body.taxRate == null ? 0 : nonNegative(body.taxRate, 'taxRate'),
      marginType: body.marginType == null ? undefined : body.marginType as 'MARKUP_PERCENT' | 'GROSS_MARGIN_PERCENT' | 'FIXED_MARGIN' | 'FIXED_SELLING_PRICE',
      marginValue: body.marginValue == null ? 0 : nonNegative(body.marginValue, 'marginValue'),
    })

    const inputSnapshot = { projectId, bomId, optimizationRunId, costingCode, version, currency: result.currency, items, discount: result.discount, taxRate: body.taxRate ?? 0, marginType: body.marginType ?? null, marginValue: body.marginValue ?? 0, requestedBy: user.id, source: 'APPROVED_BOM' }
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
      p_output_snapshot: result,
      p_items: result.items,
    })
    if (persistError) return NextResponse.json({ error: persistError.message }, { status: 409 })

    return NextResponse.json({ costingRun, result, source: 'APPROVED_BOM', createdBy: user.id }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create costing from BOM.' }, { status: 400 })
  }
}
