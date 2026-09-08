import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../../lib/supabase-server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''

    if (!email || !email.includes('@') || password.length < 8 || !name) {
      return NextResponse.json({ error: 'Enter your name, a valid email, and a password of at least 8 characters.' }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const origin = request.headers.get('origin') || new URL(request.url).origin
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${origin}/sign-in`,
      },
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ authenticated: Boolean(data.session), emailConfirmationRequired: !data.session })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create account.' }, { status: 500 })
  }
}
