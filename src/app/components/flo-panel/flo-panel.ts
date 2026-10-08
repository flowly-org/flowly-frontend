import { Component, ElementRef, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService, errorMessage } from '../../core/api.service';
import { FloService } from '../../core/flo.service';
import { TranslatePipe } from '../../core/i18n.pipes';
import { I18nService } from '../../core/i18n.service';
import { FloChat, FloMessage } from '../../core/models';
import { Icon } from '../icon/icon';

/** Flo, one click away on every page: the conversation (shared with Telegram) and quick starts. */
@Component({
  selector: 'app-flo-panel',
  imports: [FormsModule, RouterLink, Icon, TranslatePipe],
  templateUrl: './flo-panel.html',
  styleUrl: './flo-panel.scss',
  host: { '(document:keydown.escape)': 'flo.open.set(false)' },
})
export class FloPanel {
  protected flo = inject(FloService);
  private api = inject(ApiService);
  protected i18n = inject(I18nService);

  protected state = signal<FloChat | null>(null);
  protected messages = signal<FloMessage[]>([]);
  protected sending = signal(false);
  protected draft = '';
  private list = viewChild<ElementRef<HTMLElement>>('list');
  private input = viewChild<ElementRef<HTMLTextAreaElement>>('input');

  protected readonly suggestions = [
    "What's on today?",
    'Plan my day around my meetings',
    'What did I leave behind this week?',
    'Move everything not urgent to tomorrow',
  ];

  constructor() {
    effect(() => {
      if (this.flo.open()) untracked(() => this.load());
    });
  }

  private async load() {
    try {
      const s = await this.api.floChat();
      this.state.set(s);
      this.messages.set(s.messages);
      this.scroll();
      setTimeout(() => this.input()?.nativeElement.focus(), 50);
    } catch (err) {
      this.state.set({ available: false, reason: errorMessage(err), name: 'Flo', messages: [] });
    }
  }

  protected planWeek() {
    this.flo.open.set(false);
    this.flo.planning.set(true);
  }

  protected keydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.send();
    }
  }

  protected async send(text = this.draft) {
    text = text.trim();
    if (!text || this.sending()) return;
    this.draft = '';
    const now = new Date().toISOString();
    this.messages.update((m) => [...m, { role: 'user', content: text, channel: 'web', at: now }]);
    this.sending.set(true);
    this.scroll();
    try {
      const { reply } = await this.api.conciergeChat(text);
      this.messages.update((m) => [...m, { role: 'assistant', content: reply, channel: 'web', at: new Date().toISOString() }]);
      this.flo.touched(); // Flo may have added, moved or finished tasks
    } catch (err) {
      this.messages.update((m) => [...m, { role: 'assistant', content: errorMessage(err), channel: 'web', at: new Date().toISOString() }]);
    } finally {
      this.sending.set(false);
      this.scroll();
    }
  }

  private scroll() {
    setTimeout(() => {
      const el = this.list()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}
