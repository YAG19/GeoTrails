import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Source {
  id: string; name: string; sub: string; count: string; icon: string;
}

@Component({
  selector: 'app-landing-imports',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="imports" data-screen-label="03 Imports">
      <div class="container">
        <div class="section-header-grid">
          <div class="label section-header-tag">§ 02 / inputs</div>
          <div>
            <h2 class="display section-header-title">Bring your <em>entire history.</em></h2>
            <p class="section-header-sub">
              GeoTrail speaks every common location format. Pipe in your past, record your present.
            </p>
          </div>
        </div>

        <div class="flow-grid">
          <div class="flow-col">
            <div class="label flow-col-label">SOURCES</div>
            @for (s of sources; track s.id; let i = $index) {
              <div class="source-row" [class.first]="i === 0">
                <div class="source-icon">{{ s.icon }}</div>
                <div class="source-meta">
                  <div class="source-name">{{ s.name }}</div>
                  <div class="source-sub">{{ s.sub }}</div>
                </div>
                <div class="source-count">{{ s.count }}</div>
                <div class="pipe-right"></div>
                <div class="pipe-right-dot"></div>
              </div>
            }
          </div>

          <div class="flow-center">
            <div class="flow-line"></div>
            <div class="core-box">
              <div class="core-outline"></div>
              <div class="label label-accent core-tag">./geotrail.core</div>
              <div class="core-word">parse</div>
              <div class="core-word italic">dedupe</div>
              <div class="core-word">store</div>
              <div class="core-progress">
                <div class="core-progress-fill" [style.transform]="'translateX(' + progressX() + '%)'"></div>
              </div>
            </div>
          </div>

          <div class="flow-col flow-col-right">
            <div class="label flow-col-label right">YOUR INSTANCE</div>
            <div class="output-box">
              <div class="pipe-left"></div>
              <div class="pipe-left-dot"></div>
              <div class="output-line1">postgres + postgis</div>
              <div class="output-line2">encrypted at rest · on your disk</div>
              <div class="output-detail">trails · places · sessions · imports</div>
            </div>
            <div class="output-box">
              <div class="pipe-left"></div>
              <div class="pipe-left-dot"></div>
              <div class="output-line1">export anytime</div>
              <div class="output-line2">.geojson · .gpx · .csv · sqlite</div>
              <div class="output-detail">zero lock-in · MIT licensed</div>
            </div>
            <div class="output-box">
              <div class="pipe-left"></div>
              <div class="pipe-left-dot"></div>
              <div class="output-line1">api endpoints</div>
              <div class="output-line2">REST + WebSocket · OpenAPI</div>
              <div class="output-detail">bring your own dashboard</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styleUrls: ['./landing-shared.scss'],
  styles: [`
    :host { display: block; }
    .imports { padding: 120px 0; border-bottom: 1px solid var(--line); position: relative; }

    .flow-grid {
      margin-top: 64px;
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: stretch;
      min-height: 380px;
    }
    .flow-col { display: flex; flex-direction: column; }
    .flow-col-right > .output-box + .output-box { margin-top: 14px; }
    .flow-col-label { margin-bottom: 18px; }
    .flow-col-label.right { text-align: right; }

    .source-row {
      display: flex; align-items: center; gap: 14px;
      padding: 14px 0;
      border-bottom: 1px solid var(--line);
      position: relative;
    }
    .source-row.first { border-top: 1px solid var(--line); }
    .source-icon {
      width: 40px; height: 40px; flex-shrink: 0;
      border: 1px solid var(--line);
      display: flex; align-items: center; justify-content: center;
      font-size: 10px; color: var(--ink-3); font-weight: 600;
      letter-spacing: 0.04em;
      background: var(--bg-2);
    }
    .source-meta { flex: 1; }
    .source-name { font-size: 13px; color: var(--ink); font-weight: 500; }
    .source-sub { font-size: 10.5px; color: var(--ink-4); }
    .source-count { font-size: 10.5px; color: var(--ink-3); text-align: right; }
    .pipe-right {
      position: absolute; right: -36px; top: 50%;
      width: 36px; height: 1px; background: var(--line);
    }
    .pipe-right-dot {
      position: absolute; right: -38px; top: 50%;
      transform: translateY(-50%);
      width: 4px; height: 4px; background: var(--accent); border-radius: 50%;
    }

    .flow-center {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 0 36px; position: relative;
      min-width: 220px;
    }
    .flow-line {
      width: 1px; flex: 1;
      background: linear-gradient(180deg, transparent, var(--line), transparent);
      position: absolute; top: 0; bottom: 0;
    }
    .core-box {
      width: 180px; height: 180px;
      border: 1px solid var(--accent);
      background: var(--bg);
      position: relative; z-index: 2;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 8px;
    }
    .core-outline { position: absolute; inset: -8px; border: 1px dashed var(--line); }
    .core-tag { font-size: 9px; }
    .core-word {
      font-size: 28px; color: var(--ink);
      font-family: 'Instrument Serif', serif;
      letter-spacing: -0.02em;
    }
    .core-word.italic { font-style: italic; }
    .core-progress {
      position: absolute; bottom: -1px; left: 0; right: 0; height: 2px;
      background: var(--line); overflow: hidden;
    }
    .core-progress-fill {
      height: 100%; width: 40%; background: var(--accent);
      transition: transform 80ms linear;
    }

    .output-box {
      border: 1px solid var(--line);
      padding: 16px 18px;
      background: var(--bg-2);
      position: relative;
    }
    .pipe-left {
      position: absolute; left: -36px; top: 50%;
      width: 36px; height: 1px; background: var(--line);
    }
    .pipe-left-dot {
      position: absolute; left: -38px; top: 50%;
      transform: translateY(-50%);
      width: 4px; height: 4px; background: var(--accent); border-radius: 50%;
    }
    .output-line1 { font-size: 13px; color: var(--ink); font-weight: 500; margin-bottom: 2px; }
    .output-line2 { font-size: 11px; color: var(--ink-2); }
    .output-detail {
      font-size: 10px; color: var(--ink-4);
      margin-top: 6px; padding-top: 6px;
      border-top: 1px dashed var(--line);
    }

    @media (max-width: 900px) {
      .flow-grid { grid-template-columns: 1fr; gap: 36px; }
      .pipe-right, .pipe-right-dot, .pipe-left, .pipe-left-dot, .flow-line { display: none; }
    }
  `],
})
export class LandingImportsComponent implements OnInit, OnDestroy {
  progressX = signal(0);
  private tickTimer?: any;
  private tick = 0;

  sources: Source[] = [
    { id: 'owntracks', name: 'OwnTracks', sub: 'real-time MQTT', count: '~2k pts/day', icon: 'OT' },
    { id: 'gtimeline', name: 'Google Timeline', sub: 'history.json', count: '~12 yrs', icon: 'GT' },
    { id: 'gpx', name: 'GPX files', sub: 'drag & drop', count: 'any device', icon: 'GPX' },
    { id: 'strava', name: 'Strava', sub: 'oauth + sync', count: 'activities', icon: 'ST' },
    { id: 'icloud', name: 'iCloud Loc.', sub: 'shortcut url', count: 'live', icon: 'iC' },
  ];

  ngOnInit() {
    this.tickTimer = setInterval(() => {
      this.tick++;
      this.progressX.set((this.tick * 4) % 250 - 50);
    }, 80);
  }
  ngOnDestroy() { clearInterval(this.tickTimer); }
}
