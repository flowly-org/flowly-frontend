import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

import { DICTIONARIES } from '../i18n';
import { ConfigService } from './config.service';
import {
  WorkspaceMcp,
  DonetickAccount,
  DayLoad,
  InviteCodeRow,
  AgileSetup,
  SprintBrief,
  SprintNumbers,
  SprintPage,
  StandupText,
  InsightStats,
  WeekReview,
  DayBlocks,
  DayPlanProposal,
  TimeBlock,
  SearchResult,
  TaskTemplate,
  TaskReminder,
  ApiTokenRow,
  BillingSettings,
  Invoice,
  ProjectBillingRow,
  TimeEntry,
  TimeReport,
  InvitationPreview,
  SharedTask,
  TaskLinkView,
  TaskShareEntry,
  AdminUser,
  AdminWorkspace,
  PlanInfo,
  DelegationState,
  StripeSub,
  CalendarEvent,
  EInvoiceFormat,
  InvoicingProfile,
  CalendarOverview,
  CalendarAccount,
  AppNotification,
  InstanceSettingRow,
  Attachment,
  ConciergeState,
  Comment,
  Delivery,
  PublicConfig,
  GitHubAppInfo,
  Integration,
  Invitation,
  Membership,
  Project,
  SsoConnection,
  SsoSetup,
  FloChat,
  FloPlan,
  RelocateSummary,
  Role,
  Tag,
  TagGroup,
  Task,
  TaskInput,
  Workspace,
  WorkspaceContext,
} from './models';

export interface TaskQuery {
  day?: string;
  include_overdue?: boolean;
  unscheduled?: boolean;
  assignee?: 'me' | 'none' | number;
  project?: number | 'none';
  workspace?: number;
  q?: string;
  done?: boolean;
  span_from?: string;
  span_to?: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private config = inject(ConfigService);

  private url(path: string): string {
    return `${this.config.apiUrl}/${path}`;
  }

  private ws(wsId: number, path: string): string {
    return this.url(`workspaces/${wsId}/${path}`);
  }

  private run<T>(obs: Observable<T>): Promise<T> {
    return firstValueFrom(obs);
  }

  // Workspaces
  workspaces() {
    return this.run(this.http.get<Workspace[]>(this.url('workspaces/')));
  }
  createWorkspace(name: string) {
    return this.run(this.http.post<Workspace>(this.url('workspaces/'), { name }));
  }
  updateWorkspace(id: number, data: Partial<Pick<Workspace, 'name' | 'color' | 'time_tracking'>>) {
    return this.run(this.http.patch<Workspace>(this.url(`workspaces/${id}/`), data));
  }
  deleteWorkspace(id: number) {
    return this.run(this.http.delete<void>(this.url(`workspaces/${id}/`)));
  }

  // Members & invitations
  members(wsId: number) {
    return this.run(this.http.get<Membership[]>(this.ws(wsId, 'members/')));
  }
  addMember(wsId: number, email: string, role: Role) {
    return this.run(
      this.http.post<Membership | Invitation>(this.ws(wsId, 'members/'), { email, role }, { observe: 'response' }),
    );
  }
  updateMember(wsId: number, id: number, role: Role) {
    return this.run(this.http.patch<Membership>(this.ws(wsId, `members/${id}/`), { role }));
  }
  removeMember(wsId: number, id: number) {
    return this.run(this.http.delete<void>(this.ws(wsId, `members/${id}/`)));
  }
  invitations(wsId: number) {
    return this.run(this.http.get<Invitation[]>(this.ws(wsId, 'invitations/')));
  }
  invitationPreview(token: string) {
    return this.run(this.http.get<InvitationPreview>(this.url(`invitations/${token}/`)));
  }
  acceptInvitation(token: string) {
    return this.run(this.http.post<{ workspace: number }>(this.url(`invitations/${token}/accept/`), {}));
  }
  revokeInvitation(wsId: number, id: number) {
    return this.run(this.http.delete<void>(this.ws(wsId, `invitations/${id}/`)));
  }

  // Projects
  projects(wsId: number) {
    return this.run(this.http.get<Project[]>(this.ws(wsId, 'projects/')));
  }
  createProject(wsId: number, data: Partial<Project>) {
    return this.run(this.http.post<Project>(this.ws(wsId, 'projects/'), data));
  }
  updateProject(wsId: number, id: number, data: Partial<Project>) {
    return this.run(this.http.patch<Project>(this.ws(wsId, `projects/${id}/`), data));
  }
  deleteProject(wsId: number, id: number) {
    return this.run(this.http.delete<void>(this.ws(wsId, `projects/${id}/`)));
  }

  /** Move a project to another workspace (`dry_run` only reports what would happen). */
  moveProject(wsId: number, id: number, workspace: number, dryRun = false) {
    return this.run(this.http.post<RelocateSummary>(this.ws(wsId, `projects/${id}/move/`), { workspace, dry_run: dryRun }));
  }

