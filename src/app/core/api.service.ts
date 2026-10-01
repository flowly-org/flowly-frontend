import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

import { ConfigService } from './config.service';
import {
  InvitationPreview,
  SharedTask,
  TaskLinkView,
  TaskShareEntry,
  AdminUser,
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
  updateWorkspace(id: number, data: Partial<Pick<Workspace, 'name' | 'color'>>) {
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

  myContext() {
    return this.run(this.http.get<WorkspaceContext[]>(this.url('my/context/')));
  }
  createTask(wsId: number, data: TaskInput) {
    return this.run(this.http.post<Task>(this.ws(wsId, 'tasks/'), data));
  }
  updateTask(wsId: number, id: number, data: TaskInput) {
    return this.run(this.http.patch<Task>(this.ws(wsId, `tasks/${id}/`), data));
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
  adminUsers(q = '') {
    const params = q ? new HttpParams().set('q', q) : undefined;
    return this.run(this.http.get<AdminUser[]>(this.url('admin/users/'), { params }));
  }
  updateAdminUser(id: number, data: Partial<AdminUser>) {
    return this.run(this.http.patch<AdminUser>(this.url(`admin/users/${id}/`), data));
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
export function errorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  const e = err as { error?: unknown; status?: number };
  if (e?.status === 0) return 'Cannot reach the server.';
  const body = e?.error;
  if (typeof body === 'string' && body.length < 200) return body;
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
