import AsyncStorage from '@react-native-async-storage/async-storage';

// Een code uit een uitnodigingslink bewaren tot de gebruiker is ingelogd.
const KEY = 'tweeklank.pendingInvite';

export async function setPendingInvite(code: string) {
  await AsyncStorage.setItem(KEY, code).catch(() => {});
}

export async function takePendingInvite(): Promise<string | null> {
  try {
    const code = await AsyncStorage.getItem(KEY);
    if (code) await AsyncStorage.removeItem(KEY);
    return code;
  } catch {
    return null;
  }
}