  /** Turn a project into a workspace of its own. */
  promoteProject(wsId: number, id: number, data: { name?: string; members?: 'involved' | 'all' | 'me'; dry_run?: boolean }) {
    return this.run(this.http.post<RelocateSummary>(this.ws(wsId, `projects/${id}/promote/`), data));
  }

  // Tags
  tagGroups(wsId: number) {
    return this.run(this.http.get<TagGroup[]>(this.ws(wsId, 'tag-groups/')));
  }
  createTagGroup(wsId: number, name: string) {
    return this.run(this.http.post<TagGroup>(this.ws(wsId, 'tag-groups/'), { name }));
  }
  updateTagGroup(wsId: number, id: number, data: Partial<TagGroup>) {
    return this.run(this.http.patch<TagGroup>(this.ws(wsId, `tag-groups/${id}/`), data));
  }
  deleteTagGroup(wsId: number, id: number) {
    return this.run(this.http.delete<void>(this.ws(wsId, `tag-groups/${id}/`)));
  }
  tags(wsId: number) {
    return this.run(this.http.get<Tag[]>(this.ws(wsId, 'tags/')));
  }
  createTag(wsId: number, data: Partial<Tag>) {
    return this.run(this.http.post<Tag>(this.ws(wsId, 'tags/'), data));
  }
  updateTag(wsId: number, id: number, data: Partial<Tag>) {
    return this.run(this.http.patch<Tag>(this.ws(wsId, `tags/${id}/`), data));
  }
  deleteTag(wsId: number, id: number) {
    return this.run(this.http.delete<void>(this.ws(wsId, `tags/${id}/`)));
  }

  // Tasks
  tasks(wsId: number, query: TaskQuery) {
    return this.run(this.http.get<Task[]>(this.ws(wsId, 'tasks/'), { params: toParams(query) }));
  }
  /** Tasks across all the user's workspaces. */
  myTasks(query: TaskQuery) {
    return this.run(this.http.get<Task[]>(this.url('my/tasks/'), { params: toParams(query) }));
  }
  // Integrations
  integrations(wsId: number, project?: number) {
    const params = project ? new HttpParams().set('project', project) : undefined;
    return this.run(this.http.get<Integration[]>(this.ws(wsId, 'integrations/'), { params }));
  }
  createIntegration(wsId: number, data: Partial<Integration> & { api_key?: string }) {
    return this.run(this.http.post<Integration>(this.ws(wsId, 'integrations/'), data));
  }
  updateIntegration(wsId: number, id: number, data: Partial<Integration> & { api_key?: string }) {
    return this.run(this.http.patch<Integration>(this.ws(wsId, `integrations/${id}/`), data));
  }
  deleteIntegration(wsId: number, id: number) {
    return this.run(this.http.delete<void>(this.ws(wsId, `integrations/${id}/`)));
  }
  testIntegration(wsId: number, id: number) {
    return this.run(this.http.post<Delivery>(this.ws(wsId, `integrations/${id}/test/`), {}));
  }
  rotateSecret(wsId: number, id: number) {
    return this.run(this.http.post<Integration>(this.ws(wsId, `integrations/${id}/rotate-secret/`), {}));
  }
  deliveries(wsId: number, id: number) {
    return this.run(this.http.get<Delivery[]>(this.ws(wsId, `integrations/${id}/deliveries/`)));
  }
  retryDelivery(wsId: number, id: number, deliveryId: number) {
    return this.run(this.http.post<Delivery>(this.ws(wsId, `integrations/${id}/deliveries/${deliveryId}/retry/`), {}));
  }
  githubInstallUrl(wsId: number, id: number) {
    return this.run(this.http.post<{ url: string }>(this.ws(wsId, `integrations/${id}/github/install/`), {}));
  }
  githubRepos(wsId: number, id: number) {
    return this.run(this.http.get<string[]>(this.ws(wsId, `integrations/${id}/github/repos/`)));
  }
  githubApp() {
    return this.run(this.http.get<GitHubAppInfo>(this.url('integrations/github/app/')));
  }
  githubManifest(name: string, organization: string) {
    return this.run(
      this.http.post<{ action: string; manifest: string }>(this.url('integrations/github/app/manifest/'), { name, organization }),
    );
  }
  githubConvert(code: string, state: string) {
    return this.run(this.http.post<{ name: string; slug: string; html_url: string }>(this.url('integrations/github/app/convert/'), { code, state }));
  }
  githubInstalled(installationId: string, state: string) {
    return this.run(
      this.http.post<{ workspace: number; integration: number }>(this.url('integrations/github/installed/'), {
        installation_id: installationId,
        state,
      }),
    );
  }

