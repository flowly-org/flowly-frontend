import { Injectable } from '@angular/core';

import { isNative } from './native';

interface AppConfig {
  apiUrl: string;
}

/** Runtime config read from /config.json so one build can target any backend. */
@Injectable({ providedIn: 'root' })
export class ConfigService {
  private config: AppConfig = { apiUrl: 'http://localhost:8000/api' };

  get apiUrl(): string {
    return this.config.apiUrl.replace(/\/$/, '');
  }

  async load(): Promise<void> {
    try {
      const res = await fetch('config.json', { cache: 'no-store' });
      if (res.ok) this.config = { ...this.config, ...(await res.json()) };
    } catch {
      // keep defaults
    }
    // The mobile apps aren't served from Flowly's origin, so a relative API URL can't work there.
    if (isNative() && !/^https?:/.test(this.config.apiUrl)) this.config.apiUrl = 'https://api.flowly.net/api';
  }
}
