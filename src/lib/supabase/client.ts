import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const configuration = (() => {
  try {
    return { client: url && key ? createClient(url, key) : null, error: !!url !== !!key };
  } catch {
    return { client: null, error: true };
  }
})();
export const configurationError = configuration.error;
export const supabase = configuration.client;
export const localMode =
  !url && !key && (import.meta.env.DEV || import.meta.env.VITE_ENABLE_LOCAL_DATABASE === 'true');
