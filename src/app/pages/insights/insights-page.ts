import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { Bar, BarChart } from '../../components/bar-chart/bar-chart';
import { ApiService, errorMessage } from '../../core/api.service';
import { formatShort } from '../../core/dates';
import { TranslatePipe } from '../../core/i18n.pipes';
import { InsightStats, WorkspaceContext, formatMinutes } from '../../core/models';
import { ToastService } from '../../core/toast.service';

type Scope = 'me' | 'workspace' | 'project';

/** Insights for me, a workspace or a project: throughput, time, estimates, timeliness, who has what. */
@Component({
  selector: 'app-insights-page',
  imports: [BarChart, FormsModule, TranslatePipe],
  templateUrl: './insights-page.html',
  styleUrl: '../review/review-page.scss',
})
export class InsightsPage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected contexts = signal<WorkspaceContext[]>([]);
  protected scope = signal<Scope>((this.route.snapshot.queryParamMap.get('scope') as Scope) || 'me');
  protected id = signal<number | null>(Number(this.route.snapshot.queryParamMap.get('id')) || null);
  protected weeks = signal(Number(this.route.snapshot.queryParamMap.get('weeks')) || 12);
  protected data = signal<InsightStats | null>(null);
  protected readonly formatMinutes = formatMinutes;
  protected readonly minutesFmt = (v: number) => formatMinutes(v);

  protected readonly projects = computed(() => this.contexts().flatMap((c) => c.projects.filter((p) => !p.archived).map((p) => ({ ...p, ws: c.name }))));
  protected readonly throughput = computed<Bar[]>(() =>
    (this.data()?.weeks ?? []).map((w) => ({ label: formatShort(w.week), value: w.completed, value2: w.created,
                                             title: `${formatShort(w.week)}: ${w.completed} ✓ / ${w.created} +` })));
  protected readonly time = computed<Bar[]>(() => (this.data()?.weeks ?? []).map((w) => ({ label: formatShort(w.week), value: w.minutes })));
  protected readonly byProject = computed<Bar[]>(() => (this.data()?.projects ?? []).map((p) => ({ label: p.name, value: p.minutes, color: p.color })));
  protected readonly byStatus = computed<Bar[]>(() => (this.data()?.statuses ?? []).map((s) => ({ label: s.name, value: s.count })));

  constructor() {
    this.api.myContext().then((c) => this.contexts.set(c)).catch(() => {});
    effect(() => {
      const scope = this.scope(), id = this.id(), weeks = this.weeks();
      untracked(() => this.load(scope, id, weeks));
    });
  }

  private async load(scope: Scope, id: number | null, weeks: number) {
    if (scope !== 'me' && !id) return;
    this.router.navigate([], { queryParams: { scope, id: scope === 'me' ? null : id, weeks }, replaceUrl: true });
    try {
      this.data.set(await this.api.insights(scope, id, weeks));
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  protected pick(value: string) {
    if (value === 'me') {
      this.scope.set('me');
      this.id.set(null);
      return;
    }
    const [scope, id] = value.split(':');
    this.id.set(Number(id));
    this.scope.set(scope as Scope);
  }

  protected selected() {
    return this.scope() === 'me' ? 'me' : `${this.scope()}:${this.id()}`;
  }
}
