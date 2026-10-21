import Ionicons from '@expo/vector-icons/Ionicons';
import * as Notifications from 'expo-notifications';
import { Redirect, router } from 'expo-router';
import { useEffect } from 'react';
import Tabs from 'expo-router/js-tabs';
import { Loading } from '@/components/ui';
import { registerForPush } from '@/lib/push';
import { useSession } from '@/lib/session';
import { useTheme } from '@/theme/ThemeProvider';

export default function TabsLayout() {
  const { colors } = useTheme();
  const { loading, session, me, partner } = useSession();
  const wantsPush = !!me && (me.notify_new_question || me.notify_partner_answered);

  // Token stil vernieuwen (zonder om toestemming te vragen) als meldingen aan staan.
  useEffect(() => {
    if (session && partner && wantsPush) registerForPush({ prompt: false });
  }, [session, partner, wantsPush]);

  // Tikken op een melding opent het juiste scherm.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (url === '/vandaag') router.navigate('/vandaag');
    });
    return () => sub.remove();
  }, []);

  if (loading) return <Loading />;
  if (!session || !partner) return <Redirect href="/" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 13 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="vandaag"
        options={{
          title: 'Vandaag',
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="quiz"
        options={{
          title: 'Quiz',
          tabBarIcon: ({ color, size }) => <Ionicons name="help-buoy-outline" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="kaarten"
        options={{
          title: 'Kaarten',
          tabBarIcon: ({ color, size }) => <Ionicons name="layers-outline" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="samen"
        options={{
          title: 'Samen',
          tabBarIcon: ({ color, size }) => <Ionicons name="heart-circle-outline" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="ik"
        options={{
          title: 'Ik',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" color={color as string} size={size} />,
        }}
      />
    </Tabs>
  );
}
