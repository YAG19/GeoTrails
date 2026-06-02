import { Component, OnInit, Input, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { DailyStat, Place } from '../../core/models/api.models';

/* ─── Top Places ────────────────────────────────── */
@Component({
  selector: 'app-dashboard-top-places',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <div class="card-head">
        <span class="label">TOP PLACES</span>
        <span class="meta">by visits · {{ places.length }} tracked</span>
      </div>
      <div class="card-body no-pad">
        @for (p of places; track p.id; let i = $index) {
          <div class="place-row" [class.last]="i === places.length - 1">
            <div class="place-bg" [style.width.%]="p.pct * 2"></div>
            <span class="rank">{{ (i+1).toString().padStart(2,'0') }}</span>
            <div class="place-meta">
              <div class="place-name">{{ p.name }}</div>
              @if (p.category) { <div class="place-cat">{{ p.category }}</div> }
            </div>
            <div class="place-stat">
              <div class="num place-lat">{{ p.latitude.toFixed(3) }}°N</div>
            </div>
          </div>
        }
        @if (places.length === 0) {
          <div class="empty">no places yet — add places in the Places view</div>
        }
      </div>
    </div>
  `,
  styleUrls: ['./dashboard.scss'],
  styles: [`
    .meta { font-size: 10.5px; color: var(--ink-4); }
    .place-row {
      display: grid; grid-template-columns: 28px 1fr auto;
      align-items: center; gap: 12;
      padding: 9px 14px;
      border-bottom: 1px dashed var(--line-2);
      position: relative; cursor: default;
    }
    .place-row.last { border-bottom: none; }
    .place-bg {
      position: absolute; left: 0; top: 0; bottom: 0;
      background: var(--accent-soft); pointer-events: none;
    }
    .rank { font-size: 10.5px; color: var(--ink-4); z-index: 1; }
    .place-meta { z-index: 1; }
    .place-name { font-size: 12.5px; color: var(--ink); }
    .place-cat  { font-size: 10px; color: var(--ink-4); }
    .place-stat { text-align: right; z-index: 1; }
    .place-lat  { font-size: 11px; color: var(--ink-3); }
    .empty { padding: 24px 14px; font-size: 11px; color: var(--ink-4); }
  `],
})
export class DashboardTopPlacesComponent implements OnInit {
  private api = inject(ApiService);
  places: (Place & { pct: number })[] = [];

  ngOnInit() {
    this.api.getPlaces().subscribe({
      next: (ps) => {
        const max = ps.length;
        this.places = ps.slice(0, 6).map((p, i) => ({
          ...p,
          pct: ((max - i) / max) * 40,
        }));
      },
      error: () => {
        // Mock fallback
        this.places = [
          { id: 1, name: 'home',        category: 'Home',   latitude: 52.520, longitude: 13.405, radiusMeters: 150, createdAt: '', updatedAt: '', pct: 34 },
          { id: 2, name: 'office',      category: 'Work',   latitude: 52.523, longitude: 13.412, radiusMeters: 100, createdAt: '', updatedAt: '', pct: 18 },
          { id: 3, name: 'café Bonanza',category: 'Leisure',latitude: 52.541, longitude: 13.424, radiusMeters: 80,  createdAt: '', updatedAt: '', pct: 4  },
        ];
      },
    });
  }
}

/* ─── Distance Chart (wired to DailyStat) ──────── */
@Component({
  selector: 'app-dashboard-distance-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <div class="card-head">
        <div class="head-l">
          <span class="label">DISTANCE</span>
          <span class="meta">monthly · {{ chartLabel() }}</span>
        </div>
        <div class="head-r">
          <span class="muted">peak: <span class="num">{{ peak() }}km</span></span>
          <span class="muted">avg: <span class="num">{{ avg() }}km</span></span>
        </div>
      </div>
      <div class="card-body chart-body">
        <div class="chart-area">
          @for (g of [0.25, 0.5, 0.75]; track g) {
            <div class="grid-line" [style.top.%]="(1 - g) * 100">{{ (maxVal() * g) | number:'1.0-0' }}</div>
          }
          @for (v of bars(); track $index; let i = $index) {
            <div class="bar" [style.height.%]="(v / maxVal()) * 100"
                 [class.cur]="i >= 12" [title]="v + 'km'"></div>
          }
        </div>
        <div class="chart-labels">
          @for (m of monthLabels; track m) { <div>{{ m }}</div> }
        </div>  
      </div>
    </div>
  `,
  styleUrls: ['./dashboard.scss'],
  styles: [`
    .head-l, .head-r { display: flex; gap: 12px; align-items: baseline; }
    .meta { font-size: 10.5px; color: var(--ink-4); }
    .muted { font-size: 10.5px; color: var(--ink-3); }
    .num { color: var(--ink); }
    .chart-body { display: flex; flex-direction: column; min-height: 200px; }
    .chart-area {
      flex: 1; min-height: 160px;
      display: flex; align-items: flex-end; gap: 3px;
      border-left: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
      padding: 8px 0 0 8px;
      position: relative;
    }
    .grid-line {
      position: absolute; left: 8px; right: 0;
      border-top: 1px dashed var(--line-2);
      font-size: 9px; color: var(--ink-4); padding-left: 4px;
    }
    .bar { flex: 1; background: var(--ink-4); opacity: 0.5; min-width: 4px; }
    .bar.cur { background: var(--accent); opacity: 1; }
    .chart-labels {
      display: flex; gap: 3px; font-size: 9px; color: var(--ink-4);
      padding: 4px 0 0 8px;
    }
    .chart-labels > div { flex: 1; text-align: center; }
  `],
})
export class  DashboardDistanceChartComponent implements OnInit {
  private api = inject(ApiService);

  bars    = signal<number[]>(Array(24).fill(0));
  maxVal  = signal(1);
  peak    = signal('—');
  avg     = signal('—');
  chartLabel = signal('last 12 months');
  monthLabels = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

  ngOnInit() {
    const to = new Date();
    const from = new Date(); from.setMonth(from.getMonth() - 11);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    this.api.getDailyStats(fmt(from), fmt(to)).subscribe({
      next: (days: DailyStat[]) => {
        // aggregate by month
        const byMonth = new Map<string, number>();
        days.forEach(d => {
          const key = d.statDate.slice(0, 7); // YYYY-MM
          byMonth.set(key, (byMonth.get(key) ?? 0) + d.totalDistanceKm);
        });
        const vals = Array.from(byMonth.values()).slice(-24);
        const maxV = Math.max(...vals, 1);
        const avgV = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
        this.bars.set(vals);
        this.maxVal.set(maxV);
        this.peak.set(maxV.toFixed(0));
        this.avg.set(avgV.toFixed(0));
      },
      error: () => {
        // mock
        const mock = [180,220,310,425,580,612,540,488,410,350,280,245,260,320,415,510,640,720,680,590,480,395,310,280];
        this.bars.set(mock);
        this.maxVal.set(Math.max(...mock));
        this.peak.set('720'); this.avg.set('421');
      },
    });
  }
}

/* ─── Activity Calendar ─────────────────────────── */
@Component({
  selector: 'app-dashboard-activity-calendar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <div class="card-head">
        <span class="label">ACTIVITY CALENDAR</span>
        <span class="meta">52 weeks · {{ activeDays() }} active days</span>
      </div>
      <div class="card-body cal-body">
        <div class="cal-grid">
          <div class="day-labels">
            @for (d of ['','M','','W','','F','']; track $index) {
              <span>{{ d }}</span>
            }
          </div>
          <div class="weeks">
            @for (col of cells(); track $index) {
              <div class="week-col">
                @for (v of col; track $index) {
                  <div class="cal-cell" [style.background]="cellColors[v]"></div>
                }
              </div>
            }
          </div>
        </div>
        <div class="cal-footer">
          <div class="cal-months">
            <span>Apr 2025</span><span>Jul</span><span>Oct</span><span>Jan 2026</span><span>Apr</span>
          </div>
          <div class="cal-legend">
            <span>less</span>
            @for (c of cellColors; track c) { <div class="legend-cell" [style.background]="c"></div> }
            <span>more</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./dashboard.scss'],
  styles: [`
    .meta { font-size: 10.5px; color: var(--ink-4); }
    .cal-body { display: flex; flex-direction: column; gap: 10px; }
    .cal-grid { display: flex; gap: 2px; align-items: flex-start; }
    .day-labels {
      display: flex; flex-direction: column; gap: 2px;
      font-size: 9px; color: var(--ink-4); padding-right: 4px;
    }
    .day-labels span { height: 9px; line-height: 9px; }
    .weeks { display: flex; gap: 2px; flex: 1; }
    .week-col { display: flex; flex-direction: column; gap: 2px; flex: 1; }
    .cal-cell { aspect-ratio: 1; min-height: 9px; }
    .cal-footer { display: flex; justify-content: space-between; font-size: 9.5px; color: var(--ink-4); }
    .cal-months { display: flex; gap: 16px; }
    .cal-legend { display: flex; align-items: center; gap: 4px; }
    .legend-cell { width: 9px; height: 9px; }
  `],
})
export class DashboardActivityCalendarComponent implements OnInit {
  private api = inject(ApiService);

  cells      = signal<number[][]>([]);
  activeDays = signal(0);
  cellColors = ['var(--line-2)', 'rgba(255,90,54,0.25)', 'rgba(255,90,54,0.5)', 'rgba(255,90,54,0.75)', 'var(--accent)'];

  ngOnInit() {
    const to = new Date();
    const from = new Date(); from.setFullYear(from.getFullYear() - 1);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    this.api.getDailyStats(fmt(from), fmt(to)).subscribe({
      next: (days: DailyStat[]) => {
        const byDate = new Map(days.map(d => [d.statDate.slice(0, 10), d.totalDistanceKm]));
        const maxKm = Math.max(...byDate.values(), 1);
        const grid: number[][] = [];
        const cursor = new Date(from);
        // align to Monday
        const dow = cursor.getDay(); cursor.setDate(cursor.getDate() - ((dow + 6) % 7));
        let active = 0;
        for (let w = 0; w < 52; w++) {
          const col: number[] = [];
          for (let d = 0; d < 7; d++) {
            const key = cursor.toISOString().slice(0, 10);
            const km = byDate.get(key) ?? 0;
            if (km > 0) active++;
            const pct = km / maxKm;
            col.push(pct < 0.01 ? 0 : pct < 0.25 ? 1 : pct < 0.5 ? 2 : pct < 0.75 ? 3 : 4);
            cursor.setDate(cursor.getDate() + 1);
          }
          grid.push(col);
        }
        this.cells.set(grid);
        this.activeDays.set(active);
      },
      error: () => { this.buildMockCalendar(); },
    });
  }

  private buildMockCalendar() {
    let x = 31;
    const rng = () => (x = (x * 9301 + 49297) % 233280) / 233280;
    const grid = Array.from({ length: 52 }, () =>
      Array.from({ length: 7 }, (_, d) => {
        const v = Math.min(1, Math.max(0, rng() + (d === 0 || d === 6 ? 0.3 : 0) - 0.3));
        return v < 0.15 ? 0 : v < 0.4 ? 1 : v < 0.65 ? 2 : v < 0.85 ? 3 : 4;
      })
    );
    this.cells.set(grid);
    this.activeDays.set(1827);
  }
}

/* ─── Recent Trails (from LocationPoints) ──────── */
@Component({
  selector: 'app-dashboard-recent-trails',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <div class="card-head">
        <span class="label">RECENT ACTIVITY</span>
        <span class="meta">last 7 days</span>
      </div>
      <div class="card-body no-pad">
        <div class="trails-header">
          <span>date</span><span>source</span><span class="r">points</span><span class="r">accuracy</span>
        </div>
        @for (t of recentPoints(); track t.id; let i = $index) {
          <div class="trail-row" [class.last]="i === recentPoints().length - 1">
            <span class="num trail-date">{{ t.recordedAt | date:'MM-dd HH:mm' }}</span>
            <span class="trail-src">
              <span class="src-dot" [style.background]="srcColor(t.source)"></span>
              {{ t.source }}
            </span>
            <span class="num r">{{ t.accuracy ? (t.accuracy | number:'1.0-1') + 'm' : '—' }}</span>
            <span class="num r trail-vel">{{ t.velocity ? (t.velocity | number:'1.1-1') + ' m/s' : '—' }}</span>
          </div>
        }
        @if (recentPoints().length === 0 && !loading()) {
          <div class="empty">no recent points found</div>
        }
        @if (loading()) {
          <div class="empty">loading…</div>
        }
      </div>
    </div>
  `,
  styleUrls: ['./dashboard.scss'],
  styles: [`
    .meta { font-size: 10.5px; color: var(--ink-4); }
    .trails-header {
      display: grid; grid-template-columns: 120px 1fr 80px 80px;
      padding: 8px 14px; font-size: 9.5px; color: var(--ink-4);
      border-bottom: 1px solid var(--line);
      letter-spacing: 0.1em; text-transform: uppercase;
    }
    .trail-row {
      display: grid; grid-template-columns: 120px 1fr 80px 80px;
      align-items: center; padding: 8px 14px;
      border-bottom: 1px solid var(--line-2); font-size: 11.5px;
    }
    .trail-row.last { border-bottom: none; }
    .trail-row:hover { background: var(--bg-3, var(--bg-2)); }
    .trail-date { color: var(--ink-3); font-size: 10.5px; }
    .trail-src { display: flex; align-items: center; gap: 6px; color: var(--ink-2); }
    .src-dot { width: 5px; height: 5px; border-radius: 50%; }
    .r { text-align: right; color: var(--ink-2); }
    .trail-vel { color: var(--ink-3); }
    .empty { padding: 24px 14px; font-size: 11px; color: var(--ink-4); }
  `],
})
export class DashboardRecentTrailsComponent implements OnInit {
  private api = inject(ApiService);
  recentPoints = signal<any[]>([]);
  loading = signal(true);

  ngOnInit() {
    const to   = new Date();
    const from = new Date(); from.setDate(from.getDate() - 7);
    const fmt  = (d: Date) => d.toISOString();

    this.api.queryLocations({ from: fmt(from), to: fmt(to), size: 30 }).subscribe({
      next: (pts) => { this.recentPoints.set(pts.slice(0, 14)); this.loading.set(false); },
      error: () => {
        // mock fallback
        this.recentPoints.set([
          { id: 1, recordedAt: '2026-04-22T07:14:00Z', source: 'owntracks', accuracy: 3.2, velocity: 2.1 },
          { id: 2, recordedAt: '2026-04-22T07:22:00Z', source: 'owntracks', accuracy: 4.1, velocity: 2.4 },
          { id: 3, recordedAt: '2026-04-21T08:42:00Z', source: 'garmin',    accuracy: 2.0, velocity: 5.8 },
          { id: 4, recordedAt: '2026-04-21T17:55:00Z', source: 'garmin',    accuracy: 2.2, velocity: 5.2 },
          { id: 5, recordedAt: '2026-04-20T10:02:00Z', source: 'garmin',    accuracy: 1.8, velocity: 3.4 },
        ]);
        this.loading.set(false);
      },
    });
  }

  srcColor(src: string): string {
    const map: Record<string, string> = {
      owntracks: '#ff5a36', garmin: '#7ad9ff', strava: '#ffa040',
      gpx: '#a78bfa', google: '#4ade80',
    };
    return map[src?.toLowerCase()] ?? 'var(--ink-4)';
  }
}

/* ─── Polar Clock (mock — no backend support) ──── */
@Component({
  selector: 'app-dashboard-polar-clock',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <div class="card-head">
        <span class="label">TIME OF DAY</span>
        <span class="meta">activity distribution · 24h</span>
      </div>
      <div class="card-body polar-body">
        <svg [attr.viewBox]="'0 0 180 180'" width="180" height="180" style="flex-shrink:0">
          <circle [attr.cx]="cx" [attr.cy]="cy" [attr.r]="rIn - 2"
            fill="none" stroke="var(--line)" stroke-dasharray="2 2"/>
          <circle [attr.cx]="cx" [attr.cy]="cy" [attr.r]="rMax"
            fill="none" stroke="var(--line)"/>
          @for (seg of segments; track $index) {
            <path [attr.d]="seg.d" [attr.fill]="seg.fill" stroke="var(--bg-2)" stroke-width="0.5"/>
          }
          @for (h of [0,6,12,18]; track h) {
            <text
              [attr.x]="cx + Math.cos((h/24)*Math.PI*2 - Math.PI/2) * (rMax+8)"
              [attr.y]="cy + Math.sin((h/24)*Math.PI*2 - Math.PI/2) * (rMax+8)"
              font-size="9" font-family="JetBrains Mono"
              fill="var(--ink-3)" text-anchor="middle" dominant-baseline="middle">
              {{ h.toString().padStart(2,'0') }}
            </text>
          }
        </svg>
        <div class="polar-stats">
          <div class="p-row"><span>peak hour</span><span class="num">08:00–09:00</span></div>
          <div class="p-row"><span>quiet hour</span><span class="num">03:00–04:00</span></div>
          <div class="p-row"><span>morning %</span><span class="num">34.2%</span></div>
          <div class="p-row"><span>weekend shift</span><span class="num">+2.4h later</span></div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./dashboard.scss'],
  styles: [`
    .meta { font-size: 10.5px; color: var(--ink-4); }
    .polar-body { display: flex; gap: 16px; align-items: center; }
    .polar-stats { flex: 1; }
    .p-row {
      display: flex; justify-content: space-between;
      font-size: 11px; padding: 5px 0;
      border-bottom: 1px dashed var(--line-2);
      color: var(--ink-3);
    }
    .p-row .num { color: var(--ink); }
  `],
})
export class DashboardPolarClockComponent {
  cx = 90; cy = 90; rIn = 28; rMax = 78;
  Math = Math;

  segments = (() => {
    let x = 12;
    const rng = () => (x = (x * 9301 + 49297) % 233280) / 233280;
    const data = Array.from({ length: 24 }, (_, i) => {
      const r = rng();
      const commute = (i === 8 || i === 9 || i === 17 || i === 18) ? 0.4 : 0;
      const night = i <= 5 ? -0.4 : 0;
      return Math.max(0.05, r + commute + night);
    });
    const { cx, cy, rIn, rMax } = this;
    return data.map((v, i) => {
      const a1 = (i / 24) * Math.PI * 2 - Math.PI / 2;
      const a2 = ((i + 1) / 24) * Math.PI * 2 - Math.PI / 2;
      const r  = rIn + (rMax - rIn) * v;
      const x1 = cx + Math.cos(a1) * rIn,  y1 = cy + Math.sin(a1) * rIn;
      const x2 = cx + Math.cos(a1) * r,    y2 = cy + Math.sin(a1) * r;
      const x3 = cx + Math.cos(a2) * r,    y3 = cy + Math.sin(a2) * r;
      const x4 = cx + Math.cos(a2) * rIn,  y4 = cy + Math.sin(a2) * rIn;
      const fill = v > 0.6 ? 'var(--accent)' : v > 0.4 ? 'rgba(255,90,54,0.6)' : 'rgba(255,90,54,0.25)';
      return { d: `M${x1} ${y1}L${x2} ${y2}A${r} ${r} 0 0 1 ${x3} ${y3}L${x4} ${y4}A${rIn} ${rIn} 0 0 0 ${x1} ${y1}Z`, fill };
    });
  })();
}
