import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService, errorMessage } from '../../core/api.service';
import { today } from '../../core/dates';
import { LocalDatePipe, TranslatePipe } from '../../core/i18n.pipes';
import { I18nService } from '../../core/i18n.service';
import { CalendarEvent, CalendarTaskRef, PrepReason } from '../../core/models';
import { ToastService } from '../../core/toast.service';

const ICONS: Record<PrepReason, string> = { '': '', away: '🧳', travel: '🚆', tickets: '🎟️', event: '🎁', manual: '⚑' };
const REASONS: Record<PrepReason, string> = {
  '': '',
  away: 'Away from home',
  travel: 'Travel or lodging',
  tickets: 'Tickets or a booking',
  event: 'Registration or a gift',
  manual: 'Marked as needing preparation',
};
const SUGGESTED_TITLE: Record<PrepReason, string> = {
  '': 'Prepare: {title}',
  away: 'Plan the trip: {title}',
  travel: 'Book travel: {title}',
  tickets: 'Buy tickets: {title}',
  event: 'Get ready for {title}',
  manual: 'Prepare: {title}',
};

/**
 * The day's calendar events as background above the board. Events that may need preparation are flagged;
 * open one to add or link a preparation task, confirm it, or mark it as just background.
 */
@Component({
  selector: 'app-calendar-strip',
  imports: [FormsModule, TranslatePipe, LocalDatePipe],
  templateUrl: './calendar-strip.html',
  styleUrl: './calendar-strip.scss',
})
export class CalendarStrip {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private i18n = inject(I18nService);

  readonly date = input.required<string>();
  readonly workspaces = input<{ id: number; name: string }[]>([]);
  readonly defaultWorkspace = input<number | null>(null);
  /** Opens a linked task on the board. */
  readonly openTask = output<CalendarTaskRef>();
  /** A task was created or linked: the board should reload. */
  readonly changed = output<void>();

  protected events = signal<CalendarEvent[]>([]);
  protected prepList = signal<CalendarEvent[]>([]);
  protected showPrep = signal(false);
  protected selected = signal<CalendarEvent | null>(null);
  protected busy = signal(false);
  protected draftTitle = '';
  protected draftWs: number | null = null;
  protected draftDay = today();

  protected readonly visible = computed(() => this.events().length > 0 || this.prepList().length > 0);
  protected readonly prepCount = computed(() => this.prepList().filter((e) => !this.covered(e)).length);

  constructor() {
    effect(() => {
      const day = this.date();
      untracked(() => this.loadDay(day));
    });
    this.loadPrep();
  }

  private async loadDay(day: string) {
    try {
      this.events.set(await this.api.calendarEvents(day));
    } catch {
      this.events.set([]);
    }
  }

  private async loadPrep() {
    try {
      this.prepList.set(await this.api.calendarPrep());
    } catch {
      this.prepList.set([]);
    }
  }

  protected icon(e: CalendarEvent) {
    return e.needs_prep ? ICONS[e.reason] || '⚑' : '';
  }

  protected reasonLabel(e: CalendarEvent) {
    return REASONS[e.reason] ?? '';
  }

  protected covered(e: CalendarEvent) {
    return e.tasks.length > 0 && e.tasks.every((t) => t.done) && (e.reason !== 'away' || e.confirmed);
  }

  /** Day n of a multi-day event, or null. */
  protected dayOf(e: CalendarEvent): string | null {
    if (e.start_date === e.end_date) return null;
    const ms = 86_400_000;
    const n = Math.round((Date.parse(this.date()) - Date.parse(e.start_date)) / ms) + 1;
    const total = Math.round((Date.parse(e.end_date) - Date.parse(e.start_date)) / ms) + 1;
    return this.i18n.t('day {n}/{total}', { n: String(Math.max(1, n)), total: String(total) });
  }

  protected open(e: CalendarEvent) {
    if (this.selected()?.id === e.id) {
      this.selected.set(null);
      return;
    }
    this.selected.set(e);
    this.draftTitle = this.i18n.t(SUGGESTED_TITLE[e.reason] ?? SUGGESTED_TITLE[''], { title: e.title });
    this.draftWs = this.defaultWorkspace() ?? this.workspaces()[0]?.id ?? null;
    this.draftDay = today();
    // Pull suggestions (related tasks) for this event.
    this.refreshSelected(e.id);
  }

  private async refreshSelected(id: number) {
    const fresh = this.prepList().find((p) => p.id === id);
    if (fresh?.suggested) {
      this.selected.update((s) => (s && s.id === id ? { ...s, suggested: fresh.suggested } : s));
    }
  }

  private apply(updated: CalendarEvent) {
    const swap = (list: CalendarEvent[]) => list.map((e) => (e.id === updated.id ? { ...updated, suggested: updated.suggested ?? e.suggested } : e));
    this.events.update(swap);
    this.prepList.update(swap);
    this.selected.set(updated);
  }

  private async act(fn: () => Promise<CalendarEvent>, reload = false) {
    this.busy.set(true);
    try {
      this.apply(await fn());
      if (reload) this.changed.emit();
      await this.loadPrep();
    } catch (err) {
      this.toast.error(errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }

  protected addTask(e: CalendarEvent) {
    const title = this.draftTitle.trim();
    if (!title) return;
    this.act(
      () => this.api.addEventTask(e.id, { title, workspace: this.draftWs ?? undefined, planned_date: this.draftDay || null }),
      true,
    ).then(() => this.toast.show(this.i18n.t('Task added and linked to the event.')));
  }

  protected link(e: CalendarEvent, t: CalendarTaskRef) {
    this.act(() => this.api.addEventTask(e.id, { task: t.id }));
  }

  protected unlink(e: CalendarEvent, t: CalendarTaskRef) {
    this.act(() => this.api.unlinkEventTask(e.id, t.id));
  }

  protected setPrep(e: CalendarEvent, prep: CalendarEvent['prep']) {
    this.act(() => this.api.updateCalendarEvent(e.id, { prep }));
  }

  protected confirm(e: CalendarEvent, confirmed: boolean) {
    this.act(() => this.api.updateCalendarEvent(e.id, { confirmed }));
  }
}
