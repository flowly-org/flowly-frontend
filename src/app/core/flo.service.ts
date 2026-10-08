import { Injectable, signal } from '@angular/core';

/** The Flo panel's open state, and a counter bumped whenever Flo changed tasks (so boards reload). */
@Injectable({ providedIn: 'root' })
export class FloService {
  readonly open = signal(false);
  /** Open the "plan my week" dialog (from the panel or the empty day). */
  readonly planning = signal(false);
  readonly changed = signal(0);

  toggle() {
    this.open.set(!this.open());
  }

  touched() {
    this.changed.update((n) => n + 1);
  }
}
