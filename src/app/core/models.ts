export type Role = 'owner' | 'admin' | 'member';
export type TagGroupKind = 'custom' | 'status' | 'priority';

export interface User {
  id: number;
  email: string;
  full_name: string;
  github_login?: string;
  is_staff?: boolean;
}

export interface AuthResponse {
  user?: User;
  access: string;
  refresh: string;
}

export interface Workspace {
  id: number;
  name: string;
  color: string;
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
  color: string;
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
  comment_count?: number;
  attachment_count?: number;
}

export type TaskInput = Partial<
  Omit<Task, 'id' | 'created_by' | 'created_at' | 'updated_at' | 'completed_at' | 'comment_count' | 'attachment_count'>
>;

export interface Comment {
  id: number;
  task: number;
  author: User | null;
  body: string;
  source: 'flowly' | 'github';
  external_author: string;
  external_url: string;
  created_at: string;
  edited_at: string | null;
}

export type AttachmentKind = 'file' | 'link' | 'google_drive' | 'onedrive';

export interface Attachment {
  id: number;
  task: number;
  kind: AttachmentKind;
  name: string;
  url: string;
  size: number | null;
  content_type: string;
  meta: Record<string, string | number | boolean>;
  added_by: User | null;
  created_at: string;
}

export interface PublicConfig {
  uploads: { enabled: boolean; max_mb: number };
  google: { client_id: string; api_key: string; app_id: string } | null;
  microsoft: { client_id: string } | null;
}

export const PALETTE = [
  '#4f46e5', '#0ea5e9', '#14b8a6', '#22c55e', '#eab308',
  '#f97316', '#ef4444', '#ec4899', '#a855f7', '#64748b',
];

export type IntegrationKind = 'github' | 'slack' | 'outgoing_webhook' | 'incoming_webhook' | 'email';

export interface Integration {
  id: number;
  kind: IntegrationKind;
  name: string;
  /** null = whole workspace. */
  project: number | null;
  enabled: boolean;
  config: Record<string, any>;
  token: string;
  secret: string;
  /** Read-only, kind-specific details (URLs, addresses, GitHub app/install state). */
  info: Record<string, any>;
  last_delivery: { status: DeliveryStatus; event: string; created_at: string } | null;
  created_at: string;
}

export type DeliveryStatus = 'pending' | 'success' | 'failed' | 'ignored';

export interface Delivery {
  id: number;
  direction: 'in' | 'out';
  event: string;
  status: DeliveryStatus;
  attempts: number;
  task: number | null;
  payload: Record<string, any>;
  last_error: string;
  response_status: number | null;
  response_body: string;
  next_attempt_at: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface GitHubAppInfo {
  configured: boolean;
  can_setup: boolean;
  app: { name: string; slug: string; html_url: string; owner: string } | null;
}

export const TASK_EVENTS = [
  { key: 'task.created', label: 'Task created' },
  { key: 'task.updated', label: 'Task updated' },
  { key: 'task.status_changed', label: 'Status changed' },
  { key: 'task.completed', label: 'Task completed' },
  { key: 'task.assigned', label: 'Task assigned' },
  { key: 'task.deleted', label: 'Task deleted' },
];
