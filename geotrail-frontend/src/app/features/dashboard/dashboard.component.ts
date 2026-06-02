import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

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

/**
 * DashboardComponent
 *
 * Fills the authenticated <main class="content"> area.
 * The app sidebar lives in AppComponent — we don't render one here.
 *
 * On init  → sets data-theme on <body> (activates CSS variable tokens)
 * On destroy → restores previous data-theme so other routes are unaffected
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
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
    <div class="dash-root">
      <!-- topbar: scope picker + theme toggle + clock -->
      <app-dashboard-topbar
        [scope]="scope()"
        [theme]="theme()"
        [filter]="filter()"
        (filterChange)="onFilterChange($event)"
        (scopeChange)="onScopeChange($event)"
        (themeChange)="onThemeChange($event)"
      ></app-dashboard-topbar>

      <!-- stat strip: live data from ApiService, updates with scope -->
      <app-dashboard-stat-strip [scope]="scope()"></app-dashboard-stat-strip>

      <!-- main content: map left, modules rail right -->
      <div class="dash-content">
        <div class="dash-map-col">
          <app-dashboard-map [scope]="scope()" [filter]="filter()"></app-dashboard-map> 
         </div> 
        <div class="dash-rail">
          <app-dashboard-top-places></app-dashboard-top-places>
          <app-dashboard-distance-chart></app-dashboard-distance-chart>
          <app-dashboard-activity-calendar></app-dashboard-activity-calendar>
          <app-dashboard-polar-clock></app-dashboard-polar-clock>
          <app-dashboard-recent-trails></app-dashboard-recent-trails>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./dashboard.scss'],
  styles: [`
    :host { display: block; height: 100%; }

    .dash-root {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
      background: var(--bg);
      color: var(--ink);
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 12.5px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }

    .dash-content {
      flex: 1;
      min-height: 0;
      display: grid;
      grid-template-columns: 1.6fr 1fr;
      overflow: hidden;
    }

    .dash-map-col {
      display: flex;
      flex-direction: column;
      padding: 14px 7px 14px 14px;
      min-height: 0;
      overflow: hidden;
    }

    .dash-rail {
      overflow-y: auto;
      padding: 14px 14px 14px 7px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      border-left: 1px solid var(--line);
    }

    /* Narrow viewports: stack map above modules */
    @media (max-width: 1100px) {
      .dash-content { grid-template-columns: 1fr; overflow-y: auto; }
      .dash-map-col { min-height: 420px; overflow: hidden; }
      .dash-rail    { border-left: none; border-top: 1px solid var(--line); }
    }
  `],
})
export class DashboardComponent implements OnInit, OnDestroy {
  scope = signal('6M');
  theme = signal<'dark' | 'light'>('dark');
  filter = signal('all');

  private prevBodyTheme: string | null = null;

  ngOnInit() {
    // Restore any previously saved preference
    try {
      const saved = localStorage.getItem('gt-theme') as 'dark' | 'light' | null;
      if (saved) this.theme.set(saved);
    } catch {}

    // Activate theme tokens — remember what was there before
    this.prevBodyTheme = document.body.getAttribute('data-theme');
    document.body.setAttribute('data-theme', this.theme());
  }

  ngOnDestroy() {
    // Restore previous state so other routes (login, map, etc.) are unaffected
    if (this.prevBodyTheme === null) {
      document.body.removeAttribute('data-theme');
    } else {
      document.body.setAttribute('data-theme', this.prevBodyTheme);
    }
  }


  onFilterChange(f: string) {
    this.filter.set(f);
  }

  onScopeChange(s: string) {
    this.scope.set(s);
  }

  onThemeChange(t: 'dark' | 'light') {
    this.theme.set(t);
    document.body.setAttribute('data-theme', t);
    try { localStorage.setItem('gt-theme', t); } catch {}
  }
}
