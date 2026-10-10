import { Injectable } from '@angular/core';

import { isNative } from './native';
import { DEFAULT_SERVER, activeServer } from './servers';

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
    // The mobile apps aren't served from a Flowly server: they talk to the one picked on the device.
    if (isNative()) this.config.apiUrl = (activeServer() ?? DEFAULT_SERVER).apiUrl;
  }
}
