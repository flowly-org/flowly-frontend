import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { Logo } from '../../components/logo/logo';
import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { formatLong } from '../../core/dates';
import { TaskLinkView, VISIBILITIES } from '../../core/models';
import { ToastService } from '../../core/toast.service';

/** /t/<ref>: members jump to the task on its board; shared and public viewers get a read-only page. */
@Component({
  selector: 'app-task-link-page',
  imports: [RouterLink, FormsModule, DatePipe, Logo],
  templateUrl: './task-link-page.html',
  styleUrl: './task-link-page.scss',
})
export class TaskLinkPage implements OnInit {
  readonly ref = input.required<string>();

  private api = inject(ApiService);
  private router = inject(Router);
  private toast = inject(ToastService);
  protected auth = inject(AuthService);

  protected view = signal<TaskLinkView | null>(null);
  protected state = signal<'loading' | 'ok' | 'signin' | 'missing'>('loading');
  protected draft = '';
  protected readonly formatLong = formatLong;

  async ngOnInit() {
    if (this.auth.hasSession && !this.auth.user()) await this.auth.loadMe();
    try {
      const view = await this.api.taskLink(this.ref());
      if (view.access === 'member' && view.workspace.id) {
        this.router.navigate(['/w', view.workspace.id, 'board'], { queryParams: { task: view.task.id }, replaceUrl: true });
        return;
      }
      this.view.set(view);
      this.state.set('ok');
    } catch (err) {
      this.state.set(err instanceof HttpErrorResponse && err.status === 401 ? 'signin' : 'missing');
    }
  }

  protected visibility(v: TaskLinkView) {
    return VISIBILITIES.find((x) => x.value === v.task.visibility)!;
  }

  async comment() {
    const body = this.draft.trim();
    if (!body) return;
    try {
      const c = await this.api.taskLinkComment(this.ref(), body);
      this.view.update((v) => (v ? { ...v, comments: [...v.comments, c] } : v));
      this.draft = '';
    } catch (err) {
      this.toast.error(errorMessage(err, 'Could not post the comment.'));
    }
  }

  async open(a: TaskLinkView['attachments'][number]) {
    if (a.url) {
      window.open(a.url, '_blank', 'noopener');
      return;
    }
    const tab = window.open('', '_blank');
    try {
      const { url } = await this.api.taskLinkAttachment(this.ref(), a.id);
      if (tab) tab.location.href = url;
    } catch {
      tab?.close();
    }
  }
}
