import { Component, OnInit, inject, signal } from '@angular/core';

import { ApiService } from '../../core/api.service';
import { FloService } from '../../core/flo.service';
import { TranslatePipe } from '../../core/i18n.pipes';
import { Icon } from '../icon/icon';

const DISMISSED = 'flowly.brief.dismissed';

/** Flo's morning brief at the top of My day, once a day (written on the first visit if it isn't there yet). */
@Component({
  selector: 'app-flo-brief',
  imports: [Icon, TranslatePipe],
  template: `
    @if (visible()) {
      <section class="brief" [attr.aria-label]="'Morning brief' | t">
        <span class="avatar" aria-hidden="true"><app-icon name="bot" [size]="18" /></span>
        <div class="body">
          @if (text(); as t) {
            <p class="text" [class.open]="expanded()">{{ t }}</p>
            <div class="actions">
              @if (long()) {
                <button type="button" class="btn ghost small" (click)="expanded.set(!expanded())">{{ (expanded() ? 'Show less' : 'Show all') | t }}</button>
              }
              <button type="button" class="btn small" (click)="flo.open.set(true)">{{ 'Ask Flo' | t }}</button>
            </div>
          } @else {
            <p class="muted">{{ 'Flo is writing your morning brief…' | t }}</p>
          }
        </div>
        <button type="button" class="btn ghost icon" [attr.aria-label]="'Hide until tomorrow' | t" [title]="'Hide until tomorrow' | t" (click)="dismiss()">✕</button>
      </section>
    }
  `,
  styles: `
    .brief { display: flex; gap: 12px; align-items: flex-start; margin: 12px 16px 0; padding: 12px 14px; background: var(--surface);
      border: 1px solid var(--line); border-left: 3px solid var(--brand, var(--accent)); border-radius: 12px; }
    .avatar { flex: none; width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center;
      color: var(--brand, var(--accent)); background: color-mix(in srgb, var(--brand, var(--accent)) 14%, transparent); }
    .body { flex: 1; min-width: 0; }
    .text { margin: 0; white-space: pre-line; line-height: 1.5; font-size: .9rem; max-height: 4.5em; overflow: hidden;
      mask-image: linear-gradient(#000 60%, transparent); }
    .text.open { max-height: none; mask-image: none; }
    .muted { margin: 6px 0; }
    .actions { display: flex; gap: 6px; margin-top: 6px; }
  `,
})
export class FloBrief implements OnInit {
  protected flo = inject(FloService);
  private api = inject(ApiService);

  protected visible = signal(false);
  protected text = signal<string | null>(null);
  protected expanded = signal(false);
  protected long = signal(false);
  private day = '';

  async ngOnInit() {
    try {
      const today = await this.api.floBriefToday();
      this.day = today.date;
      if (!today.available || read(DISMISSED) === today.date) return;
      this.visible.set(true);
      const text = today.brief ?? (await this.api.conciergeBrief(false)).brief;
      this.text.set(text);
      this.long.set(text.split('\n').length > 3 || text.length > 260);
    } catch {
      this.visible.set(false);
    }
  }

  protected dismiss() {
    this.visible.set(false);
    try {
      localStorage.setItem(DISMISSED, this.day);
    } catch {
      /* private mode: it just comes back next visit */
    }
  }
}

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
