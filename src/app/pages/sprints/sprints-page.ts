import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { ApiService, errorMessage } from '../../core/api.service';
import { formatShort } from '../../core/dates';
import { TranslatePipe } from '../../core/i18n.pipes';
import { I18nService } from '../../core/i18n.service';
import { AgileSetup, SprintBrief, SprintPage, Task, formatMinutes } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { WorkspaceStore } from '../../core/workspace.store';

type Tab = 'board' | 'planning' | 'burndown' | 'standup' | 'retro';
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Agile rituals (opt-in): sprint board, planning, burndown, async standup and retrospective. */
@Component({
  selector: 'app-sprints-page',
  imports: [FormsModule, TranslatePipe],
  templateUrl: './sprints-page.html',
  styleUrl: './sprints-page.scss',
})
export class SprintsPage {
  protected store = inject(WorkspaceStore);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private i18n = inject(I18nService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected setups = signal<AgileSetup[] | null>(null);
  protected setupId = signal<number | null>(Number(this.route.snapshot.queryParamMap.get('setup')) || null);
  protected history = signal<SprintBrief[]>([]);
  protected sprintId = signal<number | null>(null);
  protected page = signal<SprintPage | null>(null);
  protected tab = signal<Tab>('board');
  protected editing = signal<Partial<AgileSetup> | null>(null);
  protected busy = signal(false);
  protected goal = '';
  protected retroDraft: Record<string, string> = { went_well: '', improve: '', idea: '' };
  protected readonly days = DAYS;
  protected readonly formatShort = formatShort;
  protected readonly formatMinutes = formatMinutes;
  protected readonly wsId = computed(() => this.store.currentId()!);
  protected readonly setup = computed(() => this.setups()?.find((s) => s.id === this.setupId()) ?? this.setups()?.[0] ?? null);
  protected readonly columns = computed(() => {
    const p = this.page();
    const statuses = this.store.tagGroups().find((g) => g.kind === 'status')?.tags ?? [];
    return statuses.map((s) => ({ status: s, tasks: (p?.tasks ?? []).filter((t) => t.status === s.id) }));
  });
  protected readonly committedMinutes = computed(() => (this.page()?.tasks ?? []).reduce((n, t) => n + (t.estimate_minutes ?? 0), 0));
  protected readonly burnPath = computed(() => this.path('remaining'));
  protected readonly idealPath = computed(() => this.path('ideal'));
  protected readonly retroCols = [
    { kind: 'went_well', label: 'Went well', icon: '👍' },
    { kind: 'improve', label: 'To improve', icon: '🔧' },
    { kind: 'idea', label: 'Ideas', icon: '💡' },
  ];

  constructor() {
    effect(() => {
      const ws = this.store.currentId();
      if (ws) untracked(() => this.loadSetups());
    });
    effect(() => {
      const id = this.sprintId();
      if (id) untracked(() => this.loadSprint(id));
    });
  }

  private async loadSetups() {
    try {
      const list = await this.api.agileSetups(this.wsId());
      this.setups.set(list);
      const s = this.setup();
      if (s) await this.pickSetup(s.id);
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  protected async pickSetup(id: number) {
    this.setupId.set(id);
    this.router.navigate([], { queryParams: { setup: id }, replaceUrl: true });
    const s = this.setups()?.find((x) => x.id === id);
    this.history.set(await this.api.sprints(this.wsId(), id).catch(() => []));
    this.sprintId.set(s?.sprint?.id ?? this.history()[0]?.id ?? null);
  }

  protected async loadSprint(id: number) {
    try {
      const p = await this.api.sprint(this.wsId(), id);
      this.page.set(p);
      this.goal = p.goal;
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  protected reload() {
    const id = this.sprintId();
    if (id) this.loadSprint(id);
  }

  // --- setup ----------------------------------------------------------------

  protected newSetup() {
    this.editing.set({ project: null, sprint_weeks: 2, sprint_start: 0, carry_over: true, standup: true, standup_time: '09:30',
                       standup_days: [0, 1, 2, 3, 4], retro: true, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome' });
  }

  protected toggleDay(e: Partial<AgileSetup>, d: number) {
    const set = new Set(e.standup_days ?? []);
    set.has(d) ? set.delete(d) : set.add(d);
    e.standup_days = [...set].sort();
  }

  protected async saveSetup() {
    const e = this.editing();
    if (!e) return;
    this.busy.set(true);
    try {
      const saved = await this.api.saveAgileSetup(this.wsId(), e, e.id);
      this.editing.set(null);
      this.setupId.set(saved.id);
      await this.store.loadWorkspaces();
      await this.loadSetups();
    } catch (err) {
      this.toast.error(errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }

  protected async disable(s: AgileSetup) {
    try {
      await this.api.disableAgile(this.wsId(), s.id);
      this.editing.set(null);
      this.setupId.set(null);
      this.page.set(null);
      await this.store.loadWorkspaces();
      await this.loadSetups();
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  // --- sprint ------------------------------------------------------------------

  protected async saveGoal() {
    const p = this.page();
    if (!p || this.goal === p.goal) return;
    await this.api.updateSprint(this.wsId(), p.id, { goal: this.goal }).catch((err) => this.toast.error(errorMessage(err)));
  }

  protected async move(t: Task, into: boolean) {
    const p = this.page();
    if (!p) return;
    await this.api.sprintTasks(this.wsId(), p.id, into ? [t.id] : [], into ? [] : [t.id]).catch((err) => this.toast.error(errorMessage(err)));
    this.reload();
  }

  protected async setStatus(t: Task, status: number) {
    await this.api.updateTask(t.workspace, t.id, { status }).catch((err) => this.toast.error(errorMessage(err)));
    this.reload();
  }

  protected openTask(t: Task) {
    this.router.navigate(['/w', t.workspace, 'board'], { queryParams: { task: t.id } });
  }

  protected async close() {
    const p = this.page();
    if (!p) return;
    this.busy.set(true);
    try {
      await this.api.closeSprint(this.wsId(), p.id);
      this.toast.show(this.i18n.t('{name} closed: the review went to the team.', { name: p.name }));
      await this.loadSetups();
    } catch (err) {
      this.toast.error(errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }

  protected async planNext() {
    const s = this.setup();
    if (!s) return;
    const next = await this.api.planNextSprint(this.wsId(), s.id).catch(() => null);
    if (next) {
      this.history.set(await this.api.sprints(this.wsId(), s.id));
      this.sprintId.set(next.id);
      this.tab.set('planning');
    }
  }

  // --- burndown --------------------------------------------------------------

  private path(key: 'remaining' | 'ideal') {
    const b = this.page()?.burndown;
    if (!b || !b.days.length) return '';
    const w = 600, h = 160, max = Math.max(1, b.total);
    const pts = b.days.map((d, i) => ({ x: (i / Math.max(1, b.days.length - 1)) * w, v: d[key] }))
      .filter((p) => p.v !== null) as { x: number; v: number }[];
    const start = key === 'ideal' ? [`M0,0`] : [`M0,${h - (b.total / max) * h}`];
    return start.concat(pts.map((p) => `L${p.x.toFixed(1)},${(h - (p.v / max) * h).toFixed(1)}`)).join(' ').replace('M0,0 L', 'M0,0 L');
  }

  protected burnLabel(v: number) {
    return this.page()?.burndown.unit === 'minutes' ? formatMinutes(v) : String(v);
  }

  // --- standup & retro ----------------------------------------------------------

  protected async postStandup() {
    const p = this.page();
    if (!p) return;
    try {
      await this.api.postStandup(this.wsId(), p.setup.id, p.standup.mine);
      this.toast.show(this.i18n.t('Standup posted.'));
      this.reload();
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  protected retroItems(kind: string) {
    return (this.page()?.retro ?? []).filter((r) => r.kind === kind).sort((a, b) => b.votes - a.votes);
  }

  protected async addRetro(kind: string) {
    const p = this.page();
    const text = this.retroDraft[kind]?.trim();
    if (!p || !text) return;
    this.retroDraft[kind] = '';
    await this.api.addRetro(this.wsId(), p.id, kind, text).catch((err) => this.toast.error(errorMessage(err)));
    this.reload();
  }

  protected async vote(id: number, voted: boolean) {
    await this.api.voteRetro(this.wsId(), id, !voted).catch(() => {});
    this.reload();
  }

  protected async removeRetro(id: number) {
    await this.api.deleteRetro(this.wsId(), id).catch((err) => this.toast.error(errorMessage(err)));
    this.reload();
  }

  protected async action(id: number) {
    await this.api.retroAction(this.wsId(), id).catch((err) => this.toast.error(errorMessage(err)));
    this.toast.show(this.i18n.t('Action item added to the next sprint.'));
    this.reload();
  }
}
