import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { SharedTask } from '../../core/models';

@Component({
  selector: 'app-shared-page',
  imports: [RouterLink, DatePipe],
  template: `
    <div class="page">
      <header>
        <div>
          <h1>Shared with me</h1>
          <p class="muted">Tasks from other people's workspaces that were shared with you.</p>
        </div>
      </header>
      <section class="panel">
        @for (t of tasks(); track t.ref) {
          <a class="row shared" [routerLink]="['/t', t.ref]">
            <span class="grow">
              <strong [class.done]="t.status_done">{{ t.title }}</strong>
              <span class="muted small">{{ t.workspace }}{{ t.project ? ' / ' + t.project : '' }} · {{ t.status }}</span>
            </span>
            <span class="muted small">{{ t.updated_at | date: 'MMM d' }}</span>
          </a>
        } @empty {
          <p class="empty">{{ loaded() ? 'Nothing has been shared with you yet.' : 'Loading…' }}</p>
        }
      </section>
    </div>
  `,
  styles: `
    .shared { color: inherit; text-decoration: none; }
    .shared:hover { background: var(--surface-2); }
    .shared .grow { display: grid; gap: 2px; }
    .small { font-size: 0.82rem; }
    .done { text-decoration: line-through; color: var(--muted); }
  `,
})
export class SharedPage implements OnInit {
  private api = inject(ApiService);
  protected tasks = signal<SharedTask[]>([]);
  protected loaded = signal(false);

  async ngOnInit() {
    try {
      this.tasks.set(await this.api.sharedWithMe());
    } finally {
      this.loaded.set(true);
    }
  }
}
