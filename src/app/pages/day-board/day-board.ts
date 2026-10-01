import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { BulkAdd } from '../../components/bulk-add/bulk-add';
import { TaskCard } from '../../components/task-card/task-card';
import { TaskDialog } from '../../components/task-dialog/task-dialog';
import { ApiService, TaskQuery, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { BoardData } from '../../core/board-data';
import { NotificationService } from '../../core/notification.service';
import { addDays, formatLong, isValidIsoDate, today } from '../../core/dates';
import { Task, TaskInput } from '../../core/models';
import { I18nService } from '../../core/i18n.service';
import { TranslatePipe } from '../../core/i18n.pipes';
import { ToastService } from '../../core/toast.service';
import { WorkspaceStore } from '../../core/workspace.store';
import {
  Column,
  GroupBy,
  Lane,
  accepts,
  buildColumns,
  buildLanes,
  columnKeyOf,
  groupNameOf,
  groupOptions,
  laneKeyOf,
  positionAt,
} from './lanes';

type Scope = 'me' | 'all';
type Mode = 'global' | 'workspace';
type DropTarget = { kind: 'cell'; lane: Lane; column: Column } | { kind: 'backlog' };

interface Prefs {
  groupBy: GroupBy;
  scope: Scope;
  includeOverdue: boolean;
  hideEmpty: boolean;
  showBacklog: boolean;
  collapsed: string[];
  targetWs: number | null;
}

/**
 * The day board. In "global" mode (My day) it spans every workspace the user is in;
 * in "workspace" mode it's the board of the workspace in the URL.
 */
@Component({
  selector: 'app-day-board',
  imports: [FormsModule, CdkDropListGroup, CdkDropList, CdkDrag, CdkDragPlaceholder, CdkScrollable, TaskCard, TaskDialog, BulkAdd, TranslatePipe],
  providers: [BoardData],
  templateUrl: './day-board.html',
  styleUrl: './day-board.scss',
})
export class DayBoard {
  private store = inject(WorkspaceStore);
  protected data = inject(BoardData);
  private auth = inject(AuthService);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private notifications = inject(NotificationService);
  protected i18n = inject(I18nService);
  private readonly tr = (text: string, params?: Record<string, string>) => this.i18n.t(text, params);

  protected readonly mode: Mode = this.route.snapshot.data['mode'] === 'workspace' ? 'workspace' : 'global';
  private readonly wsId = this.mode === 'workspace' ? this.store.currentId() : null;
  private readonly prefsKey = this.mode === 'workspace' ? `flowly.board.${this.wsId}` : 'flowly.myday';

  protected date = signal(today());
  protected groupBy = signal<GroupBy>('project');
  protected scope = signal<Scope>('me');
  protected includeOverdue = signal(true);
  protected hideEmpty = signal(false);
  protected showBacklog = signal(true);
  protected collapsed = signal<Set<string>>(new Set());
  /** Workspace new tasks are created in (My day only). */
  protected targetWs = signal<number | null>(null);

  protected tasks = signal<Task[]>([]);
  protected backlog = signal<Task[]>([]);
  protected backlogQuery = signal('');
  protected loading = signal(false);

  protected editing = signal<{ task: Task | null; defaults: TaskInput; tab?: 'details' | 'discussion' | 'files' } | null>(null);
  protected quickAddLane = signal<string | null>(null);
  /** Bulk-add dialog: null = closed; 'day' plans for the viewed day, 'backlog' leaves them unscheduled. */
  protected bulk = signal<'day' | 'backlog' | null>(null);
  protected quickAddTitle = '';
  protected backlogTitle = '';

  protected readonly title = computed(() =>
    this.mode === 'global' ? this.i18n.t('My day') : (this.store.current()?.name ?? this.i18n.t('Board')),
  );
  protected readonly isToday = computed(() => this.date() === today());
  protected readonly dateLabel = computed(() => {
    this.i18n.lang(); // re-format when the language changes
    return formatLong(this.date());
  });
  protected readonly hiddenGroup = computed(() => groupNameOf(this.groupBy()));
  protected readonly contexts = this.data.contexts;
  protected readonly newTaskWs = computed(() => this.wsId ?? this.targetWs() ?? this.contexts()[0]?.id ?? null);

  protected readonly columns = computed(() => buildColumns(this.contexts()));
  protected readonly lanes = computed(() => {
    this.i18n.lang();
    return buildLanes(this.groupBy(), this.contexts(), this.tasks(), this.tr);
  });
  protected readonly groupChoices = computed(() => {
    this.i18n.lang();
    return groupOptions(this.contexts(), this.tr);
  });
  protected readonly gridColumns = computed(() => `repeat(${this.columns().length || 1}, minmax(220px, 1fr))`);

  /** laneKey → columnKey → tasks sorted by position. */
  protected readonly cells = computed(() => {
    const groupBy = this.groupBy();
    const byId = this.data.byId();
    const tagById = this.data.tagById();
    const cells = new Map<string, Map<string, Task[]>>();
    for (const lane of this.lanes()) cells.set(lane.key, new Map(this.columns().map((c) => [c.key, []])));
    for (const task of this.tasks()) {
      const col = columnKeyOf(task, tagById);
      if (col !== null) cells.get(laneKeyOf(task, groupBy, byId, tagById))?.get(col)?.push(task);
    }
    for (const lane of cells.values()) for (const list of lane.values()) list.sort(byPosition);
    return cells;
  });

  protected readonly visibleLanes = computed(() => {
    const lanes = this.lanes();
    return this.hideEmpty() ? lanes.filter((l) => this.laneCount(l.key) > 0) : lanes;
  });

  protected readonly filteredBacklog = computed(() => {
    const q = this.backlogQuery().trim().toLowerCase();
    const list = [...this.backlog()].sort(byPosition);
    return q ? list.filter((t) => t.title.toLowerCase().includes(q)) : list;
  });

  protected readonly progress = computed(() => {
    const all = this.tasks();
    const done = all.filter((t) => this.data.isDone(t)).length;
    return { done, total: all.length, pct: all.length ? Math.round((done / all.length) * 100) : 0 };
  });

  protected readonly showWorkspaceOnCards = computed(
    () => this.data.multi() && this.groupBy() !== 'workspace' && this.groupBy() !== 'project',
  );

  constructor() {
    this.restorePrefs();
    this.openFromLink();

    if (this.mode === 'workspace') {
      effect(() => {
        const ctx = this.store.context();
        this.data.contexts.set(ctx ? [ctx] : []);
      });
    } else {
      this.loadContexts();
    }

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

    // Someone else changed something that concerns you: show it without a manual reload.
    effect(() => {
      if (this.notifications.version() > 0) untracked(() => this.reload());
    });

    // Fall back if the grouping no longer exists (e.g. its tag group was deleted).
    effect(() => {
      const choices = this.groupChoices();
      const current = this.groupBy();
      if (this.contexts().length && !choices.some((c) => c.value.toLowerCase() === current.toLowerCase())) {
        this.groupBy.set('project');
      }
    });
  }

  /** /w/<ws>/board?task=<id> (from notifications): jump to the task's day and open it. */
  private async openFromLink() {
    const id = Number(this.route.snapshot.queryParamMap.get('task'));
    if (!id || this.wsId === null) return;
    try {
      const task = await this.api.task(this.wsId, id);
      if (task.planned_date) this.date.set(task.planned_date);
      this.editing.set({ task, defaults: {} });
    } catch {
      this.toast.error(this.i18n.t('That task no longer exists.'));
    }
  }

  // --- data ---------------------------------------------------------------

  private async loadContexts() {
    try {
      this.data.contexts.set(await this.api.myContext());
    } catch (err) {
      this.toast.error(errorMessage(err, this.i18n.t('Could not load your workspaces.')));
    }
  }

  private loadSeq = 0;

  private fetch(query: TaskQuery): Promise<Task[]> {
    return this.wsId === null ? this.api.myTasks(query) : this.api.tasks(this.wsId, query);
  }

  private async load(date: string, scope: Scope, includeOverdue: boolean) {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    const assignee = scope === 'me' ? ('me' as const) : undefined;
    try {
      const [tasks, backlog] = await Promise.all([
        this.fetch({ day: date, include_overdue: includeOverdue, assignee }),
        this.fetch({ unscheduled: true, assignee }),
      ]);
      if (seq !== this.loadSeq) return;
      this.tasks.set(tasks);
      this.backlog.set(backlog);
    } catch (err) {
      if (seq === this.loadSeq) this.toast.error(errorMessage(err, this.i18n.t('Could not load tasks.')));
    } finally {
      if (seq === this.loadSeq) this.loading.set(false);
    }
  }

  protected reload() {
    if (this.mode === 'global') this.loadContexts();
    this.load(this.date(), this.scope(), this.includeOverdue());
  }

  /** Put a task (fresh from the server) into whichever list it belongs to, or drop it from view. */
  private place(task: Task) {
    const without = (list: Task[]) => list.filter((t) => t.id !== task.id);
    this.tasks.update(without);
    this.backlog.update(without);
    if (this.scope() === 'me' && task.assignee !== this.auth.user()?.id) return;
    if (this.wsId !== null && task.workspace !== this.wsId) return;
    if (task.planned_date === null) {
      this.backlog.update((l) => [...l, task]);
    } else if (
      task.planned_date === this.date() ||
      (this.includeOverdue() && task.planned_date < this.date() && !this.data.isDone(task))
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
      this.place(await this.api.updateTask(task.workspace, task.id, changes));
    } catch (err) {
      this.toast.error(errorMessage(err, this.i18n.t('Could not update the task.')));
      this.reload();
    }
  }

  // --- drag & drop ----------------------------------------------------------

  protected cellTarget(lane: Lane, column: Column): DropTarget {
    return { kind: 'cell', lane, column };
  }

  protected readonly backlogTarget: DropTarget = { kind: 'backlog' };

  /** Cards can't move between workspaces, so cells whose lane/column don't exist in the card's workspace refuse it. */
  protected readonly canEnter = (drag: CdkDrag<Task>, drop: CdkDropList<DropTarget>): boolean => {
    const target = drop.data;
    if (target.kind === 'backlog') return true;
    const ws = drag.data.workspace;
    return accepts(target.lane, ws) && target.column.statusIds.has(ws);
  };

  protected drop(event: CdkDragDrop<DropTarget>) {
    const task = event.item.data as Task;
    const target = event.container.data;
    if (event.previousContainer === event.container && event.previousIndex === event.currentIndex) return;
    // Released over a cell that refused the card: cancel instead of using the last cell it passed through.
    if (!event.isPointerOverContainer) return;

    if (target.kind === 'backlog') {
      const list = this.filteredBacklog().filter((t) => t.id !== task.id);
      this.patch(task, { planned_date: null, position: positionAt(list, event.currentIndex, task.position) });
      return;
    }

    const status = target.column.statusIds.get(task.workspace);
    if (status === undefined || !accepts(target.lane, task.workspace)) return;
    const list = this.cellTasks(target.lane.key, target.column.key).filter((t) => t.id !== task.id);
    const changes: TaskInput = {
      ...target.lane.assign(task),
      status,
      position: positionAt(list, event.currentIndex, task.position),
    };
    // Dropping a backlog or carried-over task onto the board schedules it for the viewed day.
    if (task.planned_date !== this.date()) changes.planned_date = this.date();
    this.patch(task, changes);
  }

  protected toggleDone(task: Task) {
    const status = this.data.toggledStatus(task);
    if (status === null) {
      this.toast.error(this.i18n.t('This workspace has no "done" status. Mark one on the Tags page.'));
      return;
    }
    this.patch(task, { status });
  }

  // --- creating & editing ---------------------------------------------------

  protected openNew(defaults: TaskInput = {}) {
    const ws = this.newTaskWs();
    if (ws === null) return;
    this.editing.set({
      task: null,
      defaults: { workspace: ws, planned_date: this.date(), assignee: this.auth.user()?.id ?? null, ...defaults },
    });
  }

  protected openTask(task: Task, tab: 'details' | 'discussion' | 'files' = 'details') {
    this.editing.set({ task, defaults: {}, tab });
  }

  /** Comments/attachments changed in the dialog: refresh that card's counts. */
  protected async refreshTask(id: number) {
    const task = [...this.tasks(), ...this.backlog()].find((t) => t.id === id);
    if (!task) return;
    try {
      this.place(await this.api.task(task.workspace, id));
    } catch {}
  }

  protected onSaved(task: Task) {
    this.editing.set(null);
    this.place(task);
    if (this.mode === 'global') this.targetWs.set(task.workspace);
  }

  protected onBulkCreated(tasks: Task[]) {
    this.bulk.set(null);
    for (const task of tasks) this.place(task);
    if (this.mode === 'global' && tasks[0]) this.targetWs.set(tasks[0].workspace);
    this.toast.show(tasks.length === 1 ? this.i18n.t('Added 1 task.') : this.i18n.t('Added {n} tasks.', { n: String(tasks.length) }));
  }

  protected onDeleted(id: number) {
    this.editing.set(null);
    this.unplace(id);
    this.toast.show(this.i18n.t('Task deleted.'));
  }

  /** Workspace a quick-added task in `lane` goes to: the preferred one if the lane allows it. */
  private laneWorkspace(lane: Lane): number | null {
    const preferred = this.newTaskWs();
    if (preferred !== null && accepts(lane, preferred)) return preferred;
    return lane.workspaces?.[0] ?? preferred;
  }

  protected canQuickAdd(lane: Lane): boolean {
    const ws = this.laneWorkspace(lane);
    return ws !== null && accepts(lane, ws);
  }

  protected startQuickAdd(lane: Lane) {
    this.quickAddTitle = '';
    this.quickAddLane.set(lane.key);
  }

  protected async quickAdd(lane: Lane, column: Column) {
    const title = this.quickAddTitle.trim();
    const ws = this.laneWorkspace(lane);
    if (!title || ws === null) {
      this.quickAddLane.set(null);
      return;
    }
    this.quickAddTitle = '';
    const status = column.statusIds.get(ws);
    try {
      const task = await this.api.createTask(ws, {
        title,
        planned_date: this.date(),
        assignee: this.auth.user()?.id ?? null,
        ...(status !== undefined ? { status } : {}),
        ...lane.assign({ workspace: ws, tags: [] }),
      });
      this.place(task);
    } catch (err) {
      this.toast.error(errorMessage(err, this.i18n.t('Could not add the task.')));
    }
  }

  protected async addToBacklog() {
    const title = this.backlogTitle.trim();
    const ws = this.newTaskWs();
    if (!title || ws === null) return;
    this.backlogTitle = '';
    try {
      this.place(await this.api.createTask(ws, { title, planned_date: null, assignee: this.auth.user()?.id ?? null }));
    } catch (err) {
      this.toast.error(errorMessage(err, this.i18n.t('Could not add the task.')));
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
  }

  protected cellTasks(laneKey: string, columnKey: string): Task[] {
    return this.cells().get(laneKey)?.get(columnKey) ?? [];
  }

  protected laneCount(key: string): number {
    let n = 0;
    for (const list of this.cells().get(key)?.values() ?? []) n += list.length;
    return n;
  }

  protected laneDone(key: string): number {
    let n = 0;
    for (const col of this.columns()) if (col.isDone) n += this.cellTasks(key, col.key).length;
    return n;
  }

  protected columnCount(key: string): number {
    let n = 0;
    for (const lane of this.cells().values()) n += lane.get(key)?.length ?? 0;
    return n;
  }

  private restorePrefs() {
    const defaults: Prefs = {
      groupBy: 'project',
      scope: this.mode === 'global' ? 'me' : 'all',
      includeOverdue: true,
      hideEmpty: this.mode === 'global',
      showBacklog: true,
      collapsed: [],
      targetWs: null,
    };
    let prefs = defaults;
    try {
      prefs = { ...defaults, ...JSON.parse(localStorage.getItem(this.prefsKey) ?? '{}') };
    } catch {}
    const qp = this.route.snapshot.queryParamMap;
    const date = qp.get('date');
    const group = qp.get('group') as GroupBy | null;
    const scope = qp.get('scope');
    this.date.set(isValidIsoDate(date) ? date : today());
    this.groupBy.set(group && /^(workspace|project|assignee|none|tags:.+)$/.test(group) ? group : prefs.groupBy);
    this.scope.set(scope === 'all' || scope === 'me' ? scope : prefs.scope);
    this.includeOverdue.set(prefs.includeOverdue);
    this.hideEmpty.set(prefs.hideEmpty);
    this.showBacklog.set(prefs.showBacklog && window.innerWidth > 900);
    this.collapsed.set(new Set(prefs.collapsed));
    this.targetWs.set(prefs.targetWs);
  }

  private savePrefs() {
    const prefs: Prefs = {
      groupBy: this.groupBy(),
      scope: this.scope(),
      includeOverdue: this.includeOverdue(),
      hideEmpty: this.hideEmpty(),
      showBacklog: this.showBacklog(),
      collapsed: [...this.collapsed()],
      targetWs: this.targetWs(),
    };
    try {
      localStorage.setItem(this.prefsKey, JSON.stringify(prefs));
    } catch {}
  }
}

function byPosition(a: Task, b: Task): number {
  return a.position - b.position || a.id - b.id;
}
