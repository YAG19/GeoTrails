import {
  AfterViewInit, Component, DestroyRef, ElementRef, Input, OnDestroy, ViewChild,
  effect, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import * as L from 'leaflet';
import 'leaflet.heat';
import { ApiService } from '../../core/services/api.service';
import { ThemeService } from '../../core/services/theme.service';
import { LocationPoint, Place } from '../../core/models/api.models';

/** Points closer in time than this belong to the same trail. */
const TRAIL_GAP_MS = 30 * 60 * 1000;
/** Must match the `size` sent to queryLocations. */
const POINT_LIMIT = 5000;

type LayerKey = 'trails' | 'places' | 'heat';

interface Trail {
  points: LocationPoint[];
  line: L.Polyline;
}

/** leaflet.heat registers itself on the global Leaflet object. */
function heatLayerFactory(): ((latlngs: [number, number, number?][], opts?: object) => L.Layer) | null {
  const g = (window as unknown as { L?: { heatLayer?: unknown } }).L;
  const fn = (L as unknown as { heatLayer?: unknown }).heatLayer ?? g?.heatLayer;
  return typeof fn === 'function' ? (fn as never) : null;
}

@Component({
  selector: 'app-dashboard-map',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="card map-card">
      <div class="card-head">
        <div class="head-left">
          <span class="label">MAP · {{ scopeLabel() }}</span>
          <span class="date-range">{{ dateRange() }}</span>
        </div>
        <div class="head-right" role="group" aria-label="Map layers">
          @for (l of layerKeys; track l) {
            <button type="button" class="layer-btn" [class.on]="layers()[l]" [attr.aria-pressed]="layers()[l]" (click)="toggleLayer(l)">
              {{ l }}
            </button>
          }
        </div>
      </div>

      <div class="map-body">
        <div
          #mapEl
          class="map-el"
          role="application"
          aria-roledescription="map"
          [attr.aria-label]="'Location history map, ' + scopeLabel().toLowerCase()"
          aria-describedby="map-keys"
        ></div>
        <p id="map-keys" class="visually-hidden">
          Use arrow keys to pan and plus or minus to zoom. Select a trail to see its details.
        </p>

        <!-- coord HUD -->
        <div class="hud hud-coord" aria-hidden="true">
          <span class="label hud-k">{{ hovering() ? 'CURSOR' : 'CENTER' }}</span><span></span>
          <span class="label hud-k">LAT</span><span class="num hud-val">{{ lat() }}</span>
          <span class="label hud-k">LNG</span><span class="num hud-val">{{ lng() }}</span>
          <span class="label hud-k">ZOOM</span><span class="num hud-val">{{ zoom() }}</span>
          <span class="label hud-k">PTS</span>
          <span class="num hud-val">{{ pointCount() | number }}{{ truncated() ? '+' : '' }}</span>
        </div>

        @if (layers().heat) {
          <div class="hud hud-legend" aria-hidden="true">
            <div class="label hud-k" style="margin-bottom:6px">DENSITY</div>
            <div class="legend-bar-wrap">
              <span class="legend-lbl">low</span>
              <div class="legend-bar"></div>
              <span class="legend-lbl">high</span>
            </div>
          </div>
        }

        <!-- zoom / fit controls -->
        <div class="map-tools" role="group" aria-label="Map controls">
          <button type="button" class="tool-btn" aria-label="Zoom in" title="Zoom in" (click)="map?.zoomIn()">+</button>
          <button type="button" class="tool-btn" aria-label="Zoom out" title="Zoom out" (click)="map?.zoomOut()">−</button>
          <button type="button" class="tool-btn" aria-label="Fit map to data" title="Fit to data"
                  [disabled]="!pointCount()" (click)="fitToData()">⤢</button>
        </div>

        @if (selected(); as s) {
          <div class="trail-card" role="region" aria-label="Selected trail">
            <div class="tc-head">
              <span class="label">TRAIL</span>
              <button type="button" class="tc-close" aria-label="Close trail details" (click)="clearSelection()">×</button>
            </div>
            <div class="tc-time">
              <time [attr.datetime]="s.start">{{ s.start | date: 'EEE d MMM y, HH:mm' }}</time>
              → <time [attr.datetime]="s.end">{{ s.end | date: 'HH:mm' }}</time>
            </div>
            <dl class="tc-stats">
              <div><dt>distance</dt><dd class="num">{{ s.km }} km</dd></div>
              <div><dt>duration</dt><dd class="num">{{ s.duration }}</dd></div>
              <div><dt>points</dt><dd class="num">{{ s.points | number }}</dd></div>
              @if (s.activity) { <div><dt>mode</dt><dd>{{ s.activity }}</dd></div> }
            </dl>
            <button type="button" class="btn-sm" (click)="zoomToSelected()">zoom to trail</button>
          </div>
        }

        @if (loading()) {
          <div class="map-overlay" role="status">loading location data…</div>
        } @else if (loadError()) {
          <div class="map-overlay" role="alert">
            <p>Couldn't load location data.</p>
            <button type="button" class="btn-sm" (click)="reload()">retry</button>
          </div>
        } @else if (ready() && !pointCount()) {
          <div class="map-overlay">
            <p>No location points {{ _filter !== 'all' ? 'for “' + _filter + '” ' : '' }}in {{ scopeLabel().toLowerCase() }}.</p>
            <a class="btn-sm" routerLink="/import">import Google Timeline data</a>
          </div>
        }
      </div>
    </div>
  `,
  styleUrls: ['./dashboard.scss'],
  styles: [`
    :host { display: flex; flex-direction: column; flex: 1; min-height: 0; }
    .map-card { flex: 1; min-height: 0; }
    .head-left { display: flex; gap: 14px; align-items: center; min-width: 0; }
    .head-right { display: flex; gap: 6px; }
    .date-range { font-size: 11px; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .layer-btn, .btn-sm, .tool-btn {
      background: transparent;
      border: 1px solid var(--line);
      color: var(--ink-3);
      font-family: inherit; cursor: pointer;
    }
    .layer-btn { padding: 2px 8px; font-size: 10.5px; }
    .layer-btn:hover, .btn-sm:hover, .tool-btn:hover:not(:disabled) { color: var(--ink); border-color: var(--ink-4); }
    .layer-btn.on { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }

    .map-body { position: relative; flex: 1; min-height: 0; }
    .map-el { position: absolute; inset: 0; }

    .hud, .map-tools, .trail-card {
      position: absolute; z-index: 500;
      background: color-mix(in oklab, var(--bg) 92%, transparent);
      border: 1px solid var(--line);
    }
    .hud { padding: 8px 12px; pointer-events: none; }
    .hud-k { font-size: 9px; }
    .hud-coord { top: 12px; left: 12px; display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; font-size: 10.5px; color: var(--ink-3); }
    .hud-val { color: var(--ink); text-align: right; }
    .hud-legend { top: 12px; right: 12px; }
    .legend-bar-wrap { display: flex; align-items: center; gap: 4px; }
    .legend-bar { width: 70px; height: 6px; background: linear-gradient(90deg, color-mix(in oklab, var(--accent) 15%, transparent), var(--accent), #ffd2c4); }
    .legend-lbl { font-size: 9px; color: var(--ink-3); }

    .map-tools { right: 12px; bottom: 28px; display: grid; }
    .tool-btn { width: 30px; height: 30px; font-size: 15px; border: 0; border-bottom: 1px solid var(--line); color: var(--ink-2); }
    .tool-btn:last-child { border-bottom: 0; }
    .tool-btn:disabled { opacity: 0.4; cursor: default; }

    .trail-card { left: 12px; bottom: 28px; width: min(280px, calc(100% - 70px)); padding: 10px 12px; display: grid; gap: 8px; font-size: 11px; }
    .tc-head { display: flex; justify-content: space-between; align-items: center; }
    .tc-close { background: none; border: 0; color: var(--ink-3); font-size: 16px; line-height: 1; cursor: pointer; padding: 0 2px; }
    .tc-close:hover { color: var(--ink); }
    .tc-time { color: var(--ink); }
    .tc-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px 12px; }
    .tc-stats dt { font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-3); }
    .tc-stats dd { color: var(--ink); }
    .btn-sm { padding: 3px 10px; font-size: 11px; justify-self: start; text-decoration: none; }

    .map-overlay {
      position: absolute; inset: 0; z-index: 600;
      display: flex; flex-direction: column; gap: 10px; align-items: center; justify-content: center;
      background: color-mix(in oklab, var(--bg) 80%, transparent);
      font-size: 12px; color: var(--ink-2); text-align: center; padding: 16px;
    }
    .map-overlay .btn-sm { color: var(--accent); border-color: var(--accent); }
  `],
})
export class DashboardMapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;
  @Input() set scope(v: string) {
    this._scope = v;
    this.loadForScope();
  }
  @Input() set filter(v: string) {
    const next = v || 'all';
    if (next === this._filter) return;
    this._filter = next;
    this.renderFiltered(true);
  }

  private api = inject(ApiService);
  private theme = inject(ThemeService);
  private destroyRef = inject(DestroyRef);

  map?: L.Map;
  private trailsLayer = L.layerGroup();
  private placesLayer = L.layerGroup();
  private heatGroup = L.layerGroup();
  private renderer = L.canvas({ tolerance: 6 }); // wider hit area for thin trails

  _scope = 'ALL';
  _filter = 'all';
  private loadedPoints: LocationPoint[] = [];
  private loadedPlaces: Place[] = [];
  private visiblePoints: LocationPoint[] = [];
  private trails: Trail[] = [];
  private selectedTrail?: Trail;
  private loadSeq = 0;

  readonly layerKeys: LayerKey[] = ['trails', 'places', 'heat'];
  layers = signal<Record<LayerKey, boolean>>({ trails: true, places: true, heat: true });

  ready = signal(false);
  loading = signal(false);
  loadError = signal(false);
  hovering = signal(false);
  lat = signal('—');
  lng = signal('—');
  zoom = signal(0);
  pointCount = signal(0);
  truncated = signal(false);
  scopeLabel = signal('ALL TIME');
  dateRange = signal('');
  selected = signal<{ start: string; end: string; km: string; duration: string; points: number; activity?: string } | null>(null);

  constructor() {
    // Canvas layers can't read CSS variables, so repaint them when the theme flips.
    effect(() => {
      this.theme.scheme();
      queueMicrotask(() => this.repaint());
    });
  }

  ngAfterViewInit() {
    this.api.getHeatmapCenter().subscribe({
      next: (center) => {
        const hasData = center.latitude != null && center.longitude != null;
        this.initMap(hasData ? [center.latitude!, center.longitude!] : [20, 0], hasData ? 7 : 2);
      },
      error: () => this.initMap([20, 0], 2),
    });
  }

  ngOnDestroy() {
    this.map?.remove();
  }

  private initMap(center: [number, number], zoom: number) {
    this.map = L.map(this.mapEl.nativeElement, {
      center,
      zoom,
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: true,
      keyboard: true,
      preferCanvas: true,
      renderer: this.renderer,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.map);

    this.heatGroup.addTo(this.map);
    this.trailsLayer.addTo(this.map);
    this.placesLayer.addTo(this.map);

    this.map.on('mousemove', (e: L.LeafletMouseEvent) => {
      this.hovering.set(true);
      this.setCoords(e.latlng);
    });
    this.map.on('mouseout', () => {
      this.hovering.set(false);
      this.setCoords(this.map!.getCenter());
    });
    this.map.on('moveend', () => {
      if (!this.hovering()) this.setCoords(this.map!.getCenter());
    });
    this.map.on('zoomend', () => this.zoom.set(this.map!.getZoom()));
    this.map.on('click', () => this.clearSelection());
    this.map.getContainer().addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.clearSelection();
    });

    this.zoom.set(zoom);
    this.setCoords(this.map.getCenter());
    this.loadForScope();
    setTimeout(() => this.map?.invalidateSize(), 0);

    // Keep the map sized correctly when the layout changes (sidebar, window, rail).
    const ro = new ResizeObserver(() => this.map?.invalidateSize());
    ro.observe(this.mapEl.nativeElement);
    this.destroyRef.onDestroy(() => ro.disconnect());
  }

  // ── Public actions ──────────────────────────────────────────────

  toggleLayer(l: LayerKey) {
    const next = { ...this.layers(), [l]: !this.layers()[l] };
    this.layers.set(next);
    const layer = l === 'trails' ? this.trailsLayer : l === 'places' ? this.placesLayer : this.heatGroup;
    if (!this.map) return;
    if (next[l]) layer.addTo(this.map);
    else this.map.removeLayer(layer);
    if (l === 'trails' && !next[l]) this.clearSelection();
  }

  fitToData() {
    if (!this.map || !this.visiblePoints.length) return;
    const bounds = L.latLngBounds(this.visiblePoints.map((p) => [p.latitude, p.longitude] as L.LatLngTuple));
    this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }

  zoomToSelected() {
    if (this.map && this.selectedTrail) {
      this.map.fitBounds(this.selectedTrail.line.getBounds(), { padding: [60, 60], maxZoom: 17 });
    }
  }

  clearSelection() {
    if (!this.selectedTrail) return;
    this.selectedTrail = undefined;
    this.selected.set(null);
    this.styleTrails();
  }

  reload() {
    this.loadForScope();
  }

  // ── Data ────────────────────────────────────────────────────────

  private loadForScope() {
    if (!this.map) return;
    const { from, to, label } = this.scopeToRange(this._scope);
    this.scopeLabel.set(label);
    this.dateRange.set(`${from.slice(0, 10)} → ${to.slice(0, 10)}`);
    this.loading.set(true);
    this.loadError.set(false);
    const seq = ++this.loadSeq; // ignore responses from superseded scopes

    this.api.queryLocations({ from, to, size: POINT_LIMIT }).subscribe({
      next: (pts) => {
        if (seq !== this.loadSeq) return;
        this.loadedPoints = [...pts].sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt));
        this.truncated.set(pts.length >= POINT_LIMIT);
        this.renderFiltered(true);
        this.loading.set(false);
        this.ready.set(true);
      },
      error: () => {
        if (seq !== this.loadSeq) return;
        this.loadedPoints = [];
        this.renderFiltered(false);
        this.loading.set(false);
        this.loadError.set(true);
      },
    });

    this.api.getPlaces().subscribe({
      next: (places) => {
        this.loadedPlaces = places;
        this.renderPlaces();
      },
      error: () => {},
    });
  }

  private renderFiltered(fit: boolean) {
    if (!this.map) return;
    const f = (this._filter || 'all').toLowerCase();
    this.visiblePoints =
      f === 'all' ? this.loadedPoints : this.loadedPoints.filter((p) => (p.activityType ?? '').toLowerCase() === f);
    this.pointCount.set(this.visiblePoints.length);
    this.selectedTrail = undefined;
    this.selected.set(null);
    this.renderTrails();
    this.renderHeat();
    if (fit) this.fitToData();
  }

  private repaint() {
    if (!this.map) return;
    this.renderHeat();
    this.styleTrails();
    this.renderPlaces();
  }

  // ── Rendering ───────────────────────────────────────────────────

  private renderTrails() {
    this.trailsLayer.clearLayers();
    this.trails = [];
    const pts = this.visiblePoints;
    if (!pts.length) return;

    let cur: LocationPoint[] = [pts[0]];
    const groups: LocationPoint[][] = [];
    for (let i = 1; i < pts.length; i++) {
      if (Date.parse(pts[i].recordedAt) - Date.parse(pts[i - 1].recordedAt) > TRAIL_GAP_MS) {
        groups.push(cur);
        cur = [];
      }
      cur.push(pts[i]);
    }
    groups.push(cur);

    for (const points of groups) {
      if (points.length < 2) continue;
      const line = L.polyline(
        points.map((p) => [p.latitude, p.longitude] as L.LatLngTuple),
        { renderer: this.renderer, interactive: true },
      );
      const trail: Trail = { points, line };
      line.on('mouseover', () => {
        if (trail !== this.selectedTrail) line.setStyle(this.trailStyle('hover'));
        line.bringToFront();
      });
      line.on('mouseout', () => {
        if (trail !== this.selectedTrail) line.setStyle(this.trailStyle('idle'));
      });
      line.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        this.selectTrail(trail);
      });
      line.addTo(this.trailsLayer);
      this.trails.push(trail);
    }
    this.styleTrails();
  }

  private styleTrails() {
    for (const t of this.trails) {
      t.line.setStyle(this.trailStyle(t === this.selectedTrail ? 'selected' : this.selectedTrail ? 'dimmed' : 'idle'));
    }
    this.selectedTrail?.line.bringToFront();
  }

  private trailStyle(state: 'idle' | 'hover' | 'selected' | 'dimmed'): L.PathOptions {
    const color = this.cssColor('--accent');
    switch (state) {
      case 'hover':    return { color, weight: 3.5, opacity: 1 };
      case 'selected': return { color, weight: 4, opacity: 1 };
      case 'dimmed':   return { color, weight: 1.5, opacity: 0.25 };
      default:         return { color, weight: 1.8, opacity: 0.7 };
    }
  }

  private selectTrail(trail: Trail) {
    this.selectedTrail = trail;
    const pts = trail.points;
    const start = pts[0].recordedAt;
    const end = pts[pts.length - 1].recordedAt;
    let meters = 0;
    for (let i = 1; i < pts.length; i++) {
      meters += L.latLng(pts[i - 1].latitude, pts[i - 1].longitude).distanceTo([pts[i].latitude, pts[i].longitude]);
    }
    const counts = new Map<string, number>();
    pts.forEach((p) => p.activityType && counts.set(p.activityType, (counts.get(p.activityType) ?? 0) + 1));
    const activity = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

    this.selected.set({
      start,
      end,
      km: (meters / 1000).toFixed(meters < 10_000 ? 2 : 1),
      duration: this.formatDuration(Date.parse(end) - Date.parse(start)),
      points: pts.length,
      activity: activity?.toLowerCase().replace(/_/g, ' '),
    });
    this.styleTrails();
  }

  private renderHeat() {
    this.heatGroup.clearLayers();
    const factory = heatLayerFactory();
    if (!factory || !this.visiblePoints.length) return;
    const accent = this.cssColor('--accent');
    factory(
      this.visiblePoints.map((p) => [p.latitude, p.longitude, 0.6]),
      {
        radius: 14,
        blur: 18,
        maxZoom: 14,
        minOpacity: 0.2,
        gradient: { 0.3: this.withAlpha(accent, 0.35), 0.65: accent, 1: '#ffd2c4' },
      },
    ).addTo(this.heatGroup);
  }

  private renderPlaces() {
    this.placesLayer.clearLayers();
    const accent = this.cssColor('--accent');
    for (const p of this.loadedPlaces) {
      L.circle([p.latitude, p.longitude], {
        radius: p.radiusMeters,
        color: accent,
        fillColor: accent,
        fillOpacity: 0.08,
        weight: 1,
        interactive: false,
        renderer: this.renderer,
      }).addTo(this.placesLayer);

      const tip = document.createElement('span');
      tip.textContent = p.category ? `${p.name} · ${p.category}` : p.name; // textContent: no HTML injection
      L.marker([p.latitude, p.longitude], {
        title: p.name,
        alt: p.name,
        keyboard: true,
        icon: L.divIcon({ className: '', html: '<div class="gt-marker"></div>', iconSize: [8, 8], iconAnchor: [4, 4] }),
      })
        .bindTooltip(tip, { direction: 'top', offset: [0, -6] })
        .addTo(this.placesLayer);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────

  /** Resolve a CSS colour token (which may use light-dark()) to a concrete colour for canvas drawing. */
  private cssColor(token: string): string {
    const el = this.mapEl?.nativeElement;
    if (!el) return '#ff5a36';
    const probe = document.createElement('span');
    probe.style.color = `var(${token})`;
    probe.style.display = 'none';
    el.appendChild(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c || '#ff5a36';
  }

  private withAlpha(color: string, alpha: number): string {
    const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    return m ? `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})` : color;
  }

  private setCoords(ll: L.LatLng) {
    const fmt = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(4)}°${v >= 0 ? pos : neg}`;
    this.lat.set(fmt(ll.lat, 'N', 'S'));
    this.lng.set(fmt(L.Util.wrapNum(ll.lng, [-180, 180], true), 'E', 'W'));
  }

  private formatDuration(ms: number): string {
    const mins = Math.max(0, Math.round(ms / 60000));
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    return h < 24 ? `${h} h ${mins % 60} min` : `${Math.floor(h / 24)} d ${h % 24} h`;
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
      default: from.setFullYear(2000, 0, 1); return { from: fmt(from), to: fmt(to), label: 'ALL TIME' };
    }
  }
}
