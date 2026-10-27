import { Alert, Platform, type AlertButton } from 'react-native';

/**
 * Op het web doet Alert.alert niets. Daar gebruiken we de bevestigingsvraag van de browser:
 * OK voert de (laatste) actie uit, Annuleren de knop met style 'cancel'.
 */
export function confirmChoice(
  title: string | null | undefined,
  message: string | null | undefined,
  buttons: AlertButton[] | undefined,
  confirm: (text: string) => boolean,
  notify: (text: string) => void,
): void {
  const text = [title, message].filter(Boolean).join('\n\n');
  const all = buttons ?? [];
  const cancel = all.find((b) => b.style === 'cancel');
  const actions = all.filter((b) => b !== cancel);
  if (actions.length === 0) {
    notify(text);
    cancel?.onPress?.();
    return;
  }
  if (confirm(text)) actions[actions.length - 1].onPress?.();
  else cancel?.onPress?.();
}

export function installWebAlert(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  Alert.alert = (title, message, buttons) =>
    confirmChoice(title, message, buttons, (t) => window.confirm(t), (t) => window.alert(t));
}
