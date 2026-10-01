import { Injectable, signal } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import localeEs from '@angular/common/locales/es';
import localeFr from '@angular/common/locales/fr';
import localeIt from '@angular/common/locales/it';
import localePt from '@angular/common/locales/pt';

import { DICTIONARIES } from '../i18n';

export type Lang = 'en' | 'it' | 'es' | 'fr' | 'de' | 'pt';

export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'it', label: 'Italiano' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
];

for (const data of [localeIt, localeEs, localeFr, localeDe, localePt]) registerLocaleData(data);

const KEY = 'flowly.lang';

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY) as Lang | null;
    if (saved && LANGUAGES.some((l) => l.code === saved)) return saved;
  } catch {}
  const browser = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return (LANGUAGES.find((l) => l.code === browser)?.code ?? 'en') as Lang;
}

/**
 * Runtime translations. Keys are the English texts themselves, so templates stay readable and
 * anything untranslated falls back to English. Placeholders: `{name}`.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly lang = signal<Lang>(detect());

  constructor() {
    document.documentElement.lang = this.lang();
  }

  set(lang: Lang) {
    this.lang.set(lang);
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(KEY, lang);
    } catch {}
  }

  t(text: string, params?: Record<string, string | number | null | undefined>): string {
    const lang = this.lang();
    const translated = lang === 'en' ? text : (DICTIONARIES[lang]?.[text] ?? text);
    if (!params) return translated;
    return translated.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? '') + '');
  }
}
