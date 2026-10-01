import { Component, inject } from '@angular/core';

import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-toast-host',
  template: `
    <div class="toasts" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <button type="button" class="toast" [class.error]="t.kind === 'error'" (click)="toast.dismiss(t.id)">
          {{ t.text }}
        </button>
      }
    </div>
  `,
  styles: `
    .toasts { position: fixed; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); left: 50%; transform: translateX(-50%);
      display: flex; flex-direction: column; gap: 8px; z-index: 1000; width: min(420px, calc(100vw - 32px)); }
    .toast { background: var(--ink); color: var(--bg); border: 0; border-radius: 10px; padding: 10px 14px;
      text-align: left; font: inherit; box-shadow: var(--shadow-lg); cursor: pointer; }
    .toast.error { background: var(--danger); color: #fff; }
  `,
})
export class ToastHost {
  protected toast = inject(ToastService);
}
