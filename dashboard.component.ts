import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth/auth.service';

import { DashboardSidebarComponent }       from './dashboard-sidebar.component';
import { DashboardTopbarComponent }         from './dashboard-topbar.component';
import { DashboardStatStripComponent }      from './dashboard-stat-strip.component';
import { DashboardMapComponent }            from './dashboard-map.component';
import {
  DashboardTopPlacesComponent,
  DashboardDistanceChartComponent,
  DashboardActivityCalendarComponent,
  DashboardRecentTrailsComponent,
  DashboardPolarClockComponent,
} from './dashboard-modules.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    DashboardSidebarComponent,
    DashboardTopbarComponent,
    DashboardStatStripComponent,
    DashboardMapComponent,
    DashboardTopPlacesComponent,
    DashboardDistanceChartComponent,
    DashboardActivityCalendarComponent,
    DashboardRecentTrailsComponent,
    DashboardPolarClockComponent,
  ],
  template: `
    <div class="dash-shell">
      <app-dashboard-sidebar></app-dashboard-sidebar>

      <div class="dash-main">
        <app-dashboard-topbar
          [scope]="scope()"
          [theme]="theme()"
          (scopeChange)="onScopeChange($event)"
          (themeChange)="onThemeChange($event)"
        ></app-dashboard-topbar>

        <app-dashboard-stat-strip></app-dashboard-stat-strip>

        <!-- content grid -->
        <div class="dash-content">
          <!-- left: full-height map -->
          <div class="dash-map-col">
            <app-dashboard-map [scope]="scope()"></app-dashboard-map>
          </div>

          <!-- right: scrollable modules rail -->
          <div class="dash-rail">
            <app-dashboard-top-places></app-dashboard-top-places>
            <app-dashboard-distance-chart></app-dashboard-distance-chart>
            <app-dashboard-activity-calendar></app-dashboard-activity-calendar>
            <app-dashboard-polar-clock></app-dashboard-polar-clock>
            <app-dashboard-recent-trails></app-dashboard-recent-trails>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./dashboard.scss'],
  styles: [`
    :host { display: block; height: 100%; }

    .dash-shell {
      display: grid;
      grid-template-columns: 220px 1fr;
      height: 100%;
      overflow: hidden;
      background: var(--bg);
      color: var(--ink);
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 12.5px;
      -webkit-font-smoothing: antialiased;
    }

    .dash-main {
      display: flex; flex-direction: column;
      overflow: hidden;
    }

    .dash-content {
      flex: 1; min-height: 0;
      display: grid;
      grid-template-columns: 1.6fr 1fr;
      overflow: hidden;
    }

    .dash-map-col {
      display: flex; flex-direction: column;
      padding: 14px 7px 14px 14px;
      min-height: 0; overflow: hidden;
    }

    .dash-rail {
      overflow-y: auto;
      padding: 14px 14px 14px 7px;
      display: flex; flex-direction: column; gap: 14px;
      border-left: 1px solid var(--line);
    }

    @media (max-width: 1100px) {
      .dash-content { grid-template-columns: 1fr; }
      .dash-map-col { min-height: 400px; }
      .dash-rail { border-left: none; border-top: 1px solid var(--line); }
    }
  `],
})
export class DashboardComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);

  scope = signal('ALL');
  theme = signal<'dark' | 'light'>('dark');
  private prevTheme: string | null = null;

  ngOnInit() {
    const saved = localStorage.getItem('gt-theme') as 'dark' | 'light' | null;
    if (saved) this.theme.set(saved);
    this.prevTheme = document.body.getAttribute('data-theme');
    document.body.setAttribute('data-theme', this.theme());
  }

  ngOnDestroy() {
    if (this.prevTheme === null) document.body.removeAttribute('data-theme');
    else document.body.setAttribute('data-theme', this.prevTheme);
  }

  onScopeChange(s: string) { this.scope.set(s); }

  onThemeChange(t: 'dark' | 'light') {
    this.theme.set(t);
    document.body.setAttribute('data-theme', t);
    try { localStorage.setItem('gt-theme', t); } catch {}
  }
}
