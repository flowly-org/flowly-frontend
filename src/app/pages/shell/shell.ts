import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { Logo, logoSvg } from '../../components/logo/logo';
import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { DatePipe } from '@angular/common';

import { AppNotification } from '../../core/models';
import { NotificationService } from '../../core/notification.service';
import { TimerService } from '../../core/timer.service';
import { formatDuration } from '../../core/models';
import { Theme, ThemeService } from '../../core/theme.service';
import { ToastService } from '../../core/toast.service';
import { WorkspaceStore } from '../../core/workspace.store';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule, Logo, DatePipe],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  host: { '[style.--brand]': 'brandColor()' },
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
  protected bellOpen = signal(false);
  protected notifications = inject(NotificationService);
  protected timer = inject(TimerService);
  protected readonly formatDuration = formatDuration;
  protected readonly icons: Record<string, string> = { urgent: '🔴', assigned: '📌', comment: '💬', brief: '☀', shared: '🔗' };

  /** Colour of the workspace being viewed (default accent on My day). */
  protected readonly brandColor = computed(() => {
    const onWorkspace = this.url().startsWith('/w/');
    return (onWorkspace && this.store.current()?.color) || '#4f46e5';
  });
  private url = signal(this.router.url);

  constructor() {
    this.router.events.subscribe(() => this.url.set(this.router.url));
    effect(() => setFavicon(this.brandColor()));
    this.notifications.start();
    this.timer.start();
    this.store.loadWorkspaces().catch((err) => this.toast.error(errorMessage(err, 'Could not load your workspaces.')));
  }

  protected openTimerTask() {
    const e = this.timer.entry();
    if (e?.task) this.router.navigate(['/w', e.workspace, 'board'], { queryParams: { task: e.task } });
  }

  protected openNotification(n: AppNotification) {
    this.notifications.markRead([n.id]);
    this.bellOpen.set(false);
    if (n.kind === 'shared' && n.data?.ref) this.router.navigate(['/t', n.data.ref]);
    else if (n.workspace && n.task) this.router.navigate(['/w', n.workspace, 'board'], { queryParams: { task: n.task } });
    else if (n.kind === 'brief') this.router.navigate(['/day']);
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

function setFavicon(color: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = 'image/svg+xml';
  link.href = 'data:image/svg+xml,' + encodeURIComponent(logoSvg(color));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
}