  donetickAccounts() {
    return this.run(this.http.get<DonetickAccount[]>(this.url('my/donetick/')));
  }
  createDonetick(data: Partial<DonetickAccount> & { token: string }) {
    return this.run(this.http.post<DonetickAccount>(this.url('my/donetick/'), data));
  }
  updateDonetick(id: number, data: Partial<DonetickAccount> & { token?: string }) {
    return this.run(this.http.patch<DonetickAccount>(this.url(`my/donetick/${id}/`), data));
  }
  deleteDonetick(id: number) {
    return this.run(this.http.delete<void>(this.url(`my/donetick/${id}/`)));
  }
  syncDonetick(id: number) {
    return this.run(this.http.post<{ detail: string; account: DonetickAccount }>(this.url(`my/donetick/${id}/sync/`), {}));
  }
  reminders(wsId: number, taskId: number) {
    return this.run(this.http.get<TaskReminder[]>(this.ws(wsId, `tasks/${taskId}/reminders/`)));
  }
  addReminder(wsId: number, taskId: number, remindAt: string) {
    return this.run(this.http.post<TaskReminder[]>(this.ws(wsId, `tasks/${taskId}/reminders/`), { remind_at: remindAt }));
  }
  deleteReminder(wsId: number, taskId: number, id: number) {
    return this.run(this.http.delete<TaskReminder[]>(this.ws(wsId, `tasks/${taskId}/reminders/${id}/`)));
  }
  dayLoad(date: string) {
    return this.run(this.http.get<DayLoad>(this.url('my/day-load/'), { params: new HttpParams().set('date', date) }));
  }
  templates(wsId: number) {
    return this.run(this.http.get<TaskTemplate[]>(this.ws(wsId, 'templates/')));
  }
  saveTemplate(wsId: number, data: Partial<TaskTemplate>) {
    return this.run(
      data.id
        ? this.http.patch<TaskTemplate>(this.ws(wsId, `templates/${data.id}/`), data)
        : this.http.post<TaskTemplate>(this.ws(wsId, 'templates/'), data),
    );
  }
  deleteTemplate(wsId: number, id: number) {
    return this.run(this.http.delete<void>(this.ws(wsId, `templates/${id}/`)));
  }
  applyTemplate(wsId: number, id: number, data: { start: string; project?: number | null }) {
    return this.run(this.http.post<Task[]>(this.ws(wsId, `templates/${id}/apply/`), data));
  }
  templateFromTasks(wsId: number, name: string, tasks: number[]) {
    return this.run(this.http.post<TaskTemplate>(this.ws(wsId, 'templates/from-tasks/'), { name, tasks }));
  }
  search(q: string) {
    return this.run(this.http.get<SearchResult[]>(this.url('my/search/'), { params: new HttpParams().set('q', q) }));
  }
  importTasks(wsId: number, data: FormData | Record<string, unknown>) {
    return this.run(this.http.post<{ created: number; skipped: number; project: number; project_name: string }>(this.ws(wsId, 'import/'), data));
  }
  dayBlocks(date: string) {
    return this.run(this.http.get<DayBlocks>(this.url('my/blocks/'), { params: new HttpParams().set('date', date) }));
  }
  addBlock(data: { task?: number | null; title?: string; start: string; minutes?: number }) {
    return this.run(this.http.post<TimeBlock>(this.url('my/blocks/'), data));
  }
  moveBlock(id: number, start: string, end?: string) {
    return this.run(this.http.patch<TimeBlock>(this.url(`my/blocks/${id}/`), end ? { start, end } : { start }));
  }
  deleteBlock(id: number) {
    return this.run(this.http.delete<void>(this.url(`my/blocks/${id}/`)));
  }
  planDay(date: string, apply: boolean) {
    return this.run(this.http.post<DayPlanProposal>(this.url('my/blocks/plan/'), { date, apply }));
  }
  review(week?: string) {
    const params = week ? new HttpParams().set('week', week) : undefined;
    return this.run(this.http.get<WeekReview>(this.url('my/review/'), { params }));
  }
  writeReview(week: string) {
    return this.run(this.http.post<WeekReview>(this.url('my/review/'), { week }));
  }
  insights(scope: 'me' | 'workspace' | 'project', id: number | null, weeks: number) {
    let params = new HttpParams().set('scope', scope).set('weeks', weeks);
    if (id) params = params.set('id', id);
    return this.run(this.http.get<InsightStats>(this.url('insights/'), { params }));
  }
  agileSetups(wsId: number) {
    return this.run(this.http.get<AgileSetup[]>(this.ws(wsId, 'agile/')));
  }
  saveAgileSetup(wsId: number, data: Partial<AgileSetup>, id?: number) {
    return this.run(id ? this.http.patch<AgileSetup>(this.ws(wsId, `agile/${id}/`), data) : this.http.post<AgileSetup>(this.ws(wsId, 'agile/'), data));
  }
  disableAgile(wsId: number, id: number) {
    return this.run(this.http.delete<void>(this.ws(wsId, `agile/${id}/`)));
  }
  sprints(wsId: number, setupId: number) {
    return this.run(this.http.get<SprintBrief[]>(this.ws(wsId, `agile/${setupId}/sprints/`)));
  }
  planNextSprint(wsId: number, setupId: number) {
    return this.run(this.http.post<SprintBrief>(this.ws(wsId, `agile/${setupId}/sprints/`), {}));
  }
  sprint(wsId: number, id: number) {
    return this.run(this.http.get<SprintPage>(this.ws(wsId, `sprints/${id}/`)));
  }
  updateSprint(wsId: number, id: number, data: { goal: string }) {
    return this.run(this.http.patch<SprintBrief>(this.ws(wsId, `sprints/${id}/`), data));
  }
  sprintTasks(wsId: number, id: number, add: number[], remove: number[]) {
    return this.run(this.http.post<SprintNumbers>(this.ws(wsId, `sprints/${id}/tasks/`), { add, remove }));
  }
  closeSprint(wsId: number, id: number) {
    return this.run(this.http.post<SprintBrief>(this.ws(wsId, `sprints/${id}/close/`), {}));
  }
  postStandup(wsId: number, setupId: number, data: StandupText) {
    return this.run(this.http.post<StandupText>(this.ws(wsId, `agile/${setupId}/standup/`), data));
  }
  addRetro(wsId: number, sprintId: number, kind: string, text: string) {
    return this.run(this.http.post<{ id: number }>(this.ws(wsId, `sprints/${sprintId}/retro/`), { kind, text }));
  }
  voteRetro(wsId: number, id: number, vote: boolean) {
    return this.run(this.http.patch<{ votes: number; voted: boolean }>(this.ws(wsId, `retro/${id}/`), { vote }));
  }
  deleteRetro(wsId: number, id: number) {
    return this.run(this.http.delete<void>(this.ws(wsId, `retro/${id}/`)));
  }
  retroAction(wsId: number, id: number) {
    return this.run(this.http.post<{ task: number; sprint: number }>(this.ws(wsId, `retro/${id}/`), {}));
  }
  myContext() {
    return this.run(this.http.get<WorkspaceContext[]>(this.url('my/context/')));
  }
  createTask(wsId: number, data: TaskInput) {
    return this.run(this.http.post<Task>(this.ws(wsId, 'tasks/'), data));
  }
  updateTask(wsId: number, id: number, data: TaskInput) {
    return this.run(this.http.patch<Task>(this.ws(wsId, `tasks/${id}/`), data));
  }
  /** Photo of a to-do list → text in the bulk-add format (nothing is created). */
  tasksFromNotes(wsId: number, text: string) {
    return this.run(this.http.post<{ text: string }>(this.ws(wsId, 'tasks/from-notes/'), { text }));
  }
  tasksFromPhoto(wsId: number, image: Blob) {
    const form = new FormData();
    form.append('image', image, 'list.jpg');
    return this.run(this.http.post<{ text: string; model: string }>(this.ws(wsId, 'tasks/from-photo/'), form));
  }
  bulkCreateTasks(wsId: number, tasks: TaskInput[]) {
    return this.run(this.http.post<Task[]>(this.ws(wsId, 'tasks/bulk/'), { tasks }));
  }
  shares(wsId: number, taskId: number) {
    return this.run(this.http.get<TaskShareEntry[]>(this.ws(wsId, `tasks/${taskId}/shares/`)));
  }
  addShare(wsId: number, taskId: number, email: string) {
    return this.run(this.http.post<TaskShareEntry>(this.ws(wsId, `tasks/${taskId}/shares/`), { email }));
  }
  removeShare(wsId: number, taskId: number, id: number) {
    return this.run(this.http.delete<void>(this.ws(wsId, `tasks/${taskId}/shares/${id}/`)));
  }
  taskLink(ref: string) {
    return this.run(this.http.get<TaskLinkView>(this.url(`t/${ref}/`)));
  }
  taskLinkComment(ref: string, body: string) {
    return this.run(this.http.post<Comment>(this.url(`t/${ref}/comments/`), { body }));
  }
  taskLinkAttachment(ref: string, id: number) {
    return this.run(this.http.get<{ url: string }>(this.url(`t/${ref}/attachments/${id}/download/`)));
  }
  sharedWithMe() {
    return this.run(this.http.get<SharedTask[]>(this.url('my/shared/')));
  }

