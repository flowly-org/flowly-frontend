import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { AdminUser, InstanceSettingRow } from '../../core/models';
import { ToastService } from '../../core/toast.service';

const GROUP_CHECKS: Record<string, { service: string; label: string }> = {
  AI: { service: 'openrouter', label: 'Test OpenRouter' },
  Telegram: { service: 'telegram', label: 'Test bot' },
  Storage: { service: 's3', label: 'Test bucket' },
};

@Component({
  selector: 'app-manage-page',
  imports: [FormsModule, DatePipe, DecimalPipe],
  templateUrl: './manage-page.html',
  styleUrl: './manage-page.scss',
})
export class ManagePage implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected auth = inject(AuthService);

  protected tab = signal<'overview' | 'users' | 'settings' | 'github'>('overview');
  protected gh = signal<Record<string, any> | null>(null);
  protected ghForm: Record<string, string> = {};
  protected ghManual = signal(false);
  protected ghConfirmRemove = signal(false);
  protected ghAppName = 'Flowly';
  protected ghOrg = '';
  protected overview = signal<Record<string, any> | null>(null);
  protected rows = signal<InstanceSettingRow[]>([]);
  protected users = signal<AdminUser[]>([]);
  protected userQuery = '';
  /** Unsaved edits per setting key. */
  protected drafts: Record<string, any> = {};
  protected checks = signal<Record<string, { ok: boolean; message: string } | 'running'>>({});
  protected readonly groupChecks = GROUP_CHECKS;

  protected readonly groups = computed(() => {
    const out: { name: string; rows: InstanceSettingRow[] }[] = [];
    for (const row of this.rows()) {
      let group = out.find((g) => g.name === row.group);
      if (!group) out.push((group = { name: row.group, rows: [] }));
      group.rows.push(row);
    }
    return out;
  });

  async ngOnInit() {
    await Promise.all([this.loadOverview(), this.loadSettings(), this.loadUsers(), this.loadGithub()]);
  }

  async loadGithub() {
    try {
      this.gh.set(await this.api.adminGithubApp());
    } catch {}
  }

  async saveGithub() {
    const data = Object.fromEntries(Object.entries(this.ghForm).filter(([, v]) => v && String(v).trim()));
    try {
      this.gh.set(await this.api.saveAdminGithubApp(data));
      this.ghForm = {};
      this.ghManual.set(false);
      this.toast.show('GitHub App connected and verified.');
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  async removeGithub() {
    this.ghConfirmRemove.set(false);
    try {
      await this.api.deleteAdminGithubApp();
      await this.loadGithub();
      this.toast.show('GitHub App disconnected.');
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  /** Same manifest flow as on the Integrations page; GitHub sends us back here. */
  async createGithubApp() {
    try {
      const { action, manifest } = await this.api.githubManifest(this.ghAppName, this.ghOrg);
      try {
        localStorage.setItem('flowly.githubReturn', '/manage');
      } catch {}
      const form = document.createElement('form');
      form.method = 'post';
      form.action = action;
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'manifest';
      input.value = manifest;
      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  protected copy(text: string) {
    navigator.clipboard?.writeText(text).then(
      () => this.toast.show('Copied.'),
      () => this.toast.show(text),
    );
  }

  private async loadOverview() {
    try {
      this.overview.set(await this.api.adminOverview());
    } catch {}
  }

  private async loadSettings() {
    try {
      this.rows.set(await this.api.adminSettings());
      this.drafts = {};
      for (const r of this.rows()) this.drafts[r.key] = r.secret ? '' : r.value;
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  async loadUsers() {
    try {
      this.users.set(await this.api.adminUsers(this.userQuery.trim()));
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  protected dirty(group: { rows: InstanceSettingRow[] }): boolean {
    return group.rows.some((r) => this.changed(r));
  }

  private changed(r: InstanceSettingRow): boolean {
    const d = this.drafts[r.key];
    return r.secret ? !!d : String(d ?? '') !== String(r.value ?? '');
  }

  async saveGroup(group: { rows: InstanceSettingRow[] }) {
    const values: Record<string, unknown> = {};
    for (const r of group.rows) if (this.changed(r)) values[r.key] = this.drafts[r.key];
    try {
      this.rows.set(await this.api.updateAdminSettings(values));
      for (const r of group.rows) this.drafts[r.key] = r.secret ? '' : this.rows().find((x) => x.key === r.key)!.value;
      this.toast.show('Settings saved.');
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  async reset(r: InstanceSettingRow) {
    try {
      this.rows.set(await this.api.updateAdminSettings({ [r.key]: null }));
      const fresh = this.rows().find((x) => x.key === r.key)!;
      this.drafts[r.key] = r.secret ? '' : fresh.value;
      this.toast.show(`${r.label} reverted to the server default.`);
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  async check(service: string) {
    this.checks.update((c) => ({ ...c, [service]: 'running' }));
    try {
      const res = await this.api.adminCheck(service);
      this.checks.update((c) => ({ ...c, [service]: res }));
    } catch (err) {
      this.checks.update((c) => ({ ...c, [service]: { ok: false, message: errorMessage(err) } }));
    }
  }

  protected checkResult(service: string) {
    const c = this.checks()[service];
    return c === 'running' ? null : (c ?? null);
  }

  async setWebhook(enable: boolean) {
    try {
      const res = await this.api.adminTelegramWebhook(enable);
      this.toast.show(res.mode === 'webhook' ? `Webhook active: ${res.webhook}` : 'Switched to polling.');
      await this.loadSettings();
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  protected telegramMode(): string {
    return String(this.rows().find((r) => r.key === 'TELEGRAM_MODE')?.value ?? 'polling');
  }

  async updateUser(u: AdminUser, data: Partial<AdminUser>) {
    try {
      const fresh = await this.api.updateAdminUser(u.id, data);
      this.users.update((list) => list.map((x) => (x.id === u.id ? fresh : x)));
      this.toast.show(`${u.email} updated.`);
      this.loadOverview();
    } catch (err) {
      this.toast.error(errorMessage(err));
      await this.loadUsers();
    }
  }
}
