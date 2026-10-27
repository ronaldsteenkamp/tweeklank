import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { chooseSeries, dismissSeriesOffer } from '@/lib/api';
import { friendlyError } from '@/lib/errors';
import { offerStatus, type SeriesOffer } from '@/lib/series';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { AppText, Button, Card, ErrorText } from './ui';

// Rustig aanbod voor een themaweek. Jullie kiezen samen; pas als jullie dezelfde kiezen, begint hij.
export function SeriesOfferCard({ offers, partnerName, onChanged }: { offers: SeriesOffer[]; partnerName: string; onChanged: () => void }) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (started) {
    return (
      <Card tone="alt">
        <AppText variant="large" accessibilityLiveRegion="polite">
          Jullie themaweek begint morgen.
        </AppText>
      </Card>
    );
  }
  if (offers.length === 0) return null;
  const status = offerStatus(offers, partnerName);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <AppText variant="large">Zin in een themaweek?</AppText>
      <AppText variant="small" muted>
        Zeven dagen vragen rond één onderwerp, met een oefening om af te sluiten. Daarna gaan de gewone vragen verder waar
        ze waren. Kies allebei dezelfde om te beginnen.
      </AppText>
      {status ? (
        <AppText color={colors.secondary} accessibilityLiveRegion="polite">
          {status}
        </AppText>
      ) : null}
      {offers.map((o) => {
        const chosen = o.i_chose;
        return (
          <Pressable
            key={o.slug}
            disabled={busy}
            onPress={() =>
              run(async () => {
                const result = await chooseSeries(o.series_id);
                if (result === 'gestart') setStarted(true);
                onChanged();
              })
            }
            accessibilityRole="radio"
            accessibilityState={{ checked: chosen, disabled: busy }}
            accessibilityLabel={`${o.title}. ${o.intro}${o.partner_chose ? `. ${partnerName} koos deze` : ''}`}
            style={({ pressed }) => ({
              minHeight: 44,
              padding: spacing.md,
              gap: spacing.xs,
              borderRadius: radius.md,
              borderWidth: 1.5,
              borderColor: chosen ? colors.primary : colors.border,
              backgroundColor: chosen ? colors.surfaceAlt : 'transparent',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <AppText variant="large">{o.title}</AppText>
            <AppText variant="small" muted>
              {o.intro}
            </AppText>
            {o.partner_chose ? (
              <AppText variant="label" color={colors.secondary}>
                {partnerName} koos deze
              </AppText>
            ) : null}
          </Pressable>
        );
      })}
      <View style={{ alignSelf: 'flex-start' }}>
        <Button
          kind="ghost"
          label="Nu niet"
          onPress={() =>
            run(async () => {
              await dismissSeriesOffer();
              onChanged();
            })
          }
          accessibilityHint="Verberg dit aanbod twee weken"
        />
      </View>
      <ErrorText message={error} />
    </Card>
  );
}
