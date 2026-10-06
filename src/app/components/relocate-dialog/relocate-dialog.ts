import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService, errorMessage } from '../../core/api.service';
import { TranslatePipe } from '../../core/i18n.pipes';
import { Project, RelocateSummary } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { WorkspaceStore } from '../../core/workspace.store';
import { Icon } from '../icon/icon';

type Members = 'involved' | 'all' | 'me';

/** Move a project to another workspace, or promote it to a workspace of its own, after a preview of what happens. */
@Component({
  selector: 'app-relocate-dialog',
  imports: [FormsModule, Icon, TranslatePipe],
  styleUrl: '../templates-dialog/templates-dialog.scss',
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <div class="backdrop" (click)="closed.emit()"></div>
    <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="reloc-title">
      <header>
        <h2 id="reloc-title">
          {{ (mode() === 'move' ? 'Move “{name}” to another workspace' : 'Promote “{name}” to a workspace') | t: { name: project().name } }}
        </h2>
        <button class="btn ghost icon" type="button" [attr.aria-label]="'Close' | t" (click)="closed.emit()">✕</button>
      </header>
      <div class="content edit">
        @if (mode() === 'move') {
          @if (targets().length) {
            <label>{{ 'Move to' | t }}
              <select [ngModel]="target()" (ngModelChange)="pickTarget($event)">
                <option [ngValue]="null" disabled>{{ '— choose —' | t }}</option>
                @for (w of targets(); track w.id) {
                  <option [ngValue]="w.id">{{ w.name }}</option>
                }
              </select>
            </label>
          } @else {
            <p class="muted">{{ 'You have no other workspace. Promote the project to a workspace of its own instead.' | t }}</p>
          }
        } @else {
          <label>{{ 'Workspace name' | t }} <input [(ngModel)]="name" maxlength="120" /></label>
          <fieldset class="people">
            <legend class="small muted">{{ 'Who comes along' | t }}</legend>
            <label class="radio"><input type="radio" name="members" [checked]="members() === 'involved'" (change)="members.set('involved')" />
              {{ 'People involved in the project ({n})' | t: { n: summary()?.people_by_choice?.involved ?? '…' } }}</label>
            <label class="radio"><input type="radio" name="members" [checked]="members() === 'all'" (change)="members.set('all')" />
              {{ 'Everyone in {ws} ({n})' | t: { ws: store.current()?.name, n: summary()?.people_by_choice?.all ?? '…' } }}</label>
            <label class="radio"><input type="radio" name="members" [checked]="members() === 'me'" (change)="members.set('me')" />
              {{ 'Only me' | t }}</label>
          </fieldset>
        }

        @if (summary(); as s) {
          <ul class="effects">
            <li><app-icon name="check" [size]="14" />
              {{ '{n} tasks ({open} open) and {t} time entries move with it.' | t: { n: s.tasks, open: s.open_tasks, t: s.time_entries } }}</li>
            @if (s.integrations) {
              <li><app-icon name="check" [size]="14" /> {{ 'Its {n} project integrations move with it.' | t: { n: s.integrations } }}</li>
            }
            @if (mode() === 'promote') {
              <li><app-icon name="check" [size]="14" /> {{ 'Statuses, priorities and billing rates are copied; invoice numbers start fresh.' | t }}</li>
            }
            @if (lostAssignees(s)) {
              <li class="warn"><app-icon name="alert" [size]="14" />
                {{ '{n} tasks are assigned to people who won\\'t be in the workspace: they become unassigned.' | t: { n: lostAssignees(s) } }}</li>
            }
            @if (s.dropped_links) {
              <li class="warn"><app-icon name="alert" [size]="14" />
                {{ '{n} tasks stop syncing with this workspace\\'s integrations (e.g. GitHub or Donetick).' | t: { n: s.dropped_links } }}</li>
            }
            @if (s.dropped_dependencies) {
              <li class="warn"><app-icon name="alert" [size]="14" />
                {{ '{n} dependencies on tasks that stay here are removed.' | t: { n: s.dropped_dependencies } }}</li>
            }
            @if (s.invoices_staying) {
              <li><app-icon name="billing" [size]="14" /> {{ '{n} invoices stay in this workspace.' | t: { n: s.invoices_staying } }}</li>
            }
          </ul>
        }

        <div class="actions">
          <span class="spacer"></span>
          <button class="btn" type="button" (click)="closed.emit()">{{ 'Cancel' | t }}</button>
          <button class="btn primary" type="button" [disabled]="busy() || !ready()" (click)="run()">
            {{ (busy() ? 'Working…' : mode() === 'move' ? 'Move project' : 'Create workspace') | t }}
          </button>
        </div>
      </div>
    </section>
  `,
  styles: `
    .people { border: 0; margin: 0; padding: 0; display: grid; gap: 6px; }
    .people legend { padding: 0; margin-bottom: 4px; }
    .people .radio { display: flex; align-items: center; gap: 8px; }
    .effects { list-style: none; margin: 0; padding: 10px 12px; background: var(--surface-2); border-radius: 10px; display: grid; gap: 6px; font-size: .88rem; }
    .effects li { display: flex; gap: 8px; align-items: baseline; }
    .effects app-icon { position: relative; top: 2px; color: var(--ok); }
    .effects .warn app-icon { color: var(--warn); }
  `,
})
export class RelocateDialog implements OnInit {
  readonly project = input.required<Project>();
  readonly mode = input<'move' | 'promote'>('move');
  /** The workspace the project ended up in. */
  readonly done = output<number>();
  readonly closed = output<void>();

  protected store = inject(WorkspaceStore);
  private api = inject(ApiService);
  private toast = inject(ToastService);

  protected name = '';
  protected members = signal<Members>('involved');
  protected target = signal<number | null>(null);
  protected summary = signal<RelocateSummary | null>(null);
  protected busy = signal(false);

  protected readonly targets = computed(() => this.store.workspaces().filter((w) => w.id !== this.store.currentId()));

  ngOnInit() {
    this.name = this.project().name;
    if (this.mode() === 'promote') this.preview();
  }

  protected ready() {
    return this.mode() === 'move' ? this.target() !== null : !!this.name.trim();
  }

  /** Tasks whose assignee won't be in the workspace afterwards. */
  protected lostAssignees(s: RelocateSummary) {
    if (this.mode() === 'move') return s.unassigned;
    return s.unassigned_by_choice?.[this.members()] ?? 0;
  }

  protected pickTarget(id: number) {
    this.target.set(id);
    this.summary.set(null);
    this.preview();
  }

  private async preview() {
    const ws = this.store.currentId()!;
    try {
      const s = this.mode() === 'move'
        ? await this.api.moveProject(ws, this.project().id, this.target()!, true)
        : await this.api.promoteProject(ws, this.project().id, { dry_run: true });
      this.summary.set(s);
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  protected async run() {
    const ws = this.store.currentId()!;
    this.busy.set(true);
    try {
      const res = this.mode() === 'move'
        ? await this.api.moveProject(ws, this.project().id, this.target()!)
        : await this.api.promoteProject(ws, this.project().id, { name: this.name.trim(), members: this.members() });
      this.done.emit(res.workspace!);
    } catch (err) {
      this.toast.error(errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}
