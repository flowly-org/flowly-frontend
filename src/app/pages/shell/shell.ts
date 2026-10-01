import { Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { WorkspaceStore } from '../../core/workspace.store';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  readonly wsId = input.required<string>();

  protected store = inject(WorkspaceStore);
  protected auth = inject(AuthService);
  private api = inject(ApiService);
  private router = inject(Router);
  private toast = inject(ToastService);

  protected ready = signal(false);
  protected creating = signal(false);
  protected newName = '';
  protected menuOpen = signal(false);

  constructor() {
    effect(() => {
      const id = Number(this.wsId());
      this.ready.set(false);
      this.store.open(id).then(
        (ok) => {
          if (!ok) {
            this.toast.error('That workspace does not exist or you are not a member.');
            this.router.navigateByUrl('/');
            return;
          }
          try {
            localStorage.setItem('mk.lastWorkspace', String(id));
          } catch {}
          this.ready.set(true);
        },
        (err) => this.toast.error(errorMessage(err, 'Could not load the workspace.')),
      );
    });
  }

  protected switchTo(value: string) {
    if (value === 'new') {
      this.creating.set(true);
      return;
    }
    const section = this.router.url.split('?')[0].split('/')[3] ?? 'day';
    this.router.navigate(['/w', value, section]);
  }

  protected async createWorkspace() {
    const name = this.newName.trim();
    if (!name) return;
    try {
      const ws = await this.api.createWorkspace(name);
      await this.store.loadWorkspaces();
      this.creating.set(false);
      this.newName = '';
      this.router.navigate(['/w', ws.id, 'day']);
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  protected initials(name: string): string {
    return name
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]!.toUpperCase())
      .join('');
  }
}
