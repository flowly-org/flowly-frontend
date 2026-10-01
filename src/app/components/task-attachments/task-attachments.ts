import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { pickFromGoogleDrive, pickFromOneDrive } from '../../core/cloud-pickers';
import { Attachment, PublicConfig } from '../../core/models';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-task-attachments',
  imports: [FormsModule, DatePipe],
  templateUrl: './task-attachments.html',
  styleUrl: './task-attachments.scss',
})
export class TaskAttachments implements OnInit {
  readonly wsId = input.required<number>();
  readonly taskId = input.required<number>();
  readonly changed = output<number>();

  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  protected items = signal<Attachment[]>([]);
  protected config = signal<PublicConfig | null>(null);
  protected uploading = signal(0);
  protected dragOver = signal(false);
  protected showLinkForm = signal(false);
  protected confirming = signal<number | null>(null);
  protected linkUrl = '';
  protected linkName = '';

  async ngOnInit() {
    try {
      const [items, config] = await Promise.all([this.api.attachments(this.wsId(), this.taskId()), this.api.publicConfig()]);
      this.items.set(items);
      this.config.set(config);
    } catch (err) {
      this.toast.error(errorMessage(err, 'Could not load attachments.'));
    }
  }

  protected icon(a: Attachment): string {
    if (a.kind === 'google_drive') return 'G';
    if (a.kind === 'onedrive') return '☁';
    if (a.kind === 'link') return '🔗';
    const t = a.content_type;
    if (t.startsWith('image/')) return '🖼';
    if (t === 'application/pdf') return 'PDF';
    if (t.includes('sheet') || t.includes('excel') || t.includes('csv')) return '▦';
    return '📄';
  }

  protected size(bytes: number | null): string {
    if (bytes === null) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  protected canRemove(a: Attachment): boolean {
    return a.added_by?.id === this.auth.user()?.id;
  }

  async open(a: Attachment) {
    if (a.kind !== 'file') {
      window.open(a.url, '_blank', 'noopener');
      return;
    }
    // Open the tab synchronously (popup blockers), then point it at the short-lived signed URL.
    const tab = window.open('', '_blank');
    try {
      const { url } = await this.api.attachmentUrl(this.wsId(), this.taskId(), a.id);
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch (err) {
      tab?.close();
      this.toast.error(errorMessage(err, 'Could not open the file.'));
    }
  }

  protected onFiles(list: FileList | null) {
    if (list) this.upload([...list]);
  }

  protected onDrop(e: DragEvent) {
    e.preventDefault();
    this.dragOver.set(false);
    if (this.config()?.uploads.enabled && e.dataTransfer?.files.length) this.upload([...e.dataTransfer.files]);
  }

  private async upload(files: File[]) {
    const max = (this.config()?.uploads.max_mb ?? 25) * 1024 * 1024;
    for (const file of files) {
      if (file.size > max) {
        this.toast.error(`${file.name} is larger than ${this.config()?.uploads.max_mb} MB.`);
        continue;
      }
      this.uploading.update((n) => n + 1);
      try {
        const a = await this.api.uploadAttachment(this.wsId(), this.taskId(), file);
        this.items.update((l) => [...l, a]);
        this.changed.emit(this.items().length);
      } catch (err) {
        this.toast.error(errorMessage(err, `Could not upload ${file.name}.`));
      } finally {
        this.uploading.update((n) => n - 1);
      }
    }
  }

  async addLink() {
    const url = this.linkUrl.trim();
    if (!url) return;
    await this.add([{ kind: 'link', url, name: this.linkName.trim(), meta: {} }]);
    this.linkUrl = '';
    this.linkName = '';
    this.showLinkForm.set(false);
  }

  async fromGoogle() {
    const cfg = this.config()?.google;
    if (!cfg) return;
    try {
      await this.add(await pickFromGoogleDrive(cfg));
    } catch (err) {
      this.toast.error(err instanceof Error ? err.message : 'Google Drive picker failed.');
    }
  }

  async fromOneDrive() {
    const cfg = this.config()?.microsoft;
    if (!cfg) return;
    try {
      await this.add(await pickFromOneDrive(cfg));
    } catch (err) {
      this.toast.error(err instanceof Error ? err.message : 'OneDrive picker failed.');
    }
  }

  private async add(list: Partial<Attachment>[]) {
    for (const data of list) {
      try {
        const a = await this.api.addAttachment(this.wsId(), this.taskId(), data);
        this.items.update((l) => [...l, a]);
      } catch (err) {
        this.toast.error(errorMessage(err, 'Could not attach that.'));
      }
    }
    this.changed.emit(this.items().length);
  }

  async remove(a: Attachment) {
    this.confirming.set(null);
    try {
      await this.api.deleteAttachment(this.wsId(), this.taskId(), a.id);
      this.items.update((l) => l.filter((x) => x.id !== a.id));
      this.changed.emit(this.items().length);
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }
}
