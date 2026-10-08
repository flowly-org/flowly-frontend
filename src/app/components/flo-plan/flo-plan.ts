import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService, errorMessage } from '../../core/api.service';
import { today } from '../../core/dates';
import { FloService } from '../../core/flo.service';
import { LocalDatePipe, TranslatePipe } from '../../core/i18n.pipes';
import { I18nService } from '../../core/i18n.service';
import { FloPlan, FloPlanTask } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { Icon } from '../icon/icon';

/** "What's on your plate this week?": Flo turns free text into projects and dated tasks, shown for review first. */
@Component({
  selector: 'app-flo-plan',
  imports: [FormsModule, Icon, TranslatePipe, LocalDatePipe],
  templateUrl: './flo-plan.html',
  styleUrl: './flo-plan.scss',
  host: { '[class.as-dialog]': '!inline()', '(document:keydown.escape)': 'inline() || closed.emit()' },
})
export class FloPlanComponent {
  /** On the empty day (true) or as a dialog. */
  readonly inline = input(true);
  readonly workspace = input<number | null>(null);
  readonly done = output<number>();
  readonly closed = output<void>();

  private api = inject(ApiService);
  private toast = inject(ToastService);
  private i18n = inject(I18nService);
  private flo = inject(FloService);

  protected text = '';
  protected busy = signal(false);
  protected plan = signal<FloPlan | null>(null);
  protected readonly today = today();

  /** The proposal by day: today, the coming days, then "someday" (no date). */
  protected readonly days = computed(() => {
    const p = this.plan();
    if (!p) return [];
    const groups = new Map<string, { date: string | null; tasks: FloPlanTask[] }>();
    for (const t of [...p.tasks].sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'))) {
      const key = t.date ?? '';
      if (!groups.has(key)) groups.set(key, { date: t.date, tasks: [] });
      groups.get(key)!.tasks.push(t);
    }
    return [...groups.values()];
  });

  protected color(project: string | null) {
    const palette = ['#4f46e5', '#0ea5e9', '#14b8a6', '#22c55e', '#eab308', '#f97316', '#ef4444', '#ec4899', '#a855f7'];
    const i = this.plan()?.projects.findIndex((p) => p.name === project) ?? -1;
    return i >= 0 ? palette[i % palette.length] : 'var(--muted)';
  }

  protected remove(task: FloPlanTask) {
    const p = this.plan()!;
    this.plan.set({ ...p, tasks: p.tasks.filter((t) => t !== task) });
  }

  protected async propose() {
    this.busy.set(true);
    try {
      this.plan.set(await this.api.floPropose(this.text.trim(), this.workspace() ?? undefined));
    } catch (err) {
      this.toast.error(errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }

  protected async apply() {
    const p = this.plan();
    if (!p?.tasks.length) return;
    this.busy.set(true);
    try {
      const res = await this.api.floApply(p);
      this.toast.show(this.i18n.t('Added {n} tasks. Ask Flo anytime from the top bar.', { n: res.tasks }));
      this.flo.touched();
      this.plan.set(null);
      this.text = '';
      this.done.emit(res.workspace);
    } catch (err) {
      this.toast.error(errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}
