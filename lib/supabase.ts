import { createBrowserClient } from '@supabase/ssr'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nsatyauawqbgtlnlbkms.supabase.co'
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_J9hAJp5CB5_QyNjaYanQDA_lefSfB9T'

export const supabase = createBrowserClient(url, key)
