import { Component, computed, input, output, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TranslatePipe } from '../../core/i18n.pipes';
import { Recurrence } from '../../core/models';

type Preset = '' | 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'monthly' | 'yearly' | 'custom';
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** "Repeat" control: common presets, or a custom rule (every N days/weeks/months/years, weekdays, after done). */
@Component({
  selector: 'app-repeat-picker',
  imports: [FormsModule, TranslatePipe],
  template: `
    <select [ngModel]="preset()" (ngModelChange)="choose($event)" [attr.aria-label]="'Repeat' | t">
      <option value="">{{ "Doesn't repeat" | t }}</option>
      <option value="daily">{{ 'Every day' | t }}</option>
      <option value="weekdays">{{ 'Every weekday (Mon–Fri)' | t }}</option>
      <option value="weekly">{{ 'Every week' | t }}</option>
      <option value="biweekly">{{ 'Every 2 weeks' | t }}</option>
      <option value="monthly">{{ 'Every month' | t }}</option>
      <option value="yearly">{{ 'Every year' | t }}</option>
      <option value="custom">{{ 'Custom…' | t }}</option>
    </select>
    @if (preset() === 'custom' && rule(); as r) {
      <div class="custom">
        <span>{{ 'Every' | t }}</span>
        <input type="number" min="1" max="365" [ngModel]="r.interval" (ngModelChange)="patch({ interval: +$event || 1 })" [attr.aria-label]="'Interval' | t" />
        <select [ngModel]="r.freq" (ngModelChange)="patch({ freq: $event, weekdays: undefined })" [attr.aria-label]="'Unit' | t">
          <option value="daily">{{ 'days' | t }}</option>
          <option value="weekly">{{ 'weeks' | t }}</option>
          <option value="monthly">{{ 'months' | t }}</option>
          <option value="yearly">{{ 'years' | t }}</option>
        </select>
      </div>
      @if (r.freq === 'weekly') {
        <div class="days" role="group" [attr.aria-label]="'On' | t">
          @for (d of days; track $index; let i = $index) {
            <button type="button" [class.on]="r.weekdays?.includes(i)" [attr.aria-pressed]="!!r.weekdays?.includes(i)" (click)="toggleDay(i)">{{ d | t }}</button>
          }
        </div>
      }
    }
    @if (rule(); as r) {
      <label class="small check"><input type="checkbox" [ngModel]="!!r.after_done" (ngModelChange)="patch({ after_done: $event || undefined })" />
        {{ 'Count from when it is done' | t }}</label>
      <label class="small until">{{ 'Until' | t }} <input type="date" [ngModel]="r.until ?? ''" (ngModelChange)="patch({ until: $event || undefined })" /></label>
    }
  `,
  styles: `
    :host { display: grid; gap: 6px; }
    .custom { display: flex; align-items: center; gap: 6px; }
    .custom input { width: 70px; }
    .days { display: flex; gap: 4px; flex-wrap: wrap; }
    .days button { border: 1px solid var(--line); background: transparent; color: inherit; border-radius: 999px; padding: 2px 8px; font: inherit; font-size: .8rem; cursor: pointer; }
    .days button.on { background: var(--brand, var(--accent)); border-color: transparent; color: #fff; }
    .check, .until { display: flex; align-items: center; gap: 6px; color: var(--muted); }
    .until input { width: auto; }
  `,
})
export class RepeatPicker {
  readonly value = input<Recurrence | null>(null);
  readonly changed = output<Recurrence | null>();
  protected readonly days = DAYS;
  protected rule = signal<Recurrence | null>(null);
  private custom = signal(false);

  constructor() {
    effect(() => this.rule.set(this.value() ? { ...this.value()! } : null));
  }

  protected readonly preset = computed<Preset>(() => {
    const r = this.rule();
    return !r ? '' : this.custom() ? 'custom' : this.base(r);
  });

  private base(r: Recurrence): Preset {
    const days = (r.weekdays ?? []).join(',');
    if (r.freq === 'daily' && r.interval === 1) return 'daily';
    if (r.freq === 'weekly' && r.interval === 1 && days === '0,1,2,3,4') return 'weekdays';
    if (r.freq === 'weekly' && !days && r.interval === 1) return 'weekly';
    if (r.freq === 'weekly' && !days && r.interval === 2) return 'biweekly';
    if (r.freq === 'monthly' && r.interval === 1) return 'monthly';
    if (r.freq === 'yearly' && r.interval === 1) return 'yearly';
    return 'custom';
  }

  protected choose(p: Preset) {
    this.custom.set(p === 'custom');
    const keep = { after_done: this.rule()?.after_done, until: this.rule()?.until };
    const rules: Record<Exclude<Preset, '' | 'custom'>, Recurrence> = {
      daily: { freq: 'daily', interval: 1 },
      weekdays: { freq: 'weekly', interval: 1, weekdays: [0, 1, 2, 3, 4] },
      weekly: { freq: 'weekly', interval: 1 },
      biweekly: { freq: 'weekly', interval: 2 },
      monthly: { freq: 'monthly', interval: 1 },
      yearly: { freq: 'yearly', interval: 1 },
    };
    const next = p === '' ? null : p === 'custom' ? (this.rule() ?? { freq: 'weekly', interval: 1 }) : { ...rules[p], ...keep };
    this.emit(next);
  }

  protected patch(change: Partial<Recurrence>) {
    const r = this.rule();
    if (r) this.emit({ ...r, ...change });
  }

  protected toggleDay(i: number) {
    const days = new Set(this.rule()?.weekdays ?? []);
    days.has(i) ? days.delete(i) : days.add(i);
    this.patch({ weekdays: days.size ? [...days].sort() : undefined });
  }

  private emit(r: Recurrence | null) {
    const clean = r ? (Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined)) as unknown as Recurrence) : null;
    this.rule.set(clean);
    this.changed.emit(clean);
  }
}

/** Short human text for a rule ("Every 2 weeks on Mon, Thu"), in English keys for translation. */
export function repeatText(r: Recurrence | null | undefined, t: (s: string, p?: Record<string, unknown>) => string): string {
  if (!r) return '';
  const unit = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[r.freq];
  let text = r.interval === 1 ? t(`Every ${unit}`) : t(`Every {n} ${unit}s`, { n: r.interval });
  if (r.weekdays?.length) text += ' · ' + r.weekdays.map((d) => t(DAYS[d])).join(', ');
  if (r.after_done) text += ' · ' + t('after done');
  return text;
}
