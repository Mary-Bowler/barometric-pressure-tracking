import { createClient } from '@supabase/supabase-js'

// Service-role client — bypasses RLS. Only import in trusted server contexts (cron, push routes).
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
