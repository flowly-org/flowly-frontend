import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, firstValueFrom, map, shareReplay, tap } from 'rxjs';

import { ConfigService } from './config.service';
import { AuthResponse, User } from './models';

const ACCESS = 'flowly.access';
const REFRESH = 'flowly.refresh';

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage unavailable: session lasts until reload
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private config = inject(ConfigService);
  private router = inject(Router);

  readonly user = signal<User | null>(null);
  /** Set by I18nService: use the account's language on a device that has no choice saved yet. */
  adoptLanguage?: (lang: string | undefined) => void;
  readonly isLoggedIn = computed(() => this.user() !== null);

  private accessToken = storageGet(ACCESS);
  private refreshToken = storageGet(REFRESH);
  private refreshing$: Observable<string> | null = null;

  get token(): string | null {
    return this.accessToken;
  }

  get hasSession(): boolean {
    return !!this.refreshToken;
  }

  async login(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<AuthResponse>(`${this.config.apiUrl}/auth/login/`, { email, password }),
    );
    this.setTokens(res.access, res.refresh);
    await this.loadMe();
  }

  async register(email: string, password: string, fullName: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<AuthResponse>(`${this.config.apiUrl}/auth/register/`, {
        email,
        password,
        full_name: fullName,
        language: document.documentElement.lang || 'en',
      }),
    );
    this.setTokens(res.access, res.refresh);
    this.user.set(res.user ?? null);
  }

  async loadMe(): Promise<User | null> {
    if (!this.hasSession) return null;
    try {
      const me = await firstValueFrom(this.http.get<User>(`${this.config.apiUrl}/auth/me/`));
      this.user.set(me);
      this.adoptLanguage?.(me.language);
      return me;
    } catch {
      this.clear();
      return null;
    }
  }

  async updateProfile(data: Partial<Pick<User, 'full_name' | 'github_login' | 'language' | 'home_location' | 'adhd_mode' | 'focus'>>): Promise<void> {
    const me = await firstValueFrom(this.http.patch<User>(`${this.config.apiUrl}/auth/me/`, data));
    this.user.set(me);
  }

  /** Single in-flight refresh shared by all requests that hit a 401. */
  refresh(): Observable<string> {
    if (!this.refreshing$) {
      this.refreshing$ = this.http
        .post<AuthResponse>(`${this.config.apiUrl}/auth/refresh/`, { refresh: this.refreshToken })
        .pipe(
          tap({
            next: (res) => this.setTokens(res.access, res.refresh ?? this.refreshToken),
            finalize: () => (this.refreshing$ = null),
          }),
          map((res) => res.access),
          shareReplay(1),
        );
    }
    return this.refreshing$;
  }

  logout(): void {
    this.clear();
    this.router.navigateByUrl('/login');
  }

  clear(): void {
    this.setTokens(null, null);
    this.user.set(null);
  }

  private setTokens(access: string | null, refresh: string | null): void {
    this.accessToken = access;
    this.refreshToken = refresh;
    storageSet(ACCESS, access);
    storageSet(REFRESH, refresh);
  }
}
