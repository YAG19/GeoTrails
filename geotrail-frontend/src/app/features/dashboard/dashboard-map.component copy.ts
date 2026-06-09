import {
  Component, OnInit, OnDestroy, AfterViewInit,
  ElementRef, ViewChild, Input, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { inject } from '@angular/core';
import * as L from 'leaflet';
import { ApiService } from '../../core/services/api.service';
import { LocationPoint, Place } from '../../core/models/api.models';

@Component({
  selector: 'app-dashboard-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card map-card">
      <!-- card head -->
      <div class="card-head">
        <div class="head-left">
          <span class="label">HEATMAP · {{ scopeLabel() }}</span>
          <span class="date-range">{{ dateRange() }}</span>
        </div>
        <div class="head-right">
          <button class="layer-btn" [class.on]="layers.trails" (click)="toggleLayer('trails')">trails</button>
          <button class="layer-btn" [class.on]="layers.places" (click)="toggleLayer('places')">places</button>
          <button class="layer-btn" [class.on]="layers.heat"   (click)="toggleLayer('heat')">heat</button>
        </div>
      </div>

      <!-- map body -->
      <div class="map-body">
        <div #mapEl class="map-el"></div>

        <!-- coord HUD -->
        <div class="hud hud-coord">
          <div class="hud-row">
            <span class="label" style="font-size:9px">LAT</span>
            <span class="num hud-val">{{ hoverLat() }}°N</span>
          </div>
          <div class="hud-row">
            <span class="label" style="font-size:9px">LNG</span>
            <span class="num hud-val">{{ hoverLng() }}°E</span>
          </div>
          <div class="hud-row">
            <span class="label" style="font-size:9px">ZOOM</span>
            <span class="num hud-val">{{ zoom() }}</span>
          </div>
        </div>

        <!-- density legend -->
        <div class="hud hud-legend">
          <div class="label" style="font-size:9px;margin-bottom:6px">DENSITY</div>
          <div class="legend-bar-wrap">
            <span class="legend-lbl">low</span>
            <div class="legend-bar"></div>
            <span class="legend-lbl">high</span>
          </div>
        </div>

        <!-- crosshair -->
        <div class="crosshair-v"></div>
        <div class="crosshair-h"></div>

        <!-- scrubber -->
     <!--     <div class="scrubber">
          <div class="scrubber-meta">
             <span>SCRUB · {{ scrubLabel() }}</span>
            <span class="num">{{ pointCount() | number }} pts · render {{ renderMs() }}ms</span>
          </div>
          <div class="scrubber-bars">
            @for (b of scrubBars; track $index; let i = $index) {
              <div class="scrub-bar" [style.height.%]="b * 100"
                   [class.recent]="i > scrubBars.length * 0.75"></div>
            }
          </div>
          <div class="scrubber-labels">
            @for (y of scrubYears; track y) { <span>{{ y }}</span> }
          </div>
        </div> -->

        @if (loading()) {
          <div class="map-loading">loading location data…</div>
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
      padding: 2px 8px;
      background: transparent;
      border: 1px solid var(--line);
      color: var(--ink-3);
      font-family: inherit; font-size: 10.5px; cursor: pointer;
    }
    .layer-btn.on {
      background: var(--accent-soft);
      border-color: var(--accent);
      color: var(--accent);
    }
    .map-body { position: relative; flex: 1; min-height: 0; }
    .map-el { position: absolute; inset: 0; }
    .hud {
      position: absolute; z-index: 500;
      background: color-mix(in oklab, var(--bg) 92%, transparent);
      border: 1px solid var(--line);
      padding: 8px 12px;
    }
    .hud-coord { top: 12px; left: 12px; display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; font-size: 10.5px; color: var(--ink-3); }
    .hud-row { display: contents; }
    .hud-val { color: var(--ink); }
    .hud-legend { top: 12px; right: 12px; }
    .legend-bar-wrap { display: flex; align-items: center; gap: 4px; }
    .legend-bar { width: 70px; height: 6px; background: linear-gradient(90deg, rgba(255,90,54,0.1), rgba(255,90,54,1)); }
    .legend-lbl { font-size: 9px; color: var(--ink-4); }
    .crosshair-v, .crosshair-h {
      position: absolute; top: 50%; left: 50%;
      background: rgba(255,90,54,0.45);
      transform: translate(-50%,-50%);
      pointer-events: none; z-index: 400;
    }
    .crosshair-v { width: 1px; height: 20px; }
    .crosshair-h { width: 20px; height: 1px; }
    .scrubber {
      position: absolute; bottom: 12px; left: 12px; right: 12px; z-index: 500;
      background: color-mix(in oklab, var(--bg) 92%, transparent);
      border: 1px solid var(--line);
      padding: 10px 14px;
    }
    .scrubber-meta {
      display: flex; justify-content: space-between;
      font-size: 10px; color: var(--ink-3); margin-bottom: 6px;
    }
    .scrubber-bars {
      display: flex; align-items: flex-end; gap: 1.5px; height: 22px;
    }
    .scrub-bar {
      flex: 1; background: var(--ink-4); opacity: 0.55; min-width: 2px;
    }
    .scrub-bar.recent { background: var(--accent); opacity: 1; }
    .scrubber-labels {
      display: flex; justify-content: space-between;
      font-size: 9.5px; color: var(--ink-4); margin-top: 4px;
    }
    .map-loading {
      position: absolute; inset: 0; z-index: 600;
      display: flex; align-items: center; justify-content: center;
      background: color-mix(in oklab, var(--bg) 80%, transparent);
      font-size: 12px; color: var(--ink-3);
    }
  `],
})
export class DashboardMapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;
  @Input() set scope(v: string) { this._scope = v; this.loadForScope(); }
  @Input() set filter(v: string) {
    const next = v || 'all';
    if (next === this._filter) return;
    this._filter = next;
    this.renderFiltered();
  }

  private api = inject(ApiService);
  private map?: L.Map;
  private trailsLayer = L.layerGroup();
  private placesLayer = L.layerGroup();
  private heatLayer = L.layerGroup();

  _scope = 'ALL';
  _filter = 'all';
  private loadedPoints: LocationPoint[] = [];
  loading = signal(false);
  hoverLat = signal('13.028');
  hoverLng = signal('77.665');
  zoom = signal(7);
  pointCount = signal(0);
  renderMs = signal(0);
  scopeLabel = signal('ALL TIME');
  dateRange = signal('');

  layers = { trails: true, places: true, heat: true };

  scrubBars: number[] = [];
  scrubYears: string[] = [];
  scrubLabel = signal('all time');

  ngAfterViewInit() {
    this.api.getHeatmapCenter().subscribe({
      next: (center) => {
        const hasData = center.latitude != null && center.longitude != null;
        this.initMap(
          hasData ? [center.latitude!, center.longitude!] : [13.028, 77.665],
          hasData ? 7 : 12,
        );
      },
      error: () => this.initMap([13.028, 77.665], 7),
    });
  }

  private initMap(center: [number, number], zoom: number) {
    this.map = L.map(this.mapEl.nativeElement, {
      center,
      zoom,
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: true,
      preferCanvas: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© osm contributors',
    }).addTo(this.map);

    this.trailsLayer.addTo(this.map);
    this.placesLayer.addTo(this.map);
    this.heatLayer.addTo(this.map);

    this.map.on('mousemove', (e: L.LeafletMouseEvent) => {
      this.hoverLat.set(e.latlng.lat.toFixed(5));
      this.hoverLng.set(e.latlng.lng.toFixed(5));
    });
    this.map.on('zoomend', () => this.zoom.set(this.map!.getZoom()));

    this.buildScrubber();
    this.loadForScope();
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  ngOnDestroy() { this.map?.remove(); }

  toggleLayer(l: 'trails' | 'places' | 'heat') {
    this.layers[l] = !this.layers[l];
    const layer = l === 'trails' ? this.trailsLayer : l === 'places' ? this.placesLayer : this.heatLayer;
    if (this.layers[l]) layer.addTo(this.map!);
    else this.map!.removeLayer(layer);
  }

  private loadForScope() {
    if (!this.map) return;
    const { from, to, label } = this.scopeToRange(this._scope);
    this.scopeLabel.set(label);
    this.scrubLabel.set(label.toLowerCase());
    this.dateRange.set(`${from} → ${to}`);
    this.loading.set(true);
    const t0 = Date.now();

    // Load location points
    this.api.queryLocations({ from, to, size: 5000 }).subscribe({
      next: (pts) => {
        this.loadedPoints = pts;
        this.renderMs.set(Date.now() - t0);
        this.renderFiltered();
        this.loading.set(false);
      },
      error: () => {
        this.loadedPoints = [];
        this.trailsLayer.clearLayers();
        this.heatLayer.clearLayers();
        this.renderSeedData();
        this.loading.set(false);
      },
    });

    // Load places
    this.api.getPlaces().subscribe({
      next: (places) => { this.renderPlaces(places); },
      error: () => { },
    });
  }

  private renderFiltered() {
    if (!this.map) return;
    this.trailsLayer.clearLayers();
    this.heatLayer.clearLayers();
    const f = (this._filter || 'all').toLowerCase();
    const filtered = f === 'all'
      ? this.loadedPoints
      : this.loadedPoints.filter(p => (p.activityType ?? '').toLowerCase() === f);
    this.pointCount.set(filtered.length);
    this.renderPoints(filtered);
    console.log("filtered", filtered);
  }

  private renderPoints(pts: LocationPoint[]) {
    if (!pts.length) { this.renderSeedData(); return; }

    // Segment into trails by 30-min gaps
    const trails: LocationPoint[][] = [];
    let cur: LocationPoint[] = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const gap = new Date(pts[i].recordedAt).getTime() - new Date(pts[i - 1].recordedAt).getTime();
      if (gap > 30 * 60 * 1000) { trails.push(cur); cur = []; }
      cur.push(pts[i]);
    }
    if (cur.length) trails.push(cur);

    trails.forEach((trail, i) => {
      const coords = trail.map(p => [p.latitude, p.longitude] as L.LatLngExpression);
      L.polyline(coords, {
        color: '#ff5a36',
        weight: 1.8,
        opacity: 0.7,
      }).addTo(this.trailsLayer);
    });

    // Density circles around hotspot areas
    const buckets = new Map<string, number>();
    pts.forEach(p => {
      const key = `${(p.latitude * 20 | 0) / 20},${(p.longitude * 20 | 0) / 20}`;
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    });
    const maxCount = Math.max(...buckets.values());
    buckets.forEach((count, key) => {
      if (count < maxCount * 0.15) return;
      const [lat, lng] = key.split(',').map(Number);
      L.circle([lat, lng], {
        radius: 300 * (count / maxCount),
        color: 'transparent',
        fillColor: '#ff5a36',
        fillOpacity: 0.12 * (count / maxCount),
      }).addTo(this.heatLayer);
    });
  }

  private renderPlaces(places: Place[]) {
    this.placesLayer.clearLayers();
    places.forEach(p => {
      L.circle([p.latitude, p.longitude], {
        radius: p.radiusMeters,
        color: 'var(--accent)',
        fillColor: 'var(--accent)',
        fillOpacity: 0.08,
        weight: 1,
      }).addTo(this.placesLayer);

      L.marker([p.latitude, p.longitude], {
        icon: L.divIcon({
          className: '',
          html: '<div class="gt-marker"></div>',
          iconSize: [8, 8], iconAnchor: [4, 4],
        }),
      }).addTo(this.placesLayer);
    });
  }

  private renderSeedData() {
    // Deterministic fallback when API is unavailable
    let x = 42;
    const rng = () => (x = (x * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 120; i++) {
      const sLat = 52.46 + rng() * 0.16;
      const sLng = 13.28 + rng() * 0.26;
      const len = 8 + Math.floor(rng() * 18);
      const pts: L.LatLngExpression[] = [[sLat, sLng]];
      for (let j = 0; j < len; j++) {
        const last = pts[pts.length - 1] as [number, number];
        pts.push([last[0] + (rng() - 0.5) * 0.013, last[1] + (rng() - 0.5) * 0.02]);
      }
      const hot = i % 11 === 0;
      L.polyline(pts, { color: '#ff5a36', weight: hot ? 2.2 : 1, opacity: hot ? 0.95 : 0.28 })
        .addTo(this.trailsLayer);
    }
  }

  private buildScrubber() {
    let x = 7;
    this.scrubBars = Array.from({ length: 64 }, () => {
      x = (x * 9301 + 49297) % 233280;
      return 0.2 + (x / 233280) * 0.8;
    });
    this.scrubYears = ['2021', '2022', '2023', '2024', '2025', '2026'];
  }

  private scopeToRange(scope: string): { from: string; to: string; label: string } {
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
}
