import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../../lib/supabase-server'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()
    if (typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) return NextResponse.json({ error: error.message }, { status: 401 })

    return NextResponse.json({ authenticated: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to sign in.' }, { status: 500 })
  }
}
