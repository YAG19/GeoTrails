import { Component, AfterViewInit, OnDestroy, ElementRef, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';

interface Trail {
  id: string;
  label: string;
  distance: string;
  duration: string;
  points: number;
  color: string;
  coords: [number, number][];
}

@Component({
  selector: 'app-landing-hero',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="hero" data-screen-label="01 Hero">
      <div class="container">
        <div class="status-bar">
          <span>~/geotrail/<span class="status-bar-path">landing</span> <span class="cursor"></span></span>
          <span>● connected · 3 devices syncing · last_ping 2s ago</span>
        </div>

        <div class="hero-grid">
          <div class="hero-left">
            <div class="label"><span class="dot">●</span> your private location history</div>

            <h1 class="display hero-title">
              Every path<br/>
              you've ever<br/>
              <em>walked.</em>
            </h1>

            <p class="hero-lede">
              GeoTrail turns your location data into a beautiful, searchable map of your life — privately hosted on your own server. Forever yours.
            </p>

            <div class="hero-buttons">
              <a href="/register" class="btn btn-primary">$ docker run geotrail <span class="btn-arrow">→</span></a>
              <a href="#demo" class="btn">live demo</a>
            </div>

            <div class="hero-stats">
              <div><div class="label stat-label">LAT_RANGE</div><div class="stat-value">±90.000°</div><div class="stat-sub">full planet</div></div>
              <div><div class="label stat-label">STORAGE</div><div class="stat-value">your_disk</div><div class="stat-sub">zero cloud</div></div>
              <div><div class="label stat-label">EXPORT</div><div class="stat-value">GeoJSON</div><div class="stat-sub">GPX · CSV</div></div>
              <div><div class="label stat-label">LICENSE</div><div class="stat-value">MIT</div><div class="stat-sub">free forever</div></div>
            </div>
          </div>

          <div class="hero-map-col">
            <div class="map-panel">
              <div class="map-header">
                <div class="map-header-info">
                  <span><span class="muted">view:</span> map.tile</span>
                  <span><span class="muted">z:</span> 13</span>
                  <span class="num"><span class="muted">cur:</span> {{ hoverLat() }}, {{ hoverLng() }}</span>
                </div>
                <div class="map-header-dots">
                  <span></span><span></span><span class="active"></span>
                </div>
              </div>

              <div class="map-body">
                <div #mapEl class="map-el"></div>
                <div class="crosshair-v"></div>
                <div class="crosshair-h"></div>
              </div>

              <div class="trail-list">
                <div class="trail-list-header">
                  <span>recent_trails.idx</span>
                  <span>{{ trails.length }} loaded</span>
                </div>
                @for (t of trails; track t.id; let i = $index) {
                  <button
                    class="trail-row"
                    [class.active]="i === activeIdx()"
                    (click)="setActive(i)"
                  >
                    <span class="trail-row-left">
                      <span class="trail-dot" [style.background]="t.color"></span>
                      <span class="trail-label">{{ t.label }}</span>
                    </span>
                    <span class="trail-row-right num">
                      <span>{{ t.distance }}</span>
                      <span>{{ t.duration }}</span>
                      <span>{{ t.points }} pts</span>
                    </span>
                  </button>
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styleUrls: ['./landing-shared.scss'],
  styles: [`
    :host { display: block; }
    .hero {
      position: relative;
      padding-top: 56px;
      border-bottom: 1px solid var(--line);
    }
    .status-bar {
      display: flex; justify-content: space-between;
      font-size: 11px; color: var(--ink-4);
      padding-bottom: 18px; margin-bottom: 36px;
      border-bottom: 1px dashed var(--line);
    }
    .status-bar-path { color: var(--ink-2); }
    .hero-grid {
      display: grid;
      grid-template-columns: minmax(280px, 360px) 1fr;
      gap: 0;
      align-items: stretch;
      min-height: 620px;
    }
    .hero-left {
      padding-right: 36px;
      padding-bottom: 36px;
      display: flex; flex-direction: column;
      gap: 28px;
      border-right: 1px solid var(--line);
    }
    .dot { color: var(--accent); }
    .hero-title {
      font-size: clamp(48px, 6.2vw, 84px);
      line-height: 0.96;
      margin: 0;
      letter-spacing: -0.02em;
      color: var(--ink);
    }
    .hero-title em { font-style: italic; color: var(--accent); }
    .hero-lede {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13.5px;
      line-height: 1.65;
      color: var(--ink-2);
      max-width: 340px;
      margin: 0;
    }
    .hero-buttons { display: flex; gap: 10px; flex-wrap: wrap; }
    .hero-stats {
      margin-top: auto;
      border-top: 1px solid var(--line);
      padding-top: 22px;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 18px;
    }
    .stat-label { font-size: 9.5px; margin-bottom: 4px; }
    .stat-value { font-size: 17px; font-weight: 500; color: var(--ink); letter-spacing: -0.01em; }
    .stat-sub { font-size: 10.5px; color: var(--ink-4); margin-top: 2px; }

    .hero-map-col { position: relative; }
    .map-panel {
      min-height: 540px; height: 100%;
      margin-left: -1px;
      border-left: 1px solid var(--line);
      display: flex; flex-direction: column;
    }
    .map-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 18px;
      border-bottom: 1px solid var(--line);
      font-size: 11px; color: var(--ink-3);
      background: var(--bg-2);
    }
    .map-header-info { display: flex; gap: 14px; }
    .muted { color: var(--ink-4); }
    .map-header-dots { display: flex; gap: 6px; }
    .map-header-dots span {
      width: 8px; height: 8px; border-radius: 50%; background: #3a3a3a;
    }
    .map-header-dots span.active { background: var(--accent); }

    .map-body { flex: 1; min-height: 380px; position: relative; }
    .map-el { position: absolute; inset: 0; }
    .crosshair-v, .crosshair-h {
      position: absolute; top: 50%; left: 50%;
      background: rgba(255,90,54,0.5);
      transform: translate(-50%, -50%);
      pointer-events: none; z-index: 400;
    }
    .crosshair-v { width: 1px; height: 24px; }
    .crosshair-h { width: 24px; height: 1px; }

    .trail-list {
      border-top: 1px solid var(--line);
      background: var(--bg-2);
    }
    .trail-list-header {
      padding: 10px 18px;
      font-size: 10px; color: var(--ink-4);
      border-bottom: 1px solid var(--line-2);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      display: flex; justify-content: space-between;
    }
    .trail-row {
      display: flex; justify-content: space-between; align-items: center;
      width: 100%; text-align: left;
      padding: 10px 18px;
      border: none;
      border-bottom: 1px solid var(--line-2);
      background: transparent;
      color: inherit;
      font-family: inherit;
      font-size: 11.5px;
      cursor: pointer;
      transition: background 120ms;
    }
    .trail-row:last-child { border-bottom: none; }
    .trail-row:hover { background: var(--line-2); }
    .trail-row.active {
      background: color-mix(in oklab, var(--accent) 8%, transparent);
    }
    .trail-row.active:hover {
      background: color-mix(in oklab, var(--accent) 8%, transparent);
    }
    .trail-row-left { display: flex; gap: 10px; align-items: center; color: var(--ink-2); }
    .trail-row.active .trail-row-left .trail-label { color: var(--ink); }
    .trail-dot { width: 6px; height: 6px; border-radius: 50%; }
    .trail-row-right { color: var(--ink-3); font-size: 10.5px; display: flex; gap: 16px; }

    @media (max-width: 900px) {
      .hero-grid { grid-template-columns: 1fr; }
      .hero-left { border-right: none; padding-right: 0; }
      .map-panel { margin-left: 0; border-left: none; border-top: 1px solid var(--line); }
    }
  `],
})
export class LandingHeroComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  activeIdx = signal(0);
  hoverLat = signal('52.5163');
  hoverLng = signal('13.3777');

  private map?: L.Map;
  private cycleTimer?: any;

  trails: Trail[] = [
    {
      id: 'morning-run',
      label: '2026-04-22 · morning_run.gpx',
      distance: '8.42 km',
      duration: '47:12',
      points: 1284,
      color: '#ff5a36',
      coords: [
        [52.5200, 13.4050],[52.5210, 13.4030],[52.5225, 13.4005],[52.5240, 13.3975],
        [52.5252, 13.3940],[52.5260, 13.3900],[52.5265, 13.3855],[52.5263, 13.3810],
        [52.5255, 13.3770],[52.5240, 13.3735],[52.5220, 13.3710],[52.5195, 13.3695],
        [52.5168, 13.3690],[52.5142, 13.3700],[52.5118, 13.3725],[52.5100, 13.3760],
        [52.5092, 13.3800],[52.5095, 13.3845],[52.5108, 13.3885],[52.5128, 13.3920],
        [52.5152, 13.3945],[52.5178, 13.3960],[52.5200, 13.3975],[52.5215, 13.4000],
      ],
    },
    {
      id: 'evening-walk',
      label: '2026-04-22 · evening_walk.gpx',
      distance: '3.18 km',
      duration: '38:04',
      points: 612,
      color: '#ffa040',
      coords: [
        [52.5050, 13.3300],[52.5065, 13.3340],[52.5078, 13.3385],[52.5085, 13.3430],
        [52.5078, 13.3475],[52.5060, 13.3510],[52.5035, 13.3530],[52.5008, 13.3525],
        [52.4988, 13.3500],[52.4980, 13.3460],[52.4985, 13.3415],[52.5000, 13.3375],
        [52.5025, 13.3340],[52.5050, 13.3300],
      ],
    },
    {
      id: 'commute',
      label: '2026-04-22 · commute.gpx',
      distance: '12.67 km',
      duration: '24:45',
      points: 542,
      color: '#7ad9ff',
      coords: [
        [52.4880, 13.4200],[52.4910, 13.4180],[52.4945, 13.4150],[52.4985, 13.4110],
        [52.5025, 13.4060],[52.5060, 13.4000],[52.5090, 13.3935],[52.5110, 13.3865],
        [52.5125, 13.3795],[52.5135, 13.3725],[52.5142, 13.3655],[52.5150, 13.3585],
      ],
    },
  ];

  ngAfterViewInit() {
    this.map = L.map(this.mapEl.nativeElement, {
      center: [52.5163, 13.3777],
      zoom: 13,
      zoomControl: false,
      scrollWheelZoom: false,
      preferCanvas: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© osm contributors',
    }).addTo(this.map);

    this.trails.forEach((t, i) => {
      L.polyline(t.coords, {
        color: t.color,
        weight: i === 0 ? 3.2 : 2,
        opacity: i === 0 ? 0.95 : 0.55,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(this.map!);
    });

    const last = this.trails[0].coords[this.trails[0].coords.length - 1];
    const liveIcon = L.divIcon({
      className: '',
      html: '<div class="gt-marker live"></div>',
      iconSize: [10, 10],
      iconAnchor: [5, 5],
    });
    L.marker(last as L.LatLngExpression, { icon: liveIcon }).addTo(this.map);

    this.map.on('mousemove', (e: L.LeafletMouseEvent) => {
      this.hoverLat.set(e.latlng.lat.toFixed(4));
      this.hoverLng.set(e.latlng.lng.toFixed(4));
    });

    this.cycleTimer = setInterval(() => {
      this.setActive((this.activeIdx() + 1) % this.trails.length);
    }, 4500);
  }

  ngOnDestroy() {
    clearInterval(this.cycleTimer);
    this.map?.remove();
  }

  setActive(i: number) {
    this.activeIdx.set(i);
    if (!this.map) return;
    const bounds = L.latLngBounds(this.trails[i].coords as L.LatLngExpression[]);
    this.map.flyToBounds(bounds, { padding: [50, 50], duration: 1.2 });
  }
}
