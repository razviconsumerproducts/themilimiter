import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const publicPath =
    pathname === '/login' ||
    pathname === '/api/health' ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico'

  // Never crash the entire deployment because auth configuration is missing.
  // Public routes remain reachable so the configuration can be repaired.
  if (!supabaseUrl || !supabaseKey) {
    if (publicPath) return NextResponse.next()
    return NextResponse.redirect(new URL('/login', request.url))
  }

  let response = NextResponse.next({ request })

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values) => {
          values.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    })

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user && !publicPath) return NextResponse.redirect(new URL('/login', request.url))
    if (user && pathname === '/login') return NextResponse.redirect(new URL('/', request.url))
  } catch {
    // Treat auth failures as unauthenticated instead of allowing middleware
    // invocation errors to turn into a deployment-wide 500.
    if (!publicPath) return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
