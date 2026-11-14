import { Injectable, computed, effect, signal } from '@angular/core';

export type ColorScheme = 'light' | 'dark';

/**
 * Single source of truth for the colour scheme.
 *
 * - No stored value  → follow the OS (`<meta name="color-scheme" content="light dark">`).
 * - Stored value     → pin `light` or `dark` for this site.
 *
 * CSS reads the `<meta>` (see styles.scss), so tokens built with `light-dark()`
 * follow automatically. An inline script in index.html applies the stored value
 * before first paint to avoid a flash of the wrong theme.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  static readonly STORAGE_KEY = 'gt-theme';

  private readonly media = window.matchMedia('(prefers-color-scheme: dark)');
  private readonly systemScheme = signal<ColorScheme>(this.media.matches ? 'dark' : 'light');
  private readonly override = signal<ColorScheme | null>(this.readStored());

  /** The scheme currently rendered. */
  readonly scheme = computed<ColorScheme>(() => this.override() ?? this.systemScheme());
  readonly isDark = computed(() => this.scheme() === 'dark');

  constructor() {
    this.media.addEventListener('change', (e) => this.systemScheme.set(e.matches ? 'dark' : 'light'));

    // Keep tabs in sync.
    window.addEventListener('storage', (e) => {
      if (e.key === ThemeService.STORAGE_KEY) this.override.set(this.parse(e.newValue));
    });

    effect(() => {
      const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
      if (meta) meta.content = this.override() ?? 'light dark';
    });
  }

  /**
   * Two-state toggle: switch to the opposite of what is rendered. If that matches
   * the OS preference, drop the override instead of pinning it, so the site keeps
   * following future OS changes.
   */
  toggle(): void {
    const target: ColorScheme = this.scheme() === 'dark' ? 'light' : 'dark';
    this.set(target === this.systemScheme() ? null : target);
  }

  /** Explicitly choose a scheme, or `null` to follow the system. */
  set(value: ColorScheme | null): void {
    this.override.set(value);
    try {
      if (value) localStorage.setItem(ThemeService.STORAGE_KEY, value);
      else localStorage.removeItem(ThemeService.STORAGE_KEY);
    } catch {
      /* storage blocked — the theme still applies for this session */
    }
  }

  /** Stored override, or null when following the system. */
  preference(): ColorScheme | null {
    return this.override();
  }

  private readStored(): ColorScheme | null {
    try {
      return this.parse(localStorage.getItem(ThemeService.STORAGE_KEY));
    } catch {
      return null;
    }
  }

  private parse(v: string | null): ColorScheme | null {
    return v === 'light' || v === 'dark' ? v : null;
  }
}
