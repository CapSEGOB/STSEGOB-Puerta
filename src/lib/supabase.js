import { createClient } from '@supabase/supabase-js'

// SOLO la URL y la clave publicable (anon). Las tablas tienen RLS sin
// policies: todo el acceso pasa por funciones security definer (RPC).
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
)
