import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { FocusService } from '../../core/focus.service';
import { LocalDatePipe, TranslatePipe } from '../../core/i18n.pipes';
import { I18nService, LANGUAGES } from '../../core/i18n.service';
import { ApiTokenRow, CalendarOverview, DonetickAccount, FocusOptions, User, WorkspaceContext, ConciergeState, EInvoiceFormat, EInvoiceSetting, InvoicingProfile, PlanInfo } from '../../core/models';
import { NotificationService } from '../../core/notification.service';
import { Theme, ThemeService } from '../../core/theme.service';
import { ToastService } from '../../core/toast.service';

type SettingsTab = 'account' | 'flo' | 'focus' | 'calendars' | 'connections' | 'invoicing';

/** Where each section lives (old #fragment links keep working). */
const TAB_OF: Record<string, SettingsTab> = {
  plan: 'account', profile: 'account', concierge: 'flo', focus: 'focus', calendars: 'calendars',
  assistants: 'connections', donetick: 'connections', invoicing: 'invoicing',
};
const FRAGMENT_OF: Record<SettingsTab, string> = {
  account: 'plan', flo: 'concierge', focus: 'focus', calendars: 'calendars', connections: 'assistants', invoicing: 'invoicing',
};

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
  protected focus = inject(FocusService);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private notifications = inject(NotificationService);
  protected i18n = inject(I18nService);
  protected readonly languages = LANGUAGES;
  protected tab = signal<SettingsTab>('account');
  protected readonly tabs: { key: SettingsTab; label: string; icon: string }[] = [
    { key: 'account', label: 'Account', icon: '👤' },
    { key: 'flo', label: 'Flo', icon: '🤖' },
    { key: 'focus', label: 'Focus', icon: '🎯' },
    { key: 'calendars', label: 'Calendars', icon: '📅' },
    { key: 'connections', label: 'Connections', icon: '🔌' },
    { key: 'invoicing', label: 'Invoicing', icon: '🧾' },
  ];
  private router = inject(Router);

  protected openTab(key: SettingsTab) {
    this.tab.set(key);
    this.router.navigate([], { fragment: FRAGMENT_OF[key], replaceUrl: true, queryParamsHandling: 'preserve' });
  }

  protected fullName = this.auth.user()?.full_name ?? '';
  protected githubLogin = this.auth.user()?.github_login ?? '';
  protected home = this.auth.user()?.home_location ?? '';
  protected calendars = signal<CalendarOverview | null>(null);
  protected calBusy = signal(false);
  protected plan = signal<PlanInfo | null>(null);
  protected memoryDraft: string | null = null;
  protected stripeKey = '';
  protected invoicing = signal<{ profile: InvoicingProfile; formats: EInvoiceFormat[] } | null>(null);
  private countryCode = signal('IT');
  protected readonly currentFormat = computed(() => {
    const inv = this.invoicing();
    const code = this.countryCode();
    return inv?.formats.find((f) => f.countries.includes(code)) ?? null;
  });
  protected readonly countries = computed(() => {
    const names = new Intl.DisplayNames([this.i18n.lang()], { type: 'region' });
    return COUNTRIES.map((code) => ({ code, name: names.of(code) ?? code })).sort((a, b) => a.name.localeCompare(b.name));
  });
  private route = inject(ActivatedRoute);
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

  // --- Donetick (personal) ---------------------------------------------------
  protected donetick = signal<DonetickAccount[]>([]);
  protected contexts = signal<WorkspaceContext[]>([]);
  protected dtNew = { base_url: '', token: '' };
  protected dtEdit = signal<(DonetickAccount & { token?: string }) | null>(null);
  protected dtBusy = signal(false);

  private async loadDonetick() {
    try {
      const [accounts, contexts] = await Promise.all([this.api.donetickAccounts(), this.api.myContext()]);
      this.donetick.set(accounts);
      this.contexts.set(contexts);
    } catch {}
  }

  protected projectsOf(wsId: number | null) {
    return this.contexts().find((c) => c.id === wsId)?.projects.filter((p) => !p.archived) ?? [];
  }

  async connectDonetick() {
    this.dtBusy.set(true);
    try {
      const account = await this.api.createDonetick({ base_url: this.dtNew.base_url.trim(), token: this.dtNew.token.trim() });
      this.donetick.update((list) => [...list, account]);
      this.dtNew = { base_url: '', token: '' };
      this.editDonetick(account);
      if (account.info.error) this.toast.error(account.info.error);
      else this.toast.show(this.i18n.t('Connected. Now choose where each label goes.'));
    } catch (err) {
      this.toast.error(errorMessage(err));
    } finally {
      this.dtBusy.set(false);
    }
  }

  editDonetick(account: DonetickAccount) {
    this.dtEdit.set({ ...structuredClone(account), token: '' });
  }

  addRoute() {
    const e = this.dtEdit();
    if (!e) return;
    this.dtEdit.set({ ...e, routes: [...e.routes, { label: '', workspace: this.contexts()[0]?.id ?? 0, project: null }] });
  }

  removeRoute(i: number) {
    const e = this.dtEdit();
    if (e) this.dtEdit.set({ ...e, routes: e.routes.filter((_, j) => j !== i) });
  }

  async saveDonetick() {
    const e = this.dtEdit();
    if (!e) return;
    this.dtBusy.set(true);
    try {
      const { info, created_at, id, token, ...data } = e;
      const payload = { ...data, routes: e.routes.filter((r) => r.label.trim() && r.workspace), ...(token?.trim() ? { token: token.trim() } : {}) };
      const saved = await this.api.updateDonetick(id, payload);
      const synced = await this.api.syncDonetick(id).catch((err) => {
        this.toast.error(errorMessage(err));
        return null;
      });
      const fresh = synced?.account ?? saved;
      this.donetick.update((list) => list.map((a) => (a.id === id ? fresh : a)));
      this.dtEdit.set(null);
      if (synced) this.toast.show(synced.detail);
    } catch (err) {
      this.toast.error(errorMessage(err));
    } finally {
      this.dtBusy.set(false);
    }
  }

  async syncDonetick(account: DonetickAccount) {
    this.dtBusy.set(true);
    try {
      const res = await this.api.syncDonetick(account.id);
      this.donetick.update((list) => list.map((a) => (a.id === account.id ? res.account : a)));
      this.toast.show(res.detail);
    } catch (err) {
      this.toast.error(errorMessage(err));
    } finally {
      this.dtBusy.set(false);
    }
  }

  async removeDonetick(account: DonetickAccount) {
    try {
      await this.api.deleteDonetick(account.id);
      this.donetick.update((list) => list.filter((a) => a.id !== account.id));
      if (this.dtEdit()?.id === account.id) this.dtEdit.set(null);
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  async copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      this.toast.show(this.i18n.t('Copied to clipboard.'));
    } catch {}
  }

  async ngOnInit() {
    await Promise.all([this.load(), this.loadTokens(), this.loadCalendars(), this.loadInvoicing(), this.loadPlan(), this.loadDonetick(), this.feed('get')]);
    const pro = this.route.snapshot.queryParamMap.get('pro');
    if (pro === 'success') {
      this.toast.show(this.i18n.t('Welcome to Flowly Pro! It may take a few seconds to switch on.'));
      setTimeout(() => this.loadPlan().then(() => this.auth.loadMe()), 4000);
    }
    const result = this.route.snapshot.queryParamMap.get('calendar');
    if (result === 'connected') this.toast.show(this.i18n.t('Google Calendar connected.'));
    if (result === 'error') this.toast.error(this.i18n.t('Could not connect Google Calendar. Please try again.'));
    const target = result ? 'calendars' : this.route.snapshot.fragment;
    if (target && TAB_OF[target]) this.tab.set(TAB_OF[target]);
    // Links to another section while already here (e.g. from the guide).
    this.route.fragment.subscribe((f) => {
      if (f && TAB_OF[f]) this.tab.set(TAB_OF[f]);
    });
    if (target && !Object.values(FRAGMENT_OF).includes(target)) {
      setTimeout(() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
    try {
      const cfg = await this.api.publicConfig();
      this.mcpUrl.set(cfg.mcp_url.startsWith('http') ? cfg.mcp_url : `${window.location.origin}/api/mcp/`);
    } catch {}
  }

  private async loadPlan() {
    try {
      this.plan.set(await this.api.billingPlan());
    } catch {}
  }

  protected money(cents: number, currency: string) {
    return new Intl.NumberFormat(this.i18n.lang(), { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
  }

  async upgrade(interval: 'month' | 'year', plan: 'pro' | 'pro_plus' = 'pro') {
    this.busy.set(true);
    try {
      window.location.href = (await this.api.billingCheckout(interval, plan)).url;
    } catch (err) {
      this.toast.error(errorMessage(err));
      this.busy.set(false);
    }
  }

  async manageSubscription() {
    try {
      window.location.href = (await this.api.billingPortal()).url;
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  async disconnectStripe() {
    try {
      const res = await this.api.updateMyInvoicing({ stripe_key: '' });
      this.invoicing.set({ profile: res.profile, formats: res.formats });
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  private async loadInvoicing() {
    try {
      const res = await this.api.myInvoicing();
      this.invoicing.set({ profile: res.profile, formats: res.formats });
      this.countryCode.set(res.profile.country);
    } catch {}
  }

  protected vatLabel() {
    return { IT: 'Partita IVA', DE: 'USt-IdNr.', FR: 'VAT number (numéro de TVA)' }[this.countryCode()] ?? 'VAT number';
  }

  protected vatPlaceholder() {
    return { IT: '01234567890', DE: 'DE123456789', FR: 'FR32123456789' }[this.countryCode()] ?? '';
  }

  protected taxLabel() {
    return { IT: 'Codice fiscale', DE: 'Steuernummer', FR: 'SIREN / SIRET' }[this.countryCode()] ?? 'Tax code';
  }

  protected countryChanged() {
    this.countryCode.set(this.invoicing()?.profile.country ?? 'IT');
  }

  protected fmtValue(format: string, field: EInvoiceSetting) {
    return this.invoicing()?.profile.format_settings?.[format]?.[field.key] ?? field.default;
  }

  protected setFmt(format: string, key: string, value: any) {
    const inv = this.invoicing();
    if (!inv) return;
    const all = { ...(inv.profile.format_settings ?? {}) };
    all[format] = { ...(all[format] ?? {}), [key]: value };
    inv.profile.format_settings = all;
  }

  async saveInvoicing() {
    const inv = this.invoicing();
    if (!inv) return;
    try {
      const data: Partial<InvoicingProfile> = { ...inv.profile };
      if (this.stripeKey.trim()) data.stripe_key = this.stripeKey.trim();
      const res = await this.api.updateMyInvoicing(data);
      this.stripeKey = '';
      this.invoicing.set({ profile: res.profile, formats: res.formats });
      this.toast.show(this.i18n.t('Invoicing details saved.'));
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  private async loadCalendars() {
    try {
      this.calendars.set(await this.api.calendarOverview());
    } catch {}
  }

  async saveHome() {
    try {
      await this.auth.updateProfile({ home_location: this.home.trim() });
      this.toast.show(this.i18n.t('Home saved.'));
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  protected calForm = signal<'caldav' | 'ics' | null>(null);
  protected caldav = { server_url: '', username: '', password: '' };
  protected icsLink = { url: '', name: '' };
  protected feedUrl = signal<string | null>(null);
  protected readonly providerNames: Record<string, string> = { google: 'Google', microsoft: 'Microsoft', caldav: 'CalDAV', ics: 'iCal' };

  async connectMicrosoft() {
    try {
      window.location.href = (await this.api.connectMicrosoftCalendar()).url;
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  async addCalDav() {
    this.calBusy.set(true);
    try {
      await this.api.addCalDav({ ...this.caldav });
      this.caldav = { server_url: '', username: '', password: '' };
      this.calForm.set(null);
      this.toast.show(this.i18n.t('Calendar connected.'));
      await this.loadCalendars();
    } catch (err) {
      this.toast.error(errorMessage(err));
    } finally {
      this.calBusy.set(false);
    }
  }

  async addIcs() {
    this.calBusy.set(true);
    try {
      await this.api.addIcs({ ...this.icsLink });
      this.icsLink = { url: '', name: '' };
      this.calForm.set(null);
      this.toast.show(this.i18n.t('Calendar connected.'));
      await this.loadCalendars();
    } catch (err) {
      this.toast.error(errorMessage(err));
    } finally {
      this.calBusy.set(false);
    }
  }

  async feed(action: 'get' | 'create' | 'delete') {
    try {
      this.feedUrl.set((await this.api.calendarFeed(action)).url);
    } catch (err) {
      if (action !== 'get') this.toast.error(errorMessage(err));
    }
  }

  async connectGoogle() {
    try {
      const { url } = await this.api.connectGoogleCalendar();
      window.location.href = url;
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  async syncAccount(id: number) {
    this.calBusy.set(true);
    try {
      await this.api.syncCalendarAccount(id);
      await this.loadCalendars();
    } catch (err) {
      this.toast.error(errorMessage(err));
    } finally {
      this.calBusy.set(false);
    }
  }

  async disconnectAccount(id: number) {
    await this.api.disconnectCalendarAccount(id);
    await this.loadCalendars();
  }

  async selectCalendar(id: number, selected: boolean) {
    try {
      await this.api.selectCalendar(id, selected);
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
    await this.loadCalendars();
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

  async setFocus(data: Partial<Pick<User, 'adhd_mode' | 'focus'>>) {
    try {
      await this.auth.updateProfile(data);
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  setOpt(key: keyof FocusOptions, event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) this.setFocus({ focus: { [key]: value } });
  }

  protected inviteCode = '';

  async redeem() {
    try {
      const res = await this.auth.redeemCode(this.inviteCode.trim());
      this.inviteCode = '';
      this.toast.show(this.i18n.t(res.forever ? 'Welcome to {plan}, forever!' : 'Welcome to {plan}!', { plan: res.plan === 'pro_plus' ? 'Flowly Pro Plus' : 'Flowly Pro' }));
      if (res.stripe_subscription) this.toast.show(this.i18n.t('You still have a paid subscription: cancel it with “Manage subscription” so you are not charged.'));
      await this.loadPlan();
    } catch (err) {
      this.toast.error(errorMessage(err));
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

  async saveMemory() {
    if (this.memoryDraft === null) return;
    await this.update({ memory: this.memoryDraft } as any);
    this.memoryDraft = null;
    this.toast.show(this.i18n.t('Memory saved.'));
  }

  async forget() {
    this.confirmForget.set(false);
    await this.api.forgetConcierge();
    this.memoryDraft = null;
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

/** Countries offered for the invoicing profile (EU, EEA and a few common others). */
const COUNTRIES = [
  'IT', 'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'NO', 'IS', 'LI', 'CH', 'GB', 'US', 'CA', 'AU', 'SM', 'VA', 'MC',
];
