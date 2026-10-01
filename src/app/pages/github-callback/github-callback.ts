import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiService, errorMessage } from '../../core/api.service';
import { WorkspaceStore } from '../../core/workspace.store';

/** Landing page for GitHub redirects: app created (manifest flow) or app installed. */
@Component({
  selector: 'app-github-callback',
  imports: [RouterLink],
  template: `
    <div class="page">
      <section class="panel">
        <h2>GitHub</h2>
        <div class="body">
          @if (error()) {
            <p class="form-error">{{ error() }}</p>
            <a routerLink="/day">Back to Flowly</a>
          } @else if (message()) {
            <p>{{ message() }}</p>
            @if (next()) {
              <a [routerLink]="next()">Continue</a>
            }
          } @else {
            <p class="muted">Finishing setup…</p>
          }
        </div>
      </section>
    </div>
  `,
  styles: `.body { padding: 16px; }`,
})
export class GithubCallback implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  private store = inject(WorkspaceStore);

  protected error = signal<string | null>(null);
  protected message = signal<string | null>(null);
  protected next = signal<string | null>(null);

  async ngOnInit() {
    const qp = this.route.snapshot.queryParamMap;
    const mode = this.route.snapshot.data['mode'];
    try {
      if (mode === 'app-created') {
        const app = await this.api.githubConvert(qp.get('code') ?? '', qp.get('state') ?? '');
        let back: string | null = null;
        try {
          back = localStorage.getItem('flowly.githubReturn');
          localStorage.removeItem('flowly.githubReturn');
        } catch {}
        this.message.set(`GitHub App "${app.name}" is ready. Now add a GitHub integration and install the app on your repositories.`);
        this.next.set(back ?? `/w/${this.store.navId()}/integrations`);
      } else {
        const installation = qp.get('installation_id');
        const state = qp.get('state');
        if (!installation || !state) {
          this.message.set('The app installation was updated on GitHub.');
          this.next.set('/day');
          return;
        }
        const res = await this.api.githubInstalled(installation, state);
        this.router.navigate(['/w', res.workspace, 'integrations'], { queryParams: { open: res.integration }, replaceUrl: true });
      }
    } catch (err) {
      this.error.set(errorMessage(err, 'GitHub setup failed.'));
    }
  }
}
