/**
 * Translations, one file per area of the app. Each maps the exact English text (the key used in the
 * templates) to its translation, per language. Missing entries fall back to English.
 */
import { ADMIN } from './admin';
import { BOARD } from './board';
import { SHELL } from './shell';
import { WORKSPACE } from './workspace';

export type Dict = Partial<Record<'it' | 'es' | 'fr' | 'de' | 'pt', Record<string, string>>>;

export const DICTIONARIES: Record<string, Record<string, string>> = {};

for (const area of [SHELL, BOARD, WORKSPACE, ADMIN]) {
  for (const [lang, entries] of Object.entries(area)) {
    DICTIONARIES[lang] = { ...(DICTIONARIES[lang] ?? {}), ...entries };
  }
}
