import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService, errorMessage } from '../../core/api.service';
import { TranslatePipe } from '../../core/i18n.pipes';
import { PALETTE, Tag, TagGroup } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { WorkspaceStore } from '../../core/workspace.store';

@Component({
  selector: 'app-tags-page',
  imports: [FormsModule, NgTemplateOutlet, TranslatePipe],
  templateUrl: './tags-page.html',
})
export class TagsPage {
  protected store = inject(WorkspaceStore);
  private api = inject(ApiService);
  private toast = inject(ToastService);

  protected readonly contextExamples = '@office, @home';
  protected readonly energyExamples = 'deep, light';
  protected newGroupName = '';
  /** Draft tag name per group id ('free' for ungrouped tags). */
  protected drafts: Record<string, string> = {};
  protected editing = signal<string | null>(null);
  protected editName = '';
  protected confirming = signal<string | null>(null);

  /** Built-in groups first (status, priority), then the user's own. */
  protected readonly groups = computed(() => {
    const rank = { status: 0, priority: 1, custom: 2 } as const;
    return [...this.store.tagGroups()].sort((a, b) => rank[a.kind] - rank[b.kind] || a.position - b.position);
  });

  private get wsId() {
    return this.store.currentId()!;
  }

  private async run(action: () => Promise<unknown>) {
    try {
      await action();
      await this.store.refreshTags();
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  createGroup() {
    const name = this.newGroupName.trim();
    if (!name) return;
    this.newGroupName = '';
    this.run(() => this.api.createTagGroup(this.wsId, name));
  }

  createTag(group: TagGroup | null) {
    const key = group ? String(group.id) : 'free';
    const name = (this.drafts[key] ?? '').trim();
    if (!name) return;
    this.drafts[key] = '';
    const count = group ? group.tags.length : this.store.freeTags().length;
    this.run(() =>
      this.api.createTag(this.wsId, { name, group: group?.id ?? null, color: PALETTE[count % PALETTE.length], position: count }),
    );
  }

  startEdit(key: string, name: string) {
    this.editing.set(key);
    this.editName = name;
  }

  saveGroupName(group: TagGroup) {
    const name = this.editName.trim();
    this.editing.set(null);
    if (name && name !== group.name) this.run(() => this.api.updateTagGroup(this.wsId, group.id, { name }));
  }

  saveTagName(tag: Tag) {
    const name = this.editName.trim();
    this.editing.set(null);
    if (name && name !== tag.name) this.run(() => this.api.updateTag(this.wsId, tag.id, { name }));
  }

  setTagColor(tag: Tag, color: string) {
    this.run(() => this.api.updateTag(this.wsId, tag.id, { color }));
  }

  setDone(tag: Tag, isDone: boolean) {
    this.run(() => this.api.updateTag(this.wsId, tag.id, { is_done: isDone }));
  }

  /** Swap a tag with its neighbour and renumber the group so positions stay dense. */
  move(group: TagGroup, tag: Tag, delta: number) {
    const list = [...group.tags];
    const i = list.findIndex((t) => t.id === tag.id);
    const j = i + delta;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    this.run(() =>
      Promise.all(list.map((t, idx) => (t.position === idx ? null : this.api.updateTag(this.wsId, t.id, { position: idx })))),
    );
  }

  deleteGroup(group: TagGroup) {
    this.confirming.set(null);
    this.run(() => this.api.deleteTagGroup(this.wsId, group.id));
  }

  deleteTag(tag: Tag) {
    this.confirming.set(null);
    this.run(() => this.api.deleteTag(this.wsId, tag.id));
  }
}
