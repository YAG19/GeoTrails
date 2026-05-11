import { Component, AfterViewInit, OnDestroy, ElementRef, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';

@Component({
  selector: 'app-landing-demo',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="demo" data-screen-label="04 Demo">
      <div class="container">
        <div class="section-header-grid">
          <div class="label section-header-tag">§ 03 / dashboard</div>
          <div>
            <h2 class="display section-header-title">Five years <em>of you, queryable.</em></h2>
            <p class="section-header-sub">
              The dashboard ships with the daemon. Pan, filter, scrub — your whole life as one map.
            </p>
          </div>
        </div>

        <div class="app-frame">
          <div class="app-chrome">
            <div class="chrome-left">
              <span class="chrome-dot accent"></span>
              <span class="chrome-dot"></span>
              <span class="chrome-dot"></span>
              <span class="chrome-url">geotrail.local:8080/dashboard</span>
            </div>
            <div class="chrome-right">
              <span>● live</span>
              <span>3 imports queued</span>
              <span>db: 2.4 GB</span>
            </div>
          </div>

          <div class="app-body">
            <!-- sidebar -->
            <div class="sidebar">
              <div class="sb-section">
                <div class="label sb-title">VIEWS</div>
                @for (v of views; track v.id) {
                  <button class="sb-item" [class.active]="view() === v.id" (click)="view.set(v.id)">
                    <span class="sb-icon">{{ v.icon }}</span>
                    <span class="sb-label">{{ v.label }}</span>
                  </button>
                }
              </div>
              <div class="sb-section">
                <div class="label sb-title">FILTERS</div>
                @for (f of ['All time','Last 30 days','By country','By transport']; track f) {
                  <div class="sb-item static">
                    <span class="sb-icon">□</span>
                    <span class="sb-label">{{ f }}</span>
                  </div>
                }
              </div>
              <div class="sb-section">
                <div class="label sb-title">DEVICES</div>
                <div class="sb-item static accent-dot">
                  <span class="sb-icon">●</span><span class="sb-label">iPhone 15</span><span class="sb-sub">active</span>
                </div>
                <div class="sb-item static accent-dot">
                  <span class="sb-icon">●</span><span class="sb-label">Garmin Fenix</span><span class="sb-sub">paired</span>
                </div>
                <div class="sb-item static">
                  <span class="sb-icon">○</span><span class="sb-label">Pixel 8</span><span class="sb-sub">last: 2d</span>
                </div>
              </div>
            </div>

            <!-- map -->
            <div class="map-wrap">
              <div #mapEl class="map-el"></div>
              <div class="hud-top">
                @for (p of periods; track p) {
                  <button class="hud-period" [class.active]="p === '5Y'">{{ p }}</button>
                }
              </div>
              <div class="hud-bottom">
                <span>scrub: <span class="num strong">2021-01 → 2026-04</span></span>
                <span>density: <span class="accent">high</span></span>
                <span>render: <span class="num">42ms</span></span>
              </div>
            </div>

            <!-- right rail -->
            <div class="rail">
              <div class="label rail-title">SUMMARY · 2025</div>
              <div class="big-stat"><div class="big-stat-v num">14,827 km</div><div class="big-stat-l">total distance</div></div>
              <div class="big-stat"><div class="big-stat-v num">8.4M</div><div class="big-stat-l">location points</div></div>
              <div class="big-stat"><div class="big-stat-v num">2,194</div><div class="big-stat-l">trails recorded</div></div>
              <hr class="rail-hr"/>
              <div class="small-stat"><span>countries</span><span class="num">14</span></div>
              <div class="small-stat"><span>cities visited</span><span class="num">87</span></div>
              <div class="small-stat"><span>days tracked</span><span class="num">1827</span></div>
              <hr class="rail-hr"/>
              <div class="label">TOP_PLACES</div>
              @for (p of places; track p.rank) {
                <div class="place-row">
                  <span><span class="rank">{{ p.rank }}</span> <span class="place-name">{{ p.name }}</span></span>
                  <span class="num pct">{{ p.pct }}</span>
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styleUrls: ['./landing-shared.scss'],
  styles: [`
    :host { display: block; }
    .demo { padding: 120px 0; border-bottom: 1px solid var(--line); }

    .app-frame {
      margin-top: 56px;
      border: 1px solid var(--line);
      background: var(--bg-2);
      box-shadow: 0 30px 80px -30px rgba(0,0,0,0.6);
      overflow: hidden;
    }
    .app-chrome {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 18px;
      border-bottom: 1px solid var(--line);
      background: var(--bg);
      font-size: 11px; color: var(--ink-3);
    }
    .chrome-left { display: flex; gap: 6px; align-items: center; }
    .chrome-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--line); }
    .chrome-dot.accent { background: var(--accent); }
    .chrome-url { margin-left: 14px; }
    .chrome-right { display: flex; gap: 16px; }

    .app-body {
      display: grid;
      grid-template-columns: 220px 1fr 240px;
      min-height: 520px;
    }
    .sidebar { border-right: 1px solid var(--line); padding: 18px 0; }
    .sb-section { margin-bottom: 22px; }
    .sb-title { padding: 0 18px 8px; font-size: 9.5px; }
    .sb-item {
      display: flex; align-items: center; gap: 10px; width: 100%;
      padding: 7px 18px; text-align: left;
      background: transparent;
      border: none;
      border-left: 2px solid transparent;
      color: var(--ink-2);
      font-family: inherit; font-size: 12px;
      cursor: pointer;
    }
    .sb-item.static { cursor: default; }
    .sb-item.active {
      background: color-mix(in oklab, var(--accent) 10%, transparent);
      border-left-color: var(--accent);
      color: var(--ink);
    }
    .sb-icon { color: var(--ink-4); width: 12px; }
    .sb-item.accent-dot .sb-icon { color: var(--accent); }
    .sb-label { flex: 1; }
    .sb-sub { font-size: 10px; color: var(--ink-4); }

    .map-wrap { position: relative; border-right: 1px solid var(--line); }
    .map-el { position: absolute; inset: 0; }
    .hud-top {
      position: absolute; top: 14px; left: 14px; z-index: 500;
      display: flex; gap: 6px;
      background: color-mix(in oklab, var(--bg) 90%, transparent);
      border: 1px solid var(--line);
      padding: 4px;
    }
    .hud-period {
      padding: 5px 10px; font-size: 10px;
      font-family: inherit;
      background: transparent; color: var(--ink-2);
      border: none; cursor: pointer;
    }
    .hud-period.active { background: var(--accent); color: #1a0d08; }
    .hud-bottom {
      position: absolute; bottom: 14px; left: 14px; right: 14px; z-index: 500;
      background: color-mix(in oklab, var(--bg) 92%, transparent);
      border: 1px solid var(--line);
      padding: 10px 14px;
      font-size: 11px; color: var(--ink-3);
      display: flex; justify-content: space-between;
    }
    .strong { color: var(--ink); }
    .accent { color: var(--accent); }

    .rail { padding: 18px 16px; }
    .rail-title { margin-bottom: 12px; }
    .big-stat { margin-bottom: 14px; }
    .big-stat-v { font-size: 22px; font-weight: 500; color: var(--ink); letter-spacing: -0.02em; }
    .big-stat-l { font-size: 10.5px; color: var(--ink-4); }
    .rail-hr { border: 0; border-top: 1px solid var(--line); margin: 14px 0; }
    .small-stat { display: flex; justify-content: space-between; font-size: 11px; padding: 3px 0; color: var(--ink-3); }
    .small-stat .num { color: var(--ink); }
    .place-row {
      display: flex; justify-content: space-between; align-items: center;
      font-size: 11px; padding: 5px 0;
      border-bottom: 1px dashed var(--line-2);
    }
    .place-row > span:first-child { display: flex; gap: 8px; }
    .rank { color: var(--ink-4); }
    .place-name { color: var(--ink-2); }
    .pct { color: var(--accent); }

    @media (max-width: 900px) {
      .app-body { grid-template-columns: 1fr; }
      .sidebar, .map-wrap { border-right: none; border-bottom: 1px solid var(--line); }
      .map-wrap { min-height: 360px; }
    }
  `],
})
export class LandingDemoComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  view = signal<'heatmap' | 'timeline' | 'places' | 'trips'>('heatmap');
  views = [
    { id: 'heatmap' as const, icon: '◉', label: 'Heatmap' },
    { id: 'timeline' as const, icon: '≡', label: 'Timeline' },
    { id: 'places' as const, icon: '◆', label: 'Places' },
    { id: 'trips' as const, icon: '→', label: 'Trips' },
  ];
  periods = ['1W','1M','6M','1Y','5Y','ALL'];
  places = [
    { rank: '01', name: 'home · Berlin', pct: '34.2%' },
    { rank: '02', name: 'office · Mitte', pct: '18.7%' },
    { rank: '03', name: 'café Bonanza', pct: '4.1%' },
    { rank: '04', name: 'Volkspark', pct: '2.8%' },
  ];

  private map?: L.Map;

  ngAfterViewInit() {
    this.map = L.map(this.mapEl.nativeElement, {
      center: [52.5, 13.4],
      zoom: 11,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
      preferCanvas: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(this.map);

    const seedLines = (n: number, seed = 42) => {
      let s = seed;
      const rng = () => (s = (s * 16807) % 2147483647) / 2147483647;
      const lines: [number, number][][] = [];
      for (let i = 0; i < n; i++) {
        const startLat = 52.45 + rng() * 0.18;
        const startLng = 13.30 + rng() * 0.22;
        const len = 6 + Math.floor(rng() * 14);
        const pts: [number, number][] = [[startLat, startLng]];
        for (let j = 0; j < len; j++) {
          const last = pts[pts.length - 1];
          pts.push([last[0] + (rng() - 0.5) * 0.012, last[1] + (rng() - 0.5) * 0.018]);
        }
        lines.push(pts);
      }
      return lines;
    };

    seedLines(80).forEach((pts, i) => {
      L.polyline(pts, {
        color: i % 9 === 0 ? '#ff5a36' : '#ff8a66',
        weight: i % 9 === 0 ? 2 : 1,
        opacity: i % 9 === 0 ? 0.85 : 0.32,
      }).addTo(this.map!);
    });

    const places: [number, number][] = [[52.52, 13.405],[52.515, 13.377],[52.48, 13.44]];
    places.forEach(([lat, lng]) => {
      L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          html: '<div class="gt-marker"></div>',
          iconSize: [10, 10], iconAnchor: [5, 5],
        }),
      }).addTo(this.map!);
    });
  }

  ngOnDestroy() { this.map?.remove(); }
}
