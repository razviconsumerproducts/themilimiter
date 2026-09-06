import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../lib/supabase-server'
import { buildQuotation } from '../../../lib/millimetre'

function requiredString(value: unknown, field: string): string {
  const result = String(value ?? '').trim()
  if (!result) throw new Error(`${field} is required.`)
  return result
}

function optionalDate(value: unknown): string | null {
  if (value == null || String(value).trim() === '') return null
  const date = String(value).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('validUntil must be YYYY-MM-DD.')
  return date
}

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    const projectId = new URL(request.url).searchParams.get('projectId')
    if (!projectId) return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })
    const { data, error } = await supabase.from('quotations').select('*').eq('project_id', projectId).order('quotation_code').order('version', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ quotations: data ?? [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load quotations.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const body = await request.json() as Record<string, unknown>
    const projectId = requiredString(body.projectId, 'projectId')
    const costingRunId = requiredString(body.costingRunId, 'costingRunId')
    const quotationCode = requiredString(body.quotationCode, 'quotationCode')
    const version = Number(body.version)
    if (!Number.isInteger(version) || version < 1) throw new Error('version must be a positive integer.')

    const [{ data: project, error: projectError }, { data: costing, error: costingError }] = await Promise.all([
      supabase.from('projects').select('id, customer_id, name').eq('id', projectId).maybeSingle(),
      supabase.from('costing_runs').select('id, project_id, status, version, currency, subtotal, discount, tax, total_cost, selling_price, input_snapshot, output_snapshot').eq('id', costingRunId).maybeSingle(),
    ])
    if (projectError) throw new Error(projectError.message)
    if (costingError) throw new Error(costingError.message)
    if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    if (!costing) return NextResponse.json({ error: 'Costing run not found.' }, { status: 404 })
    if (costing.project_id !== projectId) return NextResponse.json({ error: 'Costing run does not belong to the requested project.' }, { status: 409 })
    if (!['APPROVED', 'LOCKED'].includes(costing.status)) return NextResponse.json({ error: 'Quotation requires an approved or locked costing run.' }, { status: 409 })

    const { data: existing, error: existingError } = await supabase.from('quotations').select('id, status, version').eq('project_id', projectId).eq('quotation_code', quotationCode).order('version', { ascending: false }).limit(1).maybeSingle()
    if (existingError) throw new Error(existingError.message)
    if (existing && existing.version >= version) return NextResponse.json({ error: 'Quotation version must be greater than the existing version.' }, { status: 409 })
    if (existing?.status === 'ACCEPTED' && version <= existing.version) return NextResponse.json({ error: 'Accepted quotation requires a new version.' }, { status: 409 })

    const costingItemsQuery = await supabase.from('costing_items').select('id, category, source_type, source_id, item_code, description, quantity, unit, unit_cost, wastage_quantity, calculation_basis, notes').eq('costing_run_id', costingRunId).order('id')
    if (costingItemsQuery.error) throw new Error(costingItemsQuery.error.message)
    const costingItems = costingItemsQuery.data ?? []
    if (!costingItems.length) return NextResponse.json({ error: 'Approved costing has no costing items.' }, { status: 409 })

    const sellingPrice = Number(costing.selling_price)
    const costBase = costingItems.reduce((sum, item) => sum + Number(item.total_cost ?? ((Number(item.quantity) + Number(item.wastage_quantity ?? 0)) * Number(item.unit_cost))), 0)
    if (!Number.isFinite(sellingPrice) || sellingPrice < 0 || !Number.isFinite(costBase) || costBase < 0) throw new Error('Costing contains invalid commercial values.')

    const items = costingItems.map((item) => {
      const lineCost = Number(item.total_cost ?? ((Number(item.quantity) + Number(item.wastage_quantity ?? 0)) * Number(item.unit_cost)))
      const allocatedPrice = costBase > 0 ? lineCost / costBase * sellingPrice : 0
      return {
        itemType: item.category,
        sourceType: 'COSTING_ITEM',
        sourceId: item.id,
        itemCode: item.item_code ?? undefined,
        description: item.description,
        quantity: Number(item.quantity),
        unit: item.unit,
        unitPrice: allocatedPrice / Math.max(Number(item.quantity), 1),
        taxRate: 0,
        notes: item.calculation_basis ?? item.notes ?? undefined,
      }
    })

    const result = buildQuotation({
      projectId,
      customerId: project.customer_id,
      costingRunId,
      quotationCode,
      version,
      currency: costing.currency,
      items,
      paymentTerms: body.paymentTerms == null ? undefined : String(body.paymentTerms),
      deliveryTerms: body.deliveryTerms == null ? undefined : String(body.deliveryTerms),
      installationTerms: body.installationTerms == null ? undefined : String(body.installationTerms),
      warrantyTerms: body.warrantyTerms == null ? undefined : String(body.warrantyTerms),
      notes: body.notes == null ? undefined : String(body.notes),
      customerNotes: body.customerNotes == null ? undefined : String(body.customerNotes),
      costSnapshot: costing.output_snapshot,
    })

    const quotationDate = new Date().toISOString().slice(0, 10)
    const validUntil = optionalDate(body.validUntil)
    if (validUntil && validUntil < quotationDate) throw new Error('validUntil cannot be before quotation date.')
    if (Math.abs(Number(result.grandTotal) - sellingPrice) > 0.02) throw new Error('Quotation total does not reconcile to the approved costing selling price.')

    const { data: quotation, error: quotationError } = await supabase.from('quotations').insert({
      project_id: projectId,
      customer_id: project.customer_id,
      costing_run_id: costingRunId,
      quotation_code: quotationCode,
      version,
      status: 'DRAFT',
      quotation_date: quotationDate,
      valid_until: validUntil,
      currency: result.currency,
      subtotal: result.subtotal,
      discount: result.discount,
      taxable_amount: result.taxableAmount,
      tax_amount: result.taxAmount,
      payment_terms: body.paymentTerms == null ? null : String(body.paymentTerms),
      delivery_terms: body.deliveryTerms == null ? null : String(body.deliveryTerms),
      installation_terms: body.installationTerms == null ? null : String(body.installationTerms),
      warranty_terms: body.warrantyTerms == null ? null : String(body.warrantyTerms),
      notes: body.notes == null ? null : String(body.notes),
      customer_notes: body.customerNotes == null ? null : String(body.customerNotes),
      cost_snapshot: costing.output_snapshot ?? {},
      commercial_snapshot: { ...result.commercialSnapshot, source: 'APPROVED_COSTING', costing_run_id: costingRunId, costing_version: costing.version, generated_at: new Date().toISOString() },
      created_by: user.id,
    }).select('*').single()
    if (quotationError) return NextResponse.json({ error: quotationError.message }, { status: 409 })

    const quotationItems = result.items.map((item, index) => ({
      quotation_id: quotation.id,
      item_type: item.itemType,
      source_type: item.sourceType,
      source_id: item.sourceId,
      item_code: item.itemCode ?? null,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unitPrice,
      discount: item.discount,
      tax_rate: item.taxRate,
      tax_amount: item.taxAmount,
      line_total: item.lineTotal,
      sort_order: index,
      notes: item.notes ?? null,
    }))
    const { data: insertedItems, error: itemError } = await supabase.from('quotation_items').insert(quotationItems).select('*')
    if (itemError) {
      await supabase.from('quotations').delete().eq('id', quotation.id)
      return NextResponse.json({ error: itemError.message }, { status: 409 })
    }

    return NextResponse.json({ quotation, items: insertedItems ?? [] }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create quotation.' }, { status: 400 })
  }
}
