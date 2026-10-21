import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const TOKEN_KEY = 'tweeklank.pushToken';

export type PushResult = { ok: true } | { ok: false; message: string };

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/**
 * Vraagt (zo nodig) toestemming en registreert het pushtoken van dit toestel.
 * Met `prompt: false` wordt er nooit om toestemming gevraagd (stil vernieuwen bij het opstarten).
 */
export async function registerForPush({ prompt = true }: { prompt?: boolean } = {}): Promise<PushResult> {
  if (Platform.OS === 'web') return { ok: false, message: 'Meldingen werken alleen in de app op je telefoon.' };
  if (!Device.isDevice) return { ok: false, message: 'Pushmeldingen werken alleen op een echt toestel, niet in een simulator.' };
  if (Platform.OS === 'android' && isExpoGo) {
    return {
      ok: false,
      message: 'Expo Go op Android ondersteunt geen pushmeldingen. Gebruik een development build (zie README).',
    };
  }
  const id = projectId();
  if (!id) return { ok: false, message: 'De app heeft nog geen EAS-projectId. Draai eenmalig: npx eas-cli init (zie README).' };

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Meldingen',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && prompt) perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) {
      return { ok: false, message: 'Meldingen staan uit voor Tweeklank. Zet ze aan in de instellingen van je telefoon.' };
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    const { error } = await supabase.rpc('register_push_token', {
      p_token: token,
      p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
    if (error) throw error;
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return { ok: true };
  } catch {
    return { ok: false, message: 'Het lukte niet om meldingen aan te zetten. Probeer het later opnieuw.' };
  }
}

/** Verwijdert het token van dit toestel (bij alles uitzetten of uitloggen). */
export async function unregisterPush(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    await supabase.from('push_tokens').delete().eq('token', token);
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    // Niet erg: ongeldige tokens worden bij het versturen ook opgeruimd.
  }
}
