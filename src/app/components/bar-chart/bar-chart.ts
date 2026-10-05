import { Component, computed, input } from '@angular/core';

export interface Bar {
  label: string;
  value: number;
  /** Optional second series (e.g. created next to completed). */
  value2?: number;
  color?: string;
  title?: string;
}

/** A small dependency-free bar chart (vertical bars, e.g. per week; or horizontal rows, e.g. per project). */
@Component({
  selector: 'app-bar-chart',
  template: `
    @if (horizontal()) {
      <ul class="rows">
        @for (b of bars(); track b.label) {
          <li [title]="b.title ?? b.label + ': ' + format()(b.value)">
            <span class="name">{{ b.label }}</span>
            <span class="track"><span class="fill" [style.width.%]="pct(b.value)" [style.background]="b.color || 'var(--brand, var(--accent))'"></span></span>
            <span class="val">{{ format()(b.value) }}</span>
          </li>
        }
      </ul>
    } @else {
      <div class="cols" [style.height.px]="height()">
        @for (b of bars(); track b.label) {
          <div class="col" [title]="b.title ?? b.label + ': ' + format()(b.value)">
            <div class="stack">
              @if (b.value2 !== undefined) {
                <span class="bar alt" [style.height.%]="pct(b.value2)"></span>
              }
              <span class="bar" [style.height.%]="pct(b.value)" [style.background]="b.color || 'var(--brand, var(--accent))'"></span>
            </div>
            <span class="lab">{{ b.label }}</span>
          </div>
        }
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .cols { display: flex; align-items: stretch; gap: 4px; }
    .col { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .stack { flex: 1; display: flex; align-items: flex-end; gap: 2px; justify-content: center; }
    .bar { width: 100%; max-width: 26px; border-radius: 4px 4px 0 0; min-height: 1px; transition: height .3s ease; }
    .bar.alt { background: color-mix(in srgb, var(--muted) 35%, transparent); }
    .lab { font-size: .65rem; color: var(--muted); text-align: center; white-space: nowrap; overflow: hidden; margin-top: 3px; }
    .rows { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    .rows li { display: grid; grid-template-columns: minmax(80px, 30%) 1fr auto; align-items: center; gap: 8px; font-size: .82rem; }
    .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .track { height: 10px; background: var(--surface-2); border-radius: 5px; overflow: hidden; }
    .fill { display: block; height: 100%; border-radius: 5px; }
    .val { color: var(--muted); font-variant-numeric: tabular-nums; }
  `,
})
export class BarChart {
  readonly bars = input<Bar[]>([]);
  readonly horizontal = input(false);
  readonly height = input(120);
  readonly format = input<(v: number) => string>((v) => String(v));
  private readonly max = computed(() => Math.max(1, ...this.bars().flatMap((b) => [b.value, b.value2 ?? 0])));
  protected pct(v: number) {
    return (100 * v) / this.max();
  }
}
