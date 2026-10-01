import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-auth-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.scss',
})
export class AuthPage {
  private auth = inject(AuthService);
  private router = inject(Router);

  protected mode = toSignal(inject(ActivatedRoute).data.pipe(map((d) => d['mode'] as 'login' | 'register')), {
    initialValue: 'login' as const,
  });
  protected isRegister = computed(() => this.mode() === 'register');

  protected email = '';
  protected password = '';
  protected fullName = '';
  protected busy = signal(false);
  protected error = signal<string | null>(null);

  async submit() {
    this.busy.set(true);
    this.error.set(null);
    try {
      if (this.isRegister()) await this.auth.register(this.email, this.password, this.fullName);
      else await this.auth.login(this.email, this.password);
      this.router.navigateByUrl('/');
    } catch (err) {
      this.error.set(
        errorMessage(err, this.isRegister() ? 'Could not create your account.' : 'Wrong email or password.'),
      );
    } finally {
      this.busy.set(false);
    }
  }
}
