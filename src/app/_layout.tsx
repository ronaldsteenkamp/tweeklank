import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { configureNotificationHandler } from '@/lib/push';
import { SessionProvider } from '@/lib/session';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

configureNotificationHandler();

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
        <Stack.Screen name="privacy" options={{ headerShown: true, title: 'Privacy', headerBackTitle: 'Terug' }} />
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
