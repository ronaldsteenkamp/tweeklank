import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { secureStorage } from './secureStorage';

// Standaard het Tweeklank-project. Dit zijn publieke sleutels (bedoeld om in de app mee te leveren);
// de data wordt beschermd door de RLS-regels in de database. Een eigen project? Zet dan .env (zie .env.example).
const DEFAULT_URL = 'https://qexufuyxaxvsyaelpfkr.supabase.co';
const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_E0id8_XA4R8XnvcOpot5QA_gM82X1oh';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_PUBLISHABLE_KEY;

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Inloglink: de sessie komt in het #-deel van de terug-link (zie src/app/auth-callback.tsx)
    flowType: 'implicit',
  },
});

// Ververs de sessie alleen terwijl de app op de voorgrond staat.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
