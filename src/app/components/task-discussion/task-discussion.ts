import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Comment } from '../../core/models';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-task-discussion',
  imports: [FormsModule, DatePipe],
  template: `
    <div class="thread">
      @for (c of comments(); track c.id) {
        <article class="comment">
          <span class="avatar">{{ initials(c) }}</span>
          <div class="bubble">
            <header>
              <strong>{{ authorName(c) }}</strong>
              @if (c.source === 'github') {
                <a class="via" [href]="c.external_url" target="_blank" rel="noopener" title="Synced with GitHub">via GitHub</a>
              }
              <time [title]="c.created_at | date: 'medium'">{{ c.created_at | date: 'MMM d, HH:mm' }}</time>
              @if (c.edited_at) {
                <span class="muted">· edited</span>
              }
              @if (c.source === 'flowly' && c.author?.id === me()) {
                <span class="tools">
                  <button type="button" class="link" (click)="startEdit(c)">Edit</button>
                  <button type="button" class="link danger" (click)="remove(c)">Delete</button>
                </span>
              }
            </header>
            @if (editing() === c.id) {
              <textarea [(ngModel)]="editBody" rows="3" (keydown)="editKey($event, c)"></textarea>
              <div class="row-actions">
                <button class="btn small primary" type="button" (click)="saveEdit(c)">Save</button>
                <button class="btn small ghost" type="button" (click)="editing.set(null)">Cancel</button>
              </div>
            } @else {
              <p class="body">{{ c.body }}</p>
            }
          </div>
        </article>
      } @empty {
        @if (!loading()) {
          <p class="empty">No messages yet. Start the discussion below.</p>
        }
      }
    </div>
    <form class="composer" (ngSubmit)="send()">
      <textarea name="body" [(ngModel)]="draft" rows="3" placeholder="Write a comment… (Ctrl+Enter to send)"
        (keydown)="composerKey($event)" aria-label="New comment"></textarea>
      <button class="btn primary" type="submit" [disabled]="busy() || !draft.trim()">Comment</button>
    </form>
  `,
  styleUrl: './task-discussion.scss',
})
export class TaskDiscussion implements OnInit {
  readonly wsId = input.required<number>();
  readonly taskId = input.required<number>();
  readonly changed = output<number>();

  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  protected comments = signal<Comment[]>([]);
  protected loading = signal(true);
  protected busy = signal(false);
  protected editing = signal<number | null>(null);
  protected draft = '';
  protected editBody = '';
  protected me = () => this.auth.user()?.id;

  async ngOnInit() {
    try {
      this.comments.set(await this.api.comments(this.wsId(), this.taskId()));
    } catch (err) {
      this.toast.error(errorMessage(err, 'Could not load the discussion.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected authorName(c: Comment): string {
    if (c.author) return c.author.full_name || c.author.email;
    return c.external_author ? `@${c.external_author}` : 'Someone';
  }

  protected initials(c: Comment): string {
    return this.authorName(c)
      .replace('@', '')
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]!.toUpperCase())
      .join('');
  }

  protected composerKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.send();
    }
  }

  protected editKey(e: KeyboardEvent, c: Comment) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.saveEdit(c);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      this.editing.set(null);
    }
  }

  async send() {
    const body = this.draft.trim();
    if (!body) return;
    this.busy.set(true);
    try {
      const c = await this.api.addComment(this.wsId(), this.taskId(), body);
      this.comments.update((l) => [...l, c]);
      this.draft = '';
      this.changed.emit(this.comments().length);
    } catch (err) {
      this.toast.error(errorMessage(err, 'Could not post the comment.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected startEdit(c: Comment) {
    this.editBody = c.body;
    this.editing.set(c.id);
  }

  async saveEdit(c: Comment) {
    try {
      const updated = await this.api.editComment(this.wsId(), this.taskId(), c.id, this.editBody);
      this.comments.update((l) => l.map((x) => (x.id === c.id ? updated : x)));
      this.editing.set(null);
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  async remove(c: Comment) {
    try {
      await this.api.deleteComment(this.wsId(), this.taskId(), c.id);
      this.comments.update((l) => l.filter((x) => x.id !== c.id));
      this.changed.emit(this.comments().length);
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }
}