  task(wsId: number, id: number) {
    return this.run(this.http.get<Task>(this.ws(wsId, `tasks/${id}/`)));
  }

  // Discussion & attachments
  comments(wsId: number, taskId: number) {
    return this.run(this.http.get<Comment[]>(this.ws(wsId, `tasks/${taskId}/comments/`)));
  }
  addComment(wsId: number, taskId: number, body: string) {
    return this.run(this.http.post<Comment>(this.ws(wsId, `tasks/${taskId}/comments/`), { body }));
  }
  editComment(wsId: number, taskId: number, id: number, body: string) {
    return this.run(this.http.patch<Comment>(this.ws(wsId, `tasks/${taskId}/comments/${id}/`), { body }));
  }
  deleteComment(wsId: number, taskId: number, id: number) {
    return this.run(this.http.delete<void>(this.ws(wsId, `tasks/${taskId}/comments/${id}/`)));
  }
  attachments(wsId: number, taskId: number) {
    return this.run(this.http.get<Attachment[]>(this.ws(wsId, `tasks/${taskId}/attachments/`)));
  }
  addAttachment(wsId: number, taskId: number, data: Partial<Attachment>) {
    return this.run(this.http.post<Attachment>(this.ws(wsId, `tasks/${taskId}/attachments/`), data));
  }
  uploadAttachment(wsId: number, taskId: number, file: File) {
    const form = new FormData();
    form.append('kind', 'file');
    form.append('file', file, file.name);
    return this.run(this.http.post<Attachment>(this.ws(wsId, `tasks/${taskId}/attachments/`), form));
  }
  deleteAttachment(wsId: number, taskId: number, id: number) {
    return this.run(this.http.delete<void>(this.ws(wsId, `tasks/${taskId}/attachments/${id}/`)));
  }
  attachmentUrl(wsId: number, taskId: number, id: number) {
    return this.run(this.http.get<{ url: string }>(this.ws(wsId, `tasks/${taskId}/attachments/${id}/download/`)));
  }
  // Notifications & concierge
  notifications(after?: number) {
    const params = after ? new HttpParams().set('after', after) : undefined;
    return this.run(this.http.get<{ unread: number; results: AppNotification[] }>(this.url('notifications/'), { params }));
  }
  markNotificationsRead(ids: number[] | 'all') {
    return this.run(this.http.post<{ unread: number }>(this.url('notifications/'), ids === 'all' ? { all: true } : { ids }));
  }
  concierge() {
    return this.run(this.http.get<ConciergeState>(this.url('concierge/')));
  }
  updateConcierge(data: Partial<ConciergeState['settings']>) {
    return this.run(this.http.patch<ConciergeState>(this.url('concierge/'), data));
  }
  forgetConcierge() {
    return this.run(this.http.delete<void>(this.url('concierge/')));
  }
  telegramLink() {
    return this.run(this.http.post<{ url: string; expires_at: string }>(this.url('concierge/telegram/link/'), {}));
  }
  telegramUnlink() {
    return this.run(this.http.delete<void>(this.url('concierge/telegram/link/')));
  }
  conciergeChat(message: string) {
    return this.run(this.http.post<{ reply: string }>(this.url('concierge/chat/'), { message }));
  }
  conciergeBrief(send: boolean) {
    return this.run(this.http.post<{ brief: string }>(this.url('concierge/brief/'), { send }));
  }
  // Single sign-on (Enterprise workspaces)
  sso(wsId: number) {
    return this.run(this.http.get<SsoSetup>(this.ws(wsId, 'sso/')));
  }
  saveSso(wsId: number, data: Partial<SsoConnection> & { client_secret?: string }) {
    return this.run(this.http.put<SsoSetup>(this.ws(wsId, 'sso/'), data));
  }
  deleteSso(wsId: number) {
    return this.run(this.http.delete<void>(this.ws(wsId, 'sso/')));
  }
  ssoDomain(wsId: number, body: { domain: string } | { id: number; verify: true }) {
    return this.run(this.http.post<SsoSetup>(this.ws(wsId, 'sso/domains/'), body));
  }
  removeSsoDomain(wsId: number, id: number) {
    return this.run(this.http.delete<SsoSetup>(this.ws(wsId, 'sso/domains/'), { params: { id } }));
  }

