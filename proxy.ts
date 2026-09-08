import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './lib/supabase-config'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY

const publicPaths = new Set([
  '/', '/sign-in', '/sign-up', '/login', '/signup', '/billing', '/account', '/api/health',
  '/platform', '/features', '/templates', '/use-cases', '/pricing', '/demo', '/about', '/faq',
])

const isPublicPath = (pathname: string) =>
  publicPaths.has(pathname) ||
  pathname.startsWith('/api/auth/') || pathname.startsWith('/auth/') ||
  pathname.startsWith('/_next/')

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const publicPath = isPublicPath(pathname)
  const response = NextResponse.next({ request })

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: values => {
          values.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    })

    const { data: { user } } = await supabase.auth.getUser()

    if (!user && !publicPath) return NextResponse.redirect(new URL('/sign-in', request.url))
    if (!user) return response

    if (pathname === '/login' || pathname === '/signup') {
      return NextResponse.redirect(new URL('/executive', request.url))
    }

    if (!publicPath) {
      const { data: access, error } = await supabase.rpc('get_subscription_access')
      if (error || !access?.has_access) {
        const url = new URL('/billing', request.url)
        url.searchParams.set('reason', access?.status === 'EXPIRED' ? 'trial_expired' : 'subscription_required')
        return NextResponse.redirect(url)
      }
    }
  } catch {
    if (!publicPath) return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  return response
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
