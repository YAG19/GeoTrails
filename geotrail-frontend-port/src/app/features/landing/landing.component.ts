import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LandingHeroComponent } from './landing-hero.component';
import { LandingImportsComponent } from './landing-imports.component';
import { LandingDemoComponent } from './landing-demo.component';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, LandingHeroComponent, LandingImportsComponent, LandingDemoComponent],
  template: `
    <div class="landing-root">
      <div class="topo-bg"></div>

      <!-- edge coordinate ticks -->
      <div class="edge-ticks left">
        <span>52°31′N · 13°24′E</span>
        <span>40°42′N · 74°00′W</span>
        <span>35°41′N · 139°41′E</span>
      </div>
      <div class="edge-ticks right">
        <span>v0.4.2 · self-hosted</span>
        <span>uptime 99.97%</span>
        <span>tile.openstreetmap.org</span>
      </div>

      <!-- nav -->
      <nav class="nav">
        <div class="container nav-inner">
          <div class="nav-left">
            <a href="#" class="logo">
              <span class="logo-mark">◉</span>
              <span class="logo-text">GEOTRAIL<span class="logo-version">/v0.4</span></span>
            </a>
            <div class="nav-links">
              <a href="#docs">docs</a>
              <a href="#self-host">self-host</a>
              <a href="#changelog">changelog</a>
              <a href="https://github.com">github <span class="ext">↗</span></a>
            </div>
          </div>
          <div class="nav-right">
            <span class="num utc">{{ utc() }}</span>
            <button class="btn theme-toggle" (click)="toggleTheme()">
              {{ theme() === 'dark' ? '☾ dark' : '☀ light' }}
            </button>
            <a href="/login" class="btn small">sign_in</a>
            <a href="/register" class="btn btn-primary small">./start <span class="btn-arrow">→</span></a>
          </div>
        </div>
      </nav>

      <!-- hero -->
      <app-landing-hero></app-landing-hero>

      <!-- marquee -->
      <div class="marquee">
        <div class="marquee-track">
          @for (item of marqueeItems; track $index) {
            <span class="marquee-item"><span class="marquee-bullet">▸</span>{{ item }}</span>
          }
        </div>
      </div>

      <!-- imports -->
      <app-landing-imports></app-landing-imports>

      <!-- demo -->
      <app-landing-demo></app-landing-demo>

      <!-- footer -->
      <footer class="footer">
        <div class="container">
          <div class="footer-cta">
            <h2 class="display footer-title">
              Map your<br/>life. <em>Privately.</em>
            </h2>
            <div>
              <p class="footer-sub">
                One docker-compose, your domain, your data. Free forever for self-hosters. Source on GitHub.
              </p>
              <div class="install-box">
                <div class="install-comment"># quick start</div>
                <div><span class="dollar">$</span> curl -sSL geotrail.io/install.sh | sh</div>
                <div><span class="dollar">$</span> geotrail up</div>
                <div class="install-out">→ ready on http://localhost:8080</div>
              </div>
              <div class="footer-cta-buttons">
                <a href="#docs" class="btn btn-primary">read the docs →</a>
                <a href="#github" class="btn">★ star on github</a>
              </div>
            </div>
          </div>

          <div class="footer-cols">
            <div class="footer-brand">
              <div class="footer-brand-row">
                <span class="logo-mark">◉</span>
                <span class="logo-text">GEOTRAIL</span>
              </div>
              <p>An open-source location-history server. No cloud, no analytics, no nonsense. Built for people who keep their own data.</p>
            </div>
            <div>
              <div class="label footer-col-title">Product</div>
              <a href="#">Features</a><a href="#">Self-host guide</a><a href="#">Changelog</a><a href="#">Roadmap</a>
            </div>
            <div>
              <div class="label footer-col-title">Imports</div>
              <a href="#">OwnTracks</a><a href="#">Google Timeline</a><a href="#">GPX</a><a href="#">Strava</a><a href="#">iCloud</a>
            </div>
            <div>
              <div class="label footer-col-title">Resources</div>
              <a href="#">Docs</a><a href="#">API reference</a><a href="#">Discord</a><a href="#">Privacy</a>
            </div>
            <div>
              <div class="label footer-col-title">Source</div>
              <a href="#">GitHub</a><a href="#">Releases</a><a href="#">License (MIT)</a><a href="#">Sponsor</a>
            </div>
          </div>

          <div class="footer-strip">
            <span>© 2026 geotrail · MIT licensed · made by self-hosters, for self-hosters</span>
            <span class="num">build a4f81c2 · {{ today }} · all systems normal</span>
          </div>
        </div>
      </footer>
    </div>
  `,
  styleUrls: ['./landing-shared.scss'],
  styles: [`
    :host { display: block; }

    .edge-ticks {
      position: fixed; top: 0; bottom: 0; width: 28px; z-index: 5;
      pointer-events: none;
      display: flex; flex-direction: column; justify-content: space-between;
      padding: 80px 0;
      font-family: 'JetBrains Mono', monospace;
      font-size: 9.5px;
      color: var(--ink-4);
      letter-spacing: 0.05em;
    }
    .edge-ticks.left { left: 0; align-items: flex-start; padding-left: 10px; }
    .edge-ticks.right { right: 0; align-items: flex-end; padding-right: 10px; }
    .edge-ticks span { writing-mode: vertical-rl; transform: rotate(180deg); }
    @media (max-width: 900px) { .edge-ticks { display: none; } }

    .nav {
      position: sticky; top: 0; z-index: 20;
      background: color-mix(in oklab, var(--bg) 88%, transparent);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--line);
    }
    .nav-inner {
      display: flex; align-items: center; justify-content: space-between;
      height: 56px; font-size: 12px;
    }
    .nav-left, .nav-right { display: flex; align-items: center; gap: 18px; }
    .nav-left { gap: 28px; }
    .logo { display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 13px; }
    .logo-mark {
      width: 22px; height: 22px;
      border: 1.5px solid var(--accent);
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 11px; color: var(--accent); font-weight: 700;
    }
    .logo-text { letter-spacing: 0.06em; }
    .logo-version { color: var(--ink-4); }
    .nav-links { display: flex; gap: 22px; color: var(--ink-3); }
    .nav-links a { color: inherit; }
    .ext { color: var(--ink-4); }
    .utc { color: var(--ink-4); font-size: 11px; }
    .btn.small { padding: 8px 14px; }
    .theme-toggle { padding: 7px 12px; font-size: 11px; }

    .marquee {
      border-top: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
      background: var(--bg-2);
      overflow: hidden;
      padding: 14px 0;
    }
    .marquee-track {
      display: flex; gap: 48px;
      animation: gt-scroll 40s linear infinite;
      width: max-content;
      font-size: 11px;
      color: var(--ink-3);
    }
    .marquee-item {
      display: inline-flex; align-items: center; gap: 12px; white-space: nowrap;
    }
    .marquee-bullet { color: var(--accent); }

    .footer {
      border-top: 1px solid var(--line);
      padding-top: 80px;
      padding-bottom: 40px;
      background: var(--bg);
      position: relative;
    }
    .footer-cta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 60px;
      padding-bottom: 80px;
      border-bottom: 1px solid var(--line);
      align-items: end;
    }
    .footer-title {
      font-size: clamp(48px, 7vw, 96px);
      margin: 0;
      line-height: 0.94;
      font-weight: 400;
      letter-spacing: -0.025em;
    }
    .footer-title em { color: var(--accent); font-style: italic; }
    .footer-sub { font-size: 13.5px; color: var(--ink-2); max-width: 380px; margin: 0; }
    .install-box {
      margin-top: 24px;
      padding: 18px;
      background: var(--bg-2);
      border: 1px solid var(--line);
      font-size: 12px;
      color: var(--ink-2);
      font-family: 'JetBrains Mono', monospace;
      line-height: 1.7;
    }
    .install-comment { color: var(--ink-4); font-size: 10px; margin-bottom: 6px; }
    .dollar { color: var(--accent); }
    .install-out { color: var(--ink-4); }
    .footer-cta-buttons { display: flex; gap: 10px; margin-top: 20px; }

    .footer-cols {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
      gap: 36px;
      padding: 40px 0;
    }
    .footer-cols a {
      display: block;
      font-size: 12px;
      color: var(--ink-2);
      padding: 4px 0;
    }
    .footer-col-title { margin-bottom: 14px; }
    .footer-brand-row {
      display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
      font-weight: 600; letter-spacing: 0.06em;
    }
    .footer-brand p {
      font-size: 11px; color: var(--ink-3); max-width: 280px; line-height: 1.65; margin: 0;
    }
    .footer-strip {
      border-top: 1px solid var(--line);
      padding-top: 20px;
      display: flex; justify-content: space-between;
      font-size: 10.5px; color: var(--ink-4);
      letter-spacing: 0.05em;
    }

    @media (max-width: 900px) {
      .nav-links { display: none; }
      .footer-cta { grid-template-columns: 1fr; gap: 32px; }
      .footer-cols { grid-template-columns: 1fr 1fr; }
    }
  `],
})
export class LandingComponent implements OnInit, OnDestroy {
  theme = signal<'dark' | 'light'>('dark');
  utc = signal('');
  today = new Date().toISOString().slice(0, 10);
  private clockTimer?: any;
  private prevBodyTheme: string | null = null;