  /** Whether Flo can chat, and the recent conversation (Telegram, web and setup). */
  floChat() {
    return this.run(this.http.get<FloChat>(this.url('concierge/chat/')));
  }
  /** Today's brief if Flo already wrote it. */
  floBriefToday() {
    return this.run(this.http.get<{ brief: string | null; available: boolean; date: string }>(this.url('concierge/brief/')));
  }
  /** "What's on your plate?" → a plan to review. */
  floPropose(text: string, workspace?: number) {
    return this.run(this.http.post<FloPlan>(this.url('concierge/setup/'), { text, workspace }));
  }
  floApply(plan: FloPlan) {
    return this.run(this.http.post<{ tasks: number; projects: number; workspace: number }>(this.url('concierge/setup/'),
      { apply: true, plan, workspace: plan.workspace }));
  }

  // Plans & Stripe
  billingPlan() {
    return this.run(this.http.get<PlanInfo>(this.url('billing/plan/')));
  }
  billingCheckout(interval: 'month' | 'year', plan: 'pro' | 'pro_plus' = 'pro') {
    return this.run(this.http.post<{ url: string }>(this.url('billing/checkout/'), { interval, plan }));
  }
  delegation(wsId: number, taskId: number) {
    return this.run(this.http.get<DelegationState>(this.ws(wsId, `tasks/${taskId}/delegation/`)));
  }
  delegate(wsId: number, taskId: number, action: 'assess' | 'run') {
    return this.run(this.http.post<DelegationState>(this.ws(wsId, `tasks/${taskId}/delegation/`), { action }));
  }
  billingPortal() {
    return this.run(this.http.post<{ url: string }>(this.url('billing/portal/'), {}));
  }
  adminStripeSetup() {
    return this.run(this.http.post<{ created: Record<string, string>; enabled: boolean }>(this.url('admin/stripe/setup/'), {}));
  }
  adminEnterpriseSubscribe(id: number, data: Record<string, string>) {
    return this.run(this.http.post<StripeSub>(this.url(`admin/workspaces/${id}/stripe/`), data));
  }
  adminEnterpriseCancel(id: number) {
    return this.run(this.http.delete<StripeSub>(this.url(`admin/workspaces/${id}/stripe/`)));
  }
  invoicePaymentLink(wsId: number, id: number) {
    return this.run(this.http.post<{ url: string; paid_at: string | null }>(this.url(`workspaces/${wsId}/invoices/${id}/payment-link/`), {}));
  }
  invoicePaymentState(wsId: number, id: number) {
    return this.run(this.http.get<{ url: string; paid_at: string | null; invoice_status: string }>(this.url(`workspaces/${wsId}/invoices/${id}/payment-link/`)));
  }

