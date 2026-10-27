// Types voor scripts/content-rules.js (gebruikt in de Jest-tests).
export type ContentRow = { slug: string; [column: string]: unknown };
export function splitTuple(src: string): (string | number | boolean | null)[];
export function parseContent(sqlFiles: string[]): Record<string, Record<string, ContentRow>>;
export function genderedWords(text: string): string[];
export function similarity(a: string, b: string): number;
export function nearDuplicates(items: { slug: string; text: string }[], limit?: number): [string, string, number][];
export function depthDistribution(depths: number[]): {
  total: number;
  share: Record<1 | 2 | 3, number>;
  ok: boolean;
  problems: number[];
};
export const SIMILARITY_LIMIT: number;
export const DEPTH_TARGET: Record<1 | 2 | 3, number>;
