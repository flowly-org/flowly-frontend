import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { WorkspaceStore } from '../../core/workspace.store';

/** Sends the user to their last-used (or first) workspace. */
@Component({
  selector: 'app-home',
  template: `<p class="center-note">Loading your workspaces…</p>`,
})
export class Home implements OnInit {
  private store = inject(WorkspaceStore);
  private router = inject(Router);
  private api = inject(ApiService);

  async ngOnInit() {
    let list = await this.store.loadWorkspaces();
    if (!list.length) {
      await this.api.createWorkspace('Personal');
      list = await this.store.loadWorkspaces();
    }
    let lastId: number | null = null;
    try {
      lastId = Number(localStorage.getItem('mk.lastWorkspace')) || null;
    } catch {}
    const target = list.find((w) => w.id === lastId) ?? list[0];
    if (target) this.router.navigate(['/w', target.id, 'day'], { replaceUrl: true });
  }
}