  // Getting-started guide
  guide() {
    return this.run(this.http.get<{ steps: { key: string; done: boolean }[]; done: number; total: number; pro: boolean }>(this.url('my/guide/')));
  }

  // Calendars
  calendarOverview() {
    return this.run(this.http.get<CalendarOverview>(this.url('calendar/')));
  }
  connectGoogleCalendar() {
    return this.run(this.http.post<{ url: string }>(this.url('calendar/google/connect/'), {}));
  }
  connectMicrosoftCalendar() {
    return this.run(this.http.post<{ url: string }>(this.url('calendar/microsoft/connect/'), {}));
  }
  addCalDav(data: { server_url: string; username: string; password: string }) {
    return this.run(this.http.post<CalendarAccount>(this.url('calendar/caldav/'), data));
  }
  addIcs(data: { url: string; name: string }) {
    return this.run(this.http.post<CalendarAccount>(this.url('calendar/ics/'), data));
  }
  calendarFeed(action: 'get' | 'create' | 'delete') {
    const url = this.url('calendar/feed/');
    const req = action === 'get' ? this.http.get<{ url: string | null }>(url) : action === 'create' ? this.http.post<{ url: string | null }>(url, {}) : this.http.delete<{ url: string | null }>(url);
    return this.run(req);
  }
  syncCalendarAccount(id: number) {
    return this.run(this.http.post<CalendarAccount>(this.url(`calendar/accounts/${id}/`), {}));
  }
  disconnectCalendarAccount(id: number) {
    return this.run(this.http.delete<void>(this.url(`calendar/accounts/${id}/`)));
  }
  selectCalendar(id: number, selected: boolean) {
    return this.run(this.http.patch<{ id: number; selected: boolean }>(this.url(`calendar/calendars/${id}/`), { selected }));
  }
  calendarEvents(from: string, to = from) {
    return this.run(this.http.get<CalendarEvent[]>(this.url('calendar/events/'), { params: { from, to } }));
  }
  calendarPrep() {
    return this.run(this.http.get<CalendarEvent[]>(this.url('calendar/events/'), { params: { prep: 1 } }));
  }
  updateCalendarEvent(id: number, data: { prep?: CalendarEvent['prep']; confirmed?: boolean }) {
    return this.run(this.http.patch<CalendarEvent>(this.url(`calendar/events/${id}/`), data));
  }
  addEventTask(id: number, data: { task?: number; title?: string; workspace?: number; planned_date?: string | null }) {
    return this.run(this.http.post<CalendarEvent>(this.url(`calendar/events/${id}/tasks/`), data));
  }
  unlinkEventTask(id: number, taskId: number) {
    return this.run(this.http.delete<CalendarEvent>(this.url(`calendar/events/${id}/tasks/${taskId}/`)));
  }

