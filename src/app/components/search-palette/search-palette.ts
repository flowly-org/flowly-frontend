import { Component, ElementRef, inject, output, signal, viewChild, AfterViewInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { formatShort } from '../../core/dates';
import { TranslatePipe } from '../../core/i18n.pipes';
import { SearchResult } from '../../core/models';
import { Icon } from '../icon/icon';

const ICONS: Record<SearchResult['type'], string> = { task: 'task', project: 'projects', template: 'template', wiki: 'wiki' };

/** Ctrl/⌘+K: search tasks (titles, notes, checklists, comments), projects, templates and wiki pages. */
@Component({
  selector: 'app-search-palette',
  imports: [FormsModule, TranslatePipe, Icon],
  template: `
    <div class="backdrop" (click)="closed.emit()"></div>
    <section class="palette" role="dialog" aria-modal="true" [attr.aria-label]="'Search' | t">
      <div class="field">
        <app-icon name="search" />
        <input #box [ngModel]="q()" (ngModelChange)="type($event)" (keydown)="key($event)" [placeholder]="'Search tasks, comments, projects, wiki…' | t"
          role="combobox" aria-autocomplete="list" [attr.aria-expanded]="results().length > 0" aria-controls="search-results" />
        <kbd>Esc</kbd>
      </div>
      <ul id="search-results" role="listbox">
        @for (r of results(); track r.type + r.id; let i = $index) {
          <li role="option" [attr.aria-selected]="i === active()" [class.active]="i === active()" (mouseenter)="active.set(i)" (click)="open(r)">
            <app-icon [name]="icons[r.type]" [size]="16" />
            <span class="main">
              <span class="title" [class.done]="r.done">{{ r.title }}</span>
              @if (r.snippet) {
                <span class="snippet">{{ r.snippet }}</span>
              }
            </span>
            <span class="where">{{ r.workspace_name }}@if (r.project) { · {{ r.project }} }@if (r.planned_date) { · {{ short(r.planned_date) }} }</span>
          </li>
        } @empty {
          @if (q().trim().length >= 2 && !loading()) {
            <li class="empty">{{ 'Nothing found.' | t }}</li>
          }
        }
      </ul>
    </section>
  `,
  styles: `
    :host { position: fixed; inset: 0; z-index: 200; display: flex; justify-content: center; align-items: flex-start; padding: 12vh 16px 16px; }
    .backdrop { position: absolute; inset: 0; background: rgb(0 0 0 / 30%); }
    .palette { position: relative; width: min(640px, 100%); background: var(--surface); border-radius: 14px; box-shadow: var(--shadow-lg); overflow: hidden; }
    .field { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--line); color: var(--muted); }
    .field input { flex: 1; border: 0; outline: 0; background: transparent; font-size: 1.05rem; color: var(--ink); padding: 4px 0; box-shadow: none; }
    kbd { font-size: .7rem; border: 1px solid var(--line); border-radius: 4px; padding: 1px 5px; }
    ul { list-style: none; margin: 0; padding: 6px; max-height: 60vh; overflow: auto; }
    li { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; cursor: pointer; color: var(--muted); }
    li.active { background: color-mix(in srgb, var(--brand, var(--accent)) 12%, transparent); color: var(--ink); }
    .main { flex: 1; min-width: 0; display: grid; }
    .title { color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .title.done { text-decoration: line-through; color: var(--muted); }
    .snippet { font-size: .8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .where { font-size: .75rem; white-space: nowrap; }
    .empty { cursor: default; justify-content: center; }
  `,
  host: { '(document:keydown.escape)': 'closed.emit()' },
})
export class SearchPalette implements AfterViewInit {
  readonly closed = output<void>();
  private api = inject(ApiService);
  private router = inject(Router);
  private box = viewChild<ElementRef<HTMLInputElement>>('box');
  protected readonly icons = ICONS;
  protected q = signal('');
  protected results = signal<SearchResult[]>([]);
  protected active = signal(0);
  protected loading = signal(false);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private seq = 0;

  ngAfterViewInit() {
    this.box()?.nativeElement.focus();
  }

  protected short(d: string) {
    return formatShort(d);
  }

  protected type(value: string) {
    this.q.set(value);
    if (this.timer) clearTimeout(this.timer);
    if (value.trim().length < 2) {
      this.results.set([]);
      return;
    }
    this.timer = setTimeout(async () => {
      const seq = ++this.seq;
      this.loading.set(true);
      try {
        const res = await this.api.search(value.trim());
        if (seq === this.seq) {
          this.results.set(res);
          this.active.set(0);
        }
      } catch {
      } finally {
        if (seq === this.seq) this.loading.set(false);
      }
    }, 200);
  }

  protected key(e: KeyboardEvent) {
    const n = this.results().length;
    if (e.key === 'ArrowDown' && n) {
      e.preventDefault();
      this.active.set((this.active() + 1) % n);
    } else if (e.key === 'ArrowUp' && n) {
      e.preventDefault();
      this.active.set((this.active() - 1 + n) % n);
    } else if (e.key === 'Enter' && n) {
      e.preventDefault();
      this.open(this.results()[this.active()]);
    }
  }

  protected open(r: SearchResult) {
    this.closed.emit();
    if (r.type === 'task') this.router.navigate(['/w', r.workspace, 'board'], { queryParams: { task: r.id } });
    if (r.type === 'project') this.router.navigate(['/w', r.workspace, 'projects']);
    if (r.type === 'template') this.router.navigate(['/w', r.workspace, 'board'], { queryParams: { templates: 1 } });
    if (r.type === 'wiki' && r.url) window.open(r.url, '_blank', 'noopener');
  }
}
