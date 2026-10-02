import { Component, OnDestroy, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiService, errorMessage } from '../../core/api.service';
import { TranslatePipe } from '../../core/i18n.pipes';
import { DelegationState, Task } from '../../core/models';

const ACTIVE = ['queued', 'assessing', 'running'];

/** "Delegate to Flo" (Pro Plus): check whether the AI can do a task, have it done, see the outcome. */
@Component({
  selector: 'app-task-delegate',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './task-delegate.html',
  styleUrl: './task-delegate.scss',
})
export class TaskDelegate implements OnInit, OnDestroy {
  readonly task = input.required<Task>();
  /** The agent posted comments: the dialog should refresh the discussion count. */
  readonly finished = output<void>();
  readonly openDiscussion = output<void>();

  private api = inject(ApiService);
  protected state = signal<DelegationState | null>(null);
  protected error = signal<string | null>(null);
  protected busy = signal(false);
  private timer: ReturnType<typeof setTimeout> | null = null;

  protected readonly d = computed(() => this.state()?.delegation ?? null);
  protected readonly active = computed(() => ACTIVE.includes(this.d()?.status ?? ''));

  async ngOnInit() {
    await this.load();
  }

  ngOnDestroy() {
    if (this.timer) clearTimeout(this.timer);
  }

  private async load() {
    try {
      const before = this.d()?.status;
      this.state.set(await this.api.delegation(this.task().workspace, this.task().id));
      const now = this.d()?.status;
      if (before && ACTIVE.includes(before) && (now === 'done' || now === 'partial')) this.finished.emit();
      if (this.active()) this.timer = setTimeout(() => this.load(), 3000);
    } catch {}
  }

  async act(action: 'assess' | 'run') {
    this.busy.set(true);
    this.error.set(null);
    try {
      this.state.set(await this.api.delegate(this.task().workspace, this.task().id, action));
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => this.load(), 2000);
    } catch (err) {
      this.error.set(errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}
