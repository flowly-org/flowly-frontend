export type Role = 'owner' | 'admin' | 'member';
export type TagGroupKind = 'custom' | 'status' | 'priority';

export interface User {
  id: number;
  email: string;
  full_name: string;
  github_login?: string;
  language?: string;
  home_location?: string;
  is_staff?: boolean;
  plan?: 'free' | 'pro' | 'pro_plus';
  has_pro?: boolean;
  has_pro_plus?: boolean;
  is_bot?: boolean;
  /** Opt-in ADHD mode. */
  adhd_mode?: boolean;
  focus?: Partial<FocusOptions>;
}

export interface FocusOptions {
  today_limit: number;
  check_in_minutes: number;
  hyperfocus_minutes: number;
  heads_up_minutes: number;
  celebrate: boolean;
  calm: boolean;
  capacity_minutes?: number;
  day_start: string;
  day_end: string;
  block_reminders: boolean;
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
  time_tracking: boolean;
  billing_enabled: boolean;
  plan?: 'standard' | 'enterprise';
  is_enterprise?: boolean;
  plan_expires_at?: string | null;
  created_at: string;
  my_role: Role;
  member_count: number;
}

export interface AdminWorkspace {
  id: number;
  name: string;
  color: string;
  plan: 'standard' | 'enterprise';
  plan_expires_at: string | null;
  is_enterprise: boolean;
  members: number;
  owner: string | null;
  plan_source?: string;
  subscription?: StripeSub | null;
  created_at: string;
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
  time_tracking: boolean;
  billable: boolean;
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
  time_tracking?: boolean;
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
  checklist?: ChecklistItem[];
  estimate_minutes?: number | null;
  recurrence?: Recurrence | null;
  series?: string;
  /** Set on the answer that ticked a recurring task: the occurrence just created. */
  next_occurrence?: { id: number; planned_date: string | null; due_date: string | null };
}

export type TaskInput = Partial<
  Omit<Task, 'id' | 'ref' | 'created_by' | 'created_at' | 'updated_at' | 'completed_at' | 'comment_count' | 'attachment_count' | 'series' | 'next_occurrence'>
>;

export interface ChecklistItem {
  id?: string;
  text: string;
  done: boolean;
}

/** Repeat rule of a recurring task (Monday = 0). */
export interface Recurrence {
  freq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  weekdays?: number[];
  after_done?: boolean;
  until?: string;
}

export interface TaskReminder {
  id: number;
  remind_at: string;
  sent: boolean;
}

export interface DayLoad {
  date: string;
  tasks: number;
  estimated_minutes: number;
  unestimated: number;
  busy_minutes: number;
  capacity_minutes: number;
  free_minutes: number;
  over_minutes: number;
}

/** "1h 30m", "45m". */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

export interface Comment {
  id: number;
  task: number;
  author: User | null;
  body: string;
  source: 'flowly' | 'github' | 'ai';
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
  calendar?: { google: boolean };
}

export const PALETTE = [
  '#4f46e5', '#0ea5e9', '#14b8a6', '#22c55e', '#eab308',
  '#f97316', '#ef4444', '#ec4899', '#a855f7', '#64748b',
];

export type IntegrationKind =
  | 'wiki'
  | 'donetick'
  | 'telegram_group'
  | 'slack_bot'
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
  /** Email in: alias names (name@inbound-domain). */
  aliases?: string[];
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
  settings: { enabled: boolean; name: string; language: string; timezone: string; brief_time: string; morning_brief: boolean; alerts: boolean; provider: number | null; personality: string; learn: boolean };
  providers: { id: number; name: string; workspace: string; kind: string; model: string }[];
  personalities: { key: string; label: string; blurb: string; sample: string }[];
  memory: string;
  memory_updated_at: string | null;
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
  plan: 'free' | 'pro' | 'pro_plus';
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
  invoice_notes: string;
}

/** The user's invoicing identity (Settings → Invoicing), used on every invoice they issue. */
export interface InvoicingProfile {
  name: string;
  details: string;
  country: string;
  vat_id: string;
  tax_code: string;
  address: string;
  zip: string;
  city: string;
  province: string;
  iban: string;
  email: string;
  phone: string;
  stripe_connected?: boolean;
  stripe_account?: string;
  /** Write-only. */
  stripe_key?: string;
  format_settings: Record<string, Record<string, any>>;
}

export interface EInvoiceSetting {
  key: string;
  label: string;
  type: 'choice' | 'bool' | 'text';
  default?: any;
  help?: string;
  choices?: [string, string][];
}

