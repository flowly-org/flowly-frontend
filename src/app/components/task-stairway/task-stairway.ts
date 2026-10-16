import { Component, OnDestroy, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService, errorMessage } from '../../core/api.service';
import { TranslatePipe } from '../../core/i18n.pipes';
import { StairwayRun, Task } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { Icon } from '../icon/icon';

/** Hand a task to an AI agent on Stairway, watch it, follow up; its files land in the task's Documents. */
@Component({
  selector: 'app-task-stairway',
  imports: [FormsModule, Icon, TranslatePipe],
  template: `
    @if (available()) {
      <section class="stairway">
        <header>
          <app-icon name="bot" [size]="16" />
          <strong>Stairway</strong>
          @if (run(); as r) {
            <span class="state" [attr.data-state]="r.status">{{ statusLabel(r.status) | t }}</span>
          }
        </header>
        @if (run(); as r) {
          <div class="links small">
            <span class="muted">{{ r.experiment }}</span>
            @if (r.session_url) { <a [href]="r.session_url" target="_blank" rel="noopener">{{ 'Open the session' | t }} ↗</a> }
            @if (r.editor_url) { <a [href]="r.editor_url" target="_blank" rel="noopener">{{ 'Files in VS Code' | t }} ↗</a> }
            @if (r.files) { <button type="button" class="link-btn" (click)="openDocuments.emit()">{{ (r.files === 1 ? '1 file in Documents' : '{n} files in Documents') | t: { n: r.files } }}</button> }
          </div>
          @if (r.error) { <p class="error small"><app-icon name="alert" [size]="14" /> {{ r.error }}</p> }
          @if (r.status === 'waiting') {
            <div class="waiting">
              <p class="small"><strong>{{ 'The agent asks for your OK before going on:' | t }}</strong></p>
              <pre>{{ r.waiting_for }}</pre>
              <div class="row">
                <button class="btn primary small" type="button" [disabled]="busy()" (click)="answer(r, true)"><app-icon name="check" [size]="14" /> {{ 'Allow' | t }}</button>
                <button class="btn ghost small" type="button" [disabled]="busy()" (click)="answer(r, false)">{{ 'Refuse' | t }}</button>
              </div>
            </div>
          }
          @if (r.last_reply) {
            <p class="reply" [class.open]="expanded()">{{ r.last_reply }}</p>
            @if (r.last_reply.length > 280) {
              <button type="button" class="btn ghost small" (click)="expanded.set(!expanded())">{{ (expanded() ? 'Show less' : 'Show all') | t }}</button>
            }
          } @else if (r.status === 'working') {
            <p class="muted small">{{ 'The agent is working. Its reply and the files it leaves in ./deliverables will appear here.' | t }}</p>
          }
          @if (r.status !== 'stopped' && r.status !== 'failed') {
            <form class="ask" (ngSubmit)="followUp(r)">
              <input name="followup" [(ngModel)]="followUpText" [placeholder]="'Answer or ask for changes…' | t" [attr.aria-label]="'Message to the agent' | t" />
              <button class="btn small" type="submit" [disabled]="busy() || !followUpText.trim()">{{ 'Send' | t }}</button>
              <button class="btn ghost danger small" type="button" [disabled]="busy()" (click)="stop(r)">{{ 'Stop' | t }}</button>
            </form>
          }
        }
        @if (!run() || run()!.status === 'stopped' || run()!.status === 'failed' || run()!.status === 'review') {
          <form class="start" (ngSubmit)="start()">
            <textarea name="instructions" rows="2" [(ngModel)]="instructions" [placeholder]="'Anything the agent should know (optional)' | t"></textarea>
            <button class="btn primary small" type="submit" [disabled]="busy()">
              <app-icon name="sparkles" [size]="14" /> {{ (run() ? 'Start a new run' : 'Work on it in Stairway') | t }}
            </button>
          </form>
        }
      </section>
    }
  `,
  styles: `
    .stairway { margin-top: 14px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 12px; display: grid; gap: 8px; }
    header { display: flex; align-items: center; gap: 8px; }
    .state { margin-left: auto; font-size: .72rem; padding: 2px 8px; border-radius: 999px; background: var(--surface-2); color: var(--muted); }
    .state[data-state='working'] { color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); }
    .state[data-state='waiting'] { color: var(--warn); background: color-mix(in srgb, var(--warn) 14%, transparent); }
    .state[data-state='review'] { color: var(--ok); background: color-mix(in srgb, var(--ok) 14%, transparent); }
    .state[data-state='failed'] { color: var(--danger); background: color-mix(in srgb, var(--danger) 12%, transparent); }
    .waiting { display: grid; gap: 6px; padding: 10px; border-radius: 10px; background: var(--surface-2); }
    .waiting p { margin: 0; }
    .waiting pre { margin: 0; max-height: 12em; overflow: auto; font-size: .78rem; white-space: pre-wrap; }
    .waiting .row { display: flex; gap: 6px; }
    .waiting .btn { display: inline-flex; align-items: center; gap: 6px; }
    .links { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: center; }
    .links a { color: var(--accent); }
    .link-btn { border: 0; background: none; padding: 0; color: var(--accent); font: inherit; cursor: pointer; text-decoration: underline; }
    .reply { margin: 0; white-space: pre-line; font-size: .88rem; line-height: 1.5; max-height: 7.5em; overflow: hidden;
      mask-image: linear-gradient(#000 70%, transparent); }
    .reply.open { max-height: none; mask-image: none; }
    .error { color: var(--danger); margin: 0; display: flex; gap: 6px; align-items: center; }
    .ask, .start { display: flex; gap: 6px; align-items: flex-start; flex-wrap: wrap; }
    .ask input { flex: 1 1 200px; }
    .start textarea { flex: 1 1 240px; }
    .start .btn { display: inline-flex; align-items: center; gap: 6px; }
  `,
})
export class TaskStairway implements OnInit, OnDestroy {
  readonly task = input.required<Task>();
  readonly openDocuments = output<void>();
  readonly changed = output<void>();

