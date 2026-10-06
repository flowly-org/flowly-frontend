import { Component, computed, inject, signal } from '@angular/core';
import { ImportDialog } from '../../components/import-dialog/import-dialog';
import { RelocateDialog } from '../../components/relocate-dialog/relocate-dialog';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ApiService, errorMessage } from '../../core/api.service';
import { TranslatePipe } from '../../core/i18n.pipes';
import { I18nService } from '../../core/i18n.service';
import { PALETTE, Project } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { WorkspaceStore } from '../../core/workspace.store';

@Component({
  selector: 'app-projects-page',
  imports: [FormsModule, NgTemplateOutlet, RouterLink, TranslatePipe, ImportDialog, RelocateDialog],
  templateUrl: './projects-page.html',
})
export class ProjectsPage {
  protected store = inject(WorkspaceStore);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private i18n = inject(I18nService);
  private router = inject(Router);

  protected newName = '';
  protected newColor = PALETTE[this.store.projects().length % PALETTE.length];
  protected showArchived = signal(false);
  protected importing = signal(false);
  protected editingId = signal<number | null>(null);
  protected editName = '';
  protected confirmingDelete = signal<number | null>(null);
  protected relocating = signal<{ project: Project; mode: 'move' | 'promote' } | null>(null);

  protected readonly active = computed(() => this.store.projects().filter((p) => !p.archived));
  protected readonly archived = computed(() => this.store.projects().filter((p) => p.archived));

  private get wsId() {
    return this.store.currentId()!;
  }

  async create() {
    const name = this.newName.trim();
    if (!name) return;
    try {
      await this.api.createProject(this.wsId, { name, color: this.newColor, position: this.store.projects().length });
      this.newName = '';
      this.newColor = PALETTE[(this.store.projects().length + 1) % PALETTE.length];
      await this.store.refreshProjects();
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  startEdit(p: Project) {
    this.editingId.set(p.id);
    this.editName = p.name;
  }

  async saveName(p: Project) {
    const name = this.editName.trim();
    this.editingId.set(null);
    if (name && name !== p.name) await this.update(p, { name });
  }

  async update(p: Project, data: Partial<Project>) {
    try {
      await this.api.updateProject(this.wsId, p.id, data);
      await this.store.refreshProjects();
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  async move(p: Project, delta: number) {
    const list = [...this.active()];
    const i = list.findIndex((x) => x.id === p.id);
    const j = i + delta;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    try {
      await Promise.all(list.map((x, idx) => (x.position === idx ? null : this.api.updateProject(this.wsId, x.id, { position: idx }))));
      await this.store.refreshProjects();
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  async remove(p: Project) {
    this.confirmingDelete.set(null);
    try {
      await this.api.deleteProject(this.wsId, p.id);
      await this.store.refreshProjects();
      this.toast.show(this.i18n.t('Deleted “{name}”. Its tasks are kept without a project.', { name: p.name }));
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  protected async relocated(r: { project: Project; mode: 'move' | 'promote' }, workspaceId: number) {
    this.relocating.set(null);
    await this.store.loadWorkspaces();
    const ws = this.store.workspaces().find((w) => w.id === workspaceId);
    if (r.mode === 'promote') {
      this.toast.show(this.i18n.t('“{name}” is now a workspace.', { name: ws?.name ?? r.project.name }));
      this.router.navigate(['/w', workspaceId, 'board']);
    } else {
      await this.store.refreshProjects();
      this.toast.show(this.i18n.t('Moved “{name}” to {ws}.', { name: r.project.name, ws: ws?.name ?? '' }));
    }
  }
}
