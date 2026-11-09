# GeoTrail Dashboard — Integration Guide

## What's in this folder

```
src/
├── index.html                          ← add Google Fonts (replace)
├── styles.scss                         ← add CSS tokens (replace)
└── app/
    ├── app.component.ts                ← restyled sidebar (replace)
    └── features/dashboard/
        ├── dashboard.component.ts      ← REPLACE existing file
        ├── dashboard-topbar.component.ts   ← NEW
        ├── dashboard-stat-strip.component.ts ← NEW (wired to ApiService)
        ├── dashboard-map.component.ts      ← NEW (wired to ApiService)
        ├── dashboard-modules.component.ts  ← NEW (wired to ApiService)
        └── dashboard.scss                  ← NEW
```

## Step-by-step

### 1. Replace `src/index.html`
Adds Google Fonts preconnect for JetBrains Mono + Instrument Serif.
No other changes — Leaflet CSS stays the same.

### 2. Replace `src/styles.scss`
Adds CSS variable tokens (`--bg`, `--ink`, `--accent`, etc.) scoped under
`body[data-theme="dark"]` and `body[data-theme="light"]`.

**Your existing reset, scrollbar and Leaflet rules are preserved.**
The theme tokens only activate when `DashboardComponent` is mounted
(it sets `data-theme` on `<body>` in `ngOnInit` and clears it in `ngOnDestroy`).
Other routes are completely unaffected.

### 3. Replace `src/app/app.component.ts`
Updates the existing sidebar to the new design aesthetic.
Nav links, routing, and auth logic are identical — only the visual style changes.

### 4. Replace `src/app/features/dashboard/dashboard.component.ts`
Drop the new file in. It replaces the simple stats+bar chart with:
- Topbar (scope picker, theme toggle, live UTC clock)
- Stat strip (wired to `ApiService.getDashboardSummary()`)
- Big Leaflet map (wired to `ApiService.queryLocations()` + `getPlaces()`)
- Scrollable modules rail (top places, distance chart, activity calendar,
  polar clock, recent trails — all wired to ApiService where possible,
  mock fallback where not)

### 5. Add the 4 new component files
Copy these into `src/app/features/dashboard/`:
- `dashboard-topbar.component.ts`
- `dashboard-stat-strip.component.ts`
- `dashboard-map.component.ts`
- `dashboard-modules.component.ts`
- `dashboard.scss`

No changes to `app.routes.ts` or `app.config.ts` — the `/dashboard` route
already lazy-loads `DashboardComponent` by selector.

## Data wiring summary

| Module           | API call                         | Fallback |
|------------------|----------------------------------|----------|
| Stat strip       | `getDashboardSummary()`          | Mock values |
| Map trails       | `queryLocations({from,to,size:5000})` | Seed polylines |
| Map places       | `getPlaces()`                    | Silent skip |
| Distance chart   | `getDailyStats(from, to)`        | Mock 24mo |
| Activity calendar| `getDailyStats(from, to)`        | Mock grid |
| Top places       | `getPlaces()`                    | 3 mock places |
| Recent trails    | `queryLocations({from,to,size:30})` | 5 mock rows |
| Polar clock      | — (no backend endpoint)          | Static mock |

## No new npm packages needed
Leaflet and `@types/leaflet` are already in your `package.json`.
