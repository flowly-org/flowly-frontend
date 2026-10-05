import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TranslatePipe } from '../../core/i18n.pipes';
import { ChecklistItem } from '../../core/models';

/** Tickable checklist of a task: tick, add, rename, remove. Emits the whole list on every change. */
@Component({
  selector: 'app-task-checklist',
  imports: [FormsModule, TranslatePipe],
  template: `
    @if (items().length) {
      <div class="head">
        <span class="small muted">{{ 'Checklist' | t }} · {{ done() }}/{{ items().length }}</span>
        <span class="bar"><span [style.width.%]="pct()"></span></span>
      </div>
    }
    <ul>
      @for (item of items(); track item.id ?? $index; let i = $index) {
        <li [class.done]="item.done">
          <input type="checkbox" [checked]="item.done" (change)="toggle(i)" [attr.aria-label]="item.text" />
          @if (editing() === i) {
            <input class="edit" [ngModel]="item.text" (keydown.enter)="rename(i, $any($event.target).value)" (blur)="rename(i, $any($event.target).value)" autofocus />
          } @else {
            <span class="text" (dblclick)="editing.set(i)">{{ item.text }}</span>
          }
          <button type="button" class="x" [attr.aria-label]="'Remove' | t" (click)="remove(i)">✕</button>
        </li>
      }
    </ul>
    <input class="add" [(ngModel)]="draft" [placeholder]="'+ Add an item' | t" (keydown.enter)="add($event)" [attr.aria-label]="'Add a checklist item' | t" />
  `,
  styles: `
    :host { display: block; }
    .head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .bar { flex: 1; height: 4px; border-radius: 4px; background: var(--surface-2); overflow: hidden; }
    .bar span { display: block; height: 100%; background: var(--success, #16a34a); transition: width .2s ease; }
    ul { list-style: none; margin: 0; padding: 0; }
    li { display: flex; align-items: center; gap: 8px; padding: 3px 0; }
    li.done .text { text-decoration: line-through; color: var(--muted); }
    .text { flex: 1; overflow-wrap: anywhere; cursor: text; }
    .edit { flex: 1; padding: 2px 6px; }
    .x { border: 0; background: none; color: var(--muted); cursor: pointer; opacity: 0; font-size: .8rem; }
    li:hover .x, .x:focus-visible { opacity: 1; }
    .add { width: 100%; margin-top: 4px; border: 1px dashed var(--line); background: transparent; padding: 6px 8px; border-radius: 8px; }
  `,
})
export class TaskChecklist {
  readonly items = input<ChecklistItem[]>([]);
  readonly changed = output<ChecklistItem[]>();
  protected draft = '';
  protected editing = signal<number | null>(null);
  protected readonly done = computed(() => this.items().filter((i) => i.done).length);
  protected readonly pct = computed(() => (this.items().length ? (100 * this.done()) / this.items().length : 0));

  protected toggle(i: number) {
    this.changed.emit(this.items().map((item, j) => (j === i ? { ...item, done: !item.done } : item)));
  }

  protected add(event: Event) {
    event.preventDefault(); // inside a form: don't submit it
    const text = this.draft.trim();
    if (!text) return;
    this.draft = '';
    this.changed.emit([...this.items(), { text, done: false }]);
  }

  protected rename(i: number, text: string) {
    this.editing.set(null);
    const value = text.trim();
    if (!value || value === this.items()[i]?.text) return;
    this.changed.emit(this.items().map((item, j) => (j === i ? { ...item, text: value } : item)));
  }

  protected remove(i: number) {
    this.changed.emit(this.items().filter((_, j) => j !== i));
  }
}
