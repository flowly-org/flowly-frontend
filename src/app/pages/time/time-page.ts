import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { addDays, today } from '../../core/dates';
import { TimeEntry, TimeReport, formatDuration } from '../../core/models';
import { TimerService } from '../../core/timer.service';
import { ToastService } from '../../core/toast.service';
import { WorkspaceStore } from '../../core/workspace.store';

function monday(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return addDays(iso, -((d.getDay() + 6) % 7));
}

@Component({
  selector: 'app-time-page',
  imports: [FormsModule, DatePipe],
  templateUrl: './time-page.html',
  styleUrl: './time-page.scss',
})
export class TimePage implements OnInit {
  protected store = inject(WorkspaceStore);
  protected auth = inject(AuthService);
  protected timer = inject(TimerService);
  private api = inject(ApiService);
  private toast = inject(ToastService);

  protected from = signal(monday(today()));
  protected to = computed(() => addDays(this.from(), 6));
  protected who = signal<'me' | 'all'>('me');
  protected group = signal<'project' | 'user' | 'task' | 'day'>('project');
  protected entries = signal<TimeEntry[]>([]);
  protected report = signal<TimeReport | null>(null);
  protected readonly formatDuration = formatDuration;

  // manual entry form
  protected draft = { day: today(), start: '09:00', end: '10:00', project: null as number | null, description: '' };

  protected readonly byDay = computed(() => {
    const days = new Map<string, TimeEntry[]>();
    for (const e of this.entries()) {
      const key = e.started_at.slice(0, 10);
      days.set(key, [...(days.get(key) ?? []), e]);
    }
    return [...days.entries()].map(([day, list]) => ({
      day,
      list,
      seconds: list.reduce((s, e) => s + (e.running ? this.timer.elapsed() : e.seconds), 0),
    }));
  });

  private get wsId() {
    return this.store.currentId()!;
  }

  constructor() {
    effect(() => {
      this.from();
      this.who();
      this.group();
      this.timer.version();
      untracked(() => this.load());
    });
  }

  ngOnInit() {}

  private async load() {
    const q = { from: this.from(), to: this.to(), user: this.who() === 'me' ? 'me' : undefined };
    try {
      const [entries, report] = await Promise.all([
        this.api.timeEntries(this.wsId, q),
        this.api.timeReport(this.wsId, { ...q, group: this.group() }),
      ]);
      this.entries.set(entries);
      this.report.set(report);
    } catch (err) {
      this.toast.error(errorMessage(err, 'Could not load time.'));
    }
  }

  protected shift(weeks: number) {
    this.from.update((d) => addDays(d, weeks * 7));
  }

  async add() {
    const start = new Date(`${this.draft.day}T${this.draft.start}`);
    const end = new Date(`${this.draft.day}T${this.draft.end}`);
    if (!(end > start)) {
      this.toast.error('The end must be after the start.');
      return;
    }
    try {
      await this.api.createTimeEntry(this.wsId, {
        started_at: start.toISOString(),
        ended_at: end.toISOString(),
        project: this.draft.project,
        description: this.draft.description.trim(),
      });
      this.draft.description = '';
      this.load();
    } catch (err) {
      this.toast.error(errorMessage(err, 'Could not add the entry.'));
    }
  }

  async toggleBillable(e: TimeEntry) {
    try {
      await this.api.updateTimeEntry(this.wsId, e.id, { billable: !e.billable });
      this.load();
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  async remove(e: TimeEntry) {
    try {
      await this.api.deleteTimeEntry(this.wsId, e.id);
      this.load();
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  protected canEdit(e: TimeEntry) {
    return !e.running && !e.invoice && (e.user.id === this.auth.user()?.id || this.store.canManage());
  }
}
