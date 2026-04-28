import { createClient } from '@supabase/supabase-js';

const supabaseUrl = ((import.meta as any).env?.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// VITE_SUPABASE_ANON_KEY is public by design in a frontend app. Never place
// service-role keys, sb_secret values or database passwords in VITE_* vars.
export const supabase = createClient(
  supabaseUrl || 'https://invalid-project.supabase.co',
  supabaseAnonKey || 'invalid-anon-key'
);

export function assertSupabaseConfigured(): void {
  if (isSupabaseConfigured) return;
  throw new Error('Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
}
