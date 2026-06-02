import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-dashboard-topbar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="topbar">
      <div class="topbar-left">
        <div class="view-label">
          <span class="label">VIEW</span>
          <span class="view-name">./overview</span>
        </div>

        <!-- scope picker -->
        <div class="scope-strip">
          @for (s of scopes; track s) {
            <button
              class="btn scope-btn"
              [class.active]="s === scope"
              (click)="scopeChange.emit(s)"
            >{{ s }}</button>
          }
        </div>

        <!-- filter chips -->
        <div class="filters">
          <span class="filter-label">filters:</span>
          <label class="chip chip-select">
            <span class="chip-key">transport:</span>
            <select
              class="chip-dd"
              [value]="filter"
              (change)="onFilterChange($event)"
            >
              @for (f of filters; track f) {
                <option [value]="f">{{ f }}</option>
              }
            </select>
          </label>
          <span class="chip">device: all</span>
          <button class="chip chip-add">+ add filter</button>
        </div>
      </div>

      <div class="topbar-right">
        <span class="num utc">{{ utc() }}</span>
        <button class="btn btn-icon" title="Search">⌕</button>
        <button class="btn btn-icon" title="Export">↗</button>
        <button class="btn btn-icon" (click)="themeChange.emit(theme === 'dark' ? 'light' : 'dark')" title="Theme">
          {{ theme === 'dark' ? '☾' : '☀' }}
        </button>
        <div class="avatar">JD</div>
      </div>
    </div>
  `,
  styleUrls: ['./dashboard.scss'],
  styles: [`
    .topbar {
      display: flex; align-items: center; justify-content: space-between;
      height: 48px; padding: 0 20px;
      border-bottom: 1px solid var(--line);
      background: var(--bg);
      flex-shrink: 0;
      font-size: 11.5px;
      gap: 20px;
    }
    .topbar-left, .topbar-right { display: flex; align-items: center; gap: 16px; }
    .view-label { display: flex; align-items: center; gap: 8px; }
    .view-name { color: var(--ink); }
    .scope-strip {
      display: flex; gap: 2px; padding: 3px;
      border: 1px solid var(--line);
    }
    .scope-btn { padding: 3px 9px; font-size: 10.5px; border: none; }
    .filters { display: flex; align-items: center; gap: 6px; color: var(--ink-3); font-size: 11px; }
    .filter-label { color: var(--ink-3); }
    .chip {
      padding: 2px 8px; border: 1px solid var(--line);
      color: var(--ink-2); font-size: 11px;
      background: transparent; font-family: inherit; cursor: default;
    }
    .chip-select { display: inline-flex; align-items: center; gap: 4px; padding: 0 0 0 8px; cursor: pointer; }
    .chip-key { color: var(--ink-3); }
    .chip-dd {
      background: transparent; border: none; color: var(--ink-2);
      font: inherit; font-size: 11px; padding: 2px 4px;
      cursor: pointer; outline: none;
    }
    .chip-dd option { background: var(--bg); color: var(--ink); }
    .chip-add {
      border-style: dashed; color: var(--ink-4); cursor: pointer;
    }
    .chip-add:hover { color: var(--ink); border-color: var(--ink-3); }
    .utc { color: var(--ink-4); font-size: 10.5px; }
    .avatar {
      width: 28px; height: 28px;
      border: 1px solid var(--line);
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 10px; color: var(--ink-3);
    }
  `],
})
export class DashboardTopbarComponent implements OnInit, OnDestroy {
 private apiService = inject(ApiService);

  @Input() scope = '6M';
  @Input() theme: 'dark' | 'light' = 'dark';
  @Output() scopeChange = new EventEmitter<string>();
  @Output() themeChange = new EventEmitter<'dark' | 'light'>();

  @Input() filter = 'all'
  @Output() filterChange = new EventEmitter<string>();

  scopes = ['1W', '1M', '6M', '1Y', '5Y', 'ALL'];
  filters = ['all']
  utc = signal('');
  private timer?: ReturnType<typeof setInterval>;

  ngOnInit() {
    this.tick();
    this.timer = setInterval(() => this.tick(), 1000);
    this.apiService.getDistinctAtctivity().subscribe({
      next: (places) => {console.log(places); this.filters.push(...places);  },
      error: () => { },
    });
  }
  ngOnDestroy() { clearInterval(this.timer); }
  onFilterChange(e: Event) {
    const v = (e.target as HTMLSelectElement).value;
    this.filter = v;
    this.filterChange.emit(v);
  }
  private tick() {
    this.utc.set(new Date().toISOString().replace('T', ' ').slice(0, 19) + 'Z');
  }
}
