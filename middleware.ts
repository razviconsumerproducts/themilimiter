import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

export async function middleware(request: NextRequest) {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)')
  }

  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    { cookies: { getAll: () => request.cookies.getAll(), setAll: values => values.forEach(({name,value,options}) => { request.cookies.set(name,value); response.cookies.set(name,value,options) }) } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname
  const publicPath = pathname === '/login' || pathname === '/api/health' || pathname.startsWith('/auth/') || pathname.startsWith('/_next/') || pathname === '/favicon.ico'
  if (!user && !publicPath) return NextResponse.redirect(new URL('/login', request.url))
  if (user && pathname === '/login') return NextResponse.redirect(new URL('/', request.url))
  return response
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
