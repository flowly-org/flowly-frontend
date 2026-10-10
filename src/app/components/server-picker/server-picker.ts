import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TranslatePipe } from '../../core/i18n.pipes';
import { I18nService } from '../../core/i18n.service';
import { isNative } from '../../core/native';
import { Server, activeServer, removeServer, resolveServer, saveServer, servers, setActiveServer } from '../../core/servers';
import { Icon } from '../icon/icon';

/** Mobile app only: which Flowly server you're on, switch to another one, or add your own. Hidden on the web. */
@Component({
  selector: 'app-server-picker',
  imports: [FormsModule, Icon, TranslatePipe],
  template: `
    @if (native) {
      <div class="picker">
        <button type="button" class="current" (click)="open.set(!open())" [attr.aria-expanded]="open()">
          <app-icon name="globe" [size]="15" />
          <span class="muted">{{ 'Server' | t }}</span>
          <strong>{{ active?.name }}</strong>
          <span class="chev" aria-hidden="true">{{ open() ? '▴' : '▾' }}</span>
        </button>
        @if (open()) {
          <ul>
            @for (s of list; track s.id) {
              <li [class.on]="s.id === active?.id">
                <button type="button" class="pick" (click)="switchTo(s)">
                  @if (s.id === active?.id) { <app-icon name="check" [size]="14" /> } @else { <span class="dot"></span> }
                  {{ s.name }}
                </button>
                @if (list.length > 1 && s.id !== active?.id) {
                  <button type="button" class="x" [attr.aria-label]="'Remove {name}' | t: { name: s.name }" (click)="remove(s)">✕</button>
                }
              </li>
            }
          </ul>
          <form (ngSubmit)="add()">
            <input name="address" [(ngModel)]="address" [placeholder]="'flowly.your-company.com'" autocapitalize="none" autocomplete="url"
              [attr.aria-label]="'Server address' | t" />
            <button class="btn small" type="submit" [disabled]="busy() || !address.trim()">{{ (busy() ? 'Checking…' : 'Add') | t }}</button>
          </form>
          @if (error()) { <p class="err small">{{ error() }}</p> }
          <p class="hint small muted">{{ 'Flowly is open source: your team can run its own server. Each server keeps its own sign-in.' | t }}</p>
        }
      </div>
    }
  `,
  styles: `
    .picker { display: grid; gap: 8px; }
    .current { display: flex; align-items: center; gap: 6px; border: 1px solid var(--line); background: var(--surface); color: var(--ink);
      border-radius: 10px; padding: 8px 10px; font: inherit; font-size: .85rem; cursor: pointer; width: 100%; }
    .current strong { flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
    li { display: flex; align-items: center; }
    .pick { flex: 1; display: flex; align-items: center; gap: 8px; border: 0; background: transparent; color: var(--ink); font: inherit;
      padding: 8px 6px; text-align: left; cursor: pointer; border-radius: 8px; }
    li.on .pick { color: var(--accent); font-weight: 600; }
    .dot { width: 14px; }
    .x { border: 0; background: transparent; color: var(--muted); padding: 6px 8px; cursor: pointer; font: inherit; }
    form { display: flex; gap: 6px; }
    form input { flex: 1; min-width: 0; }
    .err { color: var(--danger); margin: 0; }
    .hint { margin: 0; }
  `,
})
export class ServerPicker {
  private i18n = inject(I18nService);
  protected readonly native = isNative();
  protected list = servers();
  protected active = activeServer();
  protected open = signal(false);
  protected busy = signal(false);
  protected error = signal<string | null>(null);
  protected address = '';

  protected switchTo(server: Server) {
    if (server.id === this.active?.id) return;
    setActiveServer(server.id);
    window.location.href = '/'; // a fresh start: that server's session, workspaces and language
  }

  protected remove(server: Server) {
    removeServer(server.id);
    this.list = servers();
    this.active = activeServer();
  }

  protected async add() {
    this.busy.set(true);
    this.error.set(null);
    try {
      const server = await resolveServer(this.address);
      saveServer(server);
      this.switchTo(server);
    } catch (err) {
      this.error.set(this.i18n.t((err as Error).message));
    } finally {
      this.busy.set(false);
    }
  }
}
