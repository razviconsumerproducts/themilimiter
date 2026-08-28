import { createClient } from '@supabase/supabase-js'

// Vercel currently has not injected the public Supabase variables into the
// production build. Keep the browser-safe project URL/key as a fallback so
// builds cannot fail during Next.js page collection. RLS must protect data.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nsatyauawqbgtlnlbkms.supabase.co'
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_J9hAJp5CB5_QyNjaYanQDA_lefSfB9T'

export const supabase = createClient(url, key)
