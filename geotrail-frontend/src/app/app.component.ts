import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    @if (authService.isAuthenticated() && !isLandingPage()) {
      <div class="app-layout">
        <nav class="sidebar">
          <!-- logo -->
          <div class="sidebar-header">
            <div class="logo-row">
              <span class="logo-mark">◉</span>
              <div>
                <div class="logo-name">GEOTRAIL</div>
                <div class="logo-sub">{{ authService.username() }}</div>
              </div>
            </div>
          </div>

          <!-- nav -->
          <ul class="nav-links">
            <!-- <li><a routerLink="/map"       routerLinkActive="active"><span class="nav-icon">◈</span> Map</a></li> -->
            <!--  <li><a routerLink="/live"      routerLinkActive="active"><span class="nav-icon live-dot"></span> Live</a></li> -->
            <li><a routerLink="/dashboard" routerLinkActive="active"><span class="nav-icon">◉</span> Dashboard</a></li>
            <li><a routerLink="/import"    routerLinkActive="active"><span class="nav-icon">↓</span> Import</a></li>
            <li><a routerLink="/places"    routerLinkActive="active"><span class="nav-icon">◆</span> Places</a></li>
            <li><a routerLink="/assistant" routerLinkActive="active"><span class="nav-icon">💬</span> Assistant</a></li>
            <li><a routerLink="/settings"  routerLinkActive="active"><span class="nav-icon">⚙</span> Settings</a></li>
          </ul>

          <div class="sidebar-footer">
            <span class="conn-status">● connected</span>
            <button class="logout-btn" (click)="authService.logout()">logout</button>
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
    .app-layout { display: flex; height: 100vh; overflow: hidden; }

    /* ── Sidebar ── */
    .sidebar {
      width: 220px; flex-shrink: 0;
      background: #0d0d0d;
      border-right: 1px solid #242424;
      display: flex; flex-direction: column;
      font-family: 'JetBrains Mono', ui-monospace, monospace;
    }
    .sidebar-header {
      padding: 14px 18px;
      border-bottom: 1px solid #242424;
    }
    .logo-row { display: flex; align-items: center; gap: 10px; }
    .logo-mark {
      width: 22px; height: 22px;
      border: 1.5px solid #ff5a36;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 11px; color: #ff5a36; font-weight: 700; flex-shrink: 0;
    }
    .logo-name { font-size: 12px; font-weight: 600; letter-spacing: 0.06em; color: #ededea; line-height: 1.1; }
    .logo-sub  { font-size: 9.5px; color: #5a5550; }

    .nav-links {
      list-style: none; padding: 12px 0; margin: 0; flex: 1; overflow: auto;
    }
    .nav-links a {
      display: flex; align-items: center; gap: 12px;
      padding: 9px 18px;
      color: #8a847b; text-decoration: none;
      font-size: 12.5px;
      border-left: 2px solid transparent;
      transition: background 120ms, color 120ms;
    }
    .nav-links a:hover { background: rgba(255,90,54,0.06); color: #c9c5be; }
    .nav-links a.active {
      background: rgba(255,90,54,0.10);
      color: #ededea;
      border-left-color: #ff5a36;
    }
    .nav-icon { width: 14px; text-align: center; font-size: 12px; }
    .live-dot {
      display: inline-block;
      width: 6px; height: 6px; border-radius: 50%;
      background: #ff5a36;
      animation: gt-pulse-dot 1.6s infinite;
    }

    .sidebar-footer {
      padding: 12px 18px;
      border-top: 1px solid #242424;
      display: flex; justify-content: space-between; align-items: center;
      font-size: 10px;
    }
    .conn-status { color: #5a5550; }
    .logout-btn {
      background: transparent;
      border: 1px solid #3a3a3a;
      color: #8a847b;
      font-family: inherit; font-size: 10px;
      padding: 4px 10px; cursor: pointer;
    }
    .logout-btn:hover { border-color: #ff5a36; color: #ff5a36; }

    /* ── Main content ── */
    .content { flex: 1; overflow: auto; background: #f5f5f5; }
  `],
})
export class AppComponent implements OnInit {
  authService = inject(AuthService);
  private router = inject(Router);
  isLandingPage = signal(false);

  ngOnInit() {
    this.isLandingPage.set(this.router.url.startsWith('/landing'));
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      this.isLandingPage.set(e.url.startsWith('/landing'));
    });
  }
}
