import { Injectable, computed, inject, signal } from '@angular/core';

import { ApiService } from './api.service';
import { Membership, Project, Tag, TagGroup, Workspace } from './models';

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
  readonly projectById = computed(() => new Map(this.projects().map((p) => [p.id, p])));
  readonly tagById = computed(() => new Map(this.tags().map((t) => [t.id, t])));
  readonly userById = computed(() => new Map(this.members().map((m) => [m.user.id, m.user])));

  async loadWorkspaces(): Promise<Workspace[]> {
    const list = await this.api.workspaces();
    this.workspaces.set(list);
    return list;
  }

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
