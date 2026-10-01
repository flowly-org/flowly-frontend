import { Injectable, inject, signal } from '@angular/core';

import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { AppNotification } from './models';
import { ToastService } from './toast.service';

const POLL_MS = 20_000;

/** Polls for notifications while the tab is visible; pops a toast (and a system notification if allowed). */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  readonly items = signal<AppNotification[]>([]);
  readonly unread = signal(0);
  /** Bumped whenever new notifications arrive, so open boards can refresh. */
  readonly version = signal(0);
  private timer: ReturnType<typeof setInterval> | null = null;
  private started = false;

  start() {
    if (this.started) return;
    this.started = true;
    this.refresh(true);
    this.timer = setInterval(() => {
      if (document.visibilityState === 'visible' && this.auth.isLoggedIn()) this.refresh(false);
    }, POLL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.auth.isLoggedIn()) this.refresh(false);
    });
  }

  async refresh(initial: boolean) {
    try {
      const lastId = this.items()[0]?.id;
      const res = await this.api.notifications(initial ? undefined : lastId);
      this.unread.set(res.unread);
      if (initial) {
        this.items.set(res.results);
        return;
      }
      if (res.results.length) {
        this.items.update((list) => [...res.results, ...list].slice(0, 50));
        this.version.update((v) => v + 1);
        for (const n of res.results.slice(0, 3)) this.announce(n);
      }
    } catch {
      // offline or logged out; try again next tick
    }
  }

  private announce(n: AppNotification) {
    this.toast.show(n.title);
    if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
      new Notification(n.title, { body: n.body, icon: '/favicon.svg', tag: `flowly-${n.id}` });
    }
  }

  async markRead(ids: number[] | 'all') {
    try {
      const res = await this.api.markNotificationsRead(ids);
      this.unread.set(res.unread);
      const now = new Date().toISOString();
      this.items.update((list) => list.map((n) => (ids === 'all' || ids.includes(n.id) ? { ...n, read_at: n.read_at ?? now } : n)));
    } catch {}
  }

  async enableSystemNotifications(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    return (await Notification.requestPermission()) === 'granted';
  }
}
