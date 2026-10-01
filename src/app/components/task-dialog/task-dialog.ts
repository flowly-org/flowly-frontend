import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService, errorMessage } from '../../core/api.service';
import { PRIORITIES, STATUSES, Task, TaskInput } from '../../core/models';
import { WorkspaceStore } from '../../core/workspace.store';

interface FormModel {
  title: string;
  description: string;
  status: Task['status'];
  priority: number;
  project: number | null;
  assignee: number | null;
  planned_date: string;
  due_date: string;
  /** Selected tag per tag group (group id → tag id | null). */
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
  /** Task to edit, or null to create one using `defaults`. */
  readonly task = input<Task | null>(null);
  readonly defaults = input<TaskInput>({});

  readonly saved = output<Task>();
  readonly deleted = output<number>();
  readonly closed = output<void>();

  protected store = inject(WorkspaceStore);
  private api = inject(ApiService);

  protected readonly statuses = STATUSES;
  protected readonly priorities = PRIORITIES;
  protected model!: FormModel;
  protected busy = signal(false);
  protected error = signal<string | null>(null);
  protected confirmDelete = signal(false);

  ngOnInit() {
    const src: TaskInput = this.task() ?? this.defaults();
    const tagIds = new Set(src.tags ?? []);
    const grouped: Record<number, number | null> = {};
    for (const group of this.store.tagGroups()) {
      grouped[group.id] = group.tags.find((t) => tagIds.has(t.id))?.id ?? null;
    }
    this.model = {
      title: src.title ?? '',
      description: src.description ?? '',
      status: src.status ?? 'todo',
      priority: src.priority ?? 0,
      project: src.project ?? null,
      assignee: src.assignee ?? null,
      planned_date: src.planned_date ?? '',
      due_date: src.due_date ?? '',
      grouped,
      free: new Set(this.store.freeTags().filter((t) => tagIds.has(t.id)).map((t) => t.id)),
    };
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
    const tags = [
      ...Object.values(m.grouped).filter((id): id is number => id !== null),
      ...m.free,
    ];
    const payload: TaskInput = {
      title: m.title.trim(),
      description: m.description,
      status: m.status,
      priority: Number(m.priority) as Task['priority'],
      project: m.project,
      assignee: m.assignee,
      planned_date: m.planned_date || null,
      due_date: m.due_date || null,
      tags,
    };
    const wsId = this.store.currentId()!;
    this.busy.set(true);
    this.error.set(null);
    try {
      const existing = this.task();
      const result = existing
        ? await this.api.updateTask(wsId, existing.id, payload)
        : await this.api.createTask(wsId, payload);
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
      await this.api.deleteTask(this.store.currentId()!, existing.id);
      this.deleted.emit(existing.id);
    } catch (err) {
      this.error.set(errorMessage(err, 'Could not delete the task.'));
      this.busy.set(false);
    }
  }
}
