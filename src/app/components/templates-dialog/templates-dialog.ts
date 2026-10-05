import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService, errorMessage } from '../../core/api.service';
import { BoardData } from '../../core/board-data';
import { TranslatePipe } from '../../core/i18n.pipes';
import { I18nService } from '../../core/i18n.service';
import { Task, TaskTemplate } from '../../core/models';
import { ToastService } from '../../core/toast.service';

/** Task templates of a workspace: use one (dated from a start day), write or edit one, or save the day's tasks as one. */
@Component({
  selector: 'app-templates-dialog',
  imports: [FormsModule, TranslatePipe],
  templateUrl: './templates-dialog.html',
  styleUrl: './templates-dialog.scss',
  host: { '(document:keydown.escape)': 'closed.emit()' },
})
export class TemplatesDialog implements OnInit {
  readonly workspace = input.required<number | null>();
  readonly day = input.required<string>();
  /** Tasks on the board now (to save them as a template). */
  readonly tasks = input<Task[]>([]);
  readonly created = output<Task[]>();
  readonly closed = output<void>();

  protected data = inject(BoardData);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private i18n = inject(I18nService);

  protected wsId = signal<number | null>(null);
  protected templates = signal<TaskTemplate[]>([]);
  protected editing = signal<Partial<TaskTemplate> | null>(null);
  protected using = signal<{ tpl: TaskTemplate; start: string; project: number | null } | null>(null);
  protected busy = signal(false);
  protected readonly projects = computed(() => this.data.ctx(this.wsId() ?? 0)?.projects.filter((p) => !p.archived) ?? []);
  protected readonly dayTasks = computed(() => this.tasks().filter((t) => t.workspace === this.wsId()));

  ngOnInit() {
    this.wsId.set(this.workspace() ?? this.data.contexts()[0]?.id ?? null);
    this.load();
  }

  protected async load() {
    const ws = this.wsId();
    if (ws === null) return;
    try {
      this.templates.set(await this.api.templates(ws));
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  protected switchWorkspace(id: number) {
    this.wsId.set(id);
    this.editing.set(null);
    this.using.set(null);
    this.load();
  }

  protected newTemplate() {
    this.editing.set({ name: '', description: '', body: '- \n', project: null });
  }

  protected async save() {
    const e = this.editing();
    const ws = this.wsId();
    if (!e || ws === null) return;
    this.busy.set(true);
    try {
      await this.api.saveTemplate(ws, e);
      this.editing.set(null);
      await this.load();
    } catch (err) {
      this.toast.error(errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(tpl: TaskTemplate) {
    const ws = this.wsId();
    if (ws === null) return;
    try {
      await this.api.deleteTemplate(ws, tpl.id);
      this.editing.set(null);
      await this.load();
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  protected async saveDay() {
    const ws = this.wsId();
    if (ws === null || !this.dayTasks().length) return;
    this.busy.set(true);
    try {
      const tpl = await this.api.templateFromTasks(ws, this.i18n.t('Tasks of {date}', { date: this.day() }), this.dayTasks().map((t) => t.id));
      await this.load();
      this.editing.set(tpl);
    } catch (err) {
      this.toast.error(errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }

  protected async apply() {
    const u = this.using();
    const ws = this.wsId();
    if (!u || ws === null) return;
    this.busy.set(true);
    try {
      const tasks = await this.api.applyTemplate(ws, u.tpl.id, { start: u.start, project: u.project });
      this.toast.show(this.i18n.t('{n} tasks created from “{name}”.', { n: tasks.length, name: u.tpl.name }));
      this.created.emit(tasks);
    } catch (err) {
      this.toast.error(errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}
