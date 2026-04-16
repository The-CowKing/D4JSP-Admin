import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://isjkdbmfxpxuuloqosib.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzamtkYm1meHB4dXVsb3Fvc2liIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NDk4MDcsImV4cCI6MjA5MDIyNTgwN30.UdzV7PkGnEo0jgnViPzif13kaS88MeAnhHYsbbg2ugA';

// autoRefreshToken: true — GoTrue refreshes before expiry via a shared mutex.
// Leaving enabled so the main session stays fresh for RLS-gated queries.
// Debug writes use a SEPARATE client (lib/debug-context.js) with autoRefreshToken:false
// so they can never block the main client's token-refresh lock.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
