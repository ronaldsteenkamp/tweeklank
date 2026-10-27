// "Bewaar een manier om terug te komen": wanneer de kaart op Vandaag verschijnt.
// Getest in __tests__/recovery.test.ts

export const RECOVERY_AFTER_DAYS = 7;

/** Eén keer, na 7 dagen gebruik, alleen voor een account zonder e-mail. Daarna alleen nog onder Ik. */
export function showRecoveryCard(params: { phoneOnly: boolean; createdAt: string | undefined; seen: boolean; now?: Date }): boolean {
  if (!params.phoneOnly || params.seen || !params.createdAt) return false;
  const age = (params.now ?? new Date()).getTime() - new Date(params.createdAt).getTime();
  return age >= RECOVERY_AFTER_DAYS * 86_400_000;
}
