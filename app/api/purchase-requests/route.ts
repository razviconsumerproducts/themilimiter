import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../lib/supabase-server'

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
      .from('purchase_requests')
      .select('*, purchase_request_items(*)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ purchaseRequests: data ?? [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load purchase requests.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const body = await request.json() as Record<string, unknown>
    const projectId = requiredString(body.projectId, 'projectId')
    const requestCode = requiredString(body.requestCode, 'requestCode')
    const status = String(body.status ?? 'DRAFT').trim().toUpperCase()
    if (!['DRAFT', 'SUBMITTED'].includes(status)) {
      return NextResponse.json({ error: 'Initial purchase request status must be DRAFT or SUBMITTED.' }, { status: 400 })
    }

    const rawItems = Array.isArray(body.items) ? body.items : []
    if (!rawItems.length) return NextResponse.json({ error: 'At least one purchase request item is required.' }, { status: 400 })

    const { data: project, error: projectError } = await supabase
      .from('projects').select('id').eq('id', projectId).maybeSingle()
    if (projectError) throw new Error(projectError.message)
    if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })

    const { data: purchaseRequest, error: requestError } = await supabase
      .from('purchase_requests')
      .insert({
        project_id: projectId,
        request_code: requestCode,
        status,
        requested_by: user.id,
        requested_at: new Date().toISOString(),
        notes: body.notes == null ? null : String(body.notes),
      })
      .select('*')
      .single()

    if (requestError) return NextResponse.json({ error: requestError.message }, { status: 409 })

    const items = rawItems.map((raw, index) => {
      const item = raw as Record<string, unknown>
      const quantity = Number(item.quantity)
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`Item ${index + 1}: quantity must be greater than zero.`)
      return {
        purchase_request_id: purchaseRequest.id,
        project_id: projectId,
        bom_item_id: item.bomItemId == null ? null : String(item.bomItemId),
        item_code: requiredString(item.itemCode, `items[${index}].itemCode`),
        description: requiredString(item.description, `items[${index}].description`),
        quantity,
        unit: requiredString(item.unit, `items[${index}].unit`),
        required_date: item.requiredDate == null ? null : String(item.requiredDate),
        notes: item.notes == null ? null : String(item.notes),
      }
    })

    const { data: insertedItems, error: itemError } = await supabase
      .from('purchase_request_items').insert(items).select('*')

    if (itemError) {
      await supabase.from('purchase_requests').delete().eq('id', purchaseRequest.id)
      return NextResponse.json({ error: itemError.message }, { status: 409 })
    }

    return NextResponse.json({ purchaseRequest, items: insertedItems ?? [] }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create purchase request.' }, { status: 400 })
  }
}
