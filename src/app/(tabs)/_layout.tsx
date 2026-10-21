import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect } from 'expo-router';
import Tabs from 'expo-router/js-tabs';
import { Loading } from '@/components/ui';
import { useSession } from '@/lib/session';
import { useTheme } from '@/theme/ThemeProvider';

export default function TabsLayout() {
  const { colors } = useTheme();
  const { loading, session, partner } = useSession();

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
        name="archief"
        options={{
          title: 'Archief',
          tabBarIcon: ({ color, size }) => <Ionicons name="albums-outline" color={color as string} size={size} />,
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
