import { createBrowserClient } from '@supabase/ssr'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabase-config'

let client: ReturnType<typeof createBrowserClient> | null = null

function getSupabaseClient() {
  if (client) return client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_PUBLISHABLE_KEY
  client = createBrowserClient(url, key)
  return client
}

export const supabase = new Proxy({} as ReturnType<typeof createBrowserClient>, {
  get(_target, property) {
    const value = Reflect.get(getSupabaseClient() as object, property)
    return typeof value === 'function' ? value.bind(getSupabaseClient()) : value
  },
})

export { getSupabaseClient }
