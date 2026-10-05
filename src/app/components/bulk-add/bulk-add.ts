import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { BoardData } from '../../core/board-data';
import { formatShort } from '../../core/dates';
import { TranslatePipe } from '../../core/i18n.pipes';
import { I18nService } from '../../core/i18n.service';
import { Task, TaskInput } from '../../core/models';
import { shrinkPhoto as shrink } from '../../core/photo';
import { parseList } from './bulk-parse';

@Component({
  selector: 'app-bulk-add',
  imports: [FormsModule, TranslatePipe],
  templateUrl: './bulk-add.html',
  styleUrl: './bulk-add.scss',
  host: { '(document:keydown.escape)': 'closed.emit()' },
})
export class BulkAdd implements OnInit {
  /** Day the tasks are planned for unless a line says otherwise; null = backlog. */
  readonly day = input<string | null>(null);
  readonly workspace = input<number | null>(null);
  readonly project = input<number | null>(null);

  readonly created = output<Task[]>();
  readonly closed = output<void>();

  protected data = inject(BoardData);

  protected i18n = inject(I18nService);
  private api = inject(ApiService);
  private auth = inject(AuthService);

  protected wsId = signal(0);
  protected projectId = signal<number | null>(null);
  protected planned = signal<'day' | 'backlog'>('day');
  protected assignToMe = signal(true);
  protected text = signal('');
  protected busy = signal(false);
  /** Reading a photo: its preview URL while the model works. */
  protected reading = signal<string | null>(null);
  protected fromPhoto = signal(false);
  /** Meeting notes / transcript being turned into action items. */
  protected notes = signal<{ text: string; busy: boolean } | null>(null);
  protected fromNotes = signal(false);
  protected error = signal<string | null>(null);

  protected ctx = computed(() => this.data.ctx(this.wsId()));
  protected drafts = computed(() => parseList(this.text(), this.ctx(), this.day() ?? new Date().toISOString().slice(0, 10)));
  protected readonly formatShort = formatShort;

  ngOnInit() {
    this.wsId.set(this.workspace() ?? this.data.contexts()[0]?.id ?? 0);
    this.projectId.set(this.project());
    if (this.day() === null) this.planned.set('backlog');
  }

  protected dateLabel(d: string | null | undefined): string {
    this.i18n.lang();
    if (d === undefined) return this.planned() === 'backlog' || !this.day() ? this.i18n.t('Backlog') : formatShort(this.day()!);
    return d === null ? this.i18n.t('Backlog') : formatShort(d);
  }

  protected changeWorkspace(id: number) {
    this.wsId.set(id);
    this.projectId.set(null);
  }

  protected async onPhoto(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.error.set(null);
    const preview = URL.createObjectURL(file);
    this.reading.set(preview);
    try {
      const image = await shrink(file);
      const { text } = await this.api.tasksFromPhoto(this.wsId(), image);
      const current = this.text().trim();
      this.text.set(current ? `${current}\n${text}` : text);
      this.fromPhoto.set(true);
    } catch (err) {
      this.error.set(errorMessage(err, this.i18n.t('Could not read the photo.')));
    } finally {
      URL.revokeObjectURL(preview);
      this.reading.set(null);
    }
  }

  protected async onNotesFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      this.error.set(this.i18n.t('That file is too large (max 2 MB).'));
      return;
    }
    let text = await file.text();
    // Subtitles (.vtt, .srt): keep the spoken lines only.
    if (/\.(vtt|srt)$/i.test(file.name)) {
      text = text.split(/\r?\n/).filter((l) => l.trim() && !/^(WEBVTT|\d+$|\d{2}:\d{2})/.test(l.trim()) && !l.includes('-->')).join('\n');
    }
    this.notes.set({ text, busy: false });
  }

  protected async readNotes() {
    const n = this.notes();
    if (!n || n.text.trim().length < 20) return;
    this.notes.set({ ...n, busy: true });
    this.error.set(null);
    try {
      const { text } = await this.api.tasksFromNotes(this.wsId(), n.text);
      const current = this.text().trim();
      this.text.set(current ? `${current}\n${text}` : text);
      this.fromNotes.set(true);
      this.assignToMe.set(false);
      this.notes.set(null);
    } catch (err) {
      this.error.set(errorMessage(err, this.i18n.t('Could not read the notes.')));
      this.notes.set({ ...n, busy: false });
    }
  }

  async create() {
    const drafts = this.drafts();
    if (!drafts.length) return;
    const statuses = this.data.statuses(this.wsId());
    const done = statuses.find((s) => s.is_done)?.id;
    const defaultDate = this.planned() === 'backlog' ? null : this.day();
    const me = this.auth.user()?.id ?? null;
    const payload: TaskInput[] = drafts.map((d) => ({
      title: d.title.slice(0, 255),
      description: d.notes,
      project: d.project?.id ?? this.projectId(),
      priority: d.priority?.id ?? null,
      tags: d.tags.map((t) => t.id),
      planned_date: d.date === undefined ? defaultDate : d.date,
      ...(d.estimate ? { estimate_minutes: d.estimate } : {}),
      ...(d.checklist.length ? { checklist: d.checklist } : {}),
      assignee: d.assignee ?? (this.assignToMe() ? me : null),
      ...(d.done && done ? { status: done } : {}),
    }));
    this.busy.set(true);
    this.error.set(null);
    try {
      this.created.emit(await this.api.bulkCreateTasks(this.wsId(), payload));
    } catch (err) {
      this.error.set(errorMessage(err, this.i18n.t('Could not create the tasks.')));
    } finally {
      this.busy.set(false);
    }
  }
}

