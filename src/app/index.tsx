import { Redirect } from 'expo-router';
import { AppText, Card, Screen, Loading } from '@/components/ui';
import { useSession } from '@/lib/session';
import { isConfigured } from '@/lib/supabase';

// Startpunt: stuurt je naar de juiste plek afhankelijk van je situatie.
export default function Index() {
  const { loading, session, me, partner } = useSession();

  if (!isConfigured) {
    return (
      <Screen>
        <AppText variant="title">Nog niet ingesteld</AppText>
        <Card>
          <AppText>
            Maak een bestand .env aan (zie .env.example) met EXPO_PUBLIC_SUPABASE_URL en EXPO_PUBLIC_SUPABASE_ANON_KEY,
            en start Expo opnieuw.
          </AppText>
        </Card>
      </Screen>
    );
  }
  if (loading) return <Loading />;
  if (!session) return <Redirect href="/inloggen" />;
  if (!me?.display_name) return <Redirect href="/profiel" />;
  if (!partner) return <Redirect href="/koppelen" />;
  return <Redirect href="/vandaag" />;
}
