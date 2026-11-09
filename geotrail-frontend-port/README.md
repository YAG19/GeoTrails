# GeoTrail landing — Angular port

Drop these files into your `geotrail-frontend/` codebase. Paths mirror the source tree.

## Files

- `src/app/features/landing/landing.component.ts` — shell (nav + marquee + footer)
- `src/app/features/landing/landing-hero.component.ts` — hero with interactive Leaflet map
- `src/app/features/landing/landing-imports.component.ts` — data-flow diagram
- `src/app/features/landing/landing-demo.component.ts` — dashboard preview with Leaflet
- `src/app/features/landing/landing-shared.scss` — shared tokens/utilities (imported by each component)
- `src/app/app.routes.ts` — adds public `/landing` route
- `src/app/app.component.ts` — skips sidebar for landing
- `src/index.html` — adds font preconnects
- `src/styles.scss` — adds CSS variables + topo background + leaflet skin

## How it's wired

- `/landing` is public (no auth guard).
- `app.component.ts` detects the landing route and renders `<router-outlet>` without the authenticated chrome.
- Theme toggle persists to `localStorage` (key: `gt-theme`). CSS vars on `<body data-theme>`.
- Both Leaflet maps init in `ngAfterViewInit` and tear down in `ngOnDestroy`.

## Notes

- The Tweaks panel from the prototype is removed — it was a design-review tool only.
- Trail data in the hero + demo is hardcoded showcase data. Wire to your `ApiService` later if you want real recent trails.
- Fonts: JetBrains Mono + Instrument Serif via Google Fonts. Self-host if you want to avoid the runtime dependency.
