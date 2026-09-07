import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../lib/supabase-server'
import { calculatePurchaseOrder } from '../../../lib/millimetre'

function requiredString(value: unknown, field: string): string {
  const result = String(value ?? '').trim()
  if (!result) throw new Error(`${field} is required.`)
  return result
}

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const projectId = new URL(request.url).searchParams.get('projectId')
    if (!projectId) return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })

    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*, purchase_order_items(*)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ purchaseOrders: data ?? [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load purchase orders.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const body = await request.json() as Record<string, unknown>
    const projectId = requiredString(body.projectId, 'projectId')
    const supplierId = requiredString(body.supplierId, 'supplierId')
    const purchaseRequestId = requiredString(body.purchaseRequestId, 'purchaseRequestId')
    const poCode = requiredString(body.poCode, 'poCode')
    const status = String(body.status ?? 'DRAFT').trim().toUpperCase()
    if (!['DRAFT', 'PENDING_APPROVAL'].includes(status)) {
      return NextResponse.json({ error: 'Initial purchase order status must be DRAFT or PENDING_APPROVAL.' }, { status: 400 })
    }

    const rawItems = Array.isArray(body.items) ? body.items : []
    if (!rawItems.length) return NextResponse.json({ error: 'At least one purchase order item is required.' }, { status: 400 })

    const items = rawItems.map((raw, index) => {
      const item = raw as Record<string, unknown>
      return {
        itemCode: requiredString(item.itemCode, `items[${index}].itemCode`),
        description: requiredString(item.description, `items[${index}].description`),
        quantity: Number(item.quantity),
        unit: requiredString(item.unit, `items[${index}].unit`),
        unitPrice: Number(item.unitPrice),
        taxRate: item.taxRate == null ? 0 : Number(item.taxRate),
        priceSnapshot: item.priceSnapshot && typeof item.priceSnapshot === 'object' ? item.priceSnapshot as Record<string, unknown> : {},
      }
    })

    const result = calculatePurchaseOrder(items)

    const { data: order, error: orderError } = await supabase
      .from('purchase_orders')
      .insert({
        project_id: projectId,
        supplier_id: supplierId,
        purchase_request_id: purchaseRequestId,
        po_code: poCode,
        status,
        currency: body.currency == null ? 'INR' : String(body.currency),
        subtotal: result.subtotal,
        tax: result.tax,
        order_date: body.orderDate == null ? null : String(body.orderDate),
        expected_date: body.expectedDate == null ? null : String(body.expectedDate),
        notes: body.notes == null ? null : String(body.notes),
      })
      .select('*')
      .single()

    if (orderError) return NextResponse.json({ error: orderError.message }, { status: 409 })

    const dbItems = result.items.map((item) => {
      const raw = rawItems.find((candidate) => {
        if (!candidate || typeof candidate !== 'object') return false
        const source = candidate as Record<string, unknown>
        return String(source.itemCode ?? '').trim() === item.itemCode && String(source.description ?? '').trim() === item.description
      }) as Record<string, unknown> | undefined

      return {
        purchase_order_id: order.id,
        project_id: projectId,
        purchase_request_item_id: raw?.purchaseRequestItemId == null ? null : String(raw.purchaseRequestItemId),
        supplier_item_id: raw?.supplierItemId == null ? null : String(raw.supplierItemId),
        item_code: item.itemCode,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unitPrice,
        tax_rate: item.taxRate ?? 0,
        price_snapshot: item.priceSnapshot ?? {},
        notes: raw?.notes == null ? null : String(raw.notes),
      }
    })

    const { data: insertedItems, error: itemError } = await supabase
      .from('purchase_order_items').insert(dbItems).select('*')

    if (itemError) {
      await supabase.from('purchase_orders').delete().eq('id', order.id)
      return NextResponse.json({ error: itemError.message }, { status: 409 })
    }

    return NextResponse.json({ purchaseOrder: order, items: insertedItems ?? [], createdBy: user.id }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create purchase order.' }, { status: 400 })
  }
}
