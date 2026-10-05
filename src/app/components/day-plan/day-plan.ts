import { Component, ElementRef, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';

import { ApiService, errorMessage } from '../../core/api.service';
import { BoardData } from '../../core/board-data';
import { TranslatePipe } from '../../core/i18n.pipes';
import { I18nService } from '../../core/i18n.service';
import { DayBlocks, DayPlanProposal, Task, TimeBlock, formatMinutes } from '../../core/models';
import { ToastService } from '../../core/toast.service';

const STEP = 15 * 60 * 1000;

/**
 * Time blocking: the working day as a timeline, meetings in grey, blocks for tasks on top.
 * Drag a task onto it, drag a block to move it, or let auto-plan fill the free time from the estimates.
 */
@Component({
  selector: 'app-day-plan',
  imports: [TranslatePipe],
  templateUrl: './day-plan.html',
  styleUrl: './day-plan.scss',
})
export class DayPlan {
  readonly date = input.required<string>();
  /** The day's tasks (only mine and open ones are offered). */
  readonly tasks = input<Task[]>([]);
  readonly me = input<number | null>(null);
  readonly openTask = output<number>();

  private api = inject(ApiService);
  private toast = inject(ToastService);
  private i18n = inject(I18nService);
  protected data = inject(BoardData);
  private track = viewChild<ElementRef<HTMLElement>>('track');

  protected day = signal<DayBlocks | null>(null);
  protected proposal = signal<DayPlanProposal | null>(null);
  protected busy = signal(false);
  protected dragging = signal<{ id: number; offset: number; x: number; moved: boolean } | null>(null);
  protected hover = signal<number | null>(null);
  protected now = signal(Date.now());
  protected readonly formatMinutes = formatMinutes;

  /** The visible range: working hours, widened to show meetings and blocks outside them. */
  protected readonly range = computed(() => {
    const d = this.day();
    if (!d) return null;
    let lo = new Date(d.day_start).getTime();
    let hi = new Date(d.day_end).getTime();
    for (const x of [...d.events, ...d.blocks]) {
      lo = Math.min(lo, new Date(x.start).getTime());
      hi = Math.max(hi, new Date(x.end).getTime());
    }
    const hour = 3600 * 1000;
    return { lo: Math.floor(lo / hour) * hour, hi: Math.ceil(hi / hour) * hour };
  });
  protected readonly hours = computed(() => {
    const r = this.range();
    if (!r) return [];
    const out = [];
    for (let t = r.lo; t < r.hi; t += 3600 * 1000) out.push(t);
    return out;
  });
  protected readonly unscheduled = computed(() => {
    const blocked = new Set((this.day()?.blocks ?? []).map((b) => b.task));
    return this.tasks().filter((t) => !this.data.isDone(t) && (t.assignee === this.me() || t.assignee === null) && !blocked.has(t.id));
  });
  /** Overlapping blocks go on separate rows. */
  protected readonly lanes = computed(() => {
    const ends: number[] = [];
    const lane = new Map<number, number>();
    for (const b of [...(this.day()?.blocks ?? [])].sort((x, y) => x.start.localeCompare(y.start))) {
      const s = new Date(b.start).getTime();
      let i = ends.findIndex((end) => end <= s);
      if (i < 0) i = ends.push(0) - 1;
      ends[i] = new Date(b.end).getTime();
      lane.set(b.id, i);
    }
    return { of: lane, count: Math.max(1, ends.length) };
  });
  protected readonly plannedMinutes = computed(() =>
    (this.day()?.blocks ?? []).reduce((sum, b) => sum + (new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000, 0),
  );

  constructor() {
    effect(() => {
      const d = this.date();
      this.tasks(); // a task done or added elsewhere: refresh
      untracked(() => this.load(d));
    });
    setInterval(() => this.now.set(Date.now()), 60_000);
  }

  protected async load(date = this.date()) {
    try {
      this.day.set(await this.api.dayBlocks(date));
    } catch {}
  }

  // --- geometry ------------------------------------------------------------

  protected left(iso: string | number) {
    const r = this.range()!;
    const t = typeof iso === 'number' ? iso : new Date(iso).getTime();
    return ((Math.max(r.lo, Math.min(r.hi, t)) - r.lo) / (r.hi - r.lo)) * 100;
  }

  protected width(start: string, end: string) {
    return Math.max(0.8, this.left(end) - this.left(start));
  }

  private timeAt(clientX: number): number {
    const el = this.track()!.nativeElement.getBoundingClientRect();
    const r = this.range()!;
    const t = r.lo + ((clientX - el.left) / el.width) * (r.hi - r.lo);
    return Math.round(t / STEP) * STEP;
  }

  protected clock(t: string | number) {
    return new Date(t).toLocaleTimeString(this.i18n.lang(), { hour: '2-digit', minute: '2-digit' });
  }

  protected color(b: TimeBlock) {
    const p = b.project ? this.data.projectById().get(b.project) : null;
    return p?.color ?? (b.workspace ? this.data.ctx(b.workspace)?.color : null) ?? 'var(--brand, var(--accent))';
  }

  // --- dropping tasks, moving blocks ----------------------------------------

  protected dragTask(e: DragEvent, task: Task) {
    e.dataTransfer?.setData('text/flowly-task', String(task.id));
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
  }

  protected over(e: DragEvent) {
    if (e.dataTransfer?.types.includes('text/flowly-task')) {
      e.preventDefault();
      this.hover.set(this.timeAt(e.clientX));
    }
  }

  protected async drop(e: DragEvent) {
    const id = Number(e.dataTransfer?.getData('text/flowly-task'));
    this.hover.set(null);
    if (!id) return;
    e.preventDefault();
    await this.create(id, this.timeAt(e.clientX));
  }

  /** Keyboard/touch alternative to dragging: the first free slot that fits. */
  protected async blockNext(task: Task) {
    const minutes = task.estimate_minutes ?? 30;
    const slot = (this.day()?.free ?? []).find((f) => {
      const start = Math.max(new Date(f.start).getTime(), Math.ceil(Date.now() / STEP) * STEP);
      return new Date(f.end).getTime() - start >= minutes * 60000;
    });
    if (!slot) {
      this.toast.error(this.i18n.t('No free slot long enough today.'));
      return;
    }
    await this.create(task.id, Math.max(new Date(slot.start).getTime(), Math.ceil(Date.now() / STEP) * STEP));
  }

  private async create(taskId: number, start: number) {
    try {
      await this.api.addBlock({ task: taskId, start: new Date(start).toISOString() });
      await this.load();
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  protected grab(e: PointerEvent, b: TimeBlock) {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.dragging.set({ id: b.id, offset: this.timeAt(e.clientX) - new Date(b.start).getTime(), x: e.clientX, moved: false });
  }

  protected move(e: PointerEvent, b: TimeBlock) {
    const d = this.dragging();
    if (!d || d.id !== b.id) return;
    if (!d.moved && Math.abs(e.clientX - d.x) < 4) return; // still a click
    if (!d.moved) this.dragging.set({ ...d, moved: true });
    const start = this.timeAt(e.clientX) - d.offset;
    const length = new Date(b.end).getTime() - new Date(b.start).getTime();
    this.day.update((day) => day && {
      ...day,
      blocks: day.blocks.map((x) => (x.id === b.id ? { ...x, start: new Date(start).toISOString(), end: new Date(start + length).toISOString() } : x)),
    });
  }

  protected async release(b: TimeBlock) {
    const d = this.dragging();
    this.dragging.set(null);
    if (!d) return;
    if (!d.moved) {
      if (b.task) this.openTask.emit(b.task); // a click on the block opens its task
      return;
    }
    const current = this.day()?.blocks.find((x) => x.id === b.id);
    if (!current) return;
    try {
      await this.api.moveBlock(b.id, current.start);
    } catch (err) {
      this.toast.error(errorMessage(err));
      await this.load();
    }
  }

  protected async remove(b: TimeBlock) {
    try {
      await this.api.deleteBlock(b.id);
      await this.load();
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  // --- auto-plan -------------------------------------------------------------

  protected async autoPlan(apply: boolean) {
    this.busy.set(true);
    try {
      const result = await this.api.planDay(this.date(), apply);
      if (apply) {
        this.proposal.set(null);
        this.toast.show(this.i18n.t('{n} blocks added to your day.', { n: result.placed.length }));
        await this.load();
      } else {
        this.proposal.set(result);
      }
    } catch (err) {
      this.toast.error(errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}
