import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ToastHost } from './components/toast/toast-host';
import { setupNative } from './core/native';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastHost],
  template: `<router-outlet /><app-toast-host />`,
})
export class App {
  constructor() {
    // Android back button: close the topmost dialog (they listen for Escape), else navigate back.
    setupNative(() => {
      const dialog = document.querySelector('app-task-dialog, app-bulk-add');
      if (!dialog) return false;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      return true;
    });
  }
}
