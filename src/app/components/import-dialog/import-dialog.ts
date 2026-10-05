import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService, errorMessage } from '../../core/api.service';
import { TranslatePipe } from '../../core/i18n.pipes';
import { I18nService } from '../../core/i18n.service';
import { Project } from '../../core/models';
import { ToastService } from '../../core/toast.service';

type Source = 'trello' | 'asana';

/** Import a Trello board (JSON export) or an Asana project (CSV export, or token + link) into the workspace. */
@Component({
  selector: 'app-import-dialog',
  imports: [FormsModule, TranslatePipe],
  templateUrl: './import-dialog.html',
  styleUrl: '../templates-dialog/templates-dialog.scss',
  host: { '(document:keydown.escape)': 'closed.emit()' },
})
export class ImportDialog {
  readonly workspace = input.required<number>();
  readonly projects = input<Project[]>([]);
  readonly imported = output<void>();
  readonly closed = output<void>();

  private api = inject(ApiService);
  private toast = inject(ToastService);
  private i18n = inject(I18nService);

  protected source = signal<Source>('trello');
  protected asanaMode = signal<'csv' | 'api'>('csv');
  protected file = signal<File | null>(null);
  protected token = '';
  protected link = '';
  protected projectId: number | null = null;
  protected busy = signal(false);
  protected result = signal<{ created: number; skipped: number; project_name: string } | null>(null);

  protected pick(event: Event) {
    const input = event.target as HTMLInputElement;
    this.file.set(input.files?.[0] ?? null);
  }

  protected ready(): boolean {
    if (this.source() === 'asana' && this.asanaMode() === 'api') return !!this.token.trim() && !!this.link.trim();
    return !!this.file();
  }

  protected async run() {
    this.busy.set(true);
    this.result.set(null);
    try {
      let res;
      if (this.source() === 'asana' && this.asanaMode() === 'api') {
        res = await this.api.importTasks(this.workspace(), { source: 'asana_api', token: this.token.trim(), project: this.link.trim(), project_id: this.projectId });
      } else {
        const form = new FormData();
        form.append('source', this.source() === 'trello' ? 'trello' : 'asana_csv');
        form.append('file', this.file()!);
        if (this.projectId) form.append('project_id', String(this.projectId));
        res = await this.api.importTasks(this.workspace(), form);
      }
      this.result.set(res);
      this.toast.show(this.i18n.t('{n} tasks imported into “{project}”.', { n: res.created, project: res.project_name }));
      this.imported.emit();
    } catch (err) {
      this.toast.error(errorMessage(err, this.i18n.t('The import failed.')));
    } finally {
      this.busy.set(false);
    }
  }
}
