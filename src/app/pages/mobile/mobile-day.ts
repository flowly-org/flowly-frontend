import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { parseList } from '../../components/bulk-add/bulk-parse';
import { Logo } from '../../components/logo/logo';
import { SwipeDeck, SwipeLabels } from '../../components/swipe-deck/swipe-deck';
import { TaskChecklist } from '../../components/task-checklist/task-checklist';
import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { BoardData } from '../../core/board-data';
import { FocusService } from '../../core/focus.service';
import { addDays, formatLong, formatShort, today } from '../../core/dates';
import { TranslatePipe } from '../../core/i18n.pipes';
import { I18nService } from '../../core/i18n.service';
import { ChecklistItem, Task, TaskInput, formatDuration, formatMinutes } from '../../core/models';
import { NotificationService } from '../../core/notification.service';
import { shrinkPhoto } from '../../core/photo';
import { TimerService } from '../../core/timer.service';
import { ToastService } from '../../core/toast.service';
import { setViewMode } from '../../core/view-mode';

type Sheet = { kind: 'add'; text: string } | { kind: 'photo'; text: string } | null;

/**
 * The compact phone view: today's tasks across workspaces, one-tap timer, quick add and add-from-photo.
 * Everything else lives in the full version.
 */
@Component({
  selector: 'app-mobile-day',
  imports: [FormsModule, Logo, SwipeDeck, TranslatePipe, TaskChecklist],
  providers: [BoardData],
  templateUrl: './mobile-day.html',
  styleUrl: './mobile-day.scss',
})
export class MobileDay {
  private api = inject(ApiService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private notifications = inject(NotificationService);
  protected auth = inject(AuthService);
  protected data = inject(BoardData);
  protected timer = inject(TimerService);
  protected focus = inject(FocusService);
  protected i18n = inject(I18nService);
  protected readonly formatDuration = formatDuration;
  protected readonly today = today;
  protected readonly addDays = addDays;
  protected readonly formatShort = formatShort;

  protected date = signal(today());
  protected tasks = signal<Task[]>([]);
  protected loading = signal(false);
  protected open = signal<number | null>(null);
  protected showDone = signal(false);
  protected menu = signal(false);
  protected sheet = signal<Sheet>(null);
  protected reading = signal(false);
  protected busy = signal(false);
  protected targetWs = signal<number | null>(null);
  protected swiping = signal(false);
  protected readonly swipeLabels: SwipeLabels = {
    where: (t) => this.where(t),
    color: (t) => this.color(t),
    carried: (t) => this.carried(t),
  };

  protected readonly isToday = computed(() => this.date() === today());
  protected readonly title = computed(() => {
    this.i18n.lang();
    const d = this.date();
    if (d === today()) return this.i18n.t('Today');
    if (d === addDays(today(), 1)) return this.i18n.t('Tomorrow');
    return formatLong(d);
  });
  protected readonly todo = computed(() =>
    this.focus.on()
      ? this.focus.queue(this.tasks(), this.data, this.timer, this.date()).concat(
          this.tasks().filter((t) => !this.data.isDone(t) && t.assignee !== this.auth.user()?.id && t.assignee !== null).sort(byOrder))
      : this.tasks().filter((t) => !this.data.isDone(t)).sort(byOrder));
  /** ADHD mode: only the first few tasks show until you ask for the rest. */
  protected showAll = signal(false);
  protected readonly shown = computed(() =>
    this.focus.on() && !this.showAll() ? this.todo().slice(0, this.focus.opts().today_limit) : this.todo());
  protected readonly done = computed(() => this.tasks().filter((t) => this.data.isDone(t)));
  protected readonly ws = computed(() => this.targetWs() ?? this.personal() ?? this.data.contexts()[0]?.id ?? null);
  protected readonly drafts = computed(() => {
    const s = this.sheet();
    return s ? parseList(s.text, this.data.ctx(this.ws() ?? 0), this.date()) : [];
  });

  constructor() {
    this.timer.start();
    this.notifications.start();
    this.loadContexts();
    effect(() => {
      const d = this.date();
      untracked(() => this.load(d));
    });
    effect(() => {
      if (this.notifications.version() > 0 || this.timer.version() > 0) untracked(() => this.load(this.date()));
    });
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && this.refresh());
  }

  private personal(): number | null {
    return this.data.contexts().find((c) => c.name.toLowerCase() === 'personal')?.id ?? null;
  }

