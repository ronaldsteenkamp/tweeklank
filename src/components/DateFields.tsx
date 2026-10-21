import { View } from 'react-native';
import { spacing } from '@/theme/tokens';
import { AppText, ErrorText, Field } from './ui';

export type DateParts = { day: string; month: string; year: string };

// Datuminvoer met drie numerieke velden; werkt overal (ook in Expo Go) zonder native date-picker.
export function DateFields({ label, value, onChange, error }: { label: string; value: DateParts; onChange: (v: DateParts) => void; error?: string | null }) {
  const set = (key: keyof DateParts) => (text: string) => onChange({ ...value, [key]: text.replace(/\D/g, '') });
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label" muted>
        {label}
      </AppText>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Field label="Dag" value={value.day} onChangeText={set('day')} keyboardType="number-pad" maxLength={2} placeholder="dd" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Maand" value={value.month} onChangeText={set('month')} keyboardType="number-pad" maxLength={2} placeholder="mm" />
        </View>
        <View style={{ flex: 1.4 }}>
          <Field label="Jaar" value={value.year} onChangeText={set('year')} keyboardType="number-pad" maxLength={4} placeholder="jjjj" />
        </View>
      </View>
      <ErrorText message={error} />
    </View>
  );
}
