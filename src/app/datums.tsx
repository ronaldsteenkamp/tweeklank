import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { DateFields, type DateParts } from '@/components/DateFields';
import { AppText, Button, Card, Chip, ErrorText, Field, Pill, Row, Screen } from '@/components/ui';
import { deleteImportantDate, fetchImportantDates, saveImportantDate } from '@/lib/api';
import { amsterdamDay } from '@/lib/dates';
import { friendlyError } from '@/lib/errors';
import { useSession } from '@/lib/session';
import {
  daysUntil,
  formatDateNl,
  KIND_LABEL,
  parseDateParts,
  relativeLabel,
  REMIND_OPTIONS,
  sortDates,
  splitDate,
  yearsAt,
  type DateKind,
  type ImportantDate,
} from '@/lib/together';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

type Draft = { id?: number; title: string; kind: DateKind; date: DateParts; yearly: boolean; remind: number };
const NEW: Draft = { title: '', kind: 'jubileum', date: { day: '', month: '', year: '' }, yearly: true, remind: 7 };
const REMIND_LABEL: Record<number, string> = { 0: 'Op de dag', 1: '1 dag', 3: '3 dagen', 7: '1 week', 14: '2 weken' };

export default function Datums() {
  const { colors } = useTheme();
  const { me, coupleId } = useSession();
  const [dates, setDates] = useState<ImportantDate[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = amsterdamDay();

  const load = useCallback(async () => {
    try {
      setDates(await fetchImportantDates());
    } catch (e) {
      setError(friendlyError(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const parsed = draft ? parseDateParts(draft.date.day, draft.date.month, draft.date.year) : null;
  const dateError = draft && draft.date.year.length === 4 && !parsed ? 'Deze datum bestaat niet.' : null;

  const save = async () => {
    if (!draft || !parsed || !draft.title.trim() || !me || !coupleId) return;
    setBusy(true);
    setError(null);
    try {
      await saveImportantDate({
        coupleId,
        userId: me.id,
        id: draft.id,
        value: { title: draft.title, kind: draft.kind, date: parsed, yearly: draft.yearly, remind_days_before: draft.remind },
      });
      setDraft(null);
      await load();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const edit = (d: ImportantDate) =>
    setDraft({ id: d.id, title: d.title, kind: d.kind, date: splitDate(d.date), yearly: d.yearly, remind: d.remind_days_before });

  const confirmDelete = (d: ImportantDate) =>
    Alert.alert('Datum verwijderen?', d.title, [
      { text: 'Annuleren', style: 'cancel' },
      {
        text: 'Verwijderen',
        style: 'destructive',
        onPress: () =>
          deleteImportantDate(d.id)
            .then(() => {
              setDraft(null);
              return load();
            })
            .catch((e) => setError(friendlyError(e))),
      },
    ]);

  return (
    <Screen>
      {draft ? (
        <Card>
          <AppText variant="large">{draft.id ? 'Datum bewerken' : 'Nieuwe datum'}</AppText>
          <Field
            label="Naam"
            value={draft.title}
            onChangeText={(t) => setDraft({ ...draft, title: t })}
            maxLength={80}
            placeholder="Bijvoorbeeld: Ons jubileum"
          />
          <AppText variant="label" muted>
            Soort
          </AppText>
          <Row wrap>
            {(Object.keys(KIND_LABEL) as DateKind[]).map((k) => (
              <Chip key={k} label={KIND_LABEL[k]} active={draft.kind === k} onPress={() => setDraft({ ...draft, kind: k })} />
            ))}
          </Row>
          <DateFields label="Datum" value={draft.date} onChange={(v) => setDraft({ ...draft, date: v })} error={dateError} />
          <Row>
            <AppText style={{ flex: 1 }}>Elk jaar terugkerend</AppText>
            <Switch
              value={draft.yearly}
              onValueChange={(v) => setDraft({ ...draft, yearly: v })}
              accessibilityLabel="Elk jaar terugkerend"
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.surface}
            />
          </Row>
          <AppText variant="label" muted>
            Herinnering vooraf
          </AppText>
          <Row wrap>
            {REMIND_OPTIONS.map((r) => (
              <Chip key={r} label={REMIND_LABEL[r]} active={draft.remind === r} onPress={() => setDraft({ ...draft, remind: r })} accessibilityLabel={`Herinnering: ${REMIND_LABEL[r]}`} />
            ))}
          </Row>
          <AppText variant="small" muted>
            Herinneringen komen als pushmelding, als je die hebt aangezet onder Ik.
          </AppText>
          <Button label="Opslaan" onPress={save} disabled={!draft.title.trim() || !parsed} busy={busy} />
          <Button kind="ghost" label="Annuleren" onPress={() => setDraft(null)} />
        </Card>
      ) : (
        <Button label="Datum toevoegen" onPress={() => setDraft(NEW)} />
      )}
      <ErrorText message={error} />
      {dates.length === 0 && !draft && <AppText muted>Voeg jullie jubileum, verjaardagen of andere belangrijke dagen toe.</AppText>}
      {sortDates(dates, today).map((d) => {
        const days = d.next ? daysUntil(d.next, today) : null;
        const years = d.next && d.yearly ? yearsAt(d.date, d.next) : 0;
        return (
          <Card key={d.id}>
            <Row>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <AppText variant="label" color={colors.secondary}>
                  {KIND_LABEL[d.kind]}
                  {d.yearly ? ' · elk jaar' : ''}
                </AppText>
                <AppText variant="large">{d.title}</AppText>
                <AppText variant="small" muted>
                  {d.next ? formatDateNl(d.next) : `${formatDateNl(d.date)} (geweest)`}
                  {d.kind === 'jubileum' && years > 0 ? ` · ${years} jaar` : ''}
                </AppText>
              </View>
              {days !== null && <Pill label={relativeLabel(days)} tone={days <= 7 ? 'accent' : 'secondary'} />}
            </Row>
            <Row>
              <Button kind="ghost" label="Bewerken" onPress={() => edit(d)} accessibilityHint={`Bewerk ${d.title}`} />
              <Button kind="ghost" label="Verwijderen" onPress={() => confirmDelete(d)} accessibilityHint={`Verwijder ${d.title}`} />
            </Row>
          </Card>
        );
      })}
    </Screen>
  );
}
