import { Component, OnInit, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { Logo } from '../../components/logo/logo';
import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { InvitationPreview } from '../../core/models';
import { WorkspaceStore } from '../../core/workspace.store';

/** /join/<token>: shareable workspace invitation. */
@Component({
  selector: 'app-join-page',
  imports: [RouterLink, Logo],
  template: `
    <main class="join">
      <section class="card">
        <app-logo [size]="34" [color]="preview()?.workspace?.color ?? '#4f46e5'" />
        @if (error()) {
          <h1>Invitation not valid</h1>
          <p class="muted">{{ error() }}</p>
          <a class="btn" routerLink="/">Go to Flowly</a>
        } @else if (preview(); as p) {
          <h1>Join <span [style.color]="p.workspace.color">{{ p.workspace.name }}</span></h1>
          <p class="muted">
            {{ p.invited_by ? p.invited_by + ' invited you' : "You've been invited" }} to collaborate on Flowly as {{ p.role === 'admin' ? 'an admin' : 'a member' }}.
          </p>
          @if (p.already_member) {
            <a class="btn primary" [routerLink]="['/w', p.workspace.id, 'board']">Open the workspace</a>
          } @else if (auth.isLoggedIn()) {
            <p class="small muted">Signed in as {{ auth.user()?.email }}</p>
            <button class="btn primary" type="button" [disabled]="busy()" (click)="accept()">Join workspace</button>
          } @else {
            <div class="actions">
              <a class="btn primary" routerLink="/register" [queryParams]="{ next: here }">Create an account</a>
              <a class="btn" routerLink="/login" [queryParams]="{ next: here }">I have an account</a>
            </div>
          }
        } @else {
          <p class="muted">Loading invitation…</p>
        }
      </section>
    </main>
  `,
  styles: `
    .join { min-height: 100dvh; display: grid; place-items: center; padding: 24px 16px; background: var(--bg); }
    .card { width: min(440px, 100%); background: var(--surface); border: 1px solid var(--line); border-radius: 16px;
      padding: 32px 28px; box-shadow: var(--shadow-lg); display: grid; gap: 12px; justify-items: center; text-align: center; }
    h1 { margin: 8px 0 0; font-size: 1.4rem; }
    p { margin: 0; }
    .small { font-size: 0.82rem; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  `,
})
export class JoinPage implements OnInit {
  readonly token = input.required<string>();

  private api = inject(ApiService);
  private router = inject(Router);
  private store = inject(WorkspaceStore);
  protected auth = inject(AuthService);

  protected preview = signal<InvitationPreview | null>(null);
  protected error = signal<string | null>(null);
  protected busy = signal(false);
  protected here = '';

  async ngOnInit() {
    this.here = `/join/${this.token()}`;
    if (this.auth.hasSession && !this.auth.user()) await this.auth.loadMe();
    try {
      this.preview.set(await this.api.invitationPreview(this.token()));
    } catch (err) {
      this.error.set(errorMessage(err, 'This invitation link is no longer valid.'));
    }
  }

  async accept() {
    this.busy.set(true);
    try {
      const { workspace } = await this.api.acceptInvitation(this.token());
      await this.store.loadWorkspaces();
      this.router.navigate(['/w', workspace, 'board']);
    } catch (err) {
      this.error.set(errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}
