import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../lib/supabase-server'
import { buildQuotation } from '../../../lib/millimetre'

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const body = await request.json() as {
      projectId?: string; costingRunId?: string; quotationCode?: string; version?: number; currency?: string; validUntil?: string
      paymentTerms?: string; deliveryTerms?: string; installationTerms?: string; warrantyTerms?: string; notes?: string; customerNotes?: string
      items?: Array<{ itemType: string; sourceType?: string; sourceId?: string; itemCode?: string; description: string; quantity: number; unit: string; unitPrice: number; discount?: number; taxRate?: number; notes?: string }>
    }
    if (!body.projectId || !body.costingRunId || !body.quotationCode) return NextResponse.json({ error: 'projectId, costingRunId and quotationCode are required.' }, { status: 400 })

    const { data: costing, error: costingError } = await supabase.from('costing_runs').select('id, project_id, status, currency, output_snapshot, total_cost, selling_price').eq('id', body.costingRunId).maybeSingle()
    if (costingError) return NextResponse.json({ error: costingError.message }, { status: 500 })
    if (!costing) return NextResponse.json({ error: 'Costing run not found.' }, { status: 404 })
    if (costing.project_id !== body.projectId) return NextResponse.json({ error: 'Costing run does not belong to the requested project.' }, { status: 409 })
    if (!['APPROVED', 'LOCKED'].includes(costing.status)) return NextResponse.json({ error: 'Quotation requires an approved or locked costing run.' }, { status: 409 })

    const { data: project, error: projectError } = await supabase.from('projects').select('id, customer_id').eq('id', body.projectId).maybeSingle()
    if (projectError) return NextResponse.json({ error: projectError.message }, { status: 500 })
    if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })

    const currency = body.currency ?? costing.currency ?? 'INR'
    if (currency !== costing.currency) return NextResponse.json({ error: 'Quotation currency must match the costing run currency.' }, { status: 409 })
    const version = body.version ?? 1
    const quotation = buildQuotation({ projectId: project.id, customerId: project.customer_id, costingRunId: costing.id, quotationCode: body.quotationCode, version, currency, items: body.items ?? [], paymentTerms: body.paymentTerms, deliveryTerms: body.deliveryTerms, installationTerms: body.installationTerms, warrantyTerms: body.warrantyTerms, notes: body.notes, customerNotes: body.customerNotes, costSnapshot: costing.output_snapshot ?? { costingRunId: costing.id, totalCost: costing.total_cost, sellingPrice: costing.selling_price } })

    const { data: inserted, error: insertError } = await supabase.from('quotations').insert({ project_id: quotation.projectId, customer_id: quotation.customerId, costing_run_id: quotation.costingRunId, quotation_code: quotation.quotationCode, version: quotation.version, status: 'DRAFT', quotation_date: new Date().toISOString().slice(0, 10), valid_until: body.validUntil ?? null, currency: quotation.currency, subtotal: quotation.subtotal, discount: quotation.discount, taxable_amount: quotation.taxableAmount, tax_amount: quotation.taxAmount, payment_terms: body.paymentTerms ?? null, delivery_terms: body.deliveryTerms ?? null, installation_terms: body.installationTerms ?? null, warranty_terms: body.warrantyTerms ?? null, notes: body.notes ?? null, customer_notes: body.customerNotes ?? null, cost_snapshot: quotation.costSnapshot, commercial_snapshot: quotation.commercialSnapshot, created_by: user.id }).select('*').single()
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 409 })

    if (quotation.items.length) {
      const { error: itemError } = await supabase.from('quotation_items').insert(quotation.items.map((item, index) => ({ quotation_id: inserted.id, item_type: item.itemType, source_type: item.sourceType ?? null, source_id: item.sourceId ?? null, item_code: item.itemCode ?? null, description: item.description, quantity: item.quantity, unit: item.unit, unit_price: item.unitPrice, discount: item.discount, tax_rate: item.taxRate, tax_amount: item.taxAmount, line_total: item.lineTotal, sort_order: index, notes: item.notes ?? null })))
      if (itemError) return NextResponse.json({ error: itemError.message }, { status: 409 })
    }
    return NextResponse.json({ quotation: inserted, items: quotation.items }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create quotation.' }, { status: 500 })
  }
}