  private async loadContexts() {
    try {
      this.data.contexts.set(await this.api.myContext());
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  private async load(day: string) {
    this.loading.set(true);
    try {
      const list = await this.api.myTasks({ day, include_overdue: day === today(), assignee: 'me' });
      if (day === this.date()) this.tasks.set(list);
    } catch (err) {
      this.toast.error(errorMessage(err, this.i18n.t('Could not load tasks.')));
    } finally {
      this.loading.set(false);
    }
  }

  protected refresh() {
    this.timer.refresh();
    this.load(this.date());
  }

  protected shift(days: number) {
    this.open.set(null);
    this.date.set(addDays(this.date(), days));
  }

  // --- labels ---------------------------------------------------------------

  protected where(task: Task): string {
    const ctx = this.data.ctx(task.workspace);
    const project = task.project ? this.data.projectById().get(task.project)?.name : null;
    return [this.data.multi() ? ctx?.name : null, project].filter(Boolean).join(' · ');
  }

  protected carried(task: Task) {
    return !!task.planned_date && task.planned_date < this.date();
  }

  protected color(task: Task) {
    const p = task.project ? this.data.projectById().get(task.project) : null;
    return p?.color ?? this.data.ctx(task.workspace)?.color ?? 'var(--line)';
  }

  protected priority(task: Task) {
    return task.priority ? this.data.tagById().get(task.priority) : null;
  }

  // --- actions --------------------------------------------------------------

  protected readonly formatMinutes = formatMinutes;

  protected checkedCount(task: Task) {
    return (task.checklist ?? []).filter((i) => i.done).length;
  }

  protected async saveChecklist(task: Task, items: ChecklistItem[]) {
    const before = this.tasks();
    this.tasks.update((list) => list.map((t) => (t.id === task.id ? { ...t, checklist: items } : t)));
    try {
      const saved = await this.api.updateTask(task.workspace, task.id, { checklist: items });
      this.tasks.update((list) => list.map((t) => (t.id === task.id ? { ...t, checklist: saved.checklist } : t)));
    } catch (err) {
      this.tasks.set(before);
      this.toast.error(errorMessage(err));
    }
  }

  protected async toggleDone(task: Task) {
    const status = this.data.toggledStatus(task);
    if (status === null) return;
    const before = this.tasks();
    if (!this.data.isDone(task)) this.focus.celebrate();
    this.tasks.update((list) => list.map((t) => (t.id === task.id ? { ...t, status } : t)));
    try {
      await this.api.updateTask(task.workspace, task.id, { status });
      if (this.timer.isRunningOn(task.id) && this.data.isDone({ ...task, status })) await this.timer.stop();
    } catch (err) {
      this.tasks.set(before);
      this.toast.error(errorMessage(err));
    }
  }

  /** Swipe right: done. Left: nothing changes (it stays to do). */
  protected async swiped(e: { task: Task; verdict: 'done' | 'keep' }) {
    if (e.verdict === 'done') {
      this.focus.celebrate();
      await this.setDone(e.task, true);
    }
  }

  protected async unswiped(e: { task: Task; verdict: 'done' | 'keep' }) {
    if (e.verdict === 'done') await this.setDone(e.task, false);
  }

  private async setDone(task: Task, done: boolean) {
    const statuses = this.data.statuses(task.workspace);
    const target = done ? statuses.find((s) => s.is_done) : statuses.find((s) => !s.is_done);
    if (!target) return;
    this.tasks.update((list) => list.map((t) => (t.id === task.id ? { ...t, status: target.id } : t)));
    try {
      await this.api.updateTask(task.workspace, task.id, { status: target.id });
      if (done && this.timer.isRunningOn(task.id)) await this.timer.stop();
    } catch (err) {
      this.toast.error(errorMessage(err));
      this.load(this.date());
    }
  }

  protected async timerOn(task: Task) {
    await this.timer.toggle(task.workspace, task.id);
  }

  protected async moveTo(task: Task, day: string | null) {
    try {
      await this.api.updateTask(task.workspace, task.id, { planned_date: day });
      this.open.set(null);
      this.toast.show(this.i18n.t(day ? 'Moved to tomorrow.' : 'Moved to the backlog.'));
      this.load(this.date());
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  protected openFull(task: Task) {
    this.router.navigate(['/w', task.workspace, 'board'], { queryParams: { task: task.id } });
  }

  protected fullVersion() {
    setViewMode('full');
    this.router.navigate(['/day']);
  }

  protected openSettings() {
    this.router.navigate(['/settings']);
  }

  // --- add ------------------------------------------------------------------

  protected async onPhoto(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const ws = this.ws();
    if (!file || ws === null) return;
    this.reading.set(true);
    try {
      const { text } = await this.api.tasksFromPhoto(ws, await shrinkPhoto(file));
      this.sheet.set({ kind: 'photo', text });
    } catch (err) {
      this.toast.error(errorMessage(err, this.i18n.t('Could not read the photo.')));
    } finally {
      this.reading.set(false);
    }
  }

  protected setText(text: string) {
    const s = this.sheet();
    if (s) this.sheet.set({ ...s, text });
  }

  protected async addAll() {
    const ws = this.ws();
    const drafts = this.drafts();
    if (ws === null || !drafts.length) return;
    const statuses = this.data.statuses(ws);
    const done = statuses.find((s) => s.is_done)?.id;
    const me = this.auth.user()?.id ?? null;
    const payload: TaskInput[] = drafts.map((d) => ({
      title: d.title.slice(0, 255),
      description: d.notes,
      project: d.project?.id ?? null,
      priority: d.priority?.id ?? null,
      tags: d.tags.map((t) => t.id),
      planned_date: d.date === undefined ? this.date() : d.date,
      assignee: me,
      ...(d.done && done ? { status: done } : {}),
    }));
    this.busy.set(true);
    try {
      const created = await this.api.bulkCreateTasks(ws, payload);
      this.sheet.set(null);
      this.toast.show(this.i18n.t(created.length === 1 ? 'Added 1 task.' : 'Added {n} tasks.', { n: String(created.length) }));
      this.load(this.date());
    } catch (err) {
      this.toast.error(errorMessage(err, this.i18n.t('Could not create the tasks.')));
    } finally {
      this.busy.set(false);
    }
  }
}

function byOrder(a: Task, b: Task) {
  return (a.planned_date ?? '').localeCompare(b.planned_date ?? '') || a.position - b.position;
}