  marqueeItems = [
    'lat 52.5163°N','lng 13.3777°E','alt 34m','speed 1.4 m/s','heading 286°',
    'trail_id 0x4f8a','points 1,284','battery 84%','accuracy ±3m','ping 2s',
    'session #41203','tz Europe/Berlin','uptime 99.97%','encrypted: yes',
    'lat 52.5163°N','lng 13.3777°E','alt 34m','speed 1.4 m/s','heading 286°',
    'trail_id 0x4f8a','points 1,284','battery 84%','accuracy ±3m','ping 2s',
    'session #41203','tz Europe/Berlin','uptime 99.97%','encrypted: yes',
  ];

  ngOnInit() {
    const saved = (typeof localStorage !== 'undefined' && localStorage.getItem('gt-theme')) as
      | 'dark' | 'light' | null;
    if (saved) this.theme.set(saved);

    this.prevBodyTheme = document.body.getAttribute('data-theme');
    document.body.setAttribute('data-theme', this.theme());

    this.tick();
    this.clockTimer = setInterval(() => this.tick(), 1000);
  }

  ngOnDestroy() {
    clearInterval(this.clockTimer);
    if (this.prevBodyTheme === null) document.body.removeAttribute('data-theme');
    else document.body.setAttribute('data-theme', this.prevBodyTheme);
  }

  toggleTheme() {
    const next = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(next);
    document.body.setAttribute('data-theme', next);
    try { localStorage.setItem('gt-theme', next); } catch {}
  }

  private tick() {
    this.utc.set(new Date().toISOString().replace('T', ' ').slice(0, 19) + 'Z');
  }
}
