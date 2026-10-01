import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { Logo } from '../../components/logo/logo';
import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';

interface ConsentInfo {
  client: { name: string; uri: string; logo_uri: string; redirect_host: string };
  user: string;
  workspace: { id: number; name: string } | null;
}

/** OAuth authorization endpoint for MCP clients (ChatGPT, claude.ai, Cursor…): "X wants to access your Flowly". */
@Component({
  selector: 'app-oauth-consent',
  imports: [Logo],
  template: `
    <main class="consent">
      <section class="card">
        <app-logo [size]="36" />
        @if (error()) {
          <h1>Can't connect</h1>
          <p class="muted">{{ error() }}</p>
        } @else if (info(); as i) {
          @if (i.client.logo_uri) {
            <img class="client-logo" [src]="i.client.logo_uri" alt="" width="40" height="40" />
          }
          @if (i.workspace) {
            <h1><strong>{{ i.client.name }}</strong> wants to access the <strong>{{ i.workspace.name }}</strong> workspace</h1>
          } @else {
            <h1><strong>{{ i.client.name }}</strong> wants to access your Flowly account</h1>
          }
          <p class="muted small">Signed in as {{ i.user }} · sends you back to {{ i.client.redirect_host }}</p>
          <ul>
            @if (i.workspace) {
              <li>See this workspace's tasks, projects and discussions, and search them</li>
            } @else {
              <li>See your tasks, workspaces and projects, and search them</li>
            }
            <li>Create, update and complete tasks, and comment on them</li>
            <li>Start and stop timers and log time</li>
          </ul>
          <p class="muted small">It acts with your permissions. Workspaces with their own exclusive AI endpoint stay hidden. You can disconnect it anytime in Settings → Claude, ChatGPT & API.</p>
          <div class="actions">
            <button class="btn" type="button" [disabled]="busy()" (click)="decide('deny')">Deny</button>
            <button class="btn primary" type="button" [disabled]="busy()" (click)="decide('allow')">Allow access</button>
          </div>
        } @else {
          <p class="muted">Loading…</p>
        }
      </section>
    </main>
  `,
  styles: `
    .consent { min-height: 100dvh; display: grid; place-items: center; padding: 24px 16px; background: var(--bg); }
    .card { width: min(460px, 100%); background: var(--surface); border: 1px solid var(--line); border-radius: 16px;
      padding: 32px 28px; box-shadow: var(--shadow-lg); display: grid; gap: 12px; }
    h1 { font-size: 1.25rem; font-weight: 500; margin: 8px 0 0; }
    ul { margin: 4px 0; padding-left: 20px; display: grid; gap: 4px; }
    p { margin: 0; }
    .small { font-size: 0.82rem; }
    .client-logo { border-radius: 10px; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
  `,
})
export class OAuthConsent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  private auth = inject(AuthService);

  protected info = signal<ConsentInfo | null>(null);
  protected error = signal<string | null>(null);
  protected busy = signal(false);
  private params: Record<string, string> = {};

  async ngOnInit() {
    const qp = this.route.snapshot.queryParamMap;
    for (const key of qp.keys) this.params[key] = qp.get(key)!;
    if (!(this.auth.isLoggedIn() || (await this.auth.loadMe()))) {
      this.router.navigate(['/login'], { queryParams: { next: this.router.url } });
      return;
    }
    try {
      this.info.set(await this.api.oauthAuthorizeInfo(this.params));
    } catch (err) {
      this.error.set(errorMessage(err, 'This connection request is invalid.'));
    }
  }

  async decide(decision: 'allow' | 'deny') {
    this.busy.set(true);
    try {
      const { redirect } = await this.api.oauthDecide({ ...this.params, decision });
      window.location.href = redirect;
    } catch (err) {
      this.error.set(errorMessage(err));
      this.busy.set(false);
    }
  }
}
