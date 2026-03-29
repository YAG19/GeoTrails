import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { DashboardSummary, DailyStat, ActivityDistance } from '../../core/models/api.models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard">
      <h2 class="page-title">Dashboard</h2>

      <p>Welcome, {{ username }}!</p>

      <div class="filter-bar">
        <button class="btn-preset" [class.active]="activePreset() === '7d'"  (click)="setPreset('7d')">7 Days</button>
        <button class="btn-preset" [class.active]="activePreset() === '30d'" (click)="setPreset('30d')">30 Days</button>
        <button class="btn-preset" [class.active]="activePreset() === '3m'"  (click)="setPreset('3m')">3 Months</button>
        <button class="btn-preset" [class.active]="activePreset() === '1y'"  (click)="setPreset('1y')">1 Year</button>
      </div>

      @if (summary()) {
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{ summary()!.totalPointsAllTime | number }}</div>
            <div class="stat-label">Total Points</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ summary()!.distanceLast30DaysKm | number:'1.1-1' }} km</div>
            <div class="stat-label">Last 30 Days</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ summary()!.pointsLast30Days | number }}</div>
            <div class="stat-label">Points (30 Days)</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ summary()!.distanceThisYearKm | number:'1.1-1' }} km</div>
            <div class="stat-label">This Year</div>
          </div>
        </div>
      }

      @if (activityDistances().length > 0) {
        <div class="section-header">
          <h3>Distance by Activity</h3>
        </div>
        <div class="activity-grid">
          @for (item of activityDistances(); track item.activityType) {
            <div class="stat-card">
              <div class="stat-value">{{ (item.totalDistanceM / 1000) | number:'1.1-1' }} km</div>
              <div class="stat-label">{{ getActivityLabel(item.activityType) }}</div>
            </div>
          }
        </div>
      }

      @if (dailyStats().length > 0) {
        <div class="chart-section">
          <h3>Daily Distance</h3>
          <div class="chart-container">
            <div class="bar-chart">
              @for (stat of dailyStats(); track stat.statDate) {
                <div class="bar-wrapper" [title]="stat.statDate + ': ' + stat.totalDistanceKm.toFixed(1) + ' km'">
                  <div
                    class="bar"
                    [style.height.%]="getBarHeight(stat.totalDistanceM)"
                  ></div>
                  <span class="bar-label">{{ stat.statDate.substring(8) }}</span>
                </div>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .dashboard { padding: 24px; max-width: 1200px; }
    .page-title { margin: 0 0 24px; font-size: 1.5rem; color: var(--text-primary); }

    .filter-bar { display: flex; gap: 8px; margin-bottom: 24px; }

    .btn-preset {
      padding: 6px 14px;
      background: var(--bg-muted);
      border: 1px solid var(--border-light);
      border-radius: 6px;
      font-size: 0.85rem;
      cursor: pointer;
      color: var(--text-secondary);
      transition: all 0.2s;
    }

    .btn-preset:hover,
    .btn-preset.active {
      background: #4fc3f7;
      color: #fff;
      border-color: #4fc3f7;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }

    .section-header { margin: 0 0 16px; }
    .section-header h3 { margin: 0; font-size: 1.1rem; color: var(--text-secondary); }

    .activity-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }

    .stat-card {
      background: var(--bg-card);
      border-radius: 12px;
      padding: 24px;
      box-shadow: var(--shadow-md);
    }

    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 4px;
    }

    .stat-label {
      font-size: 0.9rem;
      color: var(--text-hint);
    }

    .chart-section {
      background: var(--bg-card);
      border-radius: 12px;
      padding: 24px;
      box-shadow: var(--shadow-md);
    }

    .chart-section h3 {
      margin: 0 0 16px;
      font-size: 1.1rem;
      color: var(--text-secondary);
    }

    .chart-container { overflow-x: auto; }

    .bar-chart {
      display: flex;
      align-items: flex-end;
      gap: 4px;
      height: 200px;
      padding-bottom: 24px;
    }

    .bar-wrapper {
      flex: 1;
      min-width: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      height: 100%;
      justify-content: flex-end;
      cursor: pointer;
    }

    .bar {
      width: 100%;
      max-width: 24px;
      background: linear-gradient(180deg, #4fc3f7, #0288d1);
      border-radius: 4px 4px 0 0;
      min-height: 2px;
      transition: height 0.3s ease;
    }

    .bar-wrapper:hover .bar { opacity: 0.8; }

    .bar-label {
      font-size: 0.65rem;
      color: var(--text-hint);
      margin-top: 4px;
    }
  `],
})
export class DashboardComponent implements OnInit {
  private apiService = inject(ApiService);
  private authService = inject(AuthService);

  username = '';
  summary = signal<DashboardSummary | null>(null);
  dailyStats = signal<DailyStat[]>([]);
  activityDistances = signal<ActivityDistance[]>([]);
  activePreset = signal<string>('1y');

  dateFrom = this.formatDate(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000));
  dateTo = this.formatDate(new Date());

  private maxDistance = 0;

  ngOnInit(): void {
    this.username = this.authService.username() || '';
    this.apiService.getDashboardSummary().subscribe({
      next: (data) => this.summary.set(data),
    });
    this.loadFilteredData();
  }

  loadFilteredData(): void {
    this.apiService.getDailyStats(this.dateFrom, this.dateTo).subscribe({
      next: (stats) => {
        this.dailyStats.set(stats);
        this.maxDistance = Math.max(...stats.map((s) => s.totalDistanceM), 1);
      },
    });
    this.apiService.getActivityDistances(this.dateFrom, this.dateTo).subscribe({
      next: (data) => this.activityDistances.set(data),
    });
  }

  setPreset(preset: '7d' | '30d' | '3m' | '1y'): void {
    const to = new Date();
    const from = new Date();
    if (preset === '7d')  from.setDate(from.getDate() - 7);
    if (preset === '30d') from.setDate(from.getDate() - 30);
    if (preset === '3m')  from.setMonth(from.getMonth() - 3);
    if (preset === '1y')  from.setFullYear(from.getFullYear() - 1);
    this.dateFrom = this.formatDate(from);
    this.dateTo = this.formatDate(to);
    this.activePreset.set(preset);
    this.loadFilteredData();
  }

  getActivityLabel(activityType: string): string {
    const labels: Record<string, string> = {
      MOTORCYCLING: 'Motorcycle',
      FLYING: 'Flying',
      WALKING: 'Walking',
      RUNNING: 'Running',
      CYCLING: 'Cycling',
      IN_PASSENGER_VEHICLE: 'Car',
    };
    return labels[activityType] ?? activityType;
  }

  getBarHeight(distanceM: number): number {
    return Math.max(1, (distanceM / this.maxDistance) * 100);
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
