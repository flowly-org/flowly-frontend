import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiService, errorMessage } from '../../core/api.service';
import { TranslatePipe } from '../../core/i18n.pipes';
import { I18nService } from '../../core/i18n.service';
import { WorkspaceStore } from '../../core/workspace.store';

/** Landing page for GitHub redirects: app created (manifest flow) or app installed. */
@Component({
  selector: 'app-github-callback',
  imports: [RouterLink, TranslatePipe],
  template: `
    <div class="page">
      <section class="panel">
        <h2>GitHub</h2>
        <div class="body">
          @if (error()) {
            <p class="form-error">{{ error() }}</p>
            <a routerLink="/day">{{ 'Back to Flowly' | t }}</a>
          } @else if (message()) {
            <p>{{ message() }}</p>
            @if (next()) {
              <a [routerLink]="next()">{{ 'Continue' | t }}</a>
            }
          } @else {
            <p class="muted">{{ 'Finishing setup…' | t }}</p>
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
  private i18n = inject(I18nService);

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
        this.message.set(this.i18n.t('GitHub App "{name}" is ready. Now add a GitHub integration and install the app on your repositories.', { name: app.name }));
        this.next.set(back ?? `/w/${this.store.navId()}/integrations`);
      } else {
        const installation = qp.get('installation_id');
        const state = qp.get('state');
        if (!installation || !state) {
          this.message.set(this.i18n.t('The app installation was updated on GitHub.'));
          this.next.set('/day');
          return;
        }
        const res = await this.api.githubInstalled(installation, state);
        this.router.navigate(['/w', res.workspace, 'integrations'], { queryParams: { open: res.integration }, replaceUrl: true });
      }
    } catch (err) {
      this.error.set(errorMessage(err, this.i18n.t('GitHub setup failed.')));
    }
  }
}
