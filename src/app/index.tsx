import { Redirect } from 'expo-router';
import { Loading } from '@/components/ui';
import { useSession } from '@/lib/session';

// Startpunt: stuurt je naar de juiste plek afhankelijk van je situatie.
export default function Index() {
  const { loading, session, me, partner } = useSession();

  if (loading) return <Loading />;
  if (!session) return <Redirect href="/inloggen" />;
  if (!me?.display_name) return <Redirect href="/profiel" />;
  if (!partner) return <Redirect href="/koppelen" />;
  return <Redirect href="/vandaag" />;
}
