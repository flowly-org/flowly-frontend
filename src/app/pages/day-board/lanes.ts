import { Membership, Project, Tag, TagGroup, Task, TaskInput } from '../../core/models';

export type GroupBy = 'project' | 'assignee' | 'none' | `group:${number}`;

export interface Lane {
  key: string;
  label: string;
  color: string | null;
  /** Fields a task must get to belong in this lane (merged into PATCH on drop, or used on quick-add). */
  assign: (task?: Task) => TaskInput;
}

export interface LaneContext {
  projects: Project[];
  members: Membership[];
  tagGroups: TagGroup[];
  tasks: Task[];
}

export function laneKeyOf(task: Task, groupBy: GroupBy, tagGroups: TagGroup[]): string {
  if (groupBy === 'project') return `p:${task.project ?? 'none'}`;
  if (groupBy === 'assignee') return `u:${task.assignee ?? 'none'}`;
  if (groupBy === 'none') return 'all';
  const group = tagGroups.find((g) => g.id === groupIdOf(groupBy));
  const tag = group?.tags.find((t) => task.tags.includes(t.id));
  return `t:${tag?.id ?? 'none'}`;
}

export function groupIdOf(groupBy: GroupBy): number | null {
  return groupBy.startsWith('group:') ? Number(groupBy.slice(6)) : null;
}

export function buildLanes(groupBy: GroupBy, ctx: LaneContext): Lane[] {
  if (groupBy === 'project') {
    const used = new Set(ctx.tasks.map((t) => t.project));
    const projects = ctx.projects.filter((p) => !p.archived || used.has(p.id));
    return [
      ...projects.map<Lane>((p) => ({
        key: `p:${p.id}`,
        label: p.name,
        color: p.color,
        assign: () => ({ project: p.id }),
      })),
      { key: 'p:none', label: 'No project', color: null, assign: () => ({ project: null }) },
    ];
  }

  if (groupBy === 'assignee') {
    return [
      ...ctx.members.map<Lane>((m) => ({
        key: `u:${m.user.id}`,
        label: m.user.full_name || m.user.email,
        color: null,
        assign: () => ({ assignee: m.user.id }),
      })),
      { key: 'u:none', label: 'Unassigned', color: null, assign: () => ({ assignee: null }) },
    ];
  }

  if (groupBy === 'none') {
    return [{ key: 'all', label: 'All tasks', color: null, assign: () => ({}) }];
  }

  const group = ctx.tagGroups.find((g) => g.id === groupIdOf(groupBy));
  if (!group) return [];
  const withTag = (tag: Tag | null) => (task?: Task) => {
    const groupTagIds = new Set(group.tags.map((t) => t.id));
    const kept = (task?.tags ?? []).filter((id) => !groupTagIds.has(id));
    return { tags: tag ? [...kept, tag.id] : kept };
  };
  return [
    ...group.tags.map<Lane>((tag) => ({
      key: `t:${tag.id}`,
      label: tag.name,
      color: tag.color,
      assign: withTag(tag),
    })),
    { key: 't:none', label: `No ${group.name.toLowerCase()}`, color: null, assign: withTag(null) },
  ];
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
