import { Tag, TagGroup, Task, TaskInput, User, WorkspaceContext } from '../../core/models';

/**
 * Board geometry shared by "My day" (all workspaces) and a workspace board (one workspace).
 *
 * Columns are status tags; swimlanes are workspaces, projects, assignees or the tags of a tag group.
 * Status tags and tag groups are per workspace, so they're merged by (case-insensitive) name:
 * "Done" in two workspaces is one column, a "Context" group in two workspaces gives one set of lanes.
 * A lane or column only accepts tasks from workspaces where its tag exists.
 */
export type GroupBy = 'workspace' | 'project' | 'assignee' | 'none' | `tags:${string}`;

type TaskLike = Pick<Task, 'workspace' | 'tags'>;

export interface Lane {
  key: string;
  label: string;
  /** Secondary label, e.g. the workspace of a project lane. */
  sublabel: string | null;
  color: string | null;
  /** Workspaces whose tasks may live in this lane; null = any. */
  workspaces: number[] | null;
  /** Fields a task gets when it's put in this lane. */
  assign: (task: TaskLike) => TaskInput;
}

export interface Column {
  key: string;
  label: string;
  color: string;
  isDone: boolean;
  /** workspace id → status tag id for this column. */
  statusIds: Map<number, number>;
}

const norm = (s: string) => s.trim().toLowerCase();

/** Translates fixed labels ("No project", "Unassigned"…); identity when not given. */
export type Translate = (text: string, params?: Record<string, string>) => string;
const same: Translate = (text, params) => (params ? text.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '') : text);

export function accepts(lane: Lane, wsId: number): boolean {
  return lane.workspaces === null || lane.workspaces.includes(wsId);
}

export function buildColumns(contexts: WorkspaceContext[]): Column[] {
  const columns = new Map<string, Column>();
  for (const ctx of contexts) {
    const statuses = ctx.tag_groups.find((g) => g.kind === 'status')?.tags ?? [];
    for (const tag of statuses) {
      const key = norm(tag.name);
      let col = columns.get(key);
      if (!col) {
        col = { key, label: tag.name, color: tag.color, isDone: tag.is_done, statusIds: new Map() };
        columns.set(key, col);
      }
      col.statusIds.set(ctx.id, tag.id);
    }
  }
  // Columns that count as done go last, even when only some workspaces have them.
  const all = [...columns.values()];
  return [...all.filter((c) => !c.isDone), ...all.filter((c) => c.isDone)];
}

export function columnKeyOf(task: Task, tagById: Map<number, Tag>): string | null {
  const tag = tagById.get(task.status);
  return tag ? norm(tag.name) : null;
}

/** Group-by choices: tag groups of every kind except status (those are the columns), merged by name. */
export function groupOptions(contexts: WorkspaceContext[], t: Translate = same): { value: GroupBy; label: string }[] {
  const names = new Map<string, string>();
  for (const ctx of contexts)
    for (const g of ctx.tag_groups) if (g.kind !== 'status' && !names.has(norm(g.name))) names.set(norm(g.name), g.name);
  return [
    ...(contexts.length > 1 ? [{ value: 'workspace' as GroupBy, label: t('Workspace') }] : []),
    { value: 'project', label: t('Project') },
    { value: 'assignee', label: t('Assignee') },
    ...[...names.values()].map((name) => ({ value: `tags:${name}` as GroupBy, label: name })),
    { value: 'none', label: t('No grouping') },
  ];
}

export function groupNameOf(groupBy: GroupBy): string | null {
  return groupBy.startsWith('tags:') ? groupBy.slice(5) : null;
}

function findGroup(ctx: WorkspaceContext | undefined, name: string): TagGroup | undefined {
  return ctx?.tag_groups.find((g) => g.kind !== 'status' && norm(g.name) === norm(name));
}

/** The tag a task has in the group called `name` (priority comes from task.priority). */
export function tagInGroup(
  task: Task,
  ctx: WorkspaceContext | undefined,
  name: string,
  tagById: Map<number, Tag>,
): Tag | null {
  const group = findGroup(ctx, name);
  if (!group) return null;
  if (group.kind === 'priority') return task.priority === null ? null : (tagById.get(task.priority) ?? null);
  const id = task.tags.find((t) => tagById.get(t)?.group === group.id);
  return id === undefined ? null : (tagById.get(id) ?? null);
}

