import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { TaskCard } from '../../components/task-card/task-card';
import { TaskDialog } from '../../components/task-dialog/task-dialog';
import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { addDays, formatLong, isValidIsoDate, today } from '../../core/dates';
import { STATUSES, Task, TaskInput, TaskStatus } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { WorkspaceStore } from '../../core/workspace.store';
import { GroupBy, Lane, buildLanes, groupIdOf, laneKeyOf, positionAt } from './lanes';

type Scope = 'me' | 'all';
type DropTarget = { kind: 'cell'; lane: Lane; status: TaskStatus } | { kind: 'backlog' };

interface Prefs {
  groupBy: GroupBy;
  scope: Scope;
  includeOverdue: boolean;
  hideEmpty: boolean;
  showBacklog: boolean;
  collapsed: string[];
}

const DEFAULT_PREFS: Prefs = {
  groupBy: 'project',
  scope: 'me',
  includeOverdue: true,
  hideEmpty: false,
  showBacklog: true,
  collapsed: [],
};

@Component({
  selector: 'app-day-board',
  imports: [FormsModule, RouterLink, CdkDropListGroup, CdkDropList, CdkDrag, CdkDragPlaceholder, CdkScrollable, TaskCard, TaskDialog],
  templateUrl: './day-board.html',
  styleUrl: './day-board.scss',
})
export class DayBoard {
  protected store = inject(WorkspaceStore);
  private auth = inject(AuthService);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  protected readonly statuses = STATUSES;
  private readonly wsId = this.store.currentId()!;
  private readonly prefsKey = `mk.board.${this.wsId}`;

  protected date = signal(today());
  protected groupBy = signal<GroupBy>('project');
  protected scope = signal<Scope>('me');
  protected includeOverdue = signal(true);
  protected hideEmpty = signal(false);
  protected showBacklog = signal(true);
  protected collapsed = signal<Set<string>>(new Set());

  protected tasks = signal<Task[]>([]);
  protected backlog = signal<Task[]>([]);
  protected backlogQuery = signal('');
  protected loading = signal(false);

  protected editing = signal<{ task: Task | null; defaults: TaskInput } | null>(null);
  protected quickAddLane = signal<string | null>(null);
  protected quickAddTitle = '';
  protected backlogTitle = '';

  protected readonly isToday = computed(() => this.date() === today());
  protected readonly dateLabel = computed(() => formatLong(this.date()));
  protected readonly hiddenTagGroup = computed(() => groupIdOf(this.groupBy()));

  protected readonly lanes = computed(() =>
    buildLanes(this.groupBy(), {
      projects: this.store.projects(),
      members: this.store.members(),
      tagGroups: this.store.tagGroups(),
      tasks: this.tasks(),
    }),
  );

  /** laneKey → status → tasks sorted by position. */
  protected readonly cells = computed(() => {
    const groupBy = this.groupBy();
    const groups = this.store.tagGroups();
    const cells = new Map<string, Record<TaskStatus, Task[]>>();
    for (const lane of this.lanes()) cells.set(lane.key, { todo: [], in_progress: [], done: [] });
    for (const task of this.tasks()) cells.get(laneKeyOf(task, groupBy, groups))?.[task.status].push(task);
    for (const cell of cells.values()) for (const list of Object.values(cell)) list.sort(byPosition);
    return cells;
  });

  protected readonly visibleLanes = computed(() => {
    const cells = this.cells();
    const lanes = this.lanes();
    if (!this.hideEmpty()) return lanes;
    return lanes.filter((l) => {
      const c = cells.get(l.key)!;
      return c.todo.length + c.in_progress.length + c.done.length > 0;
    });
  });

  protected readonly filteredBacklog = computed(() => {
    const q = this.backlogQuery().trim().toLowerCase();
    const list = [...this.backlog()].sort(byPosition);
    return q ? list.filter((t) => t.title.toLowerCase().includes(q)) : list;
  });

  protected readonly progress = computed(() => {
    const all = this.tasks();
    const done = all.filter((t) => t.status === 'done').length;
    return { done, total: all.length, pct: all.length ? Math.round((done / all.length) * 100) : 0 };
  });

