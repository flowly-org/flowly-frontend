import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth.service';
import { TranslatePipe } from '../../core/i18n.pipes';
import { I18nService } from '../../core/i18n.service';
import { ToastService } from '../../core/toast.service';

/** Where the SSO callback lands: tokens (or an error) arrive in the fragment, never in the server logs. */
@Component({
  selector: 'app-sso-page',
  imports: [TranslatePipe],
  template: `<main class="sso"><p class="muted">{{ (failed() ? 'Back to sign-in…' : 'Signing you in…') | t }}</p></main>`,
  styles: `.sso { min-height: 60vh; display: grid; place-items: center; }`,
})
export class SsoPage implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private i18n = inject(I18nService);
  protected failed = signal(false);

  async ngOnInit() {
    const params = new URLSearchParams(window.location.hash.slice(1));
    history.replaceState(null, '', window.location.pathname); // drop the tokens from the address bar and history
    const next = params.get('next') ?? '/';
    const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';
    const error = params.get('error');
    if (error) {
      this.failed.set(true);
      if (this.auth.hasSession) {
        this.toast.error(error); // a test from the workspace settings
        this.router.navigateByUrl(safeNext);
      } else {
        this.router.navigate(['/login'], { queryParams: { sso_error: error } });
      }
      return;
    }
    const access = params.get('access');
    const refresh = params.get('refresh');
    if (!access || !refresh) {
      this.router.navigate(['/login']);
      return;
    }
    await this.auth.adoptTokens(access, refresh);
    if (params.get('tested')) this.toast.show(this.i18n.t('Single sign-on works. You can now enable it, or require it.'));
    this.router.navigateByUrl(safeNext);
  }
}
