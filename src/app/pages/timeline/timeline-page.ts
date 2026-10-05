import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { ApiService, errorMessage } from '../../core/api.service';
import { addDays, formatShort, today } from '../../core/dates';
import { TranslatePipe } from '../../core/i18n.pipes';
import { Task } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { WorkspaceStore } from '../../core/workspace.store';

const ROW = 30;
const DAY_MS = 86400000;

function mondayOf(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return addDays(iso, -((d.getDay() + 6) % 7));
}

function days(a: string, b: string): number {
  return Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / DAY_MS);
}

interface Row {
  kind: 'group' | 'task';
  label: string;
  color: string;
  task?: Task;
  start?: string;
  end?: string;
  milestone?: boolean;
}

/** Gantt view of a workspace: dated tasks as bars (planned → due), dependencies as arrows; drag to reschedule. */
@Component({
  selector: 'app-timeline-page',
  imports: [FormsModule, TranslatePipe],
  templateUrl: './timeline-page.html',
  styleUrl: './timeline-page.scss',
})
export class TimelinePage {
  protected store = inject(WorkspaceStore);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected weeks = signal(8);
  protected from = signal(addDays(mondayOf(today()), -7));
  protected project = signal<number | null>(Number(this.route.snapshot.queryParamMap.get('project')) || null);
  protected hideDone = signal(false);
  protected tasks = signal<Task[]>([]);
  protected drag = signal<{ id: number; mode: 'move' | 'end'; x: number; shift: number } | null>(null);
  protected readonly ROW = ROW;
  protected readonly formatShort = formatShort;
  protected readonly Math = Math;

  protected readonly to = computed(() => addDays(this.from(), this.weeks() * 7 - 1));
  protected readonly dayWidth = computed(() => (this.weeks() <= 4 ? 36 : this.weeks() <= 8 ? 24 : this.weeks() <= 13 ? 14 : 7));
  protected readonly width = computed(() => this.weeks() * 7 * this.dayWidth());
  protected readonly weekStarts = computed(() => Array.from({ length: this.weeks() }, (_, i) => addDays(this.from(), i * 7)));
  protected readonly todayX = computed(() => days(this.from(), today()) * this.dayWidth());

  protected readonly rows = computed<Row[]>(() => {
    const projects = new Map(this.store.projects().map((p) => [p.id, p]));
    const groups = new Map<string, Row[]>();
    const drag = this.drag();
    for (const t of this.tasks()) {
      if (this.hideDone() && t.completed_at) continue;
      if (this.project() && t.project !== this.project()) continue;
      let start = t.planned_date ?? t.due_date!;
      let end = t.due_date ?? t.planned_date!;
      if (end < start) end = start;
      if (drag?.id === t.id && drag.shift) {
        if (drag.mode === 'move') start = addDays(start, drag.shift);
        end = addDays(end, drag.shift);
        if (end < start) end = start;
      }
      const p = t.project ? projects.get(t.project) : null;
      const key = p ? `p${p.id}` : 'none';
      if (!groups.has(key)) groups.set(key, [{ kind: 'group', label: p?.name ?? '—', color: p?.color ?? 'var(--muted)' }]);
      groups.get(key)!.push({ kind: 'task', label: t.title, color: p?.color ?? 'var(--brand, var(--accent))', task: t, start, end,
                              milestone: !t.planned_date && !!t.due_date });
    }
    const out: Row[] = [];
    for (const [key, rows] of [...groups.entries()].sort((a, b) => (a[0] === 'none' ? 1 : b[0] === 'none' ? -1 : 0))) {
      const [head, ...tasks] = rows;
      tasks.sort((a, b) => a.start!.localeCompare(b.start!) || a.end!.localeCompare(b.end!));
      out.push(head, ...tasks);
      void key;
    }
    return out;
  });

  protected readonly arrows = computed(() => {
    const index = new Map<number, number>();
    this.rows().forEach((r, i) => r.task && index.set(r.task.id, i));
    const rows = this.rows();
    const out: { d: string; late: boolean }[] = [];
    for (const [i, r] of rows.entries()) {
      for (const blocker of r.task?.blocked_by ?? []) {
        const j = index.get(blocker);
        if (j === undefined) continue;
        const b = rows[j];
        const x1 = this.x(b.end!) + this.dayWidth(), y1 = j * ROW + ROW / 2;
        const x2 = this.x(r.start!), y2 = i * ROW + ROW / 2;
        const mid = Math.max(x1 + 8, Math.min(x2 - 8, x1 + 8));
        out.push({ d: `M${x1},${y1} H${mid} V${y2} H${x2 - 2}`, late: r.start! <= b.end! });
      }
    }
    return out;
  });

  constructor() {
    effect(() => {
      const ws = this.store.currentId(), from = this.from(), to = this.to();
      if (ws) untracked(() => this.load(ws, from, to));
    });
  }

  private async load(ws: number, from: string, to: string) {
    try {
      this.tasks.set((await this.api.tasks(ws, { span_from: from, span_to: to })).filter((t) => t.planned_date || t.due_date));
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  protected x(day: string) {
    return days(this.from(), day) * this.dayWidth();
  }

  protected barWidth(r: Row) {
    return (days(r.start!, r.end!) + 1) * this.dayWidth();
  }

  protected shiftRange(weeks: number) {
    this.from.set(addDays(this.from(), weeks * 7));
  }

  protected goToday() {
    this.from.set(addDays(mondayOf(today()), -7));
  }

  protected setProject(id: number | null) {
    this.project.set(id);
    this.router.navigate([], { queryParams: { project: id }, replaceUrl: true });
  }

  protected open(t: Task) {
    this.router.navigate(['/w', t.workspace, 'board'], { queryParams: { task: t.id } });
  }

  // --- drag to reschedule ----------------------------------------------------

  protected grab(e: PointerEvent, t: Task, mode: 'move' | 'end') {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    this.drag.set({ id: t.id, mode, x: e.clientX, shift: 0 });
  }

  protected moving(e: PointerEvent) {
    const d = this.drag();
    if (!d) return;
    const shift = Math.round((e.clientX - d.x) / this.dayWidth());
    if (shift !== d.shift) this.drag.set({ ...d, shift });
  }

  protected async drop(t: Task) {
    const d = this.drag();
    this.drag.set(null);
    if (!d) return;
    if (!d.shift) {
      if (d.mode === 'move') this.open(t);
      return;
    }
    const change: Record<string, string | null> = {};
    if (d.mode === 'move') {
      if (t.planned_date) change['planned_date'] = addDays(t.planned_date, d.shift);
      if (t.due_date) change['due_date'] = addDays(t.due_date, d.shift);
    } else {
      const base = t.due_date ?? t.planned_date!;
      const next = addDays(base, d.shift);
      change['due_date'] = t.planned_date && next < t.planned_date ? t.planned_date : next;
    }
    this.tasks.update((list) => list.map((x) => (x.id === t.id ? { ...x, ...change } : x)));
    try {
      const saved = await this.api.updateTask(t.workspace, t.id, change);
      this.tasks.update((list) => list.map((x) => (x.id === t.id ? saved : x)));
    } catch (err) {
      this.toast.error(errorMessage(err));
      this.load(t.workspace, this.from(), this.to());
    }
  }
}
