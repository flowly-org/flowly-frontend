import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Bar, BarChart } from '../../components/bar-chart/bar-chart';
import { ApiService, errorMessage } from '../../core/api.service';
import { addDays, formatShort, today } from '../../core/dates';
import { TranslatePipe } from '../../core/i18n.pipes';
import { I18nService } from '../../core/i18n.service';
import { WeekReview, WorkspaceContext, formatMinutes } from '../../core/models';
import { ToastService } from '../../core/toast.service';

function mondayOf(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return addDays(iso, -((d.getDay() + 6) % 7));
}

/** The weekly review: the week in numbers, Flo's written review, and what's slipping (fixable in one click). */
@Component({
  selector: 'app-review-page',
  imports: [BarChart, RouterLink, TranslatePipe],
  templateUrl: './review-page.html',
  styleUrl: './review-page.scss',
})
export class ReviewPage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected i18n = inject(I18nService);

  protected week = signal(mondayOf(today()));
  protected data = signal<WeekReview | null>(null);
  protected busy = signal(false);
  private contexts: WorkspaceContext[] = [];
  protected readonly formatMinutes = formatMinutes;
  protected readonly formatShort = formatShort;
  protected readonly isThisWeek = computed(() => this.week() === mondayOf(today()));
  protected readonly projectBars = computed<Bar[]>(() =>
    (this.data()?.stats.projects ?? []).map((p) => ({ label: p.name, value: p.minutes, color: p.color })));
  protected readonly doneBars = computed<Bar[]>(() =>
    (this.data()?.stats.projects ?? []).filter((p) => p.completed).map((p) => ({ label: p.name, value: p.completed, color: p.color })));
  protected readonly minutesFmt = (v: number) => formatMinutes(v);

  constructor() {
    this.load();
    this.api.myContext().then((c) => (this.contexts = c)).catch(() => {});
  }

  protected async load() {
    try {
      this.data.set(await this.api.review(this.week()));
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  protected shift(weeks: number) {
    this.week.set(addDays(this.week(), weeks * 7));
    this.data.set(null);
    this.load();
  }

  protected async write() {
    this.busy.set(true);
    try {
      this.data.set(await this.api.writeReview(this.week()));
    } catch (err) {
      this.toast.error(errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }

  /** Slipping task: move to next Monday, to the backlog, or mark done. */
  protected async fix(t: { id: number; workspace: number }, action: 'next' | 'backlog' | 'done') {
    const nextMonday = addDays(mondayOf(today()), 7);
    let change: Record<string, unknown> = { planned_date: action === 'next' ? nextMonday : null };
    if (action === 'done') {
      const status = this.contexts.find((c) => c.id === t.workspace)?.tag_groups.find((g) => g.kind === 'status')?.tags.find((x) => x.is_done);
      if (!status) return;
      change = { status: status.id };
    }
    try {
      await this.api.updateTask(t.workspace, t.id, change);
      this.data.update((d) => d && { ...d, stats: { ...d.stats, slipping: d.stats.slipping.filter((x) => x.id !== t.id) } });
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }
}
