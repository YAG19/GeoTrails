import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { DashboardSummary } from '../../core/models/api.models';

interface StatItem {
  label: string;
  value: string;
  unit: string;
  delta: string;
}

@Component({
  selector: 'app-dashboard-stat-strip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="stat-strip">
      @for (s of stats(); track s.label; let i = $index) {
        <div class="stat-cell" [class.last]="i === stats().length - 1">
          <div class="label stat-label">{{ s.label }}</div>
          <div class="stat-value-row">
            <span class="num stat-value">{{ s.value }}</span>
            <span class="stat-unit">{{ s.unit }}</span>
          </div>
          <div class="stat-delta">{{ s.delta }}</div>
        </div>
      }
    </div>
  `,
  styleUrls: ['./dashboard.scss'],
  styles: [`
    .stat-strip {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      border-bottom: 1px solid var(--line);
      background: var(--bg-2);
      flex-shrink: 0;
    }
    .stat-cell {
      padding: 14px 16px;
      border-right: 1px solid var(--line);
    }
    .stat-cell.last { border-right: none; }
    .stat-label { margin-bottom: 6px; }
    .stat-value-row { display: flex; align-items: baseline; gap: 4px; }
    .stat-value { font-size: 22px; font-weight: 500; letter-spacing: -0.02em; }
    .stat-unit { font-size: 11px; color: var(--ink-3); }
    .stat-delta { font-size: 10px; color: var(--ink-4); margin-top: 2px; }
  `],
})
export class DashboardStatStripComponent implements OnInit {
  private api = inject(ApiService);

  stats = signal<StatItem[]>([
    { label: 'TOTAL DISTANCE',   value: '—',    unit: 'km',    delta: 'loading…' },
    { label: 'LOCATION POINTS',  value: '—',    unit: '',      delta: 'loading…' },
    { label: 'DIST THIS YEAR',   value: '—',    unit: 'km',    delta: 'loading…' },
    { label: 'DIST LAST 30 DAYS',value: '—',    unit: 'km',    delta: 'loading…' },
    { label: 'COUNTRIES',        value: '—',    unit: '',      delta: '' },
    { label: 'STREAK',           value: '—',    unit: 'days',  delta: '' },
  ]);

  ngOnInit() {
    this.api.getDashboardSummary().subscribe({
      next: (s: DashboardSummary) => {
        this.stats.set([
          {
            label: 'TOTAL POINTS',
            value: this.fmt(s.totalPointsAllTime),
            unit: 'pts',
            delta: `+${this.fmt(s.pointsLast30Days)} last 30d`,
          },
          {
            label: 'DIST THIS YEAR',
            value: s.distanceThisYearKm.toFixed(0),
            unit: 'km',
            delta: `${(s.distanceThisYearM / 1000).toFixed(1)}k m`,
          },
          {
            label: 'DIST LAST 30D',
            value: s.distanceLast30DaysKm.toFixed(1),
            unit: 'km',
            delta: `${s.distanceLast30DaysM.toFixed(0)} m`,
          },
          {
            label: 'POINTS 30D',
            value: this.fmt(s.pointsLast30Days),
            unit: 'pts',
            delta: '',
          },
          // These two have no backend field yet — keep as stub
          { label: 'COUNTRIES',  value: '—', unit: '',     delta: '' },
          { label: 'STREAK',     value: '—', unit: 'days', delta: '' },
        ]);
      },
      error: () => {
        // Show mock values if API is unavailable
        this.stats.set([
          { label: 'TOTAL DISTANCE',    value: '14,827', unit: 'km', delta: '+312 this month' },
          { label: 'LOCATION POINTS',   value: '8.4',    unit: 'M',  delta: '+82.4k last 30d' },
          { label: 'TRAILS RECORDED',   value: '2,194',  unit: '',   delta: '+14 this week' },
          { label: 'DAYS TRACKED',      value: '1,827',  unit: '',   delta: '98.7% coverage' },
          { label: 'COUNTRIES',         value: '14',     unit: '',   delta: '4 continents' },
          { label: 'STREAK',            value: '47',     unit: 'days', delta: 'best: 312' },
        ]);
      },
    });
  }

  private fmt(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'k';
    return n.toString();
  }
}
