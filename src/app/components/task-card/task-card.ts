import { Component, computed, inject, input, output } from '@angular/core';

import { BoardData } from '../../core/board-data';
import { formatShort } from '../../core/dates';
import { Tag, Task } from '../../core/models';

@Component({
  selector: 'app-task-card',
  templateUrl: './task-card.html',
  styleUrl: './task-card.scss',
  host: { '[class.done]': 'done()' },
})
export class TaskCard {
  readonly task = input.required<Task>();
  /** The day being viewed; tasks planned earlier get a "carried over" badge. */
  readonly day = input<string | null>(null);
  readonly showProject = input(true);
  readonly showAssignee = input(true);
  readonly showWorkspace = input(false);
  /** Name of the tag group used for swimlanes; its tag is implied by the lane, so it isn't repeated. */
  readonly hideGroup = input<string | null>(null);

  readonly open = output<Task>();
  readonly toggleDone = output<Task>();

  private data = inject(BoardData);

  protected done = computed(() => this.data.isDone(this.task()));
  protected canToggle = computed(() => this.data.toggledStatus(this.task()) !== null);

  protected project = computed(() => {
    const id = this.task().project;
    return id === null ? null : (this.data.projectById().get(id) ?? null);
  });

  protected workspace = computed(() => (this.showWorkspace() ? this.data.ctx(this.task().workspace)?.name : null));

  private isHidden(tag: Tag): boolean {
    const hidden = this.hideGroup()?.toLowerCase();
    if (!hidden || tag.group === null) return false;
    return this.data.groupById().get(tag.group)?.name.toLowerCase() === hidden;
  }

  protected priority = computed(() => {
    const id = this.task().priority;
    const tag = id === null ? undefined : this.data.tagById().get(id);
    return tag && !this.isHidden(tag) ? tag : null;
  });

  protected tags = computed(() => {
    const byId = this.data.tagById();
    return this.task()
      .tags.map((id) => byId.get(id))
      .filter((t): t is Tag => !!t && !this.isHidden(t));
  });

  protected assignee = computed(() => {
    const id = this.task().assignee;
    return id === null ? null : (this.data.userById().get(id) ?? null);
  });

  protected carriedFrom = computed(() => {
    const t = this.task();
    const day = this.day();
    return day && t.planned_date && t.planned_date < day && !this.done() ? formatShort(t.planned_date) : null;
  });

  protected due = computed(() => {
    const d = this.task().due_date;
    if (!d) return null;
    const ref = this.day();
    return { label: formatShort(d), late: !!ref && d < ref && !this.done(), today: d === ref };
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
