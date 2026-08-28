import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../lib/supabase-server'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('work_orders').select('id').limit(1)
  return NextResponse.json({ ok: !error, database: error ? 'error' : 'healthy', timestamp: new Date().toISOString() }, { status: error ? 503 : 200 })
}
