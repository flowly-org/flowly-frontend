import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { LocalDatePipe, TranslatePipe } from '../../core/i18n.pipes';
import { I18nService, LANGUAGES } from '../../core/i18n.service';
import { ApiTokenRow, ConciergeState } from '../../core/models';
import { NotificationService } from '../../core/notification.service';
import { Theme, ThemeService } from '../../core/theme.service';
import { ToastService } from '../../core/toast.service';

interface ChatLine {
  role: 'user' | 'assistant';
  text: string;
}

@Component({
  selector: 'app-settings-page',
  imports: [FormsModule, TranslatePipe, LocalDatePipe],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
})
export class SettingsPage implements OnInit {
  protected auth = inject(AuthService);
  protected theme = inject(ThemeService);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private notifications = inject(NotificationService);
  protected i18n = inject(I18nService);
  protected readonly languages = LANGUAGES;

  protected fullName = this.auth.user()?.full_name ?? '';
  protected githubLogin = this.auth.user()?.github_login ?? '';
  protected state = signal<ConciergeState | null>(null);
  protected linkUrl = signal<string | null>(null);
  protected busy = signal(false);
  protected chat = signal<ChatLine[]>([]);
  protected chatDraft = '';
  protected confirmForget = signal(false);
  protected tokens = signal<ApiTokenRow[]>([]);
  protected grants = signal<{ id: number; client: string; created_at: string; last_used_at: string | null }[]>([]);
  protected newToken = signal<ApiTokenRow | null>(null);
  protected tokenName = 'Claude';
  protected mcpUrl = signal('');
  protected systemNotifications = signal('Notification' in window ? Notification.permission : 'unsupported');
  protected readonly timezones: string[] = (Intl as any).supportedValuesOf?.('timeZone') ?? ['UTC', 'Europe/Rome', 'Europe/London', 'America/New_York'];
  protected readonly themes: { value: Theme; label: string }[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'auto', label: 'Auto (system)' },
  ];

  async ngOnInit() {
    await Promise.all([this.load(), this.loadTokens()]);
    try {
      const cfg = await this.api.publicConfig();
      this.mcpUrl.set(cfg.mcp_url.startsWith('http') ? cfg.mcp_url : `${window.location.origin}/api/mcp/`);
    } catch {}
  }

  private async loadTokens() {
    try {
      const [tokens, grants] = await Promise.all([this.api.apiTokens(), this.api.oauthGrants()]);
      this.tokens.set(tokens);
      this.grants.set(grants);
    } catch {}
  }

  async disconnect(id: number) {
    await this.api.revokeOauthGrant(id);
    await this.loadTokens();
  }

  async createToken() {
    try {
      const t = await this.api.createApiToken(this.tokenName.trim() || 'Claude');
      this.newToken.set(t);
      await this.loadTokens();
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  async revokeToken(t: ApiTokenRow) {
    await this.api.deleteApiToken(t.id);
    if (this.newToken()?.id === t.id) this.newToken.set(null);
    await this.loadTokens();
  }

  protected claudeCodeCommand(token: string) {
    return `claude mcp add --transport http flowly ${this.mcpUrl()} --header "Authorization: Bearer ${token}"`;
  }

  protected desktopConfig(token: string) {
    return JSON.stringify(
      { mcpServers: { flowly: { command: 'npx', args: ['-y', 'mcp-remote', this.mcpUrl(), '--header', `Authorization: Bearer ${token}`] } } },
      null,
      2,
    );
  }

  protected copy(text: string) {
    const done = () => this.toast.show(this.i18n.t('Copied.'));
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

  private async load() {
    try {
      this.state.set(await this.api.concierge());
    } catch (err) {
      this.toast.error(errorMessage(err, this.i18n.t('Could not load concierge settings.')));
    }
  }

  async saveProfile() {
    try {
      await this.auth.updateProfile({ full_name: this.fullName.trim(), github_login: this.githubLogin.trim() });
      this.toast.show(this.i18n.t('Profile saved.'));
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  async update(data: Partial<ConciergeState['settings']>) {
    try {
      this.state.set(await this.api.updateConcierge(data));
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  async connectTelegram() {
    try {
      const { url } = await this.api.telegramLink();
      this.linkUrl.set(url);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  async disconnectTelegram() {
    await this.api.telegramUnlink();
    this.linkUrl.set(null);
    await this.load();
  }

  async checkLinked() {
    await this.load();
    if (this.state()?.telegram.linked) {
      this.linkUrl.set(null);
      this.toast.show(this.i18n.t('Telegram connected.'));
    } else {
      this.toast.show(this.i18n.t('Not linked yet. Tap Start in Telegram, then check again.'));
    }
  }

  async sendBrief() {
    this.busy.set(true);
    try {
      const { brief } = await this.api.conciergeBrief(!!this.state()?.telegram.linked);
      this.chat.update((c) => [...c, { role: 'assistant', text: brief }]);
    } catch (err) {
      this.toast.error(errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }

  async send() {
    const text = this.chatDraft.trim();
    if (!text) return;
    this.chatDraft = '';
    this.chat.update((c) => [...c, { role: 'user', text }]);
    this.busy.set(true);
    try {
      const { reply } = await this.api.conciergeChat(text);
      this.chat.update((c) => [...c, { role: 'assistant', text: reply }]);
      this.notifications.refresh(false);
    } catch (err) {
      this.toast.error(errorMessage(err, this.i18n.t('The concierge did not answer.')));
    } finally {
      this.busy.set(false);
      this.load();
    }
  }

  protected chatKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.send();
    }
  }

  async forget() {
    this.confirmForget.set(false);
    await this.api.forgetConcierge();
    this.chat.set([]);
    await this.load();
    this.toast.show(this.i18n.t('Memory and chat history cleared.'));
  }

  async enableSystem() {
    const ok = await this.notifications.enableSystemNotifications();
    this.systemNotifications.set(ok ? 'granted' : Notification.permission);
  }

  protected usagePct(s: ConciergeState): number {
    return Math.min(100, Math.round((s.usage_today / Math.max(1, s.daily_limit)) * 100));
  }
}