export interface EInvoiceFormat {
  key: string;
  label: string;
  countries: string[];
  settings: EInvoiceSetting[];
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
  client_vat: string;
  client_vat_country: string;
  client_tax_code: string;
  client_address: string;
  client_zip: string;
  client_city: string;
  client_province: string;
  client_country: string;
  client_sdi_code: string;
  client_pec: string;
  client_email: string;
  client_reference: string;
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
  payment?: { url: string; paid_at: string | null } | null;
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

// --- Calendars (background events; some need preparation) -----------------------

export interface CalendarRow {
  id: number;
  name: string;
  color: string;
  primary: boolean;
  selected: boolean;
}

export interface CalendarAccount {
  id: number;
  provider: 'google' | 'microsoft' | 'caldav' | 'ics';
  email: string;
  label: string;
  status: 'ok' | 'error';
  last_error: string;
  last_synced_at: string | null;
  calendars: CalendarRow[];
}

export interface CalendarOverview {
  available: boolean;
  providers?: { google: boolean; microsoft: boolean; caldav: boolean; ics: boolean };
  home_location: string;
  accounts: CalendarAccount[];
}

export type PrepReason = '' | 'away' | 'travel' | 'tickets' | 'event' | 'manual';

export interface CalendarTaskRef {
  id: number;
  ref: string;
  title: string;
  workspace: number;
  workspace_name: string;
  planned_date: string | null;
  done: boolean;
}

export interface CalendarEvent {
  id: number;
  calendar: number;
  color: string;
  title: string;
  location: string;
  html_link: string;
  all_day: boolean;
  start: string;
  end: string;
  start_date: string;
  end_date: string;
  prep: 'auto' | 'needed' | 'background';
  needs_prep: boolean;
  reason: PrepReason;
  confirmed: boolean;
  tasks: CalendarTaskRef[];
  suggested?: CalendarTaskRef[];
}

export interface StripeSub {
  status: string;
  interval: string;
  amount: number;
  currency: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export interface PlanPrices {
  month: { amount: number; currency: string; tax: string };
  year: { amount: number; currency: string; tax: string };
}

export interface Delegation {
  id: number;
  run: boolean;
  status: 'queued' | 'assessing' | 'assessed' | 'running' | 'done' | 'partial' | 'declined' | 'failed';
  verdict: '' | 'full' | 'partial' | 'no';
  plan: string;
  reason: string;
  summary: string;
  left_for_you: string;
  steps: number;
  created_at: string;
  finished_at: string | null;
  error: boolean;
}

export interface DelegationState {
  delegation: Delegation | null;
  quota: { used: number; limit: number };
  available: boolean;
}

export interface PlanInfo {
  stripe: boolean;
  plans: { pro?: PlanPrices; pro_plus?: PlanPrices } | null;
  has_pro_plus: boolean;
  prices: { month: { amount: number; currency: string; tax: string }; year: { amount: number; currency: string; tax: string } } | null;
  plan: 'free' | 'pro' | 'pro_plus';
  has_pro: boolean;
  source: 'manual' | 'stripe';
  expires_at: string | null;
  subscription: StripeSub | null;
  can_manage: boolean;
}

export interface DonetickMember {
  userId: number;
  username: string;
  displayName: string;
}

export interface DonetickRoute {
  label: string;
  workspace: number;
  project: number | null;
}

/** A personal Donetick connection (chores routed to workspaces and projects by label). */
export interface DonetickAccount {
  id: number;
  name: string;
  base_url: string;
  enabled: boolean;
  donetick_user_id: number | null;
  only_mine: boolean;
  default_workspace: number | null;
  default_project: number | null;
  private: boolean;
  write_back: boolean;
  routes: DonetickRoute[];
  info: {
    webhook_url: string;
    token: string | null;
    synced_at: string | null;
    error: string;
    chores: number;
    members: DonetickMember[];
    labels: string[];
  };
  created_at: string;
}

export interface TaskTemplate {
  id: number;
  name: string;
  description: string;
  /** Tasks in the bulk-add format (@+N = days after the start, ~30m, indented [ ] checklist items). */
  body: string;
  project: number | null;
  count: number;
}

export interface SearchResult {
  type: 'task' | 'project' | 'template' | 'wiki';
  id: number;
  workspace: number;
  workspace_name: string;
  title: string;
  snippet?: string;
  ref?: string;
  done?: boolean;
  planned_date?: string | null;
  project?: string | null;
  color?: string;
  url?: string;
}

export interface TimeBlock {
  id: number;
  task: number | null;
  title: string;
  start: string;
  end: string;
  workspace: number | null;
  project: number | null;
  done: boolean;
}

export interface DayBlocks {
  date: string;
  day_start: string;
  day_end: string;
  blocks: TimeBlock[];
  events: { id: number; title: string; start: string; end: string; color: string; background: boolean }[];
  free: { start: string; end: string }[];
}

export interface DayPlanProposal {
  placed: { task: number; title: string; start: string; end: string; minutes: number }[];
  unscheduled: { task: number; title: string; minutes: number }[];
}
