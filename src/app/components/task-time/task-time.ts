import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { today } from '../../core/dates';
import { Task, TimeEntry, formatDuration } from '../../core/models';
import { TimerService } from '../../core/timer.service';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-task-time',
  imports: [FormsModule, DatePipe],
  template: `
    <div class="head">
      <div>
        <div class="total">{{ formatDuration(total()) }}</div>
        <div class="muted small">tracked on this task</div>
      </div>
      @if (timer.isRunningOn(task().id)) {
        <button class="btn danger" type="button" (click)="timer.stop()">■ Stop · {{ formatDuration(timer.elapsed()) }}</button>
      } @else {
        <button class="btn primary" type="button" (click)="timer.startOn(task().workspace, task().id)">▶ Start timer</button>
      }
    </div>

    <form class="log" (ngSubmit)="log()">
      <input name="mins" type="text" [(ngModel)]="amount" placeholder="1:30 or 45m" aria-label="Time spent" />
      <input name="day" type="date" [(ngModel)]="day" aria-label="Day" />
      <input name="note" [(ngModel)]="note" placeholder="What did you do? (optional)" aria-label="Note" class="note" />
      <button class="btn" type="submit" [disabled]="!amount.trim()">Log time</button>
    </form>

    <div class="entries">
      @for (e of entries(); track e.id) {
        <div class="entry">
          <span class="dur">{{ formatDuration(e.running ? timer.elapsed() : e.seconds) }}</span>
          <span class="grow">
            {{ e.description || '—' }}
            <span class="muted small">· {{ e.user.full_name || e.user.email }} · {{ e.started_at | date: 'MMM d, HH:mm' }}</span>
          </span>
          @if (e.invoiced) {
            <span class="chip small" title="On an invoice">{{ e.invoiced }}</span>
          } @else if (!e.billable) {
            <span class="muted small">non-billable</span>
          }
          @if (!e.running && !e.invoice && e.user.id === auth.user()?.id) {
            <button class="btn ghost icon small" type="button" aria-label="Delete entry" (click)="remove(e)">✕</button>
          }
        </div>
      } @empty {
        <p class="muted small">No time tracked yet.</p>
      }
    </div>
  `,
  styleUrl: './task-time.scss',
})
export class TaskTime implements OnInit {
  readonly task = input.required<Task>();

  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected timer = inject(TimerService);
  protected auth = inject(AuthService);

  protected entries = signal<TimeEntry[]>([]);
  protected amount = '';
  protected day = today();
  protected note = '';
  protected readonly formatDuration = formatDuration;
  protected total = computed(() =>
    this.entries().reduce((sum, e) => sum + (e.running ? this.timer.elapsed() : e.seconds), 0),
  );

  constructor() {
    effect(() => {
      this.timer.version();
      this.timer.entry();
      untracked(() => this.load());
    });
  }

  ngOnInit() {
    this.load();
  }

  private async load() {
    try {
      this.entries.set(await this.api.timeEntries(this.task().workspace, { task: this.task().id }));
    } catch {}
  }

  /** "1:30", "1h 30m", "90m", "90", "1.5h" → seconds */
  private parse(text: string): number | null {
    const t = text.trim().toLowerCase();
    let m = t.match(/^(\d+):(\d{1,2})$/);
    if (m) return (+m[1] * 60 + +m[2]) * 60;
    m = t.match(/^(?:(\d+(?:[.,]\d+)?)\s*h)?\s*(?:(\d+)\s*m)?$/);
    if (m && (m[1] || m[2])) return Math.round((parseFloat((m[1] ?? '0').replace(',', '.')) * 60 + +(m[2] ?? 0)) * 60);
    if (/^\d+$/.test(t)) return +t * 60;
    return null;
  }

  async log() {
    const seconds = this.parse(this.amount);
    if (!seconds) {
      this.toast.error('Enter time like 1:30, 45m or 2h.');
      return;
    }
    const start = new Date(`${this.day}T09:00:00`);
    try {
      await this.api.createTimeEntry(this.task().workspace, {
        task: this.task().id,
        started_at: start.toISOString(),
        duration_seconds: seconds,
        description: this.note.trim(),
      });
      this.amount = '';
      this.note = '';
      this.timer.version.update((v) => v + 1);
    } catch (err) {
      this.toast.error(errorMessage(err, 'Could not log the time.'));
    }
  }

  async remove(e: TimeEntry) {
    try {
      await this.api.deleteTimeEntry(e.workspace, e.id);
      this.entries.update((l) => l.filter((x) => x.id !== e.id));
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }
}
