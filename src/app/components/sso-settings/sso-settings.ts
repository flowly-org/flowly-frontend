import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { LocalDatePipe, TranslatePipe } from '../../core/i18n.pipes';
import { I18nService } from '../../core/i18n.service';
import { SsoSetup } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { Icon } from '../icon/icon';

interface Preset {
  key: string;
  label: string;
  issuer: string;
  hint: string;
}

const PRESETS: Preset[] = [
  { key: 'google', label: 'Google Workspace', issuer: 'https://accounts.google.com',
    hint: 'Google Cloud console → APIs & Services → Credentials → Create OAuth client ID (Web application). Add the redirect URI below.' },
  { key: 'entra', label: 'Microsoft Entra ID', issuer: 'https://login.microsoftonline.com/<tenant-id>/v2.0',
    hint: 'Entra admin center → App registrations → New registration (Web, redirect URI below). Create a client secret under Certificates & secrets; replace <tenant-id> with your Directory (tenant) ID.' },
  { key: 'okta', label: 'Okta', issuer: 'https://<your-org>.okta.com',
    hint: 'Okta admin → Applications → Create App Integration → OIDC, Web Application. Sign-in redirect URI: the one below.' },
  { key: 'other', label: 'Other OpenID Connect', issuer: 'https://',
    hint: 'Keycloak, Authentik, JumpCloud, Auth0…: create a confidential OIDC client with the redirect URI below and the openid, email and profile scopes.' },
];

/** Single sign-on for an Enterprise workspace: the OIDC provider, the email domains it vouches for, test and enforce. */
@Component({
  selector: 'app-sso-settings',
  imports: [FormsModule, Icon, TranslatePipe, LocalDatePipe],
  templateUrl: './sso-settings.html',
  styleUrl: './sso-settings.scss',
})
export class SsoSettings implements OnInit {
  readonly workspace = input.required<number>();

  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private i18n = inject(I18nService);

  protected readonly presets = PRESETS;
  protected setup = signal<SsoSetup | null>(null);
  protected busy = signal(false);
  protected preset = 'google';
  protected form = { issuer: '', client_id: '', client_secret: '', label: '' };
  protected newDomain = '';
  protected confirmingRemove = signal(false);

  protected readonly conn = computed(() => this.setup()?.connection ?? null);
  protected readonly hasVerified = computed(() => !!this.conn()?.domains.some((d) => d.verified));

  async ngOnInit() {
    try {
      this.load(await this.api.sso(this.workspace()));
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  private load(setup: SsoSetup) {
    this.setup.set(setup);
    const c = setup.connection;
    if (c) {
      this.form = { issuer: c.issuer, client_id: c.client_id, client_secret: '', label: c.label };
      this.preset = PRESETS.find((p) => p.key !== 'other' && c.issuer.startsWith(p.issuer.split('<')[0]))?.key ?? 'other';
    } else {
      this.form.issuer = PRESETS[0].issuer;
    }
  }

  protected hint() {
    return PRESETS.find((p) => p.key === this.preset)?.hint ?? '';
  }

  protected pickPreset(key: string) {
    this.preset = key;
    const p = PRESETS.find((x) => x.key === key)!;
    if (!this.conn() || !this.form.issuer || PRESETS.some((x) => x.issuer === this.form.issuer)) this.form.issuer = p.issuer;
  }

  private async run(work: () => Promise<SsoSetup>, done?: string) {
    this.busy.set(true);
    try {
      this.load(await work());
      if (done) this.toast.show(this.i18n.t(done));
    } catch (err) {
      this.toast.error(errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }

  protected save() {
    const { client_secret, ...rest } = this.form;
    this.run(() => this.api.saveSso(this.workspace(), { ...rest, ...(client_secret.trim() ? { client_secret: client_secret.trim() } : {}) }), 'Saved.');
  }

  protected toggle(field: 'enabled' | 'required' | 'auto_join', value: boolean) {
    const patch: Record<string, boolean> = { [field]: value };
    if (field === 'enabled' && !value) patch['required'] = false;
    this.run(() => this.api.saveSso(this.workspace(), patch));
  }

  protected addDomain() {
    const domain = this.newDomain.trim();
    if (!domain) return;
    this.run(async () => {
      const res = await this.api.ssoDomain(this.workspace(), { domain });
      this.newDomain = '';
      return res;
    });
  }

  protected verify(id: number) {
    this.run(() => this.api.ssoDomain(this.workspace(), { id, verify: true }), 'Domain verified.');
  }

  protected removeDomain(id: number) {
    this.run(() => this.api.removeSsoDomain(this.workspace(), id));
  }

  protected async test() {
    this.busy.set(true);
    try {
      window.location.href = await this.auth.ssoStart({ workspace: this.workspace(), test: true });
    } catch (err) {
      this.toast.error(errorMessage(err));
      this.busy.set(false);
    }
  }

  protected async remove() {
    this.confirmingRemove.set(false);
    this.busy.set(true);
    try {
      await this.api.deleteSso(this.workspace());
      this.form = { issuer: PRESETS[0].issuer, client_id: '', client_secret: '', label: '' };
      this.load(await this.api.sso(this.workspace()));
    } catch (err) {
      this.toast.error(errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }

  protected async copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      this.toast.show(this.i18n.t('Copied.'));
    } catch {
      this.toast.show(text);
    }
  }
}
