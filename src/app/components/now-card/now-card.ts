import { Component, computed, inject, input, output, signal } from '@angular/core';

import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { BoardData } from '../../core/board-data';
import { FocusService } from '../../core/focus.service';
import { TranslatePipe } from '../../core/i18n.pipes';
import { I18nService } from '../../core/i18n.service';
import { Task, formatDuration } from '../../core/models';
import { TimerService } from '../../core/timer.service';
import { ToastService } from '../../core/toast.service';

/** ADHD mode: the one task to do now, with a focus timer, "not now" and "break it down"; the rest folded away. */
@Component({
  selector: 'app-now-card',
  imports: [TranslatePipe],
  templateUrl: './now-card.html',
  styleUrl: './now-card.scss',
})
export class NowCard {
  readonly tasks = input.required<Task[]>();
  readonly day = input.required<string>();
  readonly done = output<Task>();
  readonly open = output<Task>();
  /** Flo added steps to a task: the board should reload it. */
  readonly changed = output<number>();

  protected focus = inject(FocusService);
  protected timer = inject(TimerService);
  protected data = inject(BoardData);
  private auth = inject(AuthService);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private i18n = inject(I18nService);
  protected readonly formatDuration = formatDuration;

  private skipped = signal<number[]>([]);
  protected splitting = signal(false);
  protected flo = computed(() => !!this.auth.user()?.has_pro);

  protected readonly queue = computed(() => {
    const all = this.focus.queue(this.tasks(), this.data, this.timer, this.day());
    const skipped = this.skipped();
    // "Not now" moves a task to the end of the line (for this visit).
    return [...all.filter((t) => !skipped.includes(t.id)), ...skipped.map((id) => all.find((t) => t.id === id)).filter((t): t is Task => !!t)];
  });
  protected readonly current = computed(() => this.queue()[0] ?? null);
  protected readonly next = computed(() => this.queue().slice(1, this.focus.opts().today_limit));
  protected readonly more = computed(() => Math.max(0, this.queue().length - this.focus.opts().today_limit));
  protected readonly running = computed(() => {
    const c = this.current();
    return !!c && this.timer.isRunningOn(c.id);
  });

  protected where(task: Task): string {
    const project = task.project ? this.data.projectById().get(task.project)?.name : null;
    return [this.data.multi() ? this.data.ctx(task.workspace)?.name : null, project].filter(Boolean).join(' · ');
  }

  protected start(task: Task) {
    if (this.timer.isRunningOn(task.id)) this.timer.stop();
    else this.timer.startOn(task.workspace, task.id);
  }

  protected notNow(task: Task) {
    this.skipped.update((list) => [...list.filter((id) => id !== task.id), task.id]);
  }

  /** Ask Flo to split the task into tiny steps (added to its notes as a checklist). */
  protected async breakDown(task: Task) {
    if (!this.flo()) {
      this.open.emit(task);
      return;
    }
    this.splitting.set(true);
    try {
      await this.api.conciergeChat(
        `Break task #${task.id} “${task.title}” into 3-5 tiny steps with add_steps (the first one under 5 minutes). Reply in one short line.`,
      );
      this.toast.show(this.i18n.t('Flo added small steps to the task.'));
      this.changed.emit(task.id);
    } catch (err) {
      this.toast.error(errorMessage(err));
    } finally {
      this.splitting.set(false);
    }
  }
}
