import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nsatyauawqbgtlnlbkms.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_J9hAJp5CB5_QyNjaYanQDA_lefSfB9T',
    { cookies: { getAll: () => request.cookies.getAll(), setAll: values => values.forEach(({name,value}) => { request.cookies.set(name,value); response.cookies.set(name,value) }) } }
  )
  await supabase.auth.getUser()
  return response
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