  private api = inject(ApiService);
  private toast = inject(ToastService);

  protected available = signal(false);
  protected runs = signal<StairwayRun[]>([]);
  protected readonly run = computed(() => this.runs()[0] ?? null);
  protected busy = signal(false);
  protected expanded = signal(false);
  protected instructions = '';
  protected followUpText = '';
  private timer: ReturnType<typeof setInterval> | null = null;

  async ngOnInit() {
    await this.load();
    // While the agent works, look again every 15 s: its reply arrives through Stairway's callback.
    this.timer = setInterval(() => ['working', 'waiting'].includes(this.run()?.status ?? '') && this.load(), 15000);
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async load() {
    try {
      const before = this.run();
      const res = await this.api.stairwayRuns(this.task().workspace, this.task().id);
      this.available.set(res.available || res.runs.length > 0);
      this.runs.set(res.runs);
      const now = this.run();
      if (before && now && before.status !== now.status) this.changed.emit();
    } catch {
      this.available.set(false);
    }
  }

  protected statusLabel(status: StairwayRun['status']) {
    return { working: 'Working', waiting: 'Waiting for your OK', review: 'Ready for review', failed: 'Failed', stopped: 'Stopped' }[status];
  }

  private async act(work: () => Promise<unknown>) {
    this.busy.set(true);
    try {
      await work();
      await this.load();
      this.changed.emit();
    } catch (err) {
      this.toast.error(errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }

  protected start() {
    this.act(async () => {
      await this.api.stairwayStart(this.task().workspace, this.task().id, this.instructions.trim());
      this.instructions = '';
    });
  }

  protected followUp(r: StairwayRun) {
    const text = this.followUpText.trim();
    this.act(async () => {
      await this.api.stairwayAction(this.task().workspace, this.task().id, r.id, 'prompt', text);
      this.followUpText = '';
    });
  }

  protected answer(r: StairwayRun, allow: boolean) {
    this.act(() => this.api.stairwayAction(this.task().workspace, this.task().id, r.id, allow ? 'approve' : 'deny'));
  }

  protected stop(r: StairwayRun) {
    this.act(() => this.api.stairwayAction(this.task().workspace, this.task().id, r.id, 'stop'));
  }
}
