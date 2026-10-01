import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { BoardData } from '../../core/board-data';
import { formatShort } from '../../core/dates';
import { Task, TaskInput } from '../../core/models';
import { parseList } from './bulk-parse';

@Component({
  selector: 'app-bulk-add',
  imports: [FormsModule],
  templateUrl: './bulk-add.html',
  styleUrl: './bulk-add.scss',
  host: { '(document:keydown.escape)': 'closed.emit()' },
})
export class BulkAdd implements OnInit {
  /** Day the tasks are planned for unless a line says otherwise; null = backlog. */
  readonly day = input<string | null>(null);
  readonly workspace = input<number | null>(null);
  readonly project = input<number | null>(null);

  readonly created = output<Task[]>();
  readonly closed = output<void>();

  protected data = inject(BoardData);
  private api = inject(ApiService);
  private auth = inject(AuthService);

  protected wsId = signal(0);
  protected projectId = signal<number | null>(null);
  protected planned = signal<'day' | 'backlog'>('day');
  protected assignToMe = signal(true);
  protected text = signal('');
  protected busy = signal(false);
  protected error = signal<string | null>(null);

  protected ctx = computed(() => this.data.ctx(this.wsId()));
  protected drafts = computed(() => parseList(this.text(), this.ctx(), this.day() ?? new Date().toISOString().slice(0, 10)));
  protected readonly formatShort = formatShort;

  ngOnInit() {
    this.wsId.set(this.workspace() ?? this.data.contexts()[0]?.id ?? 0);
    this.projectId.set(this.project());
    if (this.day() === null) this.planned.set('backlog');
  }

  protected dateLabel(d: string | null | undefined): string {
    if (d === undefined) return this.planned() === 'backlog' || !this.day() ? 'Backlog' : formatShort(this.day()!);
    return d === null ? 'Backlog' : formatShort(d);
  }

  protected changeWorkspace(id: number) {
    this.wsId.set(id);
    this.projectId.set(null);
  }

  async create() {
    const drafts = this.drafts();
    if (!drafts.length) return;
    const statuses = this.data.statuses(this.wsId());
    const done = statuses.find((s) => s.is_done)?.id;
    const defaultDate = this.planned() === 'backlog' ? null : this.day();
    const me = this.auth.user()?.id ?? null;
    const payload: TaskInput[] = drafts.map((d) => ({
      title: d.title.slice(0, 255),
      description: d.notes,
      project: d.project?.id ?? this.projectId(),
      priority: d.priority?.id ?? null,
      tags: d.tags.map((t) => t.id),
      planned_date: d.date === undefined ? defaultDate : d.date,
      assignee: this.assignToMe() ? me : null,
      ...(d.done && done ? { status: done } : {}),
    }));
    this.busy.set(true);
    this.error.set(null);
    try {
      this.created.emit(await this.api.bulkCreateTasks(this.wsId(), payload));
    } catch (err) {
      this.error.set(errorMessage(err, 'Could not create the tasks.'));
    } finally {
      this.busy.set(false);
    }
  }
}
