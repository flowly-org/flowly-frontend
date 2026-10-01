import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService, errorMessage } from '../../core/api.service';
import { BoardData } from '../../core/board-data';
import { Task, TaskInput } from '../../core/models';

interface FormModel {
  title: string;
  description: string;
  status: number | null;
  priority: number | null;
  project: number | null;
  assignee: number | null;
  planned_date: string;
  due_date: string;
  /** Selected tag per custom tag group (group id → tag id | null). */
  grouped: Record<number, number | null>;
  free: Set<number>;
}

@Component({
  selector: 'app-task-dialog',
  imports: [FormsModule],
  templateUrl: './task-dialog.html',
  styleUrl: './task-dialog.scss',
  host: { '(document:keydown.escape)': 'closed.emit()' },
})
export class TaskDialog implements OnInit {
  /** Task to edit, or null to create one using `defaults` (which should include `workspace`). */
  readonly task = input<Task | null>(null);
  readonly defaults = input<TaskInput>({});

  readonly saved = output<Task>();
  readonly deleted = output<number>();
  readonly closed = output<void>();

  protected data = inject(BoardData);
  private api = inject(ApiService);

  protected wsId = signal<number>(0);
  protected ctx = computed(() => this.data.ctx(this.wsId()));
  protected statuses = computed(() => this.data.statuses(this.wsId()));
  protected priorities = computed(() => this.data.priorities(this.wsId()));
  protected customGroups = computed(() => this.ctx()?.tag_groups.filter((g) => g.kind === 'custom') ?? []);
  protected freeTags = computed(() => this.ctx()?.tags.filter((t) => t.group === null) ?? []);

  protected model!: FormModel;
  protected busy = signal(false);
  protected error = signal<string | null>(null);
  protected confirmDelete = signal(false);

  ngOnInit() {
    const src: TaskInput = this.task() ?? this.defaults();
    this.wsId.set(src.workspace ?? this.data.contexts()[0]?.id ?? 0);
    this.model = {
      title: src.title ?? '',
      description: src.description ?? '',
      status: src.status ?? null,
      priority: src.priority ?? null,
      project: src.project ?? null,
      assignee: src.assignee ?? null,
      planned_date: src.planned_date ?? '',
      due_date: src.due_date ?? '',
      grouped: {},
      free: new Set(),
    };
    this.applyTags(src.tags ?? []);
    if (this.model.status === null) this.model.status = this.defaultStatus();
  }

  private defaultStatus(): number | null {
    const statuses = this.statuses();
    return (statuses.find((s) => !s.is_done) ?? statuses[0])?.id ?? null;
  }

  private applyTags(ids: number[]) {
    const tagIds = new Set(ids);
    this.model.grouped = {};
    for (const group of this.customGroups()) {
      this.model.grouped[group.id] = group.tags.find((t) => tagIds.has(t.id))?.id ?? null;
    }
    this.model.free = new Set(this.freeTags().filter((t) => tagIds.has(t.id)).map((t) => t.id));
  }

  /** New tasks only: moving to another workspace resets the workspace-specific fields. */
  protected changeWorkspace(id: number) {
    this.wsId.set(id);
    const statusName = this.data.tagById().get(this.model.status ?? -1)?.name.toLowerCase();
    this.model.status = this.statuses().find((s) => s.name.toLowerCase() === statusName)?.id ?? this.defaultStatus();
    this.model.priority = null;
    this.model.project = null;
    if (!this.ctx()?.members.some((m) => m.user.id === this.model.assignee)) this.model.assignee = null;
    this.applyTags([]);
  }

  protected toggleFree(id: number) {
    if (this.model.free.has(id)) this.model.free.delete(id);
    else this.model.free.add(id);
  }

  async save() {
    const m = this.model;
    if (!m.title.trim()) {
      this.error.set('Give the task a title.');
      return;
    }
    const tags = [...Object.values(m.grouped).filter((id): id is number => id !== null), ...m.free];
    const payload: TaskInput = {
      title: m.title.trim(),
      description: m.description,
      priority: m.priority,
      project: m.project,
      assignee: m.assignee,
      planned_date: m.planned_date || null,
      due_date: m.due_date || null,
      tags,
      ...(m.status !== null ? { status: m.status } : {}),
    };
    this.busy.set(true);
    this.error.set(null);
    try {
      const existing = this.task();
      const result = existing
        ? await this.api.updateTask(existing.workspace, existing.id, payload)
        : await this.api.createTask(this.wsId(), payload);
      this.saved.emit(result);
    } catch (err) {
      this.error.set(errorMessage(err, 'Could not save the task.'));
    } finally {
      this.busy.set(false);
    }
  }

  async remove() {
    const existing = this.task();
    if (!existing) return;
    this.busy.set(true);
    try {
      await this.api.deleteTask(existing.workspace, existing.id);
      this.deleted.emit(existing.id);
    } catch (err) {
      this.error.set(errorMessage(err, 'Could not delete the task.'));
      this.busy.set(false);
    }
  }
}
