import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DashboardTopbarComponent }         from './dashboard-topbar.component';
import { DashboardStatStripComponent }      from './dashboard-stat-strip.component';
import { DashboardMapComponent }            from './dashboard-map.component';
import { DashboardPlaybackComponent }       from './dashboard-playback.component';
import {
  DashboardTopPlacesComponent,
  DashboardDistanceChartComponent,
  DashboardActivityCalendarComponent,
  DashboardRecentTrailsComponent,
  DashboardPolarClockComponent,
  DashboardTransportBreakdownComponent,
  DashboardCommutePatternsComponent,
  DashboardDwellComponent,
  DashboardTripLogComponent,
  DashboardNotableComponent,
} from './dashboard-modules.component';
import {
  DashboardRecordsComponent,
  DashboardWeeklyRhythmComponent,
  DashboardFootprintComponent,
  DashboardExplorationComponent,
} from './dashboard-insights.component';

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
    DashboardPlaybackComponent,
    DashboardTopPlacesComponent,
    DashboardDistanceChartComponent,
    DashboardActivityCalendarComponent,
    DashboardRecentTrailsComponent,
    DashboardPolarClockComponent,
    DashboardTransportBreakdownComponent,
    DashboardCommutePatternsComponent,
    DashboardDwellComponent,
    DashboardTripLogComponent,
    DashboardNotableComponent,
    DashboardRecordsComponent,
    DashboardWeeklyRhythmComponent,
    DashboardFootprintComponent,
    DashboardExplorationComponent,
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
          <!-- view toggle: static heatmap vs animated playback -->
          <div class="view-toggle">
            <button class="vt-btn" [class.on]="mapMode() === 'map'" (click)="mapMode.set('map')">▦ heatmap</button>
            <button class="vt-btn" [class.on]="mapMode() === 'playback'" (click)="mapMode.set('playback')">▶ playback</button>
          </div>
          @if (mapMode() === 'map') {
            <app-dashboard-map [scope]="scope()" [filter]="filter()"></app-dashboard-map>
          } @else {
            <app-dashboard-playback [scope]="scope()" [filter]="filter()"></app-dashboard-playback>
          }
         </div>
        <div class="dash-rail">
          <app-dashboard-records [scope]="scope()"></app-dashboard-records>
          <app-dashboard-notable [scope]="scope()"></app-dashboard-notable>
          <app-dashboard-transport-breakdown [scope]="scope()"></app-dashboard-transport-breakdown>
          <app-dashboard-footprint [scope]="scope()"></app-dashboard-footprint>
          <app-dashboard-exploration [scope]="scope()"></app-dashboard-exploration>
          <app-dashboard-top-places></app-dashboard-top-places>
          <app-dashboard-trip-log class="rail-span" [scope]="scope()"></app-dashboard-trip-log>
          <app-dashboard-commute-patterns></app-dashboard-commute-patterns>
          <app-dashboard-dwell [scope]="scope()"></app-dashboard-dwell>
          <app-dashboard-polar-clock [scope]="scope()"></app-dashboard-polar-clock>
          <app-dashboard-weekly-rhythm [scope]="scope()"></app-dashboard-weekly-rhythm>
          <app-dashboard-distance-chart class="rail-span"></app-dashboard-distance-chart>
          <app-dashboard-activity-calendar class="rail-span"></app-dashboard-activity-calendar>
          <app-dashboard-recent-trails class="rail-span"></app-dashboard-recent-trails>
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

    .view-toggle { display: flex; gap: 6px; margin-bottom: 10px; }
    .vt-btn {
      padding: 3px 10px; background: transparent; border: 1px solid var(--line);
      color: var(--ink-3); font-family: inherit; font-size: 11px; cursor: pointer;
    }
    .vt-btn.on { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }

    .dash-rail {
      overflow-y: auto;
      padding: 14px 14px 14px 7px;
      display: grid;
      grid-template-columns: 1fr;
      gap: 14px;
      align-content: start;
      border-left: 1px solid var(--line);
    }

    /* Wide viewports: two-column rail, charts span both */
    @media (min-width: 1640px) {
      .dash-rail { grid-template-columns: 1fr 1fr; }
      .dash-rail > .rail-span { grid-column: 1 / -1; }
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
  mapMode = signal<'map' | 'playback'>('map');

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
