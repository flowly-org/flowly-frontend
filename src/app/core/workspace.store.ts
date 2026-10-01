import { Injectable, computed, inject, signal } from '@angular/core';

import { ApiService } from './api.service';
import { Membership, Project, Tag, TagGroup, Workspace, WorkspaceContext } from './models';

/** Workspace-level reference data shared by every page under /w/:wsId. */
@Injectable({ providedIn: 'root' })
export class WorkspaceStore {
  private api = inject(ApiService);

  readonly workspaces = signal<Workspace[]>([]);
  readonly currentId = signal<number | null>(null);
  readonly projects = signal<Project[]>([]);
  readonly tagGroups = signal<TagGroup[]>([]);
  readonly tags = signal<Tag[]>([]);
  readonly members = signal<Membership[]>([]);
  readonly loading = signal(false);

  readonly current = computed(() => this.workspaces().find((w) => w.id === this.currentId()) ?? null);
  readonly canManage = computed(() => ['owner', 'admin'].includes(this.current()?.my_role ?? ''));
  readonly activeProjects = computed(() => this.projects().filter((p) => !p.archived));
  readonly freeTags = computed(() => this.tags().filter((t) => t.group === null));

  /** The current workspace's data in the shape the board uses. */
  readonly context = computed<WorkspaceContext | null>(() => {
    const ws = this.current();
    if (!ws) return null;
    return {
      id: ws.id,
      name: ws.name,
      color: ws.color,
      my_role: ws.my_role,
      projects: this.projects(),
      tag_groups: this.tagGroups(),
      tags: this.tags(),
      members: this.members(),
    };
  });
  readonly projectById = computed(() => new Map(this.projects().map((p) => [p.id, p])));
  readonly tagById = computed(() => new Map(this.tags().map((t) => [t.id, t])));
  readonly userById = computed(() => new Map(this.members().map((m) => [m.user.id, m.user])));

  async loadWorkspaces(): Promise<Workspace[]> {
    const list = await this.api.workspaces();
    this.workspaces.set(list);
    if (!list.some((w) => w.id === this.currentId())) this.currentId.set(null);
    return list;
  }

  /** Workspace the workspace-level nav should point at: current, else last used, else first. */
  readonly navId = computed(() => {
    const list = this.workspaces();
    const current = this.currentId();
    if (current !== null) return current;
    let last: number | null = null;
    try {
      last = Number(localStorage.getItem('flowly.lastWorkspace')) || null;
    } catch {}
    return list.find((w) => w.id === last)?.id ?? list[0]?.id ?? null;
  });

  async open(wsId: number): Promise<boolean> {
    if (!this.workspaces().length) await this.loadWorkspaces();
    if (!this.workspaces().some((w) => w.id === wsId)) return false;
    if (this.currentId() !== wsId) {
      this.projects.set([]);
      this.tagGroups.set([]);
      this.tags.set([]);
      this.members.set([]);
    }
    this.currentId.set(wsId);
    await this.refresh();
    return true;
  }

  async refresh(): Promise<void> {
    const wsId = this.currentId();
    if (wsId === null) return;
    this.loading.set(true);
    try {
      const [projects, tagGroups, tags, members] = await Promise.all([
        this.api.projects(wsId),
        this.api.tagGroups(wsId),
        this.api.tags(wsId),
        this.api.members(wsId),
      ]);
      this.projects.set(projects);
      this.tagGroups.set(tagGroups);
      this.tags.set(tags);
      this.members.set(members);
    } finally {
      this.loading.set(false);
    }
  }

  async refreshProjects(): Promise<void> {
    const wsId = this.currentId();
    if (wsId !== null) this.projects.set(await this.api.projects(wsId));
  }

  async refreshTags(): Promise<void> {
    const wsId = this.currentId();
    if (wsId === null) return;
    const [tagGroups, tags] = await Promise.all([this.api.tagGroups(wsId), this.api.tags(wsId)]);
    this.tagGroups.set(tagGroups);
    this.tags.set(tags);
  }

  async refreshMembers(): Promise<void> {
    const wsId = this.currentId();
    if (wsId !== null) this.members.set(await this.api.members(wsId));
  }
}