export function laneKeyOf(
  task: Task,
  groupBy: GroupBy,
  byId: Map<number, WorkspaceContext>,
  tagById: Map<number, Tag>,
): string {
  if (groupBy === 'workspace') return `w:${task.workspace}`;
  if (groupBy === 'project') return `p:${task.project ?? 'none'}`;
  if (groupBy === 'assignee') return `u:${task.assignee ?? 'none'}`;
  if (groupBy === 'none') return 'all';
  const tag = tagInGroup(task, byId.get(task.workspace), groupNameOf(groupBy)!, tagById);
  return `t:${tag ? norm(tag.name) : 'none'}`;
}

export function buildLanes(groupBy: GroupBy, contexts: WorkspaceContext[], tasks: Task[], t: Translate = same): Lane[] {
  const multi = contexts.length > 1;

  if (groupBy === 'workspace') {
    return contexts.map((ctx) => ({
      key: `w:${ctx.id}`,
      label: ctx.name,
      sublabel: null,
      color: null,
      workspaces: [ctx.id],
      assign: () => ({}),
    }));
  }

  if (groupBy === 'project') {
    const used = new Set(tasks.map((t) => t.project));
    const lanes: Lane[] = [];
    for (const ctx of contexts) {
      for (const p of ctx.projects) {
        if (p.archived && !used.has(p.id)) continue;
        lanes.push({
          key: `p:${p.id}`,
          label: p.name,
          sublabel: multi ? ctx.name : null,
          color: p.color,
          workspaces: [ctx.id],
          assign: () => ({ project: p.id }),
        });
      }
    }
    lanes.push({ key: 'p:none', label: t('No project'), sublabel: null, color: null, workspaces: null, assign: () => ({ project: null }) });
    return lanes;
  }

  if (groupBy === 'assignee') {
    const users = new Map<number, { user: User; workspaces: number[] }>();
    for (const ctx of contexts) {
      for (const m of ctx.members) {
        const entry = users.get(m.user.id) ?? { user: m.user, workspaces: [] };
        entry.workspaces.push(ctx.id);
        users.set(m.user.id, entry);
      }
    }
    return [
      ...[...users.values()].map<Lane>(({ user, workspaces }) => ({
        key: `u:${user.id}`,
        label: user.full_name || user.email,
        sublabel: null,
        color: null,
        workspaces,
        assign: () => ({ assignee: user.id }),
      })),
      { key: 'u:none', label: t('Unassigned'), sublabel: null, color: null, workspaces: null, assign: () => ({ assignee: null }) },
    ];
  }

  if (groupBy === 'none') {
    return [{ key: 'all', label: t('All tasks'), sublabel: null, color: null, workspaces: null, assign: () => ({}) }];
  }

  const name = groupNameOf(groupBy)!;
  const byId = new Map(contexts.map((c) => [c.id, c]));
  const lanes = new Map<string, Lane>();
  for (const ctx of contexts) {
    const group = findGroup(ctx, name);
    for (const tag of group?.tags ?? []) {
      const key = `t:${norm(tag.name)}`;
      const lane = lanes.get(key);
      if (lane) {
        lane.workspaces!.push(ctx.id);
        continue;
      }
      lanes.set(key, {
        key,
        label: tag.name,
        sublabel: null,
        color: tag.color,
        workspaces: [ctx.id],
        assign: (task) => assignGroupTag(task, findGroup(byId.get(task.workspace), name), tag.name),
      });
    }
  }
  const label = contexts.map((c) => findGroup(c, name)).find(Boolean)?.name ?? name;
  return [
    ...lanes.values(),
    {
      key: 't:none',
      label: t('No {group}', { group: label.toLowerCase() }),
      sublabel: null,
      color: null,
      workspaces: null,
      assign: (task) => assignGroupTag(task, findGroup(byId.get(task.workspace), name), null),
    },
  ];
}

/** Replace the task's tag in `group` with the tag called `tagName` (null = remove it). */
function assignGroupTag(task: TaskLike, group: TagGroup | undefined, tagName: string | null): TaskInput {
  if (!group) return {};
  const tag = tagName === null ? null : group.tags.find((t) => norm(t.name) === norm(tagName));
  if (group.kind === 'priority') return { priority: tag?.id ?? null };
  const groupTagIds = new Set(group.tags.map((t) => t.id));
  const kept = task.tags.filter((id) => !groupTagIds.has(id));
  return { tags: tag ? [...kept, tag.id] : kept };
}

/** Sort key for a task dropped at `index` in `list` (which must not contain the task). */
export function positionAt(list: Task[], index: number, fallback: number): number {
  const prev = list[index - 1]?.position;
  const next = list[index]?.position;
  if (prev !== undefined && next !== undefined) return (prev + next) / 2;
  if (prev !== undefined) return prev + 1024;
  if (next !== undefined) return next - 1024;
  return fallback;
}
