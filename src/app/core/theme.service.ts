import { Injectable, signal } from '@angular/core';

export type Theme = 'auto' | 'light' | 'dark';

const KEY = 'flowly.theme';

/** Light / dark / auto (follow the OS). Stored per browser; applied as data-theme on <html>. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(this.read());

  set(theme: Theme): void {
    this.theme.set(theme);
    try {
      if (theme === 'auto') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, theme);
    } catch {}
    this.apply();
  }

  apply(): void {
    const root = document.documentElement;
    const theme = this.theme();
    if (theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }

  private read(): Theme {
    try {
      const t = localStorage.getItem(KEY);
      return t === 'light' || t === 'dark' ? t : 'auto';
    } catch {
      return 'auto';
    }
  }
}
