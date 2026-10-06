import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { Icon } from '../icon/icon';
import { FormsModule } from '@angular/forms';

import { ApiService, errorMessage } from '../../core/api.service';
import { Task, TaskShareEntry, VISIBILITIES, Visibility } from '../../core/models';
import { TranslatePipe } from '../../core/i18n.pipes';
import { I18nService } from '../../core/i18n.service';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-task-share',
  imports: [Icon, FormsModule, TranslatePipe],
  template: `
    <fieldset class="visibility">
      <legend>{{ 'Who can see this task' | t }}</legend>
      @for (v of visibilities; track v.value) {
        <label class="option" [class.on]="visibility() === v.value">
          <input type="radio" name="visibility" [checked]="visibility() === v.value" (change)="setVisibility(v.value)" />
          <span class="icon" aria-hidden="true"><app-icon [name]="v.icon" [size]="16" /></span>
          <span><strong>{{ v.label | t }}</strong><span class="muted help">{{ v.help | t }}</span></span>
        </label>
      }
    </fieldset>

    <div class="link">
      <label for="task-link">{{ 'Link' | t }}</label>
      <div class="copy-row">
        <input id="task-link" readonly [value]="link()" (focus)="$any($event.target).select()" />
        <button class="btn small" type="button" (click)="copy()">{{ 'Copy' | t }}</button>
      </div>
      <p class="muted small">{{ linkHelp() | t }}</p>
    </div>

    @if (visibility() === 'shareable' || visibility() === 'public' || shares().length) {
      <div class="people">
        <h3>{{ 'Shared with' | t }}</h3>
        @for (s of shares(); track s.id) {
          <div class="person">
            <span class="avatar">{{ (s.name || s.email)[0].toUpperCase() }}</span>
            <span class="grow">
              {{ s.name || s.email }}
              @if (s.name) {
                <span class="muted small">{{ s.email }}</span>
              }
              @if (!s.registered) {
                <span class="muted small">· {{ 'gets access when they sign up' | t }}</span>
              }
            </span>
            <button class="btn ghost small danger" type="button" (click)="remove(s)">{{ 'Remove' | t }}</button>
          </div>
        } @empty {
          <p class="muted small">{{ 'Nobody yet.' | t }}</p>
        }
        <form class="invite" (ngSubmit)="invite()">
          <input name="email" type="email" [(ngModel)]="email" placeholder="name@example.com" [attr.aria-label]="'Share with email' | t" />
          <button class="btn primary small" type="submit" [disabled]="!email.trim()">{{ 'Share' | t }}</button>
        </form>
      </div>
    }
  `,
  styleUrl: './task-share.scss',
})
export class TaskShare implements OnInit {
  readonly task = input.required<Task>();
  readonly changed = output<Visibility>();

  private api = inject(ApiService);
  private toast = inject(ToastService);
  private i18n = inject(I18nService);

  protected readonly visibilities = VISIBILITIES;
  protected visibility = signal<Visibility>('team');
  protected shares = signal<TaskShareEntry[]>([]);
  protected email = '';

  protected link = computed(() => `${window.location.origin}/t/${this.task().ref}`);
  protected linkHelp = computed(() => {
    switch (this.visibility()) {
      case 'private':
        return 'Only you and the assignee can open this link.';
      case 'team':
        return 'Workspace members can open this link after signing in.';
      case 'shareable':
        return 'Workspace members and the people below can open this link after signing in.';
      default:
        return 'Anyone with this link can view the task. Only the team can edit it.';
    }
  });

  async ngOnInit() {
    this.visibility.set(this.task().visibility);
    try {
      this.shares.set(await this.api.shares(this.task().workspace, this.task().id));
    } catch {}
  }

  async setVisibility(v: Visibility) {
    const previous = this.visibility();
    this.visibility.set(v);
    try {
      await this.api.updateTask(this.task().workspace, this.task().id, { visibility: v });
      this.changed.emit(v);
    } catch (err) {
      this.visibility.set(previous);
      this.toast.error(errorMessage(err));
    }
  }

  async invite() {
    const email = this.email.trim();
    if (!email) return;
    try {
      const share = await this.api.addShare(this.task().workspace, this.task().id, email);
      this.shares.update((l) => (l.some((s) => s.id === share.id) ? l : [...l, share]));
      this.email = '';
      if (this.visibility() === 'team' || this.visibility() === 'private') {
        this.visibility.set('shareable');
        this.changed.emit('shareable');
      }
      this.toast.show(
        this.i18n.t(share.registered ? 'Shared with {email}.' : '{email} will get access when they sign up.', { email }),
      );
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  async remove(s: TaskShareEntry) {
    try {
      await this.api.removeShare(this.task().workspace, this.task().id, s.id);
      this.shares.update((l) => l.filter((x) => x.id !== s.id));
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  protected copy() {
    const text = this.link();
    const done = () => this.toast.show(this.i18n.t('Link copied.'));
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done);
      return;
    }
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
    done();
  }
}