  protected readonly groupOptions = computed(() => [
    { value: 'project', label: 'Project' },
    { value: 'assignee', label: 'Assignee' },
    ...this.store.tagGroups().map((g) => ({ value: `group:${g.id}`, label: g.name })),
    { value: 'none', label: 'No grouping' },
  ]);

  constructor() {
    this.restorePrefs();

    // Keep URL and stored prefs in sync with the view settings.
    effect(() => {
      const queryParams = { date: this.date(), group: this.groupBy(), scope: this.scope() };
      untracked(() => this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl: true }));
      this.savePrefs();
    });

    // Reload whenever the query inputs change.
    effect(() => {
      const query = { date: this.date(), scope: this.scope(), overdue: this.includeOverdue() };
      untracked(() => this.load(query.date, query.scope, query.overdue));
    });

    // Fall back if the grouped-by tag group was deleted.
    effect(() => {
      const gid = groupIdOf(this.groupBy());
      if (gid !== null && !this.store.loading() && !this.store.tagGroups().some((g) => g.id === gid)) {
        this.groupBy.set('project');
      }
    });
  }

  // --- data ---------------------------------------------------------------

  private loadSeq = 0;

  private async load(date: string, scope: Scope, includeOverdue: boolean) {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    const assignee = scope === 'me' ? ('me' as const) : undefined;
    try {
      const [tasks, backlog] = await Promise.all([
        this.api.tasks(this.wsId, { day: date, include_overdue: includeOverdue, assignee }),
        this.api.tasks(this.wsId, { unscheduled: true, assignee }),
      ]);
      if (seq !== this.loadSeq) return;
      this.tasks.set(tasks);
      this.backlog.set(backlog);
    } catch (err) {
      if (seq === this.loadSeq) this.toast.error(errorMessage(err, 'Could not load tasks.'));
    } finally {
      if (seq === this.loadSeq) this.loading.set(false);
    }
  }

  protected reload() {
    this.load(this.date(), this.scope(), this.includeOverdue());
  }

  /** Put a task (fresh from the server) into whichever list it belongs to, or drop it from view. */
  private place(task: Task) {
    const without = (list: Task[]) => list.filter((t) => t.id !== task.id);
    this.tasks.update(without);
    this.backlog.update(without);
    const me = this.auth.user()?.id;
    if (this.scope() === 'me' && task.assignee !== me) return;
    if (task.planned_date === null) {
      this.backlog.update((l) => [...l, task]);
    } else if (
      task.planned_date === this.date() ||
      (this.includeOverdue() && task.planned_date < this.date() && task.status !== 'done')
    ) {
      this.tasks.update((l) => [...l, task]);
    }
  }

  private unplace(id: number) {
    this.tasks.update((l) => l.filter((t) => t.id !== id));
    this.backlog.update((l) => l.filter((t) => t.id !== id));
  }

  private async patch(task: Task, changes: TaskInput) {
    this.place({ ...task, ...changes } as Task); // optimistic
    try {
      this.place(await this.api.updateTask(this.wsId, task.id, changes));
    } catch (err) {
      this.toast.error(errorMessage(err, 'Could not update the task.'));
      this.reload();
    }
  }

  // --- drag & drop ----------------------------------------------------------

  protected cellTarget(lane: Lane, status: TaskStatus): DropTarget {
    return { kind: 'cell', lane, status };
  }

  protected readonly backlogTarget: DropTarget = { kind: 'backlog' };

  protected drop(event: CdkDragDrop<DropTarget>) {
    const task = event.item.data as Task;
    const target = event.container.data;
    if (event.previousContainer === event.container && event.previousIndex === event.currentIndex) return;

    if (target.kind === 'backlog') {
      const list = this.filteredBacklog().filter((t) => t.id !== task.id);
      this.patch(task, { planned_date: null, position: positionAt(list, event.currentIndex, task.position) });
      return;
    }

    const list = this.cells().get(target.lane.key)![target.status].filter((t) => t.id !== task.id);
    const changes: TaskInput = {
      ...target.lane.assign(task),
      status: target.status,
      position: positionAt(list, event.currentIndex, task.position),
    };
    // Dropping a backlog or carried-over task onto the board schedules it for the viewed day.
    if (task.planned_date !== this.date()) changes.planned_date = this.date();
    this.patch(task, changes);
  }

  protected toggleDone(task: Task) {
    this.patch(task, { status: task.status === 'done' ? 'todo' : 'done' });
  }

  // --- creating & editing ---------------------------------------------------

  protected openNew(defaults: TaskInput = {}) {
    this.editing.set({
      task: null,
      defaults: { planned_date: this.date(), assignee: this.auth.user()?.id ?? null, ...defaults },
    });
  }

  protected openTask(task: Task) {
    this.editing.set({ task, defaults: {} });
  }

  protected onSaved(task: Task) {
    this.editing.set(null);
    this.place(task);
  }

  protected onDeleted(id: number) {
    this.editing.set(null);
    this.unplace(id);
    this.toast.show('Task deleted.');
  }

  protected startQuickAdd(lane: Lane) {
    this.quickAddTitle = '';
    this.quickAddLane.set(lane.key);
  }

  protected async quickAdd(lane: Lane) {
    const title = this.quickAddTitle.trim();
    if (!title) {
      this.quickAddLane.set(null);
      return;
    }
    this.quickAddTitle = '';
    try {
      const task = await this.api.createTask(this.wsId, {
        title,
        status: 'todo',
        planned_date: this.date(),
        assignee: this.auth.user()?.id ?? null,
        ...lane.assign(),
      });
      this.place(task);
    } catch (err) {
      this.toast.error(errorMessage(err, 'Could not add the task.'));
    }
  }

  protected async addToBacklog() {
    const title = this.backlogTitle.trim();
    if (!title) return;
    this.backlogTitle = '';
    try {
      this.place(
        await this.api.createTask(this.wsId, { title, planned_date: null, assignee: this.auth.user()?.id ?? null }),
      );
    } catch (err) {
      this.toast.error(errorMessage(err, 'Could not add the task.'));
    }
  }

  // --- view controls --------------------------------------------------------

  protected shiftDay(days: number) {
    this.date.update((d) => addDays(d, days));
  }

  protected goToday() {
    this.date.set(today());
  }

  protected setDate(value: string) {
    if (isValidIsoDate(value)) this.date.set(value);
  }

  protected toggleLane(key: string) {
    this.collapsed.update((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    this.savePrefs();
  }

  protected laneCount(key: string): number {
    const c = this.cells().get(key);
    return c ? c.todo.length + c.in_progress.length + c.done.length : 0;
  }

  protected laneDone(key: string): number {
    return this.cells().get(key)?.done.length ?? 0;
  }

  private restorePrefs() {
    let prefs = DEFAULT_PREFS;
    try {
      prefs = { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(this.prefsKey) ?? '{}') };
    } catch {}
    const qp = this.route.snapshot.queryParamMap;
    const date = qp.get('date');
    const group = qp.get('group') as GroupBy | null;
    const scope = qp.get('scope');
    this.date.set(isValidIsoDate(date) ? date : today());
    this.groupBy.set(group && /^(project|assignee|none|group:\d+)$/.test(group) ? group : prefs.groupBy);
    this.scope.set(scope === 'all' || scope === 'me' ? scope : prefs.scope);
    this.includeOverdue.set(prefs.includeOverdue);
    this.hideEmpty.set(prefs.hideEmpty);
    this.showBacklog.set(prefs.showBacklog && window.innerWidth > 900);
    this.collapsed.set(new Set(prefs.collapsed));
  }

  protected savePrefs() {
    const prefs: Prefs = {
      groupBy: this.groupBy(),
      scope: this.scope(),
      includeOverdue: this.includeOverdue(),
      hideEmpty: this.hideEmpty(),
      showBacklog: this.showBacklog(),
      collapsed: [...this.collapsed()],
    };
    try {
      localStorage.setItem(this.prefsKey, JSON.stringify(prefs));
    } catch {}
  }
}

function byPosition(a: Task, b: Task): number {
  return a.position - b.position || a.id - b.id;
}
