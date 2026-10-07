import { Injectable, computed, effect, inject } from '@angular/core';

import { AuthService } from './auth.service';
import { BoardData } from './board-data';
import { I18nService } from './i18n.service';
import { FocusOptions, Task } from './models';
import { TimerService } from './timer.service';
import { ToastService } from './toast.service';

export const FOCUS_DEFAULTS: FocusOptions = {
  today_limit: 3,
  check_in_minutes: 25,
  hyperfocus_minutes: 90,
  heads_up_minutes: 10,
  celebrate: true,
  calm: false,
  capacity_minutes: 480,
  day_start: '09:00',
  day_end: '18:00',
  block_reminders: true,
  transfer_minutes: 45,
  appointment_briefs: 'off',
  appointment_lead_minutes: 15,
};

const CHEERS = ['Nice! One down.', 'Done! That counts.', 'Great work. Take the win.', 'Done. Ready for the next small step?'];

/** Opt-in ADHD mode: one thing at a time, fewer distractions, a small celebration when something gets done. */
@Injectable({ providedIn: 'root' })
export class FocusService {
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private i18n = inject(I18nService);

  readonly on = computed(() => !!this.auth.user()?.adhd_mode);
  readonly opts = computed<FocusOptions>(() => ({ ...FOCUS_DEFAULTS, ...(this.auth.user()?.focus ?? {}) }));

  constructor() {
    effect(() => {
      const root = document.documentElement;
      root.classList.toggle('adhd', this.on());
      root.classList.toggle('adhd-calm', this.on() && this.opts().calm);
    });
  }

  /** My open tasks in the order to do them: the one with the timer, then urgent and due ones, then the plan's order. */
  queue(tasks: Task[], data: BoardData, timer: TimerService, day: string): Task[] {
    const me = this.auth.user()?.id;
    const rank = (t: Task) => {
      const priorities = data.priorities(t.workspace);
      const i = priorities.findIndex((p) => p.id === t.priority);
      return i < 0 ? priorities.length + 1 : i;
    };
    const due = (t: Task) => (t.due_date && t.due_date <= day ? 0 : 1);
    return tasks
      .filter((t) => !data.isDone(t) && !t.blocked && (t.assignee === me || t.assignee === null))
      .sort((a, b) =>
        Number(timer.isRunningOn(b.id)) - Number(timer.isRunningOn(a.id)) ||
        due(a) - due(b) || rank(a) - rank(b) ||
        (a.planned_date ?? '').localeCompare(b.planned_date ?? '') || a.position - b.position);
  }

  /** Call when a task becomes done. */
  celebrate() {
    if (!this.on() || !this.opts().celebrate) return;
    this.toast.show(this.i18n.t(CHEERS[Math.floor(Math.random() * CHEERS.length)]));
    const still = this.opts().calm || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!still) burst();
  }
}

function burst() {
  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  Object.assign(layer.style, { position: 'fixed', left: '50%', bottom: '30%', width: '0', height: '0', zIndex: '9999', pointerEvents: 'none' });
  const bits = ['✦', '✓', '★', '✧', '✶', '•'];
  for (let i = 0; i < 16; i++) {
    const s = document.createElement('span');
    s.textContent = bits[i % bits.length];
    Object.assign(s.style, { position: 'absolute', fontSize: '22px', left: '0', top: '0' });
    layer.appendChild(s);
    const angle = (Math.PI * 2 * i) / 16 + Math.random() * 0.4;
    const dist = 90 + Math.random() * 90;
    s.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.4)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist - 40}px)) scale(1)`, opacity: 0 },
      ],
      { duration: 900 + Math.random() * 300, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' },
    );
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 1400);
}
