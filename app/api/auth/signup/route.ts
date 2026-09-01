import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../../lib/supabase-server'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()
    if (typeof email !== 'string' || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'Enter a valid email and a password of at least 6 characters.' }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ authenticated: Boolean(data.session), emailConfirmationRequired: !data.session })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create account.' }, { status: 500 })
  }
}
