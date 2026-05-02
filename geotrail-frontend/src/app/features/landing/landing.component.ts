import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="landing">

      <!-- NAV -->
      <nav class="nav">
        <span class="nav-logo">GeoTrail</span>
        <div class="nav-actions">
          <a routerLink="/login" class="btn-ghost">Login</a>
          <a routerLink="/register" class="btn-primary">Get Started</a>
        </div>
      </nav>

      <!-- HERO -->
      <section class="hero">
        <div class="hero-badge">Your private location history</div>
        <h1 class="hero-title">
          Every path you've<br />
          <span class="accent">ever walked</span>
        </h1>
        <p class="hero-sub">
          GeoTrail turns your location history into a beautiful, searchable map
          of your life — privately hosted, fully yours.
        </p>
        <div class="hero-ctas">
          <a routerLink="/register" class="btn-primary btn-lg">Start for free</a>
          <a routerLink="/login" class="btn-outline btn-lg">Sign in</a>
        </div>
        <div class="hero-visual">
          <div class="map-mock">
            <div class="map-grid"></div>
            <svg class="trail-svg" viewBox="0 0 600 300" preserveAspectRatio="none">
              <polyline class="trail-line"
                points="20,260 60,230 100,200 150,175 190,150 230,130 270,115 310,108 360,100 400,95 440,88 500,80 580,70" />
              <circle class="trail-dot" cx="20"  cy="260" r="5" />
              <circle class="trail-dot" cx="580" cy="70"  r="5" />
              <circle class="trail-pulse" cx="580" cy="70" r="5" />
            </svg>
            <div class="map-pin" style="top: 22%; left: 94%">
              <div class="pin-label">📍 Current</div>
            </div>
            <div class="map-pin" style="top: 86%; left: 2%">
              <div class="pin-label">🏠 Home</div>
            </div>
          </div>
        </div>
      </section>

      <!-- STATS -->
      <section class="stats-bar">
        <div class="stat">
          <span class="stat-num">∞</span>
          <span class="stat-label">Location points</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat">
          <span class="stat-num">Real-time</span>
          <span class="stat-label">Live tracking</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat">
          <span class="stat-num">100%</span>
          <span class="stat-label">Private & self-hosted</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat">
          <span class="stat-num">GeoJSON</span>
          <span class="stat-label">Open data export</span>
        </div>
      </section>

      <!-- FEATURES -->
      <section class="features" id="features">
        <div class="section-label">Features</div>
        <h2 class="section-title">Everything your trails need</h2>
        <div class="features-grid">

          <div class="feature-card feature-card--accent">
            <div class="feature-icon">🗺️</div>
            <h3>Interactive Map</h3>
            <p>Visualize your entire location history on a smooth, zoomable map. Filter by date range and explore where you've been down to the street level.</p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">📡</div>
            <h3>Live Tracking</h3>
            <p>See your real-time position update on the map via WebSocket. Connects with the OwnTracks mobile app for seamless phone-to-server sync.</p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">📊</div>
            <h3>Dashboard & Stats</h3>
            <p>Track total distance traveled, activity breakdown, and daily movement patterns with beautiful charts. Filter by week, month, or year.</p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">📥</div>
            <h3>Import History</h3>
            <p>Bring in your existing location data. Import Google Timeline exports, GPX files, and more to build your complete history from day one.</p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">📍</div>
            <h3>Saved Places</h3>
            <p>Mark and name locations that matter — home, work, favourite spots. Places appear on the map as landmarks tied to your trail history.</p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">🔒</div>
            <h3>Fully Private</h3>
            <p>Your data lives on your own server. No third-party analytics, no data sharing. Export everything at any time as GeoJSON or GPX.</p>
          </div>

        </div>
      </section>

      <!-- HOW IT WORKS -->
      <section class="how">
        <div class="section-label">How it works</div>
        <h2 class="section-title">Up and running in minutes</h2>
        <div class="steps">
          <div class="step">
            <div class="step-num">01</div>
            <h3>Create your account</h3>
            <p>Sign up and get your personal GeoTrail instance ready to receive location data.</p>
          </div>
          <div class="step-arrow">→</div>
          <div class="step">
            <div class="step-num">02</div>
            <h3>Connect OwnTracks</h3>
            <p>Install OwnTracks on your phone and point it at your GeoTrail URL — your location starts flowing in automatically.</p>
          </div>
          <div class="step-arrow">→</div>
          <div class="step">
            <div class="step-num">03</div>
            <h3>Explore your trails</h3>
            <p>Open the map, browse the dashboard, and discover patterns in your own movement data.</p>
          </div>
        </div>
      </section>

      <!-- CTA BANNER -->
      <section class="cta-banner">
        <h2>Ready to map your life?</h2>
        <p>Create your account and start building your location history today.</p>
        <a routerLink="/register" class="btn-primary btn-lg">Get started free</a>
      </section>

      <!-- FOOTER -->
      <footer class="footer">
        <span class="nav-logo">GeoTrail</span>
        <span class="footer-copy">Your trails, your data.</span>
      </footer>

    </div>
  `,
  styles: [`
    /* ── Reset & base ─────────────────────────────────── */
    .landing {
      min-height: 100vh;
      background: #0d0d1a;
      color: #e0e0f0;
      font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      overflow-x: hidden;
    }

    /* ── Nav ──────────────────────────────────────────── */
    .nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 48px;
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(13, 13, 26, 0.85);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(79, 195, 247, 0.08);
    }

    .nav-logo {
      font-size: 1.4rem;
      font-weight: 700;
      color: #4fc3f7;
      letter-spacing: -0.02em;
    }

    .nav-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    /* ── Buttons ──────────────────────────────────────── */
    .btn-primary {
      display: inline-block;
      padding: 10px 22px;
      background: #4fc3f7;
      color: #0d0d1a;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.9rem;
      text-decoration: none;
      transition: background 0.2s, transform 0.15s;
    }
    .btn-primary:hover { background: #29b6f6; transform: translateY(-1px); }

    .btn-ghost {
      display: inline-block;
      padding: 10px 22px;
      color: #b0b8c8;
      border-radius: 8px;
      font-size: 0.9rem;
      text-decoration: none;
      transition: color 0.2s;
    }
    .btn-ghost:hover { color: #fff; }

    .btn-outline {
      display: inline-block;
      padding: 14px 32px;
      border: 1px solid rgba(79, 195, 247, 0.4);
      color: #4fc3f7;
      border-radius: 10px;
      font-weight: 600;
      font-size: 1rem;
      text-decoration: none;
      transition: border-color 0.2s, background 0.2s;
    }
    .btn-outline:hover { border-color: #4fc3f7; background: rgba(79, 195, 247, 0.08); }

    .btn-lg { padding: 14px 32px; font-size: 1rem; border-radius: 10px; }

    /* ── Hero ─────────────────────────────────────────── */
    .hero {
      text-align: center;
      padding: 96px 24px 0;
    }

    .hero-badge {
      display: inline-block;
      padding: 6px 16px;
      background: rgba(79, 195, 247, 0.12);
      border: 1px solid rgba(79, 195, 247, 0.25);
      color: #4fc3f7;
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 28px;
    }

    .hero-title {
      font-size: clamp(2.6rem, 6vw, 4.5rem);
      font-weight: 800;
      line-height: 1.1;
      letter-spacing: -0.03em;
      color: #f0f0ff;
      margin: 0 0 24px;
    }

    .accent {
      background: linear-gradient(90deg, #4fc3f7, #29b6f6, #81d4fa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .hero-sub {
      max-width: 520px;
      margin: 0 auto 40px;
      color: #8898aa;
      font-size: 1.1rem;
      line-height: 1.65;
    }

    .hero-ctas {
      display: flex;
      gap: 16px;
      justify-content: center;
      flex-wrap: wrap;
      margin-bottom: 64px;
    }

    /* ── Map mock ─────────────────────────────────────── */
    .hero-visual {
      max-width: 850px;
      margin: 0 auto;
      padding: 0 24px;
    }

    .map-mock {
      position: relative;
      width: 100%;
      height: 280px;
      background: #111827;
      border-radius: 16px 16px 0 0;
      border: 1px solid rgba(79, 195, 247, 0.15);
      border-bottom: none;
      overflow: hidden;
    }

    .map-grid {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(79, 195, 247, 0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(79, 195, 247, 0.04) 1px, transparent 1px);
      background-size: 48px 48px;
    }

    .trail-svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }

    .trail-line {
      fill: none;
      stroke: #4fc3f7;
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-dasharray: 1000;
      stroke-dashoffset: 1000;
      animation: draw-trail 2.4s ease forwards 0.4s;
      filter: drop-shadow(0 0 6px rgba(79, 195, 247, 0.5));
    }

    @keyframes draw-trail {
      to { stroke-dashoffset: 0; }
    }

    .trail-dot {
      fill: #4fc3f7;
      filter: drop-shadow(0 0 4px rgba(79, 195, 247, 0.8));
      opacity: 0;
      animation: fade-in 0.4s ease forwards 2.6s;
    }

    .trail-pulse {
      fill: none;
      stroke: #4fc3f7;
      stroke-width: 2;
      opacity: 0;
      animation: pulse 1.8s ease-in-out infinite 3s;
    }

    @keyframes fade-in { to { opacity: 1; } }

    @keyframes pulse {
      0%   { r: 5;  opacity: 0.8; }
      100% { r: 18; opacity: 0; }
    }

    .map-pin {
      position: absolute;
      transform: translateX(-50%);
    }

    .pin-label {
      background: rgba(13, 13, 26, 0.85);
      border: 1px solid rgba(79, 195, 247, 0.3);
      color: #e0e0f0;
      font-size: 0.72rem;
      padding: 4px 8px;
      border-radius: 6px;
      white-space: nowrap;
      backdrop-filter: blur(6px);
    }

    /* ── Stats bar ────────────────────────────────────── */
    .stats-bar {
      max-width: 800px;
      margin: 0 auto 96px;
      display: flex;
      align-items: center;
      justify-content: space-around;
      background: #111827;
      border: 1px solid rgba(79, 195, 247, 0.12);
      border-top: none;
      border-radius: 0 0 16px 16px;
      padding: 28px 32px;
      flex-wrap: wrap;
      gap: 16px;
    }

    .stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }

    .stat-num {
      font-size: 1.4rem;
      font-weight: 700;
      color: #4fc3f7;
      letter-spacing: -0.02em;
    }

    .stat-label {
      font-size: 0.78rem;
      color: #6b7a90;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .stat-divider {
      width: 1px;
      height: 36px;
      background: rgba(79, 195, 247, 0.12);
    }

    /* ── Section shared ───────────────────────────────── */
    .section-label {
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      font-size: 0.75rem;
      font-weight: 600;
      color: #4fc3f7;
      margin-bottom: 12px;
    }

    .section-title {
      text-align: center;
      font-size: clamp(1.8rem, 3.5vw, 2.6rem);
      font-weight: 700;
      color: #f0f0ff;
      letter-spacing: -0.02em;
      margin: 0 0 56px;
    }

    /* ── Features ─────────────────────────────────────── */
    .features {
      padding: 0 48px 96px;
      max-width: 1100px;
      margin: 0 auto;
    }

    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
    }

    .feature-card {
      background: #111827;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 14px;
      padding: 28px;
      transition: border-color 0.2s, transform 0.2s;
    }

    .feature-card:hover {
      border-color: rgba(79, 195, 247, 0.3);
      transform: translateY(-2px);
    }

    .feature-card--accent {
      border-color: rgba(79, 195, 247, 0.25);
      background: linear-gradient(135deg, #111827 0%, rgba(79, 195, 247, 0.05) 100%);
    }

    .feature-icon {
      font-size: 1.8rem;
      margin-bottom: 16px;
    }

    .feature-card h3 {
      font-size: 1.05rem;
      font-weight: 600;
      color: #f0f0ff;
      margin: 0 0 10px;
    }

    .feature-card p {
      font-size: 0.9rem;
      color: #6b7a90;
      line-height: 1.65;
      margin: 0;
    }

    /* ── How it works ─────────────────────────────────── */
    .how {
      padding: 0 48px 96px;
      max-width: 1000px;
      margin: 0 auto;
    }

    .steps {
      display: flex;
      align-items: flex-start;
      gap: 0;
      flex-wrap: wrap;
      justify-content: center;
    }

    .step {
      flex: 1;
      min-width: 220px;
      max-width: 280px;
      text-align: center;
      padding: 0 16px;
    }

    .step-num {
      display: inline-block;
      font-size: 2rem;
      font-weight: 800;
      color: rgba(79, 195, 247, 0.2);
      letter-spacing: -0.03em;
      margin-bottom: 16px;
    }

    .step h3 {
      font-size: 1rem;
      font-weight: 600;
      color: #f0f0ff;
      margin: 0 0 10px;
    }

    .step p {
      font-size: 0.88rem;
      color: #6b7a90;
      line-height: 1.6;
      margin: 0;
    }

    .step-arrow {
      font-size: 1.4rem;
      color: rgba(79, 195, 247, 0.3);
      align-self: center;
      padding-bottom: 32px;
      flex-shrink: 0;
    }

    /* ── CTA banner ───────────────────────────────────── */
    .cta-banner {
      margin: 0 48px 96px;
      padding: 64px 48px;
      background: linear-gradient(135deg, #111827 0%, rgba(79, 195, 247, 0.06) 100%);
      border: 1px solid rgba(79, 195, 247, 0.18);
      border-radius: 20px;
      text-align: center;
      max-width: 800px;
      margin-left: auto;
      margin-right: auto;
    }

    .cta-banner h2 {
      font-size: 2rem;
      font-weight: 700;
      color: #f0f0ff;
      letter-spacing: -0.02em;
      margin: 0 0 12px;
    }

    .cta-banner p {
      color: #6b7a90;
      margin: 0 0 32px;
      font-size: 1rem;
    }

    /* ── Footer ───────────────────────────────────────── */
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 24px 48px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      color: #4a5568;
      font-size: 0.85rem;
    }

    .footer-copy { color: #4a5568; }

    /* ── Responsive ───────────────────────────────────── */
    @media (max-width: 640px) {
      .nav { padding: 16px 20px; }
      .hero { padding: 64px 20px 0; }
      .features { padding: 0 20px 64px; }
      .how { padding: 0 20px 64px; }
      .cta-banner { margin: 0 20px 64px; padding: 40px 24px; }
      .footer { padding: 20px; flex-direction: column; gap: 8px; text-align: center; }
      .stat-divider { display: none; }
      .step-arrow { display: none; }
    }
  `]
})
export class LandingComponent {}
