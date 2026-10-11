import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService, errorMessage } from '../../core/api.service';
import { TranslatePipe } from '../../core/i18n.pipes';
import { Attribute } from '../../core/models';
import { ToastService } from '../../core/toast.service';

/** Custom attributes of a workspace (project = null) or of one project, with the workspace's ones it inherits. */
@Component({
  selector: 'app-attribute-editor',
  imports: [FormsModule, TranslatePipe],
  template: `
    <p class="small muted hint">{{ 'Facts Flo should know when it works here: a client\\'s email, the contract terms, the tone to use, the repository. In a task, write the name in double braces to insert the value, or with @ to point Flo at it.' | t }}</p>
    <div class="list">
      @for (a of own(); track a.id) {
        <div class="attr">
          <div class="key"><code>{{ placeholder(a.key) }}</code> <code class="at">{{ '@' + a.key }}</code></div>
          @if (canEdit()) {
            <textarea rows="2" [(ngModel)]="a.value" [name]="'v' + a.id" [attr.aria-label]="a.key"></textarea>
            <div class="row-actions">
              <button class="btn small" type="button" [disabled]="busy()" (click)="update(a)">{{ 'Save' | t }}</button>
              <button class="btn ghost danger small" type="button" [disabled]="busy()" (click)="remove(a)">{{ 'Delete' | t }}</button>
            </div>
          } @else {
            <p class="value">{{ a.value }}</p>
          }
        </div>
      }
      @for (a of inherited(); track a.id) {
        <div class="attr inherited">
          <div class="key"><code>{{ placeholder(a.key) }}</code> <span class="small muted">{{ 'from the workspace' | t }}</span></div>
          <p class="value">{{ a.value }}</p>
          @if (canEdit()) {
            <div class="row-actions"><button class="btn ghost small" type="button" (click)="override(a)">{{ 'Override for this project' | t }}</button></div>
          }
        </div>
      }
      @if (!own().length && !inherited().length) {
        <p class="small muted">{{ 'No attributes yet.' | t }}</p>
      }
    </div>
    @if (canEdit()) {
      <form class="add" (ngSubmit)="add()">
        <input name="key" [(ngModel)]="draftKey" [placeholder]="'name, e.g. client_email' | t" [attr.aria-label]="'Attribute name' | t" autocomplete="off" />
        <textarea name="value" rows="2" [(ngModel)]="draftValue" [placeholder]="'Value' | t" [attr.aria-label]="'Value' | t"></textarea>
        <button class="btn primary small" type="submit" [disabled]="busy() || !draftKey.trim()">{{ 'Add attribute' | t }}</button>
      </form>
    }
  `,
  styles: `
    :host { display: block; }
    .hint { margin: 0 0 10px; }
    .list { display: grid; gap: 8px; margin-bottom: 10px; }
    .attr { border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; display: grid; gap: 6px; }
    .attr.inherited { background: var(--surface-2); }
    .key { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    code { font-size: .8rem; padding: 1px 6px; border-radius: 6px; background: var(--surface-2); }
    code.at { color: var(--accent); }
    .value { margin: 0; white-space: pre-line; font-size: .88rem; }
    .row-actions { display: flex; gap: 6px; justify-content: flex-end; }
    .add { display: grid; grid-template-columns: minmax(140px, 1fr) 2fr auto; gap: 8px; align-items: start; }
    @media (max-width: 640px) { .add { grid-template-columns: 1fr; } }
  `,
})
export class AttributeEditor implements OnInit {
  readonly workspace = input.required<number>();
  readonly project = input<number | null>(null);
  readonly canEdit = input(false);

  private api = inject(ApiService);
  private toast = inject(ToastService);

  protected all = signal<Attribute[]>([]);
  protected busy = signal(false);
  protected draftKey = '';
  protected draftValue = '';

  protected readonly own = computed(() => this.all().filter((a) => a.project === this.project()));
  /** Workspace attributes a project uses unless it overrides them. */
  protected readonly inherited = computed(() => {
    if (this.project() === null) return [];
    const mine = new Set(this.own().map((a) => a.key));
    return this.all().filter((a) => a.project === null && !mine.has(a.key));
  });

  async ngOnInit() {
    await this.load();
  }

  protected placeholder(key: string) {
    return '{' + '{' + key + '}' + '}';
  }

  private async load() {
    try {
      const list = await this.api.attributes(this.workspace());
      this.all.set(list.filter((a) => a.project === null || a.project === this.project()));
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  private async run(work: () => Promise<unknown>) {
    this.busy.set(true);
    try {
      await work();
      await this.load();
    } catch (err) {
      this.toast.error(errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }

  protected add() {
    this.run(async () => {
      await this.api.saveAttribute(this.workspace(), { key: this.draftKey.trim(), value: this.draftValue, project: this.project() });
      this.draftKey = '';
      this.draftValue = '';
    });
  }

  protected update(a: Attribute) {
    this.run(() => this.api.saveAttribute(this.workspace(), { id: a.id, value: a.value }));
  }

  protected remove(a: Attribute) {
    this.run(() => this.api.deleteAttribute(this.workspace(), a.id));
  }

  protected override(a: Attribute) {
    this.draftKey = a.key;
    this.draftValue = a.value;
  }
}
