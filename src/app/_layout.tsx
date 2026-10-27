import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { configureNotificationHandler } from '@/lib/push';
import { SessionProvider } from '@/lib/session';
import { installWebAlert } from '@/lib/webAlert';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

configureNotificationHandler();
installWebAlert();

function ThemedStack() {
  const { colors, scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="dag/[day]" options={{ headerShown: true, title: 'Uit het archief', headerBackTitle: 'Terug' }} />
        <Stack.Screen name="quiz/[slug]/index" options={{ headerShown: true, title: 'Quiz', headerBackTitle: 'Terug' }} />
        <Stack.Screen name="quiz/[slug]/resultaat" options={{ headerShown: true, title: 'Uitslag', headerBackTitle: 'Terug' }} />
        <Stack.Screen name="kaarten/[thema]" options={{ headerShown: true, title: 'Kaarten', headerBackTitle: 'Terug' }} />
        <Stack.Screen name="archief" options={{ headerShown: true, title: 'Archief', headerBackTitle: 'Terug' }} />
        <Stack.Screen name="oefeningen/index" options={{ headerShown: true, title: 'Oefeningen', headerBackTitle: 'Terug' }} />
        <Stack.Screen name="oefeningen/[slug]" options={{ headerShown: true, title: 'Oefening', headerBackTitle: 'Terug' }} />
        <Stack.Screen name="ideeen" options={{ headerShown: true, title: 'Date-ideeën', headerBackTitle: 'Terug' }} />
        <Stack.Screen name="plannen" options={{ headerShown: true, title: 'Onze plannen', headerBackTitle: 'Terug' }} />
        <Stack.Screen name="datums" options={{ headerShown: true, title: 'Belangrijke datums', headerBackTitle: 'Terug' }} />
        <Stack.Screen name="auth-callback" options={{ gestureEnabled: false }} />
        <Stack.Screen name="overzetten" options={{ headerShown: true, title: 'Overzetten', headerBackTitle: 'Terug' }} />
        <Stack.Screen name="overzetcode" options={{ headerShown: true, title: 'Overzetten', headerBackTitle: 'Terug' }} />
        <Stack.Screen name="privacy" options={{ headerShown: true, title: 'Privacy', headerBackTitle: 'Terug' }} />
        <Stack.Screen name="herstelcode" options={{ headerShown: true, title: 'Herstelcode', headerBackTitle: 'Terug' }} />
        <Stack.Screen name="email-koppelen" options={{ headerShown: true, title: 'E-mail koppelen', headerBackTitle: 'Terug' }} />
        <Stack.Screen name="checkin" options={{ headerShown: true, title: 'Check-in', headerBackTitle: 'Terug' }} />
        <Stack.Screen name="hulp" options={{ headerShown: true, title: 'Hulp', headerBackTitle: 'Terug' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SessionProvider>
          <ThemedStack />
        </SessionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
