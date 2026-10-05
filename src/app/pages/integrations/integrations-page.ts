import { JsonPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { ApiService, errorMessage } from '../../core/api.service';
import { LocalDatePipe, TranslatePipe } from '../../core/i18n.pipes';
import { I18nService } from '../../core/i18n.service';
import { Delivery, GitHubAppInfo, Integration, IntegrationKind, TASK_EVENTS, WorkspaceMcp } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { WorkspaceStore } from '../../core/workspace.store';

interface KindInfo {
  kind: IntegrationKind;
  label: string;
  icon: string;
  blurb: string;
  /** Needs the Enterprise plan for the workspace. */
  enterprise?: boolean;
}

export const KINDS: KindInfo[] = [
  { kind: 'github', label: 'GitHub', icon: '', blurb: 'Issues become tasks; closing or reopening a task updates the issue.' },
  { kind: 'slack', label: 'Slack', icon: '#', blurb: 'Post task events to a Slack channel.' },
  { kind: 'outgoing_webhook', label: 'Outgoing webhook', icon: '↗', blurb: 'POST signed JSON to your URL when tasks change.' },
  { kind: 'incoming_webhook', label: 'Incoming webhook', icon: '↘', blurb: 'A secret URL any system can call to create or update tasks.' },
  { kind: 'email', label: 'Email in', icon: '✉', blurb: 'Email an address to create a task.' },
  { kind: 'donetick', label: 'Donetick', icon: '✔', blurb: 'Two-way sync with your self-hosted Donetick: chores become tasks, done is done in both.' },
  { kind: 'wiki', label: 'Wiki', icon: '📖', blurb: 'Link a GitHub wiki, a docs folder or a MediaWiki: Flo and the AI agent use it as team knowledge.' },
  { kind: 'telegram_group', label: 'Telegram group', icon: '✈', enterprise: true,
    blurb: "Flowly in your team's Telegram group: today's plan, updates, questions and photos of lists." },
  { kind: 'slack_bot', label: 'Slack app', icon: '◆', enterprise: true,
    blurb: 'Flowly in your Slack: @Flowly questions, /flowly, a morning brief and updates in a channel.' },
  { kind: 'openrouter', label: 'OpenRouter', icon: '✦', enterprise: true, blurb: "Use the workspace's own OpenRouter key and model for AI features." },
  { kind: 'openai_compatible', label: 'Custom AI endpoint', icon: '⚙', enterprise: true, blurb: 'Any OpenAI-compatible API, e.g. an on-premises model server.' },
];

interface Form {
  id: number | null;
  kind: IntegrationKind;
  name: string;
  project: number | null;
  enabled: boolean;
  config: Record<string, any>;
  events: Set<string>;
  apiKey: string;
}

const DEFAULT_EVENTS: Partial<Record<IntegrationKind, string[]>> = {
  outgoing_webhook: TASK_EVENTS.map((e) => e.key),
  slack: ['task.created', 'task.completed', 'task.assigned'],
  telegram_group: ['task.created', 'task.completed', 'task.assigned'],
  slack_bot: ['task.created', 'task.completed', 'task.assigned'],
};
/** Kinds that post task events and take an "events" list. */
export const EVENT_KINDS: IntegrationKind[] = ['outgoing_webhook', 'slack', 'telegram_group', 'slack_bot'];
const TEAM_KINDS: IntegrationKind[] = ['telegram_group', 'slack_bot'];

@Component({
  selector: 'app-integrations-page',
  imports: [FormsModule, JsonPipe, TranslatePipe, LocalDatePipe],
  templateUrl: './integrations-page.html',
  styleUrl: './integrations-page.scss',
})
export class IntegrationsPage implements OnInit {
  protected store = inject(WorkspaceStore);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private i18n = inject(I18nService);

  protected readonly kinds = KINDS;
  protected readonly events = TASK_EVENTS;
  protected items = signal<Integration[]>([]);
  protected projectFilter = signal<number | null>(null);
  protected form = signal<Form | null>(null);
  protected deliveries = signal<Delivery[]>([]);
  protected repos = signal<string[] | null>(null);
  protected githubApp = signal<GitHubAppInfo | null>(null);
  protected busy = signal(false);
  protected confirmDelete = signal(false);
  protected expanded = signal<number | null>(null);
  protected appName = 'Flowly';
  protected mcp = signal<WorkspaceMcp | null>(null);
  protected mcpNew = signal<WorkspaceMcp['tokens'][number] | null>(null);
  protected mcpTokenName = this.i18n.t('Automation');
  protected appOrg = '';
  protected readonly eventKinds = EVENT_KINDS;
  protected readonly teamKinds = TEAM_KINDS;
  protected slackChannels = signal<{ id: string; name: string }[] | null>(null);
  protected readonly enterprise = computed(() => !!this.store.current()?.is_enterprise);

  protected readonly current = computed(() => {
    const f = this.form();
    return f?.id ? (this.items().find((i) => i.id === f.id) ?? null) : null;
  });

  protected readonly visible = computed(() => {
    const filter = this.projectFilter();
    return filter === null ? this.items() : this.items().filter((i) => i.project === filter);
  });

  protected readonly statusTags = computed(() => this.store.tagGroups().find((g) => g.kind === 'status')?.tags ?? []);

  private get wsId() {
    return this.store.currentId()!;
  }

  async ngOnInit() {
    const qp = this.route.snapshot.queryParamMap;
    const project = Number(qp.get('project'));
    if (project) this.projectFilter.set(project);
    if (!this.store.canManage()) return;
    await Promise.all([this.load(), this.loadGithubApp(), this.loadMcp()]);
    const slack = qp.get('slack');
    if (slack === 'connected') this.toast.show(this.i18n.t('Slack connected. Pick a channel for the brief and updates.'));
    if (slack === 'error') this.toast.error(this.i18n.t('Could not connect Slack. Please try again.'));
    if (slack === 'connected') {
      const bot = this.items().find((i) => i.kind === 'slack_bot');
      if (bot) this.edit(bot);
    }
    const open = Number(qp.get('open'));
    const item = this.items().find((i) => i.id === open);
    if (item) this.edit(item);
  }

  private async load() {
    try {
      this.items.set(await this.api.integrations(this.wsId));
    } catch (err) {
      this.toast.error(errorMessage(err, this.i18n.t('Could not load integrations.')));
    }
  }

  private async loadMcp() {
    try {
      this.mcp.set(await this.api.workspaceMcp(this.wsId));
    } catch {}
  }

  async createMcpToken() {
    try {
      this.mcpNew.set(await this.api.createWorkspaceMcpToken(this.wsId, this.mcpTokenName.trim() || this.i18n.t('Automation')));
      await this.loadMcp();
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  async revokeMcpToken(id: number) {
    try {
      await this.api.revokeWorkspaceMcpToken(this.wsId, id);
      if (this.mcpNew()?.id === id) this.mcpNew.set(null);
      await this.loadMcp();
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  private async loadGithubApp() {
    try {
      this.githubApp.set(await this.api.githubApp());
    } catch {}
  }

  protected kindInfo(kind: IntegrationKind): KindInfo {
    return KINDS.find((k) => k.kind === kind)!;
  }

  protected projectName(id: number | null): string {
    return id === null ? this.i18n.t('Whole workspace') : (this.store.projectById().get(id)?.name ?? this.i18n.t('Project'));
  }

  protected setFilter(value: string) {
    const id = value ? Number(value) : null;
    this.projectFilter.set(id);
    this.router.navigate([], { relativeTo: this.route, queryParams: { project: id }, replaceUrl: true });
  }

  protected async startNew(kind: IntegrationKind) {
    if (this.kindInfo(kind).enterprise && !this.enterprise()) return;
    if (kind === 'slack_bot') {
      try {
        window.location.href = (await this.api.slackInstall(this.wsId)).url;
      } catch (err) {
        this.toast.error(errorMessage(err));
      }
      return;
    }
    const team = { brief: true, brief_time: '08:30', weekends: false, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome' };
    const config: Record<string, any> = kind === 'telegram_group' ? team :
      kind === 'github'
        ? { sync_labels: true, status_labels: false, create_issues: false, schedule: 'backlog', repo: '' }
        : kind === 'email'
          ? { allowed_senders: 'members', schedule: 'backlog', ai: 'auto' }
          : kind === 'incoming_webhook'
            ? { schedule: 'backlog', require_signature: false }
            : kind === 'openrouter'
              ? { model: '', exclusive: false }
              : kind === 'openai_compatible'
                ? { base_url: '', model: '', exclusive: true }
                : kind === 'wiki'
                  ? { source: 'github_wiki', repo: '', path: '', branch: '' }
                  : kind === 'donetick'
                    ? prepDonetick({ base_url: '', labels: [], label_projects: {}, members: {}, write_back: true, create_chores: false })
                    : {};
    this.form.set({
      id: null,
      kind,
      name: this.kindInfo(kind).label,
      project: this.projectFilter(),
      enabled: true,
      config,
      events: new Set(DEFAULT_EVENTS[kind] ?? []),
      apiKey: '',
    });
    this.deliveries.set([]);
    this.repos.set(null);
    this.confirmDelete.set(false);
  }

  private async loadSlackChannels(item: Integration) {
    try {
      this.slackChannels.set(await this.api.slackChannels(this.wsId, item.id));
    } catch (err) {
      this.slackChannels.set([]);
      this.toast.error(errorMessage(err));
    }
  }

  protected pickChannel(f: { config: Record<string, any> }, id: string) {
    f.config['channel'] = id;
    f.config['channel_name'] = this.slackChannels()?.find((c) => c.id === id)?.name ?? '';
  }

  protected async reconnectSlack() {
    try {
      window.location.href = (await this.api.slackInstall(this.wsId)).url;
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  protected edit(item: Integration) {
    this.form.set({
      id: item.id,
      kind: item.kind,
      name: item.name,
      project: item.project,
      enabled: item.enabled,
      config: item.kind === 'donetick' ? prepDonetick(structuredClone(item.config)) : structuredClone(item.config),
      events: new Set(item.config['events']?.length ? item.config['events'] : (DEFAULT_EVENTS[item.kind] ?? [])),
      apiKey: '',
    });
    this.confirmDelete.set(false);
    this.repos.set(null);
    this.loadDeliveries();
    if (item.kind === 'github' && item.info['installed']) this.loadRepos();
    this.slackChannels.set(null);
    if (item.kind === 'slack_bot') this.loadSlackChannels(item);
  }

  protected close() {
    this.form.set(null);
  }

  protected toggleEvent(f: Form, key: string) {
    if (f.events.has(key)) f.events.delete(key);
    else f.events.add(key);
  }

  async save() {
    const f = this.form();
    if (!f) return;
    const config = { ...f.config };
    if (EVENT_KINDS.includes(f.kind)) config['events'] = [...f.events];
    if (f.kind === 'donetick') {
      const rows: { label: string; project: number | null }[] = config['_rows'] ?? [];
      config['label_projects'] = Object.fromEntries(rows.filter((r) => r.label.trim() && r.project).map((r) => [r.label.trim(), r.project]));
      config['labels'] = String(config['_labels'] ?? '').split(',').map((x: string) => x.trim()).filter(Boolean);
      delete config['_rows'];
      delete config['_labels'];
    }
    const payload: Partial<Integration> & { api_key?: string } = {
      kind: f.kind,
      name: f.name.trim() || this.i18n.t(this.kindInfo(f.kind).label),
      project: f.project,
      enabled: f.enabled,
      config,
    };
    if (f.apiKey.trim()) payload.api_key = f.apiKey.trim();
    this.busy.set(true);
    try {
      const saved = f.id
        ? await this.api.updateIntegration(this.wsId, f.id, payload)
        : await this.api.createIntegration(this.wsId, payload);
      await this.load();
      this.toast.show(
        f.id ? this.i18n.t('Saved.') : this.i18n.t('{kind} integration added.', { kind: this.i18n.t(this.kindInfo(f.kind).label) }),
      );
      this.edit(saved);
    } catch (err) {
      this.toast.error(errorMessage(err, this.i18n.t('Could not save the integration.')));
    } finally {
      this.busy.set(false);
    }
  }

  protected aliasDraft: Record<number, string> = {};

  private aliasNames(item: Integration): string[] {
    return (item.info['aliases'] ?? []).map((a: string) => a.split('@')[0]);
  }

  async addAlias(item: Integration) {
    const name = (this.aliasDraft[item.id] ?? '').trim();
    if (!name) return;
    try {
      await this.api.updateIntegration(this.wsId, item.id, { aliases: [...this.aliasNames(item), name] });
      this.aliasDraft[item.id] = '';
      await this.load();
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  async removeAlias(item: Integration, address: string) {
    const name = address.split('@')[0];
    try {
      await this.api.updateIntegration(this.wsId, item.id, { aliases: this.aliasNames(item).filter((n) => n !== name) });
      await this.load();
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  async toggleEnabled(item: Integration) {
    try {
      await this.api.updateIntegration(this.wsId, item.id, { enabled: !item.enabled });
      await this.load();
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  async remove() {
    const f = this.form();
    if (!f?.id) return;
    try {
      await this.api.deleteIntegration(this.wsId, f.id);
      this.form.set(null);
      await this.load();
      this.toast.show(this.i18n.t('Integration removed.'));
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  async test() {
    const f = this.form();
    if (!f?.id) return;
    this.busy.set(true);
    try {
      const d = await this.api.testIntegration(this.wsId, f.id);
      if (d.status === 'success' && (f.kind === 'wiki' || f.kind === 'donetick')) this.toast.show(d.response_body);
      else if (d.status === 'success')
        this.toast.show(
          d.response_body
            ? this.i18n.t('Test delivered: {response}', { response: d.response_body.slice(0, 80) })
            : this.i18n.t('Test delivered.'),
        );
      else this.toast.error(this.i18n.t('Test failed: {error}', { error: d.last_error || d.response_status }));
      await Promise.all([this.loadDeliveries(), this.load()]);
    } catch (err) {
      this.toast.error(errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }

  async rotate() {
    const f = this.form();
    if (!f?.id) return;
    try {
      await this.api.rotateSecret(this.wsId, f.id);
      await this.load();
      this.toast.show(this.i18n.t('New secret generated. Update the other side.'));
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  async loadDeliveries() {
    const f = this.form();
    if (!f?.id) return;
    try {
      this.deliveries.set(await this.api.deliveries(this.wsId, f.id));
    } catch {}
  }

  async retry(d: Delivery) {
    const f = this.form();
    if (!f?.id) return;
    try {
      const res = await this.api.retryDelivery(this.wsId, f.id, d.id);
      this.toast.show(
        res.status === 'success' ? this.i18n.t('Delivered.') : this.i18n.t('Still failing: {error}', { error: res.last_error }),
      );
      await this.loadDeliveries();
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  // --- GitHub ---------------------------------------------------------------

  async installGithub() {
    const f = this.form();
    if (!f?.id) return;
    try {
      const { url } = await this.api.githubInstallUrl(this.wsId, f.id);
      window.location.href = url;
    } catch (err) {
      this.toast.error(errorMessage(err));
    }
  }

  async loadRepos() {
    const f = this.form();
    if (!f?.id) return;
    try {
      this.repos.set(await this.api.githubRepos(this.wsId, f.id));
    } catch (err) {
      this.toast.error(errorMessage(err, this.i18n.t('Could not list repositories.')));
    }
  }

  /** Manifest flow: POST a form to GitHub, which creates the app and redirects back with a code. */
  async createGithubApp() {
    try {
      const { action, manifest } = await this.api.githubManifest(this.appName, this.appOrg);
      try {
        localStorage.setItem('flowly.githubReturn', this.router.url);
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

  // --- helpers --------------------------------------------------------------

  /** `message` is an English key, e.g. 'URL copied to clipboard.' */
  protected copy(text: string, message = 'Copied to clipboard.') {
    const done = () => this.toast.show(this.i18n.t(message));
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, () => this.fallbackCopy(text, done));
    } else {
      this.fallbackCopy(text, done);
    }
  }

  private fallbackCopy(text: string, done: () => void) {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand('copy');
      done();
    } catch {
      this.toast.error(this.i18n.t('Copy failed; select the text and copy it manually.'));
    }
    area.remove();
  }

  protected inboundExample(token: string): string {
    return `${token}@your-inbound-domain`;
  }

  /** English label of a delivery status (translated in the template). */
  protected statusLabel(status: string): string {
    return ({ pending: 'Pending', success: 'Success', failed: 'Failed', ignored: 'Ignored' } as Record<string, string>)[status] ?? status;
  }

  protected addLabelRow(f: Form) {
    f.config['_rows'] = [...(f.config['_rows'] ?? []), { label: '', project: null }];
  }

  protected removeLabelRow(f: Form, i: number) {
    f.config['_rows'] = (f.config['_rows'] ?? []).filter((_: unknown, j: number) => j !== i);
  }

  protected setMember(f: Form, donetickId: number, flowlyId: string) {
    const members = { ...(f.config['members'] ?? {}) };
    if (flowlyId) members[donetickId] = Number(flowlyId);
    else delete members[donetickId];
    f.config['members'] = members;
  }

  protected isAi(kind: IntegrationKind): boolean {
    return kind === 'openrouter' || kind === 'openai_compatible';
  }

  protected curlExample(item: Integration): string {
    return `curl -X POST '${item.info['url']}' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"external_id": "TICKET-42", "title": "Investigate login error", "priority": "High"}'`;
  }
}

/** Donetick config in an editable shape: label → project rows and the label filter as text. */
function prepDonetick(config: Record<string, any>): Record<string, any> {
  return {
    ...config,
    _rows: Object.entries(config['label_projects'] ?? {}).map(([label, project]) => ({ label, project })),
    _labels: (config['labels'] ?? []).join(', '),
  };
}
