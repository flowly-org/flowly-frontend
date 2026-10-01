import { Component, computed, inject, input, output } from '@angular/core';

import { formatShort } from '../../core/dates';
import { Task } from '../../core/models';
import { WorkspaceStore } from '../../core/workspace.store';

@Component({
  selector: 'app-task-card',
  templateUrl: './task-card.html',
  styleUrl: './task-card.scss',
  host: { '[class.done]': "task().status === 'done'" },
})
export class TaskCard {
  readonly task = input.required<Task>();
  /** The day being viewed; tasks planned earlier get a "carried over" badge. */
  readonly day = input<string | null>(null);
  readonly showProject = input(true);
  readonly showAssignee = input(true);
  /** Tags from this group are implied by the swimlane, so they're not repeated on the card. */
  readonly hideTagGroup = input<number | null>(null);

  readonly open = output<Task>();
  readonly toggleDone = output<Task>();

  private store = inject(WorkspaceStore);

  protected project = computed(() => {
    const id = this.task().project;
    return id === null ? null : (this.store.projectById().get(id) ?? null);
  });

  protected tags = computed(() => {
    const byId = this.store.tagById();
    const hidden = this.hideTagGroup();
    return this.task()
      .tags.map((id) => byId.get(id))
      .filter((t) => !!t && (hidden === null || t.group !== hidden));
  });

  protected assignee = computed(() => {
    const id = this.task().assignee;
    return id === null ? null : (this.store.userById().get(id) ?? null);
  });

  protected carriedFrom = computed(() => {
    const t = this.task();
    const day = this.day();
    return day && t.planned_date && t.planned_date < day && t.status !== 'done' ? formatShort(t.planned_date) : null;
  });

  protected due = computed(() => {
    const d = this.task().due_date;
    if (!d) return null;
    const ref = this.day();
    return { label: formatShort(d), late: !!ref && d < ref && this.task().status !== 'done', today: d === ref };
  });

  protected initials(name: string): string {
    return name
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]!.toUpperCase())
      .join('');
  }

  protected onToggle(event: Event) {
    event.stopPropagation();
    this.toggleDone.emit(this.task());
  }
}
