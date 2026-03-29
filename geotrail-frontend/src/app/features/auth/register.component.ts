import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="auth-container">
      <div class="auth-card">
        <h1 class="auth-title">Create Account</h1>
        <p class="auth-subtitle">Start tracking your location history</p>

        @if (error()) {
          <div class="error-msg">{{ error() }}</div>
        }

        <form (ngSubmit)="onRegister()">
          <div class="form-group">
            <label>Username</label>
            <input type="text" [(ngModel)]="username" name="username" placeholder="Choose a username" required />
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" [(ngModel)]="email" name="email" placeholder="your@email.com" required />
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" [(ngModel)]="password" name="password" placeholder="Min 8 characters" required minlength="8" />
          </div>
          <button type="submit" class="btn-primary" [disabled]="loading()">
            {{ loading() ? 'Creating account...' : 'Create Account' }}
          </button>
        </form>

        <p class="auth-link">
          Already have an account? <a routerLink="/login">Sign in</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .auth-container { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); }
    .auth-card { background: var(--bg-card); padding: 48px 40px; border-radius: 16px; width: 100%; max-width: 420px; box-shadow: var(--shadow-lg); }
    .auth-title { text-align: center; font-size: 2rem; color: var(--text-primary); margin: 0 0 4px; }
    .auth-subtitle { text-align: center; color: var(--text-hint); margin: 0 0 32px; font-size: 0.95rem; }
    .form-group { margin-bottom: 20px; }
    label { display: block; margin-bottom: 6px; font-weight: 500; color: var(--text-secondary); font-size: 0.9rem; }
    input { width: 100%; padding: 12px 16px; border: 2px solid var(--border-color); border-radius: 10px; font-size: 1rem; transition: border-color 0.2s; box-sizing: border-box; background: var(--bg-input); color: var(--text-secondary); }
    input:focus { outline: none; border-color: #4fc3f7; }
    .btn-primary { width: 100%; padding: 14px; background: #4fc3f7; color: #fff; border: none; border-radius: 10px; font-size: 1rem; font-weight: 600; cursor: pointer; margin-top: 8px; }
    .btn-primary:hover:not(:disabled) { background: #29b6f6; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .error-msg { background: var(--danger-bg); color: var(--danger-text); padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 0.9rem; }
    .auth-link { text-align: center; margin-top: 24px; color: var(--text-hint); font-size: 0.9rem; }
    .auth-link a { color: #4fc3f7; text-decoration: none; font-weight: 500; }
  `],
})
export class RegisterComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  username = '';
  email = '';
  password = '';
  loading = signal(false);
  error = signal<string | null>(null);

  onRegister(): void {
    if (!this.username || !this.email || !this.password) return;

    this.loading.set(true);
    this.error.set(null);

    this.authService.register({ username: this.username, email: this.email, password: this.password }).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/app/map']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.message || 'Registration failed.');
      },
    });
  }
}
