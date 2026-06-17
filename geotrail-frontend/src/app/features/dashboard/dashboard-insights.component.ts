import { Component, Input, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { DailyStat, TimelineSegment, TransportMode } from '../../core/models/api.models';

/**
 * Insight widgets derived entirely client-side from data the Google Timeline
 * import already stores (daily_stats, visits, user_activities, transport
 * breakdown). No new backend endpoints required.
 */

/** Convert a dashboard scope token into a from/to window. */
function scopeDates(scope: string): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();
  switch (scope) {
    case '1W': from.setDate(to.getDate() - 7); break;
    case '1M': from.setMonth(to.getMonth() - 1); break;
    case '6M': from.setMonth(to.getMonth() - 6); break;
    case '1Y': from.setFullYear(to.getFullYear() - 1); break;
    case '5Y': from.setFullYear(to.getFullYear() - 5); break;
    default: from.setFullYear(2020, 0, 1); break;
  }
  return { from, to };
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/* ─── Records & Streaks (from /stats/daily) ─────── */
@Component({
  selector: 'app-dashboard-records',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <div class="card-head">
        <span class="label">RECORDS</span>
        <span class="meta">streaks & personal bests</span>
      </div>
      <div class="card-body">
        @for (r of rows(); track r.label) {
          <div class="p-row">
            <span>{{ r.label }}</span>
            <span class="num">{{ r.value }}<span class="sub"> {{ r.sub }}</span></span>
          </div>
        }
        @if (rows().length === 0 && !loading()) {
          <div class="empty">no daily stats in range — run the stats scheduler after import</div>
        }
        @if (loading()) { <div class="empty">loading…</div> }
      </div>
    </div>
  `,
  styleUrls: ['./dashboard.scss'],
  styles: [`
    .meta { font-size: 10.5px; color: var(--ink-4); }
    .p-row {
      display: flex; justify-content: space-between;
      font-size: 11.5px; padding: 6px 0;
      border-bottom: 1px dashed var(--line-2);
      color: var(--ink-3);
    }
    .p-row:last-child { border-bottom: none; }
    .p-row .num { color: var(--ink); }
    .sub { color: var(--ink-4); font-size: 10px; }
    .empty { padding: 12px 0; font-size: 11px; color: var(--ink-4); }
  `],
})
export class DashboardRecordsComponent implements OnInit {
  @Input() set scope(v: string) { this._scope = v || '6M'; if (this.initialized) this.load(); }
  private _scope = '6M';
  private initialized = false;
  private api = inject(ApiService);

  rows = signal<{ label: string; value: string; sub: string }[]>([]);
  loading = signal(true);

  ngOnInit() { this.initialized = true; this.load(); }

  private load() {
    const { from, to } = scopeDates(this._scope);
    this.loading.set(true);
    this.api.getDailyStats(isoDate(from), isoDate(to)).subscribe({
      next: (days: DailyStat[]) => {
        const byDate = new Map(days.map(d => [d.statDate.slice(0, 10), d.totalDistanceKm ?? 0]));

        let bestKm = 0, bestDate = '';
        let streak = 0, maxStreak = 0, maxStreakEnd = '';
        let active = 0, totalKm = 0, totalDays = 0;

        const cursor = new Date(from);
        while (cursor <= to) {
          const key = isoDate(cursor);
          const km = byDate.get(key) ?? 0;
          totalDays++;
          if (km > 0.1) {
            active++; totalKm += km;
            streak++;
            if (streak > maxStreak) { maxStreak = streak; maxStreakEnd = key; }
            if (km > bestKm) { bestKm = km; bestDate = key; }
          } else {
            streak = 0;
          }
          cursor.setDate(cursor.getDate() + 1);
        }

        if (active === 0) { this.rows.set([]); this.loading.set(false); return; }
        this.rows.set([
          { label: 'biggest day',    value: `${bestKm.toFixed(0)} km`, sub: bestDate },
          { label: 'longest streak', value: `${maxStreak} days`,       sub: `to ${maxStreakEnd}` },
          { label: 'active days',    value: `${active}/${totalDays}`,  sub: `${((active / totalDays) * 100).toFixed(0)}%` },
          { label: 'avg / active day', value: `${(totalKm / active).toFixed(1)} km`, sub: '' },
          { label: 'total in range', value: `${totalKm.toFixed(0)} km`, sub: '' },
        ]);
        this.loading.set(false);
      },
      error: () => { this.rows.set([]); this.loading.set(false); },
    });
  }
}

/* ─── Weekly Rhythm (from /stats/daily) ─────────── */
@Component({
  selector: 'app-dashboard-weekly-rhythm',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <div class="card-head">
        <span class="label">WEEKLY RHYTHM</span>
        <span class="meta">avg km per weekday</span>
      </div>
      <div class="card-body">
        <div class="dow-chart">
          @for (d of dows(); track d.label; let i = $index) {
            <div class="dow-col">
              <div class="dow-bar-wrap">
                <div class="dow-bar" [class.weekend]="i >= 5"
                     [style.height.%]="d.pct" [title]="d.km.toFixed(1) + ' km avg'"></div>
              </div>
              <div class="dow-km num">{{ d.display }}</div>
              <div class="dow-label">{{ d.label }}</div>
            </div>
          }
        </div>
        <div class="dow-footer">
          <span>weekday avg <span class="num ink">{{ weekdayAvg() }} km</span></span>
          <span>weekend avg <span class="num ink">{{ weekendAvg() }} km</span></span>
        </div>
        @if (empty() && !loading()) { <div class="empty">no daily stats in range</div> }
      </div>
    </div>
  `,
  styleUrls: ['./dashboard.scss'],
  styles: [`
    .meta { font-size: 10.5px; color: var(--ink-4); }
    .dow-chart { display: flex; gap: 6px; align-items: stretch; height: 110px; }
    .dow-col { flex: 1; display: flex; flex-direction: column; gap: 3px; }
    .dow-bar-wrap {
      flex: 1; display: flex; align-items: flex-end;
      border-bottom: 1px solid var(--line);
    }
    .dow-bar { width: 100%; background: var(--accent); opacity: 0.85; min-height: 1px; }
    .dow-bar.weekend { background: var(--ink-4); }
    .dow-km { font-size: 9.5px; color: var(--ink-3); text-align: center; }
    .dow-label { font-size: 9px; color: var(--ink-4); text-align: center; letter-spacing: 0.08em; }
    .dow-footer {
      display: flex; justify-content: space-between; margin-top: 10px;
      font-size: 10.5px; color: var(--ink-3);
    }
    .ink { color: var(--ink); }
    .empty { padding: 12px 0; font-size: 11px; color: var(--ink-4); }
  `],
})
export class DashboardWeeklyRhythmComponent implements OnInit {
  @Input() set scope(v: string) { this._scope = v || '6M'; if (this.initialized) this.load(); }
  private _scope = '6M';
  private initialized = false;
  private api = inject(ApiService);

  dows = signal<{ label: string; km: number; display: string; pct: number }[]>(
    ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].map(l => ({ label: l, km: 0, display: '0', pct: 0 })));
  weekdayAvg = signal('—');
  weekendAvg = signal('—');
  empty = signal(false);
  loading = signal(true);

  ngOnInit() { this.initialized = true; this.load(); }

  private load() {
    const { from, to } = scopeDates(this._scope);
    this.loading.set(true);
    this.api.getDailyStats(isoDate(from), isoDate(to)).subscribe({
      next: (days: DailyStat[]) => {
        const byDate = new Map(days.map(d => [d.statDate.slice(0, 10), d.totalDistanceKm ?? 0]));
        const sum = Array(7).fill(0);
        const cnt = Array(7).fill(0);
        const cursor = new Date(from);
        while (cursor <= to) {
          const dow = (cursor.getDay() + 6) % 7; // Monday = 0
          sum[dow] += byDate.get(isoDate(cursor)) ?? 0;
          cnt[dow]++;
          cursor.setDate(cursor.getDate() + 1);
        }
        const avgs = sum.map((s, i) => (cnt[i] ? s / cnt[i] : 0));
        const max = Math.max(...avgs, 0.001);
        this.dows.set(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].map((label, i) => ({
          label,
          km: avgs[i],
          display: avgs[i] >= 10 ? avgs[i].toFixed(0) : avgs[i].toFixed(1),
          pct: (avgs[i] / max) * 100,
        })));
        const wd = avgs.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
        const we = avgs.slice(5).reduce((a, b) => a + b, 0) / 2;
        this.weekdayAvg.set(wd.toFixed(1));
        this.weekendAvg.set(we.toFixed(1));
        this.empty.set(max <= 0.001);
        this.loading.set(false);
      },
      error: () => { this.empty.set(true); this.loading.set(false); },
    });
  }
}

