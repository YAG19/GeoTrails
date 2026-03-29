import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    @if (authService.isAuthenticated()) {
      <div class="app-layout">
        <nav class="sidebar">
          <div class="sidebar-header">
            <h1 class="logo">GeoTrail</h1>
            <span class="username">{{ authService.username() }}</span>
          </div>
          <ul class="nav-links">
            <li>
              <a routerLink="/app/map" routerLinkActive="active">
                <span class="icon">🗺️</span> Map
              </a>
            </li>
            <li>
              <a routerLink="/app/live" routerLinkActive="active">
                <span class="icon">📡</span> Live Tracking
              </a>
            </li>
            <li>
              <a routerLink="/app/dashboard" routerLinkActive="active">
                <span class="icon">📊</span> Dashboard
              </a>
            </li>
            <li>
              <a routerLink="/app/import" routerLinkActive="active">
                <span class="icon">📥</span> Import
              </a>
            </li>
            <li>
              <a routerLink="/app/places" routerLinkActive="active">
                <span class="icon">📍</span> Places
              </a>
            </li>
            <li>
              <a routerLink="/app/settings" routerLinkActive="active">
                <span class="icon">⚙️</span> Settings
              </a>
            </li>
          </ul>
          <div class="sidebar-footer">
            <button class="theme-toggle-btn" (click)="themeService.toggleTheme()" [title]="themeService.isDarkMode() ? 'Switch to light mode' : 'Switch to dark mode'">
              {{ themeService.isDarkMode() ? '☀️ Light Mode' : '🌙 Dark Mode' }}
            </button>
            <button class="logout-btn" (click)="authService.logout()">
              Logout
            </button>
          </div>
        </nav>
        <main class="content">
          <router-outlet />
        </main>
      </div>
    } @else {
      <router-outlet />
    }
  `,
  styles: [`
    .app-layout {
      display: flex;
      height: 100vh;
      overflow: hidden;
    }

    .sidebar {
      width: 240px;
      background: #1a1a2e;
      color: #e0e0e0;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }

    .sidebar-header {
      padding: 24px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .logo {
      font-size: 1.5rem;
      font-weight: 700;
      color: #4fc3f7;
      margin: 0 0 4px;
    }

    .username {
      font-size: 0.85rem;
      color: #888;
    }

    .nav-links {
      list-style: none;
      padding: 12px 0;
      margin: 0;
      flex: 1;
    }

    .nav-links a {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 20px;
      color: #b0b0b0;
      text-decoration: none;
      font-size: 0.95rem;
      transition: all 0.2s;
      border-left: 3px solid transparent;
    }

    .nav-links a:hover {
      background: rgba(79, 195, 247, 0.08);
      color: #fff;
    }

    .nav-links a.active {
      background: rgba(79, 195, 247, 0.12);
      color: #4fc3f7;
      border-left-color: #4fc3f7;
    }

    .icon {
      font-size: 1.1rem;
      width: 24px;
      text-align: center;
    }

    .sidebar-footer {
      padding: 16px 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .theme-toggle-btn {
      width: 100%;
      padding: 10px;
      background: rgba(79, 195, 247, 0.1);
      color: #4fc3f7;
      border: 1px solid rgba(79, 195, 247, 0.3);
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.2s;
    }

    .theme-toggle-btn:hover {
      background: rgba(79, 195, 247, 0.2);
    }

    .logout-btn {
      width: 100%;
      padding: 10px;
      background: rgba(244, 67, 54, 0.15);
      color: #ef5350;
      border: 1px solid rgba(244, 67, 54, 0.3);
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.2s;
    }

    .logout-btn:hover {
      background: rgba(244, 67, 54, 0.25);
    }

    .content {
      flex: 1;
      overflow: auto;
      background: var(--bg-page);
    }
  `],
})
export class AppComponent {
  authService = inject(AuthService);
  themeService = inject(ThemeService);
}
