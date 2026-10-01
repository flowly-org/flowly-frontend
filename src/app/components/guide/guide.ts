import { Component, computed, effect, inject, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { TranslatePipe } from '../../core/i18n.pipes';
import { WorkspaceStore } from '../../core/workspace.store';

interface StepText {
  icon: string;
  title: string;
  why: string;
  action: string;
  /** Route; ':ws' is replaced by the current workspace. */
  link: string;
  fragment?: string;
  pro?: boolean;
}

const STEPS: Record<string, StepText> = {
  task: { icon: '✓', title: 'Plan your day', why: 'Add tasks with + New task, or paste a list with Bulk add.', action: 'Open My day', link: '/day' },
  project: { icon: '▤', title: 'Create projects', why: 'Projects become swimlanes on your board.', action: 'Add a project', link: '/w/:ws/projects' },
  tags: { icon: '#', title: 'Add your own tags', why: 'Group the day by context (calls, errands…) instead of by project.', action: 'Add tags', link: '/w/:ws/tags' },
  team: { icon: '👥', title: 'Invite your team', why: 'Share a workspace: send an invite link to colleagues.', action: 'Invite people', link: '/w/:ws/members' },
  calendar: { icon: '📅', title: 'Connect your calendar', why: 'Events show as background; tickets and trips get flagged for preparation.', action: 'Connect Google Calendar', link: '/settings', fragment: 'calendars' },
  home: { icon: '🏠', title: 'Set your home town', why: 'So Flowly can tell when an event is a trip.', action: 'Set home', link: '/settings', fragment: 'calendars' },
  integration: { icon: '⇄', title: 'Bring work in', why: 'Turn emails, GitHub issues or webhooks into tasks, and send updates to Slack.', action: 'Add an integration', link: '/w/:ws/integrations' },
  concierge: { icon: '🤖', title: 'Meet your concierge', why: 'A Telegram assistant that briefs you each morning and handles tasks by chat.', action: 'Link Telegram', link: '/settings', fragment: 'concierge', pro: true },
  assistant: { icon: '✦', title: 'Use Flowly from Claude or ChatGPT', why: 'Let your AI assistant read your day and add tasks.', action: 'Connect an assistant', link: '/settings', fragment: 'assistants' },
  time: { icon: '⏱', title: 'Track time', why: 'Start a timer from any task; bill the hours if you need to.', action: 'Open time', link: '/w/:ws/time' },
};

/**
 * Optional getting-started checklist: a small button in the top bar that opens a list of the pieces worth setting up.
 * Nothing pops up by itself; it can be hidden and brought back from the user menu.
 */
@Component({
  selector: 'app-guide',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './guide.html',
  styleUrl: './guide.scss',
})
export class Guide {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private store = inject(WorkspaceStore);
  /** Emitted when the panel opens, so the shell can close its other menus. */
  readonly opened = output<void>();

  protected open = signal(false);
  protected steps = signal<{ key: string; done: boolean }[]>([]);
  protected pro = signal(false);
  private hiddenFlag = signal(false);

  protected readonly done = computed(() => this.steps().filter((s) => s.done).length);
  protected readonly total = computed(() => this.steps().length);
  protected readonly visible = computed(() => !this.hiddenFlag() && this.total() > 0 && this.done() < this.total());
  protected readonly items = computed(() =>
    this.steps().map((s) => ({ ...s, text: STEPS[s.key] })).filter((s) => !!s.text),
  );

  constructor() {
    effect(() => {
      const id = this.auth.user()?.id;
      if (id !== undefined) this.hiddenFlag.set(readHidden(id));
    });
    this.load();
  }

  async load() {
    try {
      const res = await this.api.guide();
      this.steps.set(res.steps);
      this.pro.set(res.pro);
    } catch {}
  }

  toggle() {
    const next = !this.open();
    this.open.set(next);
    if (next) {
      this.opened.emit();
      this.load();
    }
  }

  close() {
    this.open.set(false);
  }

  /** Called from the user menu. */
  show() {
    this.setHidden(false);
    this.open.set(true);
    this.load();
  }

  hide() {
    this.setHidden(true);
    this.open.set(false);
  }

  protected route(text: StepText): string[] {
    const ws = this.store.navId() ?? this.store.workspaces()[0]?.id;
    return text.link.replace(':ws', String(ws ?? '')).split('/').filter(Boolean).map((p, i) => (i === 0 ? '/' + p : p));
  }

  private setHidden(value: boolean) {
    this.hiddenFlag.set(value);
    const id = this.auth.user()?.id;
    try {
      if (id !== undefined) localStorage.setItem(key(id), value ? '1' : '0');
    } catch {}
  }
}

const key = (id: number) => `flowly.guide.hidden.${id}`;

function readHidden(id: number): boolean {
  try {
    return localStorage.getItem(key(id)) === '1';
  } catch {
    return false;
  }
}
