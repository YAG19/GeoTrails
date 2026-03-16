import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { DashboardSummary, DailyStat } from '../../core/models/api.models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard">
      <h2 class="page-title">Dashboard</h2>

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

      @if (dailyStats().length > 0) {
        <div class="chart-section">
          <h3>Daily Distance (Last 30 Days)</h3>
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

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
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

  summary = signal<DashboardSummary | null>(null);
  dailyStats = signal<DailyStat[]>([]);
  private maxDistance = 0;

  ngOnInit(): void {
    this.apiService.getDashboardSummary().subscribe({
      next: (data) => this.summary.set(data),
    });

    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);

    this.apiService
      .getDailyStats(from.toISOString().split('T')[0], to.toISOString().split('T')[0])
      .subscribe({
        next: (stats) => {
          this.dailyStats.set(stats);
          this.maxDistance = Math.max(...stats.map((s) => s.totalDistanceM), 1);
        },
      });
  }

  getBarHeight(distanceM: number): number {
    return Math.max(1, (distanceM / this.maxDistance) * 100);
  }
}
