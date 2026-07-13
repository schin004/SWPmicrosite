import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Client is safe to create even without keys — calls will simply fail gracefully
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Startup diagnostic — remove once data flow is confirmed
console.log(
  '[Supabase] configured:', isSupabaseConfigured,
  '| url:', supabaseUrl ? supabaseUrl.slice(0, 32) + '…' : '(missing)',
  '| key:', supabaseAnonKey ? supabaseAnonKey.slice(0, 12) + '…' : '(missing)'
);
