import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;

  show(text: string, kind: Toast['kind'] = 'info'): void {
    const id = ++this.seq;
    this.toasts.update((list) => [...list, { id, text, kind }]);
    setTimeout(() => this.dismiss(id), kind === 'error' ? 6000 : 3000);
  }

  error(text: string): void {
    this.show(text, 'error');
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
