import { unregisterPush } from './push';
import { supabase } from './supabase';

export async function signOut(): Promise<void> {
  await unregisterPush();
  await supabase.auth.signOut();
}
