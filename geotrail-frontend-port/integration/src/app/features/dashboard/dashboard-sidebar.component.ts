import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

interface NavItem {
  id: string;
  icon: string;
  label: string;
  sub: string;
  live?: boolean;
  route: string;
}

@Component({
  selector: 'app-dashboard-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <aside class="sidebar">
      <!-- logo -->
      <div class="sb-logo">
        <span class="logo-mark">◉</span>
        <div class="logo-text">
          <div class="logo-name">GEOTRAIL</div>
          <div class="logo-ver">v0.4.2 · self-hosted</div>
        </div>
      </div>

      <!-- nav -->
      <nav class="sb-nav">
        <div class="label sb-section-title">WORKSPACE</div>
        @for (it of navItems; track it.id) {
          <a [routerLink]="it.route" routerLinkActive="active" class="sb-item">
            <span class="sb-icon">
              @if (it.live) { <span class="live-dot"></span> }
              @else { {{ it.icon }} }
            </span>
            <span class="sb-label">{{ it.label }}</span>
            @if (it.sub) { <span class="sb-sub">{{ it.sub }}</span> }
          </a>
        }

        <div class="sb-spacer"></div>
        <div class="label sb-section-title">DEVICES · 3</div>
        <div class="device-row">
          <span class="device-dot accent"></span>
          <span class="device-name">iPhone 15</span>
          <span class="device-status">live · 2s</span>
        </div>
        <div class="device-row">
          <span class="device-dot accent"></span>
          <span class="device-name">Garmin Fenix</span>
          <span class="device-status">paired</span>
        </div>
        <div class="device-row">
          <span class="device-dot"></span>
          <span class="device-name">Pixel 8</span>
          <span class="device-status">last 2d</span>
        </div>

        <div class="sb-spacer"></div>
        <div class="label sb-section-title">SAVED VIEWS</div>
        <button class="saved-view">↳ berlin 2024</button>
        <button class="saved-view">↳ japan trip</button>
        <button class="saved-view">↳ commute only</button>
      </nav>

      <!-- footer -->
      <div class="sb-footer">
        <span>● connected</span>
        <span class="num">db 2.4G</span>
      </div>
    </aside>
  `,
  styleUrls: ['./dashboard.scss'],
  styles: [`
    .sidebar {
      background: var(--bg-2);
      border-right: 1px solid var(--line);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      width: 220px;
      flex-shrink: 0;
    }
    .sb-logo {
      padding: 14px 18px;
      border-bottom: 1px solid var(--line);
      display: flex; align-items: center; gap: 10px;
    }
    .logo-mark {
      width: 22px; height: 22px;
      border: 1.5px solid var(--accent);
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 11px; color: var(--accent); font-weight: 700;
    }
    .logo-name { font-size: 12.5px; font-weight: 600; letter-spacing: 0.06em; line-height: 1.1; }
    .logo-ver { font-size: 9.5px; color: var(--ink-4); }
    .sb-nav { flex: 1; padding: 12px 0; overflow: auto; }
    .sb-section-title { padding: 0 18px 8px; }
    .sb-item {
      display: flex; align-items: center; gap: 12px;
      padding: 8px 18px;
      color: var(--ink-2); text-decoration: none;
      font-family: 'JetBrains Mono', monospace; font-size: 12.5px;
      border-left: 2px solid transparent;
      transition: background 120ms;
    }
    .sb-item:hover { background: color-mix(in oklab, var(--ink) 4%, transparent); }
    .sb-item.active {
      background: var(--accent-soft);
      border-left-color: var(--accent);
      color: var(--ink);
    }
    .sb-item.active .sb-icon { color: var(--accent); }
    .sb-icon { width: 14px; color: var(--ink-3); display: inline-flex; justify-content: center; }
    .sb-label { flex: 1; }
    .sb-sub { font-size: 10px; color: var(--ink-4); }
    .sb-spacer { height: 22px; }
    .device-row {
      display: flex; align-items: center; gap: 10px;
      padding: 5px 18px; font-size: 11.5px;
    }
    .device-dot {
      width: 6px; height: 6px; border-radius: 50%; background: var(--ink-4);
    }
    .device-dot.accent { background: var(--accent); }
    .device-name { flex: 1; color: var(--ink-2); }
    .device-status { font-size: 9.5px; color: var(--ink-4); }
    .saved-view {
      display: flex; align-items: center; gap: 10px;
      padding: 5px 18px; width: 100%;
      background: transparent; border: none;
      font-family: 'JetBrains Mono', monospace; font-size: 11.5px;
      color: var(--ink-2); text-align: left; cursor: pointer;
    }
    .saved-view:hover { color: var(--ink); }
    .sb-footer {
      padding: 12px 18px;
      border-top: 1px solid var(--line);
      font-size: 10px; color: var(--ink-4);
      display: flex; justify-content: space-between;
    }
  `],
})
export class DashboardSidebarComponent {
  navItems: NavItem[] = [
    { id: 'overview', icon: '◉', label: 'Overview', sub: '', route: '/dashboard' },
    { id: 'map',      icon: '◈', label: 'Map',      sub: '', route: '/map' },
    { id: 'live',     icon: '●', label: 'Live',     sub: 'tracking', live: true, route: '/live' },
    { id: 'trails',   icon: '∿', label: 'Trails',   sub: '', route: '/map' },
    { id: 'places',   icon: '◆', label: 'Places',   sub: '', route: '/places' },
    { id: 'import',   icon: '↓', label: 'Import',   sub: '3 queued', route: '/import' },
    { id: 'settings', icon: '⚙', label: 'Settings', sub: '', route: '/settings' },
  ];
}
