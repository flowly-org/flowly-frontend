import { Component, computed, inject, signal } from '@angular/core';
import { Icon } from '../../components/icon/icon';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { Logo } from '../../components/logo/logo';
import { errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { TranslatePipe } from '../../core/i18n.pipes';
import { I18nService } from '../../core/i18n.service';

@Component({
  selector: 'app-auth-page',
  imports: [Icon, FormsModule, RouterLink, Logo, TranslatePipe],
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.scss',
})
export class AuthPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private i18n = inject(I18nService);

  protected mode = toSignal(inject(ActivatedRoute).data.pipe(map((d) => d['mode'] as 'login' | 'register')), {
    initialValue: 'login' as const,
  });
  protected isRegister = computed(() => this.mode() === 'register');

  protected email = '';
  protected password = '';
  protected fullName = '';
  protected code = this.route.snapshot.queryParamMap.get('code') ?? '';
  protected codeInfo = signal<{ valid: boolean; plan?: string; forever?: boolean; days?: number | null; detail?: string } | null>(null);
  private codeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (this.code) this.checkCode(this.code);
  }

  protected checkCode(value: string) {
    this.code = value;
    if (this.codeTimer) clearTimeout(this.codeTimer);
    if (value.trim().length < 6) {
      this.codeInfo.set(null);
      return;
    }
    this.codeTimer = setTimeout(async () => {
      try {
        this.codeInfo.set(await this.auth.checkCode(value.trim()));
      } catch {
        this.codeInfo.set(null);
      }
    }, 350);
  }
  protected busy = signal(false);
  protected error = signal<string | null>(null);

  async submit() {
    this.busy.set(true);
    this.error.set(null);
    try {
      if (this.isRegister()) await this.auth.register(this.email, this.password, this.fullName, this.code);
      else await this.auth.login(this.email, this.password);
      const next = this.route.snapshot.queryParamMap.get('next');
      this.router.navigateByUrl(next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
    } catch (err) {
      this.error.set(
        errorMessage(err, this.i18n.t(this.isRegister() ? 'Could not create your account.' : 'Wrong email or password.')),
      );
    } finally {
      this.busy.set(false);
    }
  }
}
