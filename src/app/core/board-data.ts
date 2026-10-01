import { Injectable, computed, signal } from '@angular/core';

import { Project, Tag, TagGroup, Task, User, WorkspaceContext } from './models';

/**
 * Reference data for one board: one workspace, or all of the user's workspaces on "My day".
 * Provided per board component so cards and the task dialog see the same lookups.
 */
@Injectable()
export class BoardData {
  readonly contexts = signal<WorkspaceContext[]>([]);

  readonly multi = computed(() => this.contexts().length > 1);
  readonly byId = computed(() => new Map(this.contexts().map((c) => [c.id, c])));

  readonly projectById = computed(() => {
    const map = new Map<number, Project>();
    for (const c of this.contexts()) for (const p of c.projects) map.set(p.id, p);
    return map;
  });

  readonly tagById = computed(() => {
    const map = new Map<number, Tag>();
    for (const c of this.contexts()) for (const t of c.tags) map.set(t.id, t);
    return map;
  });

  readonly groupById = computed(() => {
    const map = new Map<number, TagGroup>();
    for (const c of this.contexts()) for (const g of c.tag_groups) map.set(g.id, g);
    return map;
  });

  readonly userById = computed(() => {
    const map = new Map<number, User>();
    for (const c of this.contexts()) for (const m of c.members) map.set(m.user.id, m.user);
    return map;
  });

  ctx(wsId: number): WorkspaceContext | undefined {
    return this.byId().get(wsId);
  }

  statuses(wsId: number): Tag[] {
    return this.ctx(wsId)?.tag_groups.find((g) => g.kind === 'status')?.tags ?? [];
  }

  priorities(wsId: number): Tag[] {
    return this.ctx(wsId)?.tag_groups.find((g) => g.kind === 'priority')?.tags ?? [];
  }

  /** Time can be tracked on this task (workspace and project both allow it). */
  canTrack(task: Task): boolean {
    if (this.ctx(task.workspace)?.time_tracking === false) return false;
    const project = task.project === null ? null : this.projectById().get(task.project);
    return project?.time_tracking !== false;
  }

  isDone(task: Task): boolean {
    return this.tagById().get(task.status)?.is_done ?? false;
  }

  /** Status to toggle to from the card checkbox, or null if the workspace has no such status. */
  toggledStatus(task: Task): number | null {
    const statuses = this.statuses(task.workspace);
    const target = this.isDone(task) ? statuses.find((s) => !s.is_done) : statuses.find((s) => s.is_done);
    return target?.id ?? null;
  }
}
