import { Injectable, computed, inject, signal } from '@angular/core';

import { ApiService, errorMessage } from './api.service';
import { TimeEntry } from './models';
import { I18nService } from './i18n.service';
import { ToastService } from './toast.service';

/** The user's single running timer (shared by the top bar, cards and the task dialog). */
@Injectable({ providedIn: 'root' })
export class TimerService {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private i18n = inject(I18nService);

  readonly entry = signal<TimeEntry | null>(null);
  readonly now = signal(Date.now());
  /** Bumped when time is recorded, so open lists can refresh. */
  readonly version = signal(0);
  readonly elapsed = computed(() => {
    const e = this.entry();
    return e ? Math.max(0, (this.now() - new Date(e.started_at).getTime()) / 1000) : 0;
  });

  private started = false;

  start() {
    if (this.started) return;
    this.started = true;
    this.refresh();
    setInterval(() => this.now.set(Date.now()), 1000);
    setInterval(() => document.visibilityState === 'visible' && this.refresh(), 60_000);
  }

  async refresh() {
    try {
      this.entry.set((await this.api.timer()).entry);
    } catch {}
  }

  isRunningOn(taskId: number) {
    return this.entry()?.task === taskId;
  }

  async startOn(workspace: number, task: number | null, description = '') {
    try {
      const had = this.entry();
      this.entry.set((await this.api.startTimer(workspace, task, description)).entry);
      if (had) this.version.update((v) => v + 1);
    } catch (err) {
      this.toast.error(errorMessage(err, this.i18n.t('Could not start the timer.')));
    }
  }

  async stop() {
    try {
      const res = await this.api.stopTimer();
      this.entry.set(null);
      this.version.update((v) => v + 1);
      if (res.stopped) {
        const mins = Math.round(res.stopped.duration_seconds / 60);
        const params = { h: Math.floor(mins / 60), m: mins % 60, task: res.stopped.task_title };
        this.toast.show(this.i18n.t(res.stopped.task_title ? 'Tracked {h}h {m}m on {task}.' : 'Tracked {h}h {m}m.', params));
      }
    } catch (err) {
      this.toast.error(errorMessage(err, this.i18n.t('Could not stop the timer.')));
    }
  }

  async toggle(workspace: number, task: number) {
    if (this.isRunningOn(task)) await this.stop();
    else await this.startOn(workspace, task);
  }
}
