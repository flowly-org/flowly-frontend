import { Component, effect, inject, input, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

import { errorMessage } from '../../core/api.service';
import { TranslatePipe } from '../../core/i18n.pipes';
import { I18nService } from '../../core/i18n.service';
import { ToastService } from '../../core/toast.service';
import { WorkspaceStore } from '../../core/workspace.store';

/** Loads the workspace in the URL into the store before rendering its pages. */
@Component({
  selector: 'app-workspace-host',
  imports: [RouterOutlet, TranslatePipe],
  template: `
    @if (ready()) {
      <router-outlet />
    } @else {
      <p class="center-note">{{ 'Loading…' | t }}</p>
    }
  `,
  styles: `:host { display: flex; flex-direction: column; flex: 1; min-height: 0; }`,
})
export class WorkspaceHost {
  readonly wsId = input.required<string>();

  private store = inject(WorkspaceStore);
  private router = inject(Router);
  private toast = inject(ToastService);
  private i18n = inject(I18nService);

  protected ready = signal(false);

  constructor() {
    effect(() => {
      const id = Number(this.wsId());
      this.ready.set(false);
      this.store.open(id).then(
        (ok) => {
          if (!ok) {
            this.toast.error(this.i18n.t('That workspace does not exist or you are not a member.'));
            this.router.navigateByUrl('/day');
            return;
          }
          try {
            localStorage.setItem('flowly.lastWorkspace', String(id));
          } catch {}
          this.ready.set(true);
        },
        (err) => this.toast.error(errorMessage(err, this.i18n.t('Could not load the workspace.'))),
      );
    });
  }
}
