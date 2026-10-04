export const SUPABASE_URL = 'https://nsatyauawqbgtlnlbkms.supabase.co'

// Supabase publishable key. This key is safe for browser/server client initialization;
// database access remains protected by Supabase RLS and server-side authorization.
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_J9hAJp5CB5_QyNjaYanQDA_lefSfB9T'