  // Instance admin (staff only)
  adminOverview() {
    return this.run(this.http.get<Record<string, any>>(this.url('admin/overview/')));
  }
  adminSettings() {
    return this.run(this.http.get<InstanceSettingRow[]>(this.url('admin/settings/')));
  }
  updateAdminSettings(values: Record<string, unknown>) {
    return this.run(this.http.patch<InstanceSettingRow[]>(this.url('admin/settings/'), values));
  }
  adminCheck(service: string) {
    return this.run(this.http.post<{ ok: boolean; message: string }>(this.url(`admin/check/${service}/`), {}));
  }
  adminTelegramWebhook(enable: boolean) {
    return this.run(this.http.post<{ mode: string; webhook: string; pending: number }>(this.url('admin/telegram/webhook/'), { enable }));
  }
  adminGithubApp() {
    return this.run(this.http.get<Record<string, any>>(this.url('admin/github-app/')));
  }
  saveAdminGithubApp(data: Record<string, string>) {
    return this.run(this.http.put<Record<string, any>>(this.url('admin/github-app/'), data));
  }
  deleteAdminGithubApp() {
    return this.run(this.http.delete<void>(this.url('admin/github-app/')));
  }
  inviteCodes() {
    return this.run(this.http.get<InviteCodeRow[]>(this.url('admin/codes/')));
  }
  createInviteCode(data: Partial<InviteCodeRow>) {
    return this.run(this.http.post<InviteCodeRow>(this.url('admin/codes/'), data));
  }
  updateInviteCode(id: number, data: Partial<InviteCodeRow>) {
    return this.run(this.http.patch<InviteCodeRow>(this.url(`admin/codes/${id}/`), data));
  }
  deleteInviteCode(id: number) {
    return this.run(this.http.delete<void>(this.url(`admin/codes/${id}/`)));
  }
  adminUsers(q = '') {
    const params = q ? new HttpParams().set('q', q) : undefined;
    return this.run(this.http.get<AdminUser[]>(this.url('admin/users/'), { params }));
  }
  updateAdminUser(id: number, data: Partial<AdminUser>) {
    return this.run(this.http.patch<AdminUser>(this.url(`admin/users/${id}/`), data));
  }
  adminWorkspaces(q = '') {
    const params = q ? new HttpParams().set('q', q) : undefined;
    return this.run(this.http.get<AdminWorkspace[]>(this.url('admin/workspaces/'), { params }));
  }
  updateAdminWorkspace(id: number, data: Partial<AdminWorkspace>) {
    return this.run(this.http.patch<AdminWorkspace>(this.url(`admin/workspaces/${id}/`), data));
  }
  slackManifest() {
    return this.run(this.http.get<{ manifest: Record<string, any>; configured: boolean }>(this.url('integrations/slack/manifest/')));
  }
  slackInstall(workspace: number) {
    return this.run(this.http.post<{ url: string }>(this.url('integrations/slack/install/'), { workspace }));
  }
  slackChannels(wsId: number, id: number) {
    return this.run(this.http.get<{ id: string; name: string }[]>(this.url(`workspaces/${wsId}/integrations/${id}/slack-channels/`)));
  }

