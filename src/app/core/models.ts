export type Role = 'owner' | 'admin' | 'member';
export type TagGroupKind = 'custom' | 'status' | 'priority';

export interface User {
  id: number;
  email: string;
  full_name: string;
}

export interface AuthResponse {
  user?: User;
  access: string;
  refresh: string;
}

export interface Workspace {
  id: number;
  name: string;
  created_at: string;
  my_role: Role;
  member_count: number;
}

export interface Membership {
  id: number;
  user: User;
  role: Role;
  joined_at: string;
}

export interface Invitation {
  id: number;
  email: string;
  role: Role;
  created_at: string;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  color: string;
  archived: boolean;
  position: number;
  open_task_count: number;
  created_at: string;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
  group: number | null;
  position: number;
  /** Status tags only: tasks in this status count as finished. */
  is_done: boolean;
}

export interface TagGroup {
  id: number;
  name: string;
  /** "status" tags are the board columns, "priority" tags the task priorities. */
  kind: TagGroupKind;
  position: number;
  tags: Tag[];
}

/** Everything about one workspace the board needs (GET /my/context/). */
export interface WorkspaceContext {
  id: number;
  name: string;
  my_role: Role;
  projects: Project[];
  tag_groups: TagGroup[];
  tags: Tag[];
  members: Membership[];
}

export interface Task {
  id: number;
  workspace: number;
  title: string;
  description: string;
  /** Id of a tag in the workspace's status group. */
  status: number;
  /** Id of a tag in the workspace's priority group. */
  priority: number | null;
  project: number | null;
  assignee: number | null;
  tags: number[];
  planned_date: string | null;
  due_date: string | null;
  position: number;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export type TaskInput = Partial<Omit<Task, 'id' | 'created_by' | 'created_at' | 'updated_at' | 'completed_at'>>;

export const PALETTE = [
  '#4f46e5', '#0ea5e9', '#14b8a6', '#22c55e', '#eab308',
  '#f97316', '#ef4444', '#ec4899', '#a855f7', '#64748b',
];
