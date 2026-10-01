/** Local-calendar date helpers working on YYYY-MM-DD strings. */
export function toIsoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today(): string {
  return toIsoDate(new Date());
}

export function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, days: number): string {
  const d = parseIsoDate(s);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

function uiLang(): string {
  return document.documentElement.lang || undefined!;
}

export function formatLong(s: string): string {
  return parseIsoDate(s).toLocaleDateString(uiLang(), { weekday: 'long', day: 'numeric', month: 'long' });
}

export function formatShort(s: string): string {
  return parseIsoDate(s).toLocaleDateString(uiLang(), { day: 'numeric', month: 'short' });
}

export function isValidIsoDate(s: string | null | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(parseIsoDate(s).getTime());
}