  // Time tracking & billing
  timer() {
    return this.run(this.http.get<{ entry: TimeEntry | null }>(this.url('my/timer/')));
  }
  startTimer(workspace: number, task?: number | null, description = '', project?: number | null) {
    return this.run(
      this.http.post<{ entry: TimeEntry }>(this.url('my/timer/'), { action: 'start', workspace, task, description, project }),
    );
  }
  stopTimer() {
    return this.run(this.http.post<{ entry: null; stopped: TimeEntry | null }>(this.url('my/timer/'), { action: 'stop' }));
  }
  timeEntries(wsId: number, query: Record<string, string | number | undefined> = {}) {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') params = params.set(k, String(v));
    return this.run(this.http.get<TimeEntry[]>(this.ws(wsId, 'time-entries/'), { params }));
  }
  createTimeEntry(wsId: number, data: Partial<TimeEntry> & { duration_seconds?: number }) {
    return this.run(this.http.post<TimeEntry>(this.ws(wsId, 'time-entries/'), data));
  }
  updateTimeEntry(wsId: number, id: number, data: Partial<TimeEntry>) {
    return this.run(this.http.patch<TimeEntry>(this.ws(wsId, `time-entries/${id}/`), data));
  }
  deleteTimeEntry(wsId: number, id: number) {
    return this.run(this.http.delete<void>(this.ws(wsId, `time-entries/${id}/`)));
  }
  timeReport(wsId: number, query: Record<string, string | undefined>) {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(query)) if (v) params = params.set(k, v);
    return this.run(this.http.get<TimeReport>(this.ws(wsId, 'time-entries/report/'), { params }));
  }
  billing(wsId: number) {
    return this.run(
      this.http.get<{ settings: BillingSettings; projects: ProjectBillingRow[]; can_manage: boolean }>(this.ws(wsId, 'billing/')),
    );
  }
  updateBilling(wsId: number, data: Partial<BillingSettings>) {
    return this.run(
      this.http.patch<{ settings: BillingSettings; projects: ProjectBillingRow[]; can_manage: boolean }>(this.ws(wsId, 'billing/'), data),
    );
  }
  updateProjectBilling(wsId: number, projectId: number, data: Partial<ProjectBillingRow>) {
    return this.run(this.http.patch(this.ws(wsId, `billing/projects/${projectId}/`), data));
  }
  invoices(wsId: number) {
    return this.run(this.http.get<Invoice[]>(this.ws(wsId, 'invoices/')));
  }
  invoice(wsId: number, id: number) {
    return this.run(this.http.get<Invoice>(this.ws(wsId, `invoices/${id}/`)));
  }
  createInvoice(wsId: number, data: { project: number | null; period_start: string; period_end: string; group_by: string }) {
    return this.run(this.http.post<Invoice>(this.ws(wsId, 'invoices/'), data));
  }
  updateInvoice(wsId: number, id: number, data: Partial<Invoice>) {
    return this.run(this.http.patch<Invoice>(this.ws(wsId, `invoices/${id}/`), data));
  }
  deleteInvoice(wsId: number, id: number) {
    return this.run(this.http.delete<void>(this.ws(wsId, `invoices/${id}/`)));
  }
  myInvoicing() {
    return this.run(this.http.get<{ profile: InvoicingProfile; format: string | null; formats: EInvoiceFormat[] }>(this.url('my/invoicing/')));
  }
  updateMyInvoicing(data: Partial<InvoicingProfile>) {
    return this.run(this.http.patch<{ profile: InvoicingProfile; format: string | null; formats: EInvoiceFormat[] }>(this.url('my/invoicing/'), data));
  }
  einvoiceCheck(wsId: number, id: number) {
    return this.run(this.http.get<{ ok: boolean; missing: string[]; filename: string | null; format: string | null; label: string | null }>(this.ws(wsId, `invoices/${id}/einvoice/`), { params: { check: 1 } }));
  }
  einvoiceXml(wsId: number, id: number) {
    return this.run(this.http.get(this.ws(wsId, `invoices/${id}/einvoice/`), { responseType: 'blob' }));
  }
  invoiceCsv(wsId: number, id: number) {
    return this.run(this.http.get(this.ws(wsId, `invoices/${id}/csv/`), { responseType: 'text' }));
  }

  // OAuth for MCP clients
  oauthAuthorizeInfo(params: Record<string, string>) {
    return this.run(
      this.http.get<{
        client: { name: string; uri: string; logo_uri: string; redirect_host: string };
        user: string;
        workspace: { id: number; name: string } | null;
      }>(
        this.url('oauth/authorize/'),
        { params: new HttpParams({ fromObject: params }) },
      ),
    );
  }
  oauthDecide(data: Record<string, string>) {
    return this.run(this.http.post<{ redirect: string }>(this.url('oauth/authorize/'), data));
  }
  oauthGrants() {
    return this.run(this.http.get<{ id: number; client: string; created_at: string; last_used_at: string | null }[]>(this.url('oauth/grants/')));
  }
  revokeOauthGrant(id: number) {
    return this.run(this.http.delete<void>(this.url(`oauth/grants/${id}/`)));
  }

  workspaceMcp(wsId: number) {
    return this.run(this.http.get<WorkspaceMcp>(this.ws(wsId, 'mcp-tokens/')));
  }
  createWorkspaceMcpToken(wsId: number, name: string) {
    return this.run(this.http.post<WorkspaceMcp['tokens'][number]>(this.ws(wsId, 'mcp-tokens/'), { name }));
  }
  revokeWorkspaceMcpToken(wsId: number, id: number) {
    return this.run(this.http.delete<void>(this.ws(wsId, `mcp-tokens/${id}/`)));
  }

  // API tokens (MCP / API)
  apiTokens() {
    return this.run(this.http.get<ApiTokenRow[]>(this.url('auth/tokens/')));
  }
  createApiToken(name: string) {
    return this.run(this.http.post<ApiTokenRow>(this.url('auth/tokens/'), { name }));
  }
  deleteApiToken(id: number) {
    return this.run(this.http.delete<void>(this.url(`auth/tokens/${id}/`)));
  }

  private configPromise: Promise<PublicConfig> | null = null;
  publicConfig() {
    this.configPromise ??= this.run(this.http.get<PublicConfig>(this.url('config/')));
    return this.configPromise;
  }

  deleteTask(wsId: number, id: number) {
    return this.run(this.http.delete<void>(this.ws(wsId, `tasks/${id}/`)));
  }
}

function toParams(query: TaskQuery): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
  }
  return params;
}

/** Flattens DRF validation errors into one readable line. */
/** Translation of a fixed message for the current UI language (errorMessage is a plain function, outside DI). */
function tr(text: string, params?: Record<string, string | number>): string {
  const lang = document.documentElement.lang || 'en';
  const translated = (lang !== 'en' && DICTIONARIES[lang]?.[text]) || text;
  return params ? translated.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? '')) : translated;
}

export function errorMessage(err: unknown, fallback = tr('Something went wrong.')): string {
  const e = err as { error?: unknown; status?: number };
  if (e?.status === 0) return tr('Cannot reach the server.');
  const body = e?.error;
  if ((e?.status ?? 0) >= 500) return tr('Server error ({status}). Please try again.', { status: e.status! });
  if (typeof body === 'string' && body.length < 200 && !body.trimStart().startsWith('<')) return body;
  if (body && typeof body === 'object') {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      const text = Array.isArray(value) ? value.join(' ') : String(value);
      parts.push(key === 'detail' || key === 'non_field_errors' ? text : `${key}: ${text}`);
    }
    if (parts.length) return parts.join(' · ');
  }
  return fallback;
}
