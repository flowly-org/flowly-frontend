import { isNative } from './native';

const KEY = 'flowly.view';

/** Compact phone view (/m) or the full board. The user's explicit choice wins; otherwise phones get compact. */
export function prefersCompact(): boolean {
  let choice: string | null = null;
  try {
    choice = localStorage.getItem(KEY);
  } catch {}
  if (choice === 'compact') return true;
  if (choice === 'full') return false;
  return isNative() || window.matchMedia('(max-width: 640px)').matches;
}

export function setViewMode(mode: 'compact' | 'full') {
  try {
    localStorage.setItem(KEY, mode);
  } catch {}
}
