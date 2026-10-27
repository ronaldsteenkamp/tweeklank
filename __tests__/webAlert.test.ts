jest.mock('react-native', () => ({ Alert: {}, Platform: { OS: 'web' } }));
import { confirmChoice } from '../src/lib/webAlert';

describe('bevestigen op het web', () => {
  const setup = () => {
    const calls: string[] = [];
    const buttons = [
      { text: 'Annuleren', style: 'cancel' as const, onPress: () => calls.push('cancel') },
      { text: 'Verwijderen', style: 'destructive' as const, onPress: () => calls.push('delete') },
    ];
    return { calls, buttons };
  };

  it('OK voert de actie uit', () => {
    const { calls, buttons } = setup();
    confirmChoice('Weg?', 'Zeker?', buttons, () => true, () => {});
    expect(calls).toEqual(['delete']);
  });

  it('Annuleren voert de actie niet uit', () => {
    const { calls, buttons } = setup();
    confirmChoice('Weg?', undefined, buttons, () => false, () => {});
    expect(calls).toEqual(['cancel']);
  });

  it('zonder knoppen alleen een melding', () => {
    const shown: string[] = [];
    confirmChoice('Er ging iets mis', undefined, undefined, () => true, (t) => shown.push(t));
    expect(shown).toEqual(['Er ging iets mis']);
  });
});
