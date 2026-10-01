export type Role = 'owner' | 'admin' | 'member';
export type TagGroupKind = 'custom' | 'status' | 'priority';

export interface User {
  id: number;
  email: string;
  full_name: string;
  github_login?: string;
  is_staff?: boolean;
  plan?: 'free' | 'pro';
  has_pro?: boolean;
  is_bot?: boolean;
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
  /** Join link; only returned to owners and admins. */
  link: string | null;
  link_expired: boolean;
}

export interface InvitationPreview {
  workspace: { id: number | null; name: string; color: string };
  invited_by: string | null;
  email: string;
  role: Role;
  already_member: boolean;
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

export type Visibility = 'private' | 'team' | 'shareable' | 'public';

export const VISIBILITIES: { value: Visibility; label: string; icon: string; help: string }[] = [
  { value: 'private', label: 'Private', icon: '🔒', help: 'Only you and the assignee.' },
  { value: 'team', label: 'Team', icon: '👥', help: 'Everyone in the workspace.' },
  { value: 'shareable', label: 'Shareable', icon: '🔗', help: 'The team, plus people you invite by email (they can view and comment).' },
  { value: 'public', label: 'Public', icon: '🌐', help: 'Anyone with the link can view it, no account needed.' },
];

export interface Task {
  id: number;
  ref: string;
  visibility: Visibility;
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
  Omit<Task, 'id' | 'ref' | 'created_by' | 'created_at' | 'updated_at' | 'completed_at' | 'comment_count' | 'attachment_count'>
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
  mcp_url: string;
  google: { client_id: string; api_key: string; app_id: string } | null;
  microsoft: { client_id: string } | null;
}

export const PALETTE = [
  '#4f46e5', '#0ea5e9', '#14b8a6', '#22c55e', '#eab308',
  '#f97316', '#ef4444', '#ec4899', '#a855f7', '#64748b',
];

export type IntegrationKind =
  | 'github'
  | 'slack'
  | 'outgoing_webhook'
  | 'incoming_webhook'
  | 'email'
  | 'openrouter'
  | 'openai_compatible';

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
  { key: 'comment.created', label: 'New comment' },
];

export interface AppNotification {
  id: number;
  kind: 'assigned' | 'urgent' | 'comment' | 'brief' | 'shared';
  title: string;
  body: string;
  workspace: number | null;
  task: number | null;
  data: { ref?: string };
  created_at: string;
  read_at: string | null;
}

export interface TaskShareEntry {
  id: number;
  email: string;
  name: string;
  registered: boolean;
  created_at: string;
}

export interface TaskLinkView {
  access: 'member' | 'shared' | 'public';
  task: {
    id: number;
    ref: string;
    title: string;
    description: string;
    visibility: Visibility;
    workspace: { id: number; name: string };
    project: { id: number; name: string } | null;
    status: { id: number; name: string; is_done: boolean };
    priority: { id: number; name: string } | null;
    assignee: { name: string; email?: string } | null;
    tags: { id: number; name: string; group: string | null }[];
    planned_date: string | null;
    due_date: string | null;
    completed_at: string | null;
    link: string;
  };
  workspace: { id?: number; name: string; color: string };
  comments: Comment[];
  attachments: { id: number; kind: AttachmentKind; name: string; url: string; size: number | null }[];
  can_comment: boolean;
  can_edit: boolean;
}

export interface SharedTask {
  ref: string;
  title: string;
  workspace: string;
  status: string;
  status_done: boolean;
  project: string | null;
  planned_date: string | null;
  due_date: string | null;
  updated_at: string;
}

export interface ConciergeState {
  plan: 'free' | 'pro';
  has_pro: boolean;
  available: boolean;
  unavailable_reason: string | null;
  platform_ai: boolean;
  telegram: { configured: boolean; bot: string; linked: boolean; username: string };
  languages: { code: string; label: string }[];
  settings: { enabled: boolean; name: string; language: string; timezone: string; brief_time: string; morning_brief: boolean; alerts: boolean; provider: number | null };
  providers: { id: number; name: string; workspace: string; kind: string; model: string }[];
  memory: string;
  usage_today: number;
  daily_limit: number;
}

export interface InstanceSettingRow {
  key: string;
  group: string;
  label: string;
  help: string;
  type: 'str' | 'int' | 'bool' | 'url' | 'choice';
  secret: boolean;
  choices: string[];
  value: string | number | boolean;
  is_set: boolean;
  source: 'admin' | 'environment' | 'unset';
}

export interface AdminUser {
  id: number;
  email: string;
  full_name: string;
  plan: 'free' | 'pro';
  plan_expires_at: string | null;
  is_staff: boolean;
  is_active: boolean;
  date_joined: string;
  last_login: string | null;
  workspaces: number;
  tokens_30d: number;
}

export interface TimeEntry {
  id: number;
  workspace: number;
  user: User;
  task: number | null;
  task_title: string | null;
  project: number | null;
  project_name: string | null;
  description: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  seconds: number;
  billable: boolean;
  running: boolean;
  invoice: number | null;
  invoiced: string | null;
}

export interface TimeReport {
  currency: string;
  billing_enabled: boolean;
  rows: { key: string; label: string; seconds: number; billable_seconds: number; amount: string }[];
  totals: { seconds: number; billable_seconds: number; amount: string };
}

export interface BillingSettings {
  enabled: boolean;
  currency: string;
  default_rate: string;
  rounding_minutes: number;
  billable_by_default: boolean;
  tax_rate: string;
  invoice_prefix: string;
  next_invoice_number: number;
  payment_terms_days: number;
  issuer_name: string;
  issuer_details: string;
  invoice_notes: string;
}

export interface ProjectBillingRow {
  project: number;
  name: string;
  color: string;
  archived: boolean;
  mode: 'inherit' | 'hourly' | 'off';
  hourly_rate: string | null;
  client_name: string;
  client_details: string;
  budget_hours: string | null;
  effective_rate: string | null;
  unbilled_hours: number;
  tracked_hours: number;
}

export interface InvoiceLine {
  id: number;
  description: string;
  hours: string;
  rate: string;
  amount: string;
}

export interface Invoice {
  id: number;
  number: string;
  status: 'draft' | 'sent' | 'paid' | 'void';
  project: number | null;
  project_name: string | null;
  issue_date: string;
  due_date: string;
  period_start: string;
  period_end: string;
  currency: string;
  subtotal: string;
  tax_rate: string;
  tax_amount: string;
  total: string;
  issuer_name: string;
  issuer_details: string;
  client_name: string;
  client_details: string;
  notes: string;
  lines: InvoiceLine[];
  entry_count: number;
  created_at: string;
}

export interface ApiTokenRow {
  id: number;
  name: string;
  hint: string;
  created_at: string;
  last_used_at: string | null;
  token?: string;
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds / 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

export interface WorkspaceMcp {
  url: string;
  tokens: { id: number; name: string; hint: string; bot: string; created_at: string; last_used_at: string | null; token?: string }[];
}
