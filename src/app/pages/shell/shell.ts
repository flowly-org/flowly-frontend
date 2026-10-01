import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Theme, ThemeService } from '../../core/theme.service';
import { ToastService } from '../../core/toast.service';
import { WorkspaceStore } from '../../core/workspace.store';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected store = inject(WorkspaceStore);
  protected auth = inject(AuthService);
  protected theme = inject(ThemeService);
  protected readonly themes: { value: Theme; label: string; icon: string }[] = [
    { value: 'light', label: 'Light', icon: '☀' },
    { value: 'dark', label: 'Dark', icon: '☾' },
    { value: 'auto', label: 'Auto', icon: '◐' },
  ];
  private api = inject(ApiService);
  private router = inject(Router);
  private toast = inject(ToastService);

  protected creating = signal(false);
  protected newName = '';
  protected menuOpen = signal(false);

  constructor() {
    this.store.loadWorkspaces().catch((err) => this.toast.error(errorMessage(err, 'Could not load your workspaces.')));
  }

  protected switchTo(value: string) {
    if (value === 'new') {
      this.creating.set(true);
      return;
    }
    const parts = this.router.url.split('?')[0].split('/');
    const section = parts[1] === 'w' && parts[3] ? parts[3] : 'board';
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
      this.router.navigate(['/w', ws.id, 'board']);
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
