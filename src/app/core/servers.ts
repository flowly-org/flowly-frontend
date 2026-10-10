import { isNative } from './native';

/** A Flowly server the mobile app can sign in to. The web app always talks to the server that serves it. */
export interface Server {
  id: string;
  name: string;
  apiUrl: string;
}

const LIST = 'flowly.servers';
const ACTIVE = 'flowly.server';
export const DEFAULT_SERVER: Server = { id: 'flowly', name: 'flowly.net', apiUrl: 'https://api.flowly.net/api' };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

/** Servers on this device (mobile app only; flowly.net first unless removed). */
export function servers(): Server[] {
  if (!isNative()) return [];
  const list = read<Server[]>(LIST, []);
  return list.length ? list : [DEFAULT_SERVER];
}

export function activeServer(): Server | null {
  const list = servers();
  if (!list.length) return null;
  const id = read<string>(ACTIVE, list[0].id);
  return list.find((s) => s.id === id) ?? list[0];
}

export function setActiveServer(id: string) {
  write(ACTIVE, id);
}

export function saveServer(server: Server) {
  const list = servers().filter((s) => s.id !== server.id);
  write(LIST, [...list, server]);
}

export function removeServer(id: string) {
  const list = servers().filter((s) => s.id !== id);
  write(LIST, list.length ? list : [DEFAULT_SERVER]);
  if (activeServer()?.id === id) setActiveServer((list[0] ?? DEFAULT_SERVER).id);
}

/** Storage key for a per-server value. flowly.net keeps the original keys, so existing sessions survive. */
export function serverKey(base: string): string {
  const server = activeServer();
  return !server || server.id === DEFAULT_SERVER.id ? base : `${base}.${server.id}`;
}

/** Turns what someone typed ("flowly.acme.com", "https://acme.com/flowly", "https://api.flowly.net") into a server,
 * by asking each candidate address whether it's a Flowly API. */
export async function resolveServer(input: string): Promise<Server> {
  let text = input.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(text)) text = `https://${text}`;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error('That doesn\'t look like a web address.');
  }
  const local = ['localhost', '127.0.0.1'].includes(url.hostname) || url.hostname.endsWith('.local');
  if (url.protocol !== 'https:' && !local) throw new Error('Use an https:// address.');
  const base = `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
  const candidates = base.endsWith('/api') ? [base] : [`${base}/api`, base];
  for (const apiUrl of candidates) {
    try {
      const res = await fetch(`${apiUrl}/auth/sso/discover/?email=probe%40example.com`, { headers: { Accept: 'application/json' } });
      if (res.ok && 'sso' in (await res.json())) {
        return { id: url.host + url.pathname.replace(/\/+$/, ''), name: url.host, apiUrl };
      }
    } catch {
      /* try the next one */
    }
  }
  throw new Error('No Flowly server answered at that address.');
}
