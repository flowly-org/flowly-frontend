import { Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { Icon } from '../icon/icon';

import { TranslatePipe } from '../../core/i18n.pipes';
import { Task } from '../../core/models';

export interface SwipeLabels {
  where: (task: Task) => string;
  color: (task: Task) => string;
  carried: (task: Task) => boolean;
}

type Verdict = 'done' | 'keep';
const THRESHOLD = 0.28; // share of the card width that commits a swipe
const FLING = 0.6; // px/ms

/**
 * Tinder-style review of open tasks: swipe right (or ✓, →) to mark done, left (or ✕, ←) to keep it to do.
 * The parent does the actual status change through (decided) and reverts it through (undone).
 */
@Component({
  selector: 'app-swipe-deck',
  imports: [Icon, TranslatePipe],
  templateUrl: './swipe-deck.html',
  styleUrl: './swipe-deck.scss',
  host: { '(document:keydown)': 'onKey($event)' },
})
export class SwipeDeck {
  readonly tasks = input.required<Task[]>();
  readonly labels = input.required<SwipeLabels>();
  readonly decided = output<{ task: Task; verdict: Verdict }>();
  readonly undone = output<{ task: Task; verdict: Verdict }>();
  readonly closed = output<void>();

  private card = viewChild<ElementRef<HTMLElement>>('top');

  /** Tasks in the order they were dealt (fixed when the deck opens). */
  private deck = signal<Task[] | null>(null);
  protected index = signal(0);
  protected history = signal<{ task: Task; verdict: Verdict }[]>([]);
  protected dx = signal(0);
  protected dy = signal(0);
  protected dragging = signal(false);
  protected leaving = signal<Verdict | null>(null);

  private start = { x: 0, y: 0, t: 0 };
  private pointer: number | null = null;

  protected readonly cards = computed(() => {
    const deck = this.deck() ?? this.tasks();
    return deck.slice(this.index(), this.index() + 3);
  });
  protected readonly total = computed(() => (this.deck() ?? this.tasks()).length);
  protected readonly finished = computed(() => this.index() >= this.total());
  protected readonly doneCount = computed(() => this.history().filter((h) => h.verdict === 'done').length);
  protected readonly keptCount = computed(() => this.history().filter((h) => h.verdict === 'keep').length);
  /** -1…1: how far the card is towards keep (-) or done (+). */
  protected readonly lean = computed(() => {
    const width = this.card()?.nativeElement.offsetWidth || 320;
    return Math.max(-1, Math.min(1, this.dx() / (width * THRESHOLD)));
  });
  protected readonly transform = computed(() => {
    const leave = this.leaving();
    if (leave) return `translate(${leave === 'done' ? 150 : -150}vw, ${this.dy()}px) rotate(${leave === 'done' ? 30 : -30}deg)`;
    return `translate(${this.dx()}px, ${this.dy() * 0.3}px) rotate(${this.dx() / 18}deg)`;
  });

  ngOnInit() {
    this.deck.set([...this.tasks()]);
  }

  protected down(e: PointerEvent) {
    if (this.leaving() || this.pointer !== null) return;
    this.pointer = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.start = { x: e.clientX, y: e.clientY, t: performance.now() };
    this.dragging.set(true);
  }

  protected move(e: PointerEvent) {
    if (e.pointerId !== this.pointer) return;
    this.dx.set(e.clientX - this.start.x);
    this.dy.set(e.clientY - this.start.y);
  }

  protected up(e: PointerEvent) {
    if (e.pointerId !== this.pointer) return;
    this.pointer = null;
    this.dragging.set(false);
    const width = this.card()?.nativeElement.offsetWidth || 320;
    const speed = this.dx() / Math.max(1, performance.now() - this.start.t);
    if (Math.abs(this.dx()) > width * THRESHOLD || Math.abs(speed) > FLING) {
      this.decide(this.dx() > 0 ? 'done' : 'keep');
    } else {
      this.dx.set(0);
      this.dy.set(0);
    }
  }

  protected decide(verdict: Verdict) {
    const task = this.cards()[0];
    if (!task || this.leaving()) return;
    if (verdict === 'done') navigator.vibrate?.(25);
    this.leaving.set(verdict);
    this.decided.emit({ task, verdict });
    this.history.update((h) => [...h, { task, verdict }]);
    setTimeout(() => {
      this.leaving.set(null);
      this.dx.set(0);
      this.dy.set(0);
      this.index.update((i) => i + 1);
    }, 260);
  }

  protected undo() {
    const last = this.history().at(-1);
    if (!last || this.leaving()) return;
    this.history.update((h) => h.slice(0, -1));
    this.index.update((i) => Math.max(0, i - 1));
    this.undone.emit(last);
  }

  protected onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') this.decide('done');
    else if (e.key === 'ArrowLeft') this.decide('keep');
    else if (e.key === 'Escape') this.closed.emit();
    else if ((e.key === 'z' && (e.ctrlKey || e.metaKey)) || e.key === 'Backspace') this.undo();
  }
}
