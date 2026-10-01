/**
 * Translations, one file per area of the app. Each maps the exact English text (the key used in the
 * templates) to its translation, per language. Missing entries fall back to English.
 *
 * The areas are loaded on demand (a separate chunk), so English users download no dictionaries.
 */
export type Dict = Partial<Record<'it' | 'es' | 'fr' | 'de' | 'pt', Record<string, string>>>;

export const DICTIONARIES: Record<string, Record<string, string>> = {};

let loading: Promise<void> | null = null;

export function loadDictionaries(): Promise<void> {
  loading ??= Promise.all([import('./shell'), import('./board'), import('./workspace'), import('./admin')]).then(
    ([shell, board, workspace, admin]) => {
      for (const area of [shell.SHELL, board.BOARD, workspace.WORKSPACE, admin.ADMIN]) {
        for (const [lang, entries] of Object.entries(area)) {
          DICTIONARIES[lang] = { ...(DICTIONARIES[lang] ?? {}), ...entries };
        }
      }
    },
  );
  return loading;
}
