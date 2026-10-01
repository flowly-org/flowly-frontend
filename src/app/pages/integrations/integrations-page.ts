import { DatePipe, JsonPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { ApiService, errorMessage } from '../../core/api.service';
import { Delivery, GitHubAppInfo, Integration, IntegrationKind, TASK_EVENTS } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { WorkspaceStore } from '../../core/workspace.store';

interface KindInfo {
  kind: IntegrationKind;
  label: string;
  icon: string;
  blurb: string;
}

export const KINDS: KindInfo[] = [
  { kind: 'github', label: 'GitHub', icon: '', blurb: 'Issues become tasks; closing or reopening a task updates the issue.' },
  { kind: 'slack', label: 'Slack', icon: '#', blurb: 'Post task events to a Slack channel.' },
  { kind: 'outgoing_webhook', label: 'Outgoing webhook', icon: '↗', blurb: 'POST signed JSON to your URL when tasks change.' },
  { kind: 'incoming_webhook', label: 'Incoming webhook', icon: '↘', blurb: 'A secret URL any system can call to create or update tasks.' },
  { kind: 'email', label: 'Email in', icon: '✉', blurb: 'Email an address to create a task.' },
];

interface Form {
  id: number | null;
  kind: IntegrationKind;
  name: string;
  project: number | null;
  enabled: boolean;
  config: Record<string, any>;
  events: Set<string>;
}

const DEFAULT_EVENTS: Partial<Record<IntegrationKind, string[]>> = {
  outgoing_webhook: TASK_EVENTS.map((e) => e.key),
  slack: ['task.created', 'task.completed', 'task.assigned'],
};

@Component({
  selector: 'app-integrations-page',
  imports: [FormsModule, DatePipe, JsonPipe],
  templateUrl: './integrations-page.html',
  styleUrl: './integrations-page.scss',
})
export class IntegrationsPage implements OnInit {
  protected store = inject(WorkspaceStore);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

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
  protected appOrg = '';

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
    await Promise.all([this.load(), this.loadGithubApp()]);
    const open = Number(qp.get('open'));
    const item = this.items().find((i) => i.id === open);
    if (item) this.edit(item);
  }

  private async load() {
    try {
      this.items.set(await this.api.integrations(this.wsId));
    } catch (err) {
      this.toast.error(errorMessage(err, 'Could not load integrations.'));
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
    return id === null ? 'Whole workspace' : (this.store.projectById().get(id)?.name ?? 'Project');
  }

  protected setFilter(value: string) {
    const id = value ? Number(value) : null;
    this.projectFilter.set(id);
    this.router.navigate([], { relativeTo: this.route, queryParams: { project: id }, replaceUrl: true });
  }

  protected startNew(kind: IntegrationKind) {
    const config: Record<string, any> =
      kind === 'github'
        ? { sync_labels: true, status_labels: false, create_issues: false, schedule: 'backlog', repo: '' }
        : kind === 'email'
          ? { allowed_senders: 'members', schedule: 'backlog' }
          : kind === 'incoming_webhook'
            ? { schedule: 'backlog', require_signature: false }
            : {};
    this.form.set({
      id: null,
      kind,
      name: this.kindInfo(kind).label,
      project: this.projectFilter(),
      enabled: true,
      config,
      events: new Set(DEFAULT_EVENTS[kind] ?? []),
    });
    this.deliveries.set([]);
    this.repos.set(null);
    this.confirmDelete.set(false);
  }

  protected edit(item: Integration) {
    this.form.set({
      id: item.id,
      kind: item.kind,
      name: item.name,
      project: item.project,
      enabled: item.enabled,
      config: structuredClone(item.config),
      events: new Set(item.config['events']?.length ? item.config['events'] : (DEFAULT_EVENTS[item.kind] ?? [])),
    });
    this.confirmDelete.set(false);
    this.repos.set(null);
    this.loadDeliveries();
    if (item.kind === 'github' && item.info['installed']) this.loadRepos();
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
    if (f.kind === 'outgoing_webhook' || f.kind === 'slack') config['events'] = [...f.events];
    const payload: Partial<Integration> = { kind: f.kind, name: f.name.trim() || this.kindInfo(f.kind).label, project: f.project, enabled: f.enabled, config };
    this.busy.set(true);
    try {
      const saved = f.id
        ? await this.api.updateIntegration(this.wsId, f.id, payload)
        : await this.api.createIntegration(this.wsId, payload);
      await this.load();
      this.toast.show(f.id ? 'Saved.' : `${this.kindInfo(f.kind).label} integration added.`);
      this.edit(saved);
    } catch (err) {
      this.toast.error(errorMessage(err, 'Could not save the integration.'));
    } finally {
      this.busy.set(false);
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
      this.toast.show('Integration removed.');
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
      if (d.status === 'success') this.toast.show(`Test delivered${d.response_body ? ': ' + d.response_body.slice(0, 80) : '.'}`);
      else this.toast.error(`Test failed: ${d.last_error || d.response_status}`);
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
      this.toast.show('New secret generated. Update the other side.');
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
      this.toast.show(res.status === 'success' ? 'Delivered.' : `Still failing: ${res.last_error}`);
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
      this.toast.error(errorMessage(err, 'Could not list repositories.'));
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

  protected copy(text: string, what = 'Copied') {
    const done = () => this.toast.show(`${what} to clipboard.`);
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
      this.toast.error('Copy failed; select the text and copy it manually.');
    }
    area.remove();
  }

  protected curlExample(item: Integration): string {
    return `curl -X POST '${item.info['url']}' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"external_id": "TICKET-42", "title": "Investigate login error", "priority": "High"}'`;
  }
}
