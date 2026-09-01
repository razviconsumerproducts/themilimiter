export const SUPABASE_URL = 'https://nsatyauawqbgtlnlbkms.supabase.co'

// This is intentionally read from the deployment environment at runtime/build time.
// Do not commit API keys to the repository.
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  ''
