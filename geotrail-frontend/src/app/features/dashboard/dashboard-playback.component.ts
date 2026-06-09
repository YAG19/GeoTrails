import {
  Component, OnDestroy, AfterViewInit,
  ElementRef, ViewChild, Input, signal, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { ApiService } from '../../core/services/api.service';
import { TimelinePathPoint } from '../../core/models/api.models';

/**
 * DashboardPlaybackComponent
 *
 * Animated replay ("simulation") of the user travelling along their recorded
 * timeline path. Fetches GET /timeline/path for the active scope, decimates to a
 * point budget, then drives a marker + growing, mode-coloured trail with
 * play/pause, speed and a draggable scrubber. Peer to DashboardMapComponent —
 * the dashboard shows one or the other so two Leaflet maps never run at once.
 */
@Component({
  selector: 'app-dashboard-playback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card map-card">
      <div class="card-head">
        <div class="head-left">
          <span class="label">PLAYBACK · {{ scopeLabel() }}</span>
          <span class="date-range">{{ caption() }}</span>
        </div>
        <div class="head-right">
          @for (s of speeds; track s) {
            <button class="layer-btn" [class.on]="speed() === s" (click)="setSpeed(s)">{{ s }}×</button>
          }
        </div>
      </div>

      <div class="map-body">
        <div #mapEl class="map-el"></div>

        <!-- current activity caption -->
        <div class="hud hud-coord">
          <div class="hud-row">
            <span class="label" style="font-size:9px">TIME</span>
            <span class="num hud-val">{{ clock() }}</span>
          </div>
          <div class="hud-row">
            <span class="label" style="font-size:9px">MODE</span>
            <span class="num hud-val" [style.color]="modeColor()">{{ modeLabel() }}</span>
          </div>
        </div>

        <!-- transport controls -->
        <div class="scrubber">
          <div class="scrubber-meta">
            <span>{{ pointCount() | number }} pts · {{ progressPct() }}%</span>
            <span class="num">{{ playing() ? 'playing' : 'paused' }}</span>
          </div>
          <div class="controls-row">
            <button class="play-btn" (click)="togglePlay()" [disabled]="pointCount() === 0">
              {{ playing() ? '❚❚' : '▶' }}
            </button>
            <input class="scrub-range" type="range" min="0" [max]="maxIndex()" step="1"
                   [value]="index()" (input)="onScrub($event)" [disabled]="pointCount() === 0" />
            <button class="play-btn" (click)="restart()" [disabled]="pointCount() === 0">⟲</button>
          </div>
        </div>

        @if (loading()) {
          <div class="map-loading">loading timeline path…</div>
        }
        @if (!loading() && pointCount() === 0) {
          <div class="map-loading">no semantic path for this range — import a Google Timeline export with movement segments</div>
        }
      </div>
    </div>
  `,
  styleUrls: ['./dashboard.scss'],
  styles: [`
    :host { display: flex; flex-direction: column; flex: 1; min-height: 0; }
    .map-card { flex: 1; min-height: 0; }
    .head-left { display: flex; gap: 14px; align-items: center; }
    .head-right { display: flex; gap: 6px; }
    .date-range { font-size: 11px; color: var(--ink-3); }
    .layer-btn {
      padding: 2px 8px; background: transparent; border: 1px solid var(--line);
      color: var(--ink-3); font-family: inherit; font-size: 10.5px; cursor: pointer;
    }
    .layer-btn.on { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }
    .map-body { position: relative; flex: 1; min-height: 0; }
    .map-el { position: absolute; inset: 0; }
    .hud {
      position: absolute; z-index: 500;
      background: color-mix(in oklab, var(--bg) 92%, transparent);
      border: 1px solid var(--line); padding: 8px 12px;
    }
    .hud-coord { top: 12px; left: 12px; display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; font-size: 10.5px; color: var(--ink-3); }
    .hud-row { display: contents; }
    .hud-val { color: var(--ink); }
    .scrubber {
      position: absolute; bottom: 12px; left: 12px; right: 12px; z-index: 500;
      background: color-mix(in oklab, var(--bg) 92%, transparent);
      border: 1px solid var(--line); padding: 10px 14px;
    }
    .scrubber-meta { display: flex; justify-content: space-between; font-size: 10px; color: var(--ink-3); margin-bottom: 8px; }
    .controls-row { display: flex; align-items: center; gap: 10px; }
    .play-btn {
      width: 30px; height: 26px; flex: none; cursor: pointer;
      background: var(--accent-soft); border: 1px solid var(--accent); color: var(--accent);
      font-family: inherit; font-size: 12px;
    }
    .play-btn:disabled { opacity: 0.4; cursor: default; }
    .scrub-range { flex: 1; accent-color: var(--accent); cursor: pointer; }
    .map-loading {
      position: absolute; inset: 0; z-index: 600; display: flex; align-items: center;
      justify-content: center; text-align: center; padding: 0 24px;
      background: color-mix(in oklab, var(--bg) 80%, transparent); font-size: 12px; color: var(--ink-3);
    }
  `],
})
export class DashboardPlaybackComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;
  @Input() set scope(v: string) { this._scope = v || 'ALL'; this.loadForScope(); }
  @Input() set filter(v: string) { this._filter = (v || 'all'); }

  private api = inject(ApiService);
  private map?: L.Map;
  private trailLayer = L.layerGroup();
  private marker?: L.Marker;

  /** Animation budget — dense windows are decimated to keep playback smooth. */
  private static readonly BUDGET = 3000;
  /** Index steps advanced per real second at 1× speed. */
  private static readonly BASE_RATE = 40;

  readonly speeds = [1, 4, 16, 60];

  private _scope = 'ALL';
  private _filter = 'all';
  private points: TimelinePathPoint[] = [];
  private rafId?: number;
  private lastTs = 0;
  private fracIndex = 0;          // fractional position for smooth interpolation

  loading = signal(false);
  playing = signal(false);
  speed = signal(1);
  index = signal(0);
  pointCount = signal(0);
  scopeLabel = signal('ALL TIME');
  clock = signal('—');
  modeLabel = signal('—');
  modeColor = signal('var(--ink-3)');
  caption = signal('');

  ngAfterViewInit() {
    this.api.getHeatmapCenter().subscribe({
      next: (c) => this.initMap(
        c.latitude != null && c.longitude != null ? [c.latitude, c.longitude] : [13.028, 77.665],
        c.latitude != null ? 11 : 12),
      error: () => this.initMap([13.028, 77.665], 11),
    });
  }

  ngOnDestroy() {
    this.stopLoop();
    this.map?.remove();
  }

  private initMap(center: [number, number], zoom: number) {
    this.map = L.map(this.mapEl.nativeElement, {
      center, zoom, zoomControl: false, attributionControl: true,
      scrollWheelZoom: true, preferCanvas: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: '© osm contributors',
    }).addTo(this.map);
    this.trailLayer.addTo(this.map);
    this.loadForScope();
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  // ==================== data ====================

  private loadForScope() {
    if (!this.map) return;
    const { from, to, label } = scopeToRange(this._scope);
    this.scopeLabel.set(label);
    this.loading.set(true);
    this.pause();

    this.api.getTimelinePath(from, to).subscribe({
      next: (path) => {
        this.points = decimate(path, DashboardPlaybackComponent.BUDGET);
        this.pointCount.set(this.points.length);
        this.loading.set(false);
        this.resetAnimation();
        this.fitBounds();
      },
      error: () => { this.points = []; this.pointCount.set(0); this.loading.set(false); this.resetAnimation(); },
    });
  }

  private fitBounds() {
    if (!this.map || !this.points.length) return;
    const latlngs = this.points.map(p => [p.lat, p.lng] as L.LatLngExpression);
    this.map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] });
  }

  // ==================== playback controls ====================

  setSpeed(s: number) { this.speed.set(s); }

  togglePlay() { this.playing() ? this.pause() : this.play(); }

  play() {
    if (!this.points.length) return;
    if (this.fracIndex >= this.maxIndex()) this.resetAnimation(false);
    this.playing.set(true);
    this.lastTs = performance.now();
    this.rafId = requestAnimationFrame(this.step);
  }

  pause() { this.playing.set(false); this.stopLoop(); }

  restart() { this.resetAnimation(); }

  onScrub(e: Event) {
    const i = +(e.target as HTMLInputElement).value;
    this.pause();
    this.fracIndex = i;
    this.rebuildTrailTo(i);
    this.updateAt(i);
  }

  maxIndex = () => Math.max(0, this.points.length - 1);
  progressPct = () => this.maxIndex() ? Math.round((this.index() / this.maxIndex()) * 100) : 0;

  // ==================== animation loop ====================

  private step = (ts: number) => {
    if (!this.playing()) return;
    const dt = (ts - this.lastTs) / 1000;
    this.lastTs = ts;

    const prev = Math.floor(this.fracIndex);
    this.fracIndex = Math.min(this.maxIndex(),
      this.fracIndex + dt * DashboardPlaybackComponent.BASE_RATE * this.speed());
    const cur = Math.floor(this.fracIndex);

    // Extend the coloured trail for every whole index we crossed.
    for (let i = prev; i < cur; i++) this.addTrailSegment(i);
    this.updateAt(this.fracIndex);

    if (this.fracIndex >= this.maxIndex()) { this.pause(); return; }
    this.rafId = requestAnimationFrame(this.step);
  };

  /** Move the marker to a (possibly fractional) position and refresh HUD. */
  private updateAt(frac: number) {
    const i = Math.floor(frac);
    const p = this.points[i];
    if (!p) return;
    const next = this.points[Math.min(i + 1, this.maxIndex())];
    const t = frac - i;
    const lat = p.lat + (next.lat - p.lat) * t;
    const lng = p.lng + (next.lng - p.lng) * t;

    if (!this.marker) {
      this.marker = L.marker([lat, lng], {
        icon: L.divIcon({ className: '', html: '<div class="gt-marker"></div>', iconSize: [10, 10], iconAnchor: [5, 5] }),
      }).addTo(this.map!);
    } else {
      this.marker.setLatLng([lat, lng]);
    }
    this.index.set(i);
    this.clock.set(new Date(p.recordedAt).toLocaleString());
    const mode = p.activityType ?? 'STATIONARY';
    this.modeLabel.set(prettyMode(mode));
    this.modeColor.set(modeColor(p.activityType));
    this.caption.set(prettyMode(mode));
  }

  private addTrailSegment(i: number) {
    const a = this.points[i], b = this.points[i + 1];
    if (!a || !b) return;
    L.polyline([[a.lat, a.lng], [b.lat, b.lng]], {
      color: modeColor(a.activityType), weight: 3, opacity: 0.85,
    }).addTo(this.trailLayer);
  }

  private rebuildTrailTo(i: number) {
    this.trailLayer.clearLayers();
    for (let k = 0; k < i; k++) this.addTrailSegment(k);
  }

  private resetAnimation(resetMarker = true) {
    this.fracIndex = 0;
    this.index.set(0);
    this.trailLayer.clearLayers();
    if (resetMarker && this.marker) { this.map?.removeLayer(this.marker); this.marker = undefined; }
    if (this.points.length) this.updateAt(0);
    else { this.clock.set('—'); this.modeLabel.set('—'); }
  }

  private stopLoop() { if (this.rafId) cancelAnimationFrame(this.rafId); this.rafId = undefined; }
}

// ==================== helpers ====================

/** Convert the dashboard scope token into an ISO from/to window. */
function scopeToRange(scope: string): { from: string; to: string; label: string } {
  const to = new Date();
  const from = new Date();
  const fmt = (d: Date) => d.toISOString();
  switch (scope) {
    case '1W': from.setDate(to.getDate() - 7); return { from: fmt(from), to: fmt(to), label: 'LAST 7 DAYS' };
    case '1M': from.setMonth(to.getMonth() - 1); return { from: fmt(from), to: fmt(to), label: 'LAST 30 DAYS' };
    case '6M': from.setMonth(to.getMonth() - 6); return { from: fmt(from), to: fmt(to), label: 'LAST 6 MONTHS' };
    case '1Y': from.setFullYear(to.getFullYear() - 1); return { from: fmt(from), to: fmt(to), label: 'LAST YEAR' };
    case '5Y': from.setFullYear(to.getFullYear() - 5); return { from: fmt(from), to: fmt(to), label: 'LAST 5 YEARS' };
    default: from.setFullYear(2020, 0, 1); return { from: fmt(from), to: fmt(to), label: 'ALL TIME' };
  }
}

/** Evenly thin an array down to at most `budget` points, keeping order + last point. */
function decimate<T>(arr: T[], budget: number): T[] {
  if (arr.length <= budget) return arr;
  const stride = arr.length / budget;
  const out: T[] = [];
  for (let i = 0; i < budget; i++) out.push(arr[Math.floor(i * stride)]);
  out.push(arr[arr.length - 1]);
  return out;
}

const MODE_COLORS: Record<string, string> = {
  WALKING: '#34d399',
  RUNNING: '#10b981',
  CYCLING: '#a78bfa',
  IN_PASSENGER_VEHICLE: '#ff5a36',
  IN_VEHICLE: '#ff5a36',
  DRIVING: '#ff5a36',
  IN_TAXI: '#fbbf24',
  MOTORCYCLING: '#f472b6',
  IN_BUS: '#60a5fa',
  IN_TRAIN: '#60a5fa',
  IN_SUBWAY: '#60a5fa',
  IN_TRAM: '#60a5fa',
  IN_FERRY: '#22d3ee',
  FLYING: '#f87171',
  IN_FLIGHT: '#f87171',
};

function modeColor(mode?: string | null): string {
  if (!mode) return '#9aa0a6';
  return MODE_COLORS[mode.toUpperCase()] ?? '#9aa0a6';
}

function prettyMode(mode?: string | null): string {
  if (!mode) return 'Stationary';
  return mode.replace(/^IN_/, '').replace(/_/g, ' ').toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}
