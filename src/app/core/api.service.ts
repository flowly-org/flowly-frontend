import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

import { ConfigService } from './config.service';
import {
  Invitation,
  Membership,
  Project,
  Role,
  Tag,
  TagGroup,
  Task,
  TaskInput,
  Workspace,
} from './models';

export interface TaskQuery {
  day?: string;
  include_overdue?: boolean;
  unscheduled?: boolean;
  assignee?: 'me' | 'none' | number;
  project?: number | 'none';
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
  renameWorkspace(id: number, name: string) {
    return this.run(this.http.patch<Workspace>(this.url(`workspaces/${id}/`), { name }));
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
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    }
    return this.run(this.http.get<Task[]>(this.ws(wsId, 'tasks/'), { params }));
  }
  createTask(wsId: number, data: TaskInput) {
    return this.run(this.http.post<Task>(this.ws(wsId, 'tasks/'), data));
  }
  updateTask(wsId: number, id: number, data: TaskInput) {
    return this.run(this.http.patch<Task>(this.ws(wsId, `tasks/${id}/`), data));
  }
  deleteTask(wsId: number, id: number) {
    return this.run(this.http.delete<void>(this.ws(wsId, `tasks/${id}/`)));
  }
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