/* ─── Footprint (from /timeline/transport-breakdown) ─── */

/** Rough CO₂e per passenger-km (kg) — published averages, marked as estimates in the UI. */
const CO2_KG_PER_KM: Record<string, number> = {
  IN_PASSENGER_VEHICLE: 0.17, IN_VEHICLE: 0.17, DRIVING: 0.17, IN_TAXI: 0.17,
  MOTORCYCLING: 0.09,
  IN_BUS: 0.08,
  IN_TRAIN: 0.035, IN_SUBWAY: 0.035, IN_TRAM: 0.035,
  IN_FERRY: 0.11,
  FLYING: 0.25, IN_FLIGHT: 0.25,
};
const ACTIVE_MODES = new Set(['WALKING', 'RUNNING', 'CYCLING', 'HIKING', 'ON_FOOT']);
const TRANSIT_MODES = new Set(['IN_BUS', 'IN_TRAIN', 'IN_SUBWAY', 'IN_TRAM', 'IN_FERRY']);

@Component({
  selector: 'app-dashboard-footprint',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <div class="card-head">
        <span class="label">FOOTPRINT</span>
        <span class="meta">estimated · from transport modes</span>
      </div>
      <div class="card-body">
        <div class="fp-hero">
          <span class="num fp-big">{{ co2() }}</span>
          <span class="fp-unit">kg CO₂e</span>
          <span class="fp-trees">≈ {{ trees() }} tree-years to offset</span>
        </div>
        <div class="fp-bar">
          <div class="fp-seg active" [style.width.%]="activePct()" title="active (walk/run/cycle)"></div>
          <div class="fp-seg transit" [style.width.%]="transitPct()" title="public transit"></div>
          <div class="fp-seg motor" [style.width.%]="motorPct()" title="motorised"></div>
        </div>
        <div class="fp-legend">
          <span><i class="sw active"></i>active {{ activeKm() }} km</span>
          <span><i class="sw transit"></i>transit {{ transitKm() }} km</span>
          <span><i class="sw motor"></i>motor {{ motorKm() }} km</span>
        </div>
        @if (empty() && !loading()) {
          <div class="empty">no travel segments — import a semantic Google Timeline export</div>
        }
        @if (loading()) { <div class="empty">loading…</div> }
      </div>
    </div>
  `,
  styleUrls: ['./dashboard.scss'],
  styles: [`
    .meta { font-size: 10.5px; color: var(--ink-4); }
    .fp-hero { display: flex; align-items: baseline; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
    .fp-big { font-size: 26px; color: var(--ink); letter-spacing: -0.02em; }
    .fp-unit { font-size: 11px; color: var(--ink-3); }
    .fp-trees { font-size: 10px; color: var(--ink-4); margin-left: auto; }
    .fp-bar { display: flex; height: 8px; background: var(--line-2); }
    .fp-seg.active  { background: #34d399; }
    .fp-seg.transit { background: #60a5fa; }
    .fp-seg.motor   { background: var(--accent); }
    .fp-legend {
      display: flex; gap: 12px; margin-top: 8px; flex-wrap: wrap;
      font-size: 10px; color: var(--ink-3);
    }
    .sw { display: inline-block; width: 8px; height: 8px; margin-right: 4px; }
    .sw.active  { background: #34d399; }
    .sw.transit { background: #60a5fa; }
    .sw.motor   { background: var(--accent); }
    .empty { padding: 12px 0; font-size: 11px; color: var(--ink-4); }
  `],
})
export class DashboardFootprintComponent implements OnInit {
  @Input() set scope(v: string) { this._scope = v || '6M'; if (this.initialized) this.load(); }
  private _scope = '6M';
  private initialized = false;
  private api = inject(ApiService);

  co2 = signal('—');
  trees = signal('—');
  activeKm = signal('0'); transitKm = signal('0'); motorKm = signal('0');
  activePct = signal(0); transitPct = signal(0); motorPct = signal(0);
  empty = signal(false);
  loading = signal(true);

  ngOnInit() { this.initialized = true; this.load(); }

  private load() {
    const { from, to } = scopeDates(this._scope);
    this.loading.set(true);
    this.api.getTransportBreakdown(from.toISOString(), to.toISOString()).subscribe({
      next: (modes: TransportMode[]) => {
        let active = 0, transit = 0, motor = 0, co2 = 0;
        for (const m of modes) {
          const km = m.distanceMeters / 1000;
          const mode = (m.mode || '').toUpperCase();
          if (ACTIVE_MODES.has(mode)) active += km;
          else if (TRANSIT_MODES.has(mode)) transit += km;
          else motor += km;
          co2 += km * (CO2_KG_PER_KM[mode] ?? 0);
        }
        const total = Math.max(active + transit + motor, 0.001);
        this.activeKm.set(active.toFixed(0));
        this.transitKm.set(transit.toFixed(0));
        this.motorKm.set(motor.toFixed(0));
        this.activePct.set((active / total) * 100);
        this.transitPct.set((transit / total) * 100);
        this.motorPct.set((motor / total) * 100);
        this.co2.set(co2 >= 100 ? co2.toFixed(0) : co2.toFixed(1));
        this.trees.set(Math.ceil(co2 / 21).toString()); // ~21 kg CO₂ absorbed per tree per year
        this.empty.set(total <= 0.001);
        this.loading.set(false);
      },
      error: () => { this.empty.set(true); this.loading.set(false); },
    });
  }
}

/* ─── Exploration (from /timeline/segments visits) ─── */
@Component({
  selector: 'app-dashboard-exploration',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <div class="card-head">
        <span class="label">EXPLORATION</span>
        <span class="meta">distinct places visited</span>
      </div>
      <div class="card-body">
        <div class="ex-hero">
          <div class="ex-stat">
            <div class="num ex-big">{{ uniquePlaces() }}</div>
            <div class="ex-cap">places</div>
          </div>
          <div class="ex-stat">
            <div class="num ex-big">{{ totalVisits() }}</div>
            <div class="ex-cap">visits</div>
          </div>
          <div class="ex-stat">
            <div class="num ex-big">{{ newPlaces() }}</div>
            <div class="ex-cap">new · last 30d</div>
          </div>
        </div>
        @for (r of rows(); track r.label) {
          <div class="p-row">
            <span>{{ r.label }}</span>
            <span class="num">{{ r.value }}</span>
          </div>
        }
        @if (empty() && !loading()) {
          <div class="empty">no visits in range — import a semantic Google Timeline export</div>
        }
        @if (loading()) { <div class="empty">loading…</div> }
      </div>
    </div>
  `,
  styleUrls: ['./dashboard.scss'],
  styles: [`
    .meta { font-size: 10.5px; color: var(--ink-4); }
    .ex-hero {
      display: flex; gap: 10px; margin-bottom: 10px;
    }
    .ex-stat {
      flex: 1; padding: 8px 10px;
      border: 1px dashed var(--line-2);
      text-align: center;
    }
    .ex-big { font-size: 20px; color: var(--ink); }
    .ex-cap { font-size: 9px; color: var(--ink-4); letter-spacing: 0.08em; text-transform: uppercase; margin-top: 2px; }
    .p-row {
      display: flex; justify-content: space-between;
      font-size: 11.5px; padding: 6px 0;
      border-bottom: 1px dashed var(--line-2);
      color: var(--ink-3);
    }
    .p-row:last-child { border-bottom: none; }
    .p-row .num { color: var(--ink); }
    .empty { padding: 12px 0; font-size: 11px; color: var(--ink-4); }
  `],
})
export class DashboardExplorationComponent implements OnInit {
  @Input() set scope(v: string) { this._scope = v || '6M'; if (this.initialized) this.load(); }
  private _scope = '6M';
  private initialized = false;
  private api = inject(ApiService);

  uniquePlaces = signal('—');
  totalVisits = signal('—');
  newPlaces = signal('—');
  rows = signal<{ label: string; value: string }[]>([]);
  empty = signal(false);
  loading = signal(true);

  ngOnInit() { this.initialized = true; this.load(); }

  private load() {
    const { from, to } = scopeDates(this._scope);
    this.loading.set(true);
    this.api.getTimelineSegments(from.toISOString(), to.toISOString()).subscribe({
      next: (segs: TimelineSegment[]) => {
        const visits = segs.filter(s => s.kind === 'VISIT' && s.startTime);
        if (visits.length === 0) {
          this.empty.set(true); this.loading.set(false);
          this.uniquePlaces.set('0'); this.totalVisits.set('0'); this.newPlaces.set('0');
          this.rows.set([]);
          return;
        }

        // Key by Google place id; fall back to a ~110 m coordinate bucket.
        const keyOf = (v: TimelineSegment) =>
          v.googlePlaceId ?? `${v.startLat?.toFixed(3)},${v.startLng?.toFixed(3)}`;

        const firstSeen = new Map<string, number>();
        const visitCount = new Map<string, number>();
        let totalMinutes = 0, minutesCount = 0, longestStay = 0;

        for (const v of visits) {
          const key = keyOf(v);
          const t = new Date(v.startTime!).getTime();
          if (!firstSeen.has(key) || t < firstSeen.get(key)!) firstSeen.set(key, t);
          visitCount.set(key, (visitCount.get(key) ?? 0) + 1);
          if (v.durationMinutes != null) {
            totalMinutes += v.durationMinutes; minutesCount++;
            if (v.durationMinutes > longestStay) longestStay = v.durationMinutes;
          }
        }

        const cutoff = to.getTime() - 30 * 86400_000;
        let fresh = 0;
        firstSeen.forEach(t => { if (t >= cutoff) fresh++; });

        const maxRepeat = Math.max(...visitCount.values());
        const repeatVisits = visits.length - firstSeen.size;

        this.uniquePlaces.set(String(firstSeen.size));
        this.totalVisits.set(String(visits.length));
        this.newPlaces.set(String(fresh));
        this.rows.set([
          { label: 'repeat visit rate', value: `${((repeatVisits / visits.length) * 100).toFixed(0)}%` },
          { label: 'most revisited place', value: `${maxRepeat}× visits` },
          { label: 'avg stay', value: minutesCount ? this.fmtMin(totalMinutes / minutesCount) : '—' },
          { label: 'longest stay', value: this.fmtMin(longestStay) },
        ]);
        this.empty.set(false);
        this.loading.set(false);
      },
      error: () => { this.empty.set(true); this.loading.set(false); },
    });
  }

  private fmtMin(min: number): string {
    return min >= 60 ? `${(min / 60).toFixed(1)}h` : `${Math.round(min)}m`;
  }
}
