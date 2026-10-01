import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ApiService, errorMessage } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { WorkspaceStore } from '../../core/workspace.store';

@Component({
  selector: 'app-workspace-settings',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="page">
      <header>
        <div>
          <h1>Workspace settings</h1>
          <p class="muted">How {{ store.current()?.name }} looks and which features it uses.</p>
        </div>
      </header>

      @if (!store.canManage()) {
        <section class="panel"><p class="empty">Only owners and admins can change workspace settings.</p></section>
      } @else {
        <section class="panel">
          <h2>Identity</h2>
          <form class="inline-form" (ngSubmit)="saveIdentity()">
            <input type="color" name="color" [(ngModel)]="color" aria-label="Workspace colour" title="Tints the Flowly logo while you're in this workspace" />
            <input name="name" [(ngModel)]="name" aria-label="Workspace name" />
            <button class="btn primary" type="submit" [disabled]="!name.trim()">Save</button>
          </form>
        </section>

        <section class="panel">
          <h2>Features</h2>
          <div class="row feature">
            <div class="grow">
              <strong>Time tracking</strong>
              <div class="muted small">Timers and logged time on tasks. Off hides Time and Billing here. Individual projects can still opt out on the <a routerLink="../projects">Projects</a> page.</div>
            </div>
            <label class="switch">
              <input type="checkbox" [checked]="store.current()?.time_tracking" (change)="setTimeTracking($any($event.target).checked)" aria-label="Time tracking" />
              <span></span>
            </label>
          </div>
          <div class="row feature" [class.disabled]="!store.current()?.time_tracking">
            <div class="grow">
              <strong>Billing</strong>
              <div class="muted small">
                Turn tracked time into invoices. Rates, rounding, tax and invoices are on the
                <a routerLink="../billing">Billing</a> page; projects can opt out on the Projects page.
              </div>
            </div>
            <label class="switch">
              <input type="checkbox" [checked]="store.current()?.billing_enabled" [disabled]="!store.current()?.time_tracking"
                (change)="setBilling($any($event.target).checked)" aria-label="Billing" />
              <span></span>
            </label>
          </div>
        </section>

        @if (store.current()?.my_role === 'owner') {
          <section class="panel">
            <h2>Danger zone</h2>
            <div class="row">
              <div class="grow muted">Deleting the workspace removes all of its projects, tags, tasks, time and invoices for everyone.</div>
              @if (confirming()) {
                <button class="btn danger small" type="button" (click)="remove()">Delete forever</button>
                <button class="btn ghost small" type="button" (click)="confirming.set(false)">Cancel</button>
              } @else {
                <button class="btn danger small" type="button" (click)="confirming.set(true)">Delete workspace</button>
              }
            </div>
          </section>
        }
      }
    </div>
  `,
  styles: `
    .small { font-size: 0.82rem; }
    .feature.disabled { opacity: 0.55; }
    .switch { position: relative; width: 38px; height: 22px; flex: none; cursor: pointer; }
    .switch input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
    .switch span { position: absolute; inset: 0; border-radius: 999px; background: var(--line); transition: background 0.15s; pointer-events: none; }
    .switch span::after { content: ''; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform 0.15s; }
    .switch input:checked + span { background: var(--ok); }
    .switch input:checked + span::after { transform: translateX(16px); }
    input[type='color'] { flex: none; }
  `,
})
export class WorkspaceSettings implements OnInit {
  protected store = inject(WorkspaceStore);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);

  protected name = '';
  protected color = '#4f46e5';
  protected confirming = signal(false);

  private get wsId() {
    return this.store.currentId()!;
  }

  ngOnInit() {
    this.name = this.store.current()?.name ?? '';
    this.color = this.store.current()?.color ?? '#4f46e5';
  }

  async saveIdentity() {
    await this.update({ name: this.name.trim(), color: this.color }, 'Saved.');
  }

  async setTimeTracking(on: boolean) {
    await this.update({ time_tracking: on }, on ? 'Time tracking is on.' : 'Time tracking is off for this workspace.');
  }

  async setBilling(on: boolean) {
    try {
      await this.api.updateBilling(this.wsId, { enabled: on });
      await this.store.loadWorkspaces();
      this.toast.show(on ? 'Billing is on. Set rates on the Billing page.' : 'Billing is off.');
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  private async update(data: Parameters<ApiService['updateWorkspace']>[1], message: string) {
    try {
      await this.api.updateWorkspace(this.wsId, data);
      await this.store.loadWorkspaces();
      this.toast.show(message);
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  async remove() {
    try {
      await this.api.deleteWorkspace(this.wsId);
      await this.store.loadWorkspaces();
      try {
        localStorage.removeItem('flowly.lastWorkspace');
      } catch {}
      this.router.navigateByUrl('/day');
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }
}
