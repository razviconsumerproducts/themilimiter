import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

function getSupabaseClient() {
  if (client) return client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase public configuration')
  }

  client = createBrowserClient(url, key)
  return client
}

// Lazy initialization prevents Supabase configuration from being evaluated during Next.js prerender/build.
export const supabase = new Proxy({} as ReturnType<typeof createBrowserClient>, {
  get(_target, property) {
    const value = Reflect.get(getSupabaseClient() as object, property)
    return typeof value === 'function' ? value.bind(getSupabaseClient()) : value
  },
})

export { getSupabaseClient }
