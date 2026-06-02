import { Component, OnInit, Input, signal, inject } from '@angular/core';
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

  private allTimeSummary: DashboardSummary | null = null;
  private _scope: string = '6M';
  private initialized = false;

  @Input() set scope(v: string) {
    this._scope = v;
    if (this.initialized) {
      this.loadDashboardData();
    }
  }

  stats = signal<StatItem[]>([
    { label: 'TOTAL POINTS', value: '—', unit: 'pts', delta: 'loading…' },
    { label: 'DIST THIS YEAR', value: '—', unit: 'km', delta: 'loading…' },
    { label: 'DIST LAST 30D', value: '—', unit: 'km', delta: 'loading…' },
    { label: 'POINTS SCOPE', value: '—', unit: 'pts', delta: 'loading…' },
    { label: 'COUNTRIES', value: '—', unit: '', delta: '' },
  ]);

  ngOnInit() {
    this.initialized = true;
    this.loadDashboardData();
  }

  private loadDashboardData() {
    const { from, to, label } = this.scopeToRange(this._scope);
    const currentYear = new Date().getFullYear();
    const fromStr = from.split('T')[0];
    const toStr = to.split('T')[0];

    this.api.getDashboardSummary(fromStr, toStr, currentYear).subscribe({
      next: (s: DashboardSummary) => {
        this.allTimeSummary = s;
        this.stats.update(prev => [
          { ...prev[0], value: this.fmt(s.totalPointsAllTime), delta: `+${this.fmt(s.pointsLast30Days)} last 30d` },
          { ...prev[1], value: (s.distanceThisYearM / 1000).toFixed(0), delta: `${s.distanceThisYearM.toFixed(0)} m` },
          { ...prev[2], value: (s.distanceLast30DaysM / 1000).toFixed(1), delta: `${s.distanceLast30DaysM.toFixed(0)} m` },
          {
            label: `POINTS · ${label}`,
            value: this.fmt(s.pointsLast30Days),
            unit: 'pts',
            delta: `${(s.distanceLast30DaysM / 1000).toFixed(1)} km`,
          },
          prev[4],
        ]);
      },
      error: () => {
        this.stats.set([
          { label: 'TOTAL DISTANCE', value: '14,827', unit: 'km', delta: '+312 this month' },
          { label: 'LOCATION POINTS', value: '8.4', unit: 'M', delta: '+82.4k last 30d' },
          { label: 'TRAILS RECORDED', value: '2,194', unit: '', delta: '+14 this week' },
          { label: 'DAYS TRACKED', value: '1,827', unit: '', delta: '98.7% coverage' },
          { label: 'COUNTRIES', value: '14', unit: '', delta: '4 continents' },
        ]);
      },
    });
  }

  private scopeToRange(scope: string): { from: string; to: string; label: string } {
    const to = new Date();
    const from = new Date();
    switch (scope) {
      case '1W': from.setDate(to.getDate() - 7); return { from: from.toISOString(), to: to.toISOString(), label: '1W' };
      case '1M': from.setMonth(to.getMonth() - 1); return { from: from.toISOString(), to: to.toISOString(), label: '1M' };
      case '6M': from.setMonth(to.getMonth() - 6); return { from: from.toISOString(), to: to.toISOString(), label: '6M' };
      case '1Y': from.setFullYear(to.getFullYear() - 1); return { from: from.toISOString(), to: to.toISOString(), label: '1Y' };
      case '5Y': from.setFullYear(to.getFullYear() - 5); return { from: from.toISOString(), to: to.toISOString(), label: '5Y' };
      default: from.setFullYear(2020, 0, 1); return { from: from.toISOString(), to: to.toISOString(), label: 'ALL' };
    }
  }

  private fmt(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
    return n.toString();
  }
}
