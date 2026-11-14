import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { Subscription, from, timer } from 'rxjs';
import { concatMap, finalize, switchMap, takeWhile } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import { ImportJob } from '../../core/models/api.models';

/** Matches spring.servlet.multipart.max-file-size in the backend. */
const MAX_FILE_BYTES = 500 * 1024 * 1024;
/** How much of each file we read to guess its format. */
const SNIFF_BYTES = 256 * 1024;

type DetectedFormat = 'device' | 'records' | 'semantic' | 'ios-array' | 'unknown';

interface QueueItem {
  id: number;
  file: File;
  format: DetectedFormat;
  state: 'invalid' | 'waiting' | 'uploading' | 'uploaded' | 'failed';
  uploadPercent: number;
  message?: string;
  jobId?: number;
}

const FORMAT_LABELS: Record<DetectedFormat, string> = {
  device: 'Timeline export (phone, 2024+)',
  records: 'Takeout · Records.json',
  semantic: 'Takeout · Semantic Location History',
  'ios-array': 'iPhone list format',
  unknown: 'Unrecognised format',
};

@Component({
  selector: 'app-import',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="import-page">
      <header class="page-head">
        <h1 class="page-title">Import location history</h1>
        <p class="page-sub">
          Bring in your Google Timeline / Takeout data. Files are processed on your own server; duplicates are skipped,
          so re-importing the same file is safe.
        </p>
      </header>

      <!-- ── Where do I get my file? ── -->
      <section class="howto" aria-labelledby="howto-title">
        <h2 id="howto-title" class="section-title">Get your data from Google</h2>

        <details name="howto" open>
          <summary>Android phone (Timeline on device, 2024 onwards)</summary>
          <ol>
            <li>Open your phone's <b>Settings → Location → Location services → Timeline</b>.</li>
            <li>Tap <b>Export Timeline data</b> and save the file.</li>
            <li>Copy <code>Timeline.json</code> to this computer and drop it below.</li>
          </ol>
        </details>

        <details name="howto">
          <summary>iPhone (Google Maps app)</summary>
          <ol>
            <li>In Google Maps, tap your profile picture → <b>Settings → Personal content</b>.</li>
            <li>Tap <b>Export Timeline data</b> and save the JSON file.</li>
          </ol>
          <p class="note">
            Some iPhone exports are a plain list (the file starts with <code>[</code>). GeoTrail can't read that layout
            yet. We'll flag it before uploading.
          </p>
        </details>

        <details name="howto">
          <summary>Older Google Takeout archive (Location History)</summary>
          <ol>
            <li>
              Go to <a href="https://takeout.google.com/" target="_blank" rel="noopener noreferrer">takeout.google.com</a>,
              deselect all, then select <b>Location History (Timeline)</b>.
            </li>
            <li>Download and unzip the archive.</li>
            <li>
              Import <code>Records.json</code> (raw GPS points) and/or the monthly files in
              <code>Semantic Location History/YYYY/</code>. You can select many files at once.
            </li>
          </ol>
        </details>
      </section>

      <!-- ── Drop zone: a real <label> + file input, so it works with keyboard and screen readers ── -->
      <label
        class="drop-zone"
        [class.dragging]="dragDepth() > 0"
        (dragenter)="onDragEnter($event)"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave()"
        (drop)="onDrop($event)"
      >
        <input
          class="visually-hidden"
          type="file"
          accept=".json,application/json"
          multiple
          aria-describedby="drop-hint"
          (change)="onFileSelected($event)"
        />
        <span class="drop-icon" aria-hidden="true">↓</span>
        <span class="drop-title">{{ dragDepth() > 0 ? 'Drop to import' : 'Choose JSON files or drop them here' }}</span>
        <span id="drop-hint" class="drop-hint">
          Timeline.json, Records.json or Semantic Location History files · up to 500 MB each
        </span>
      </label>

      <!-- Screen-reader announcements -->
      <p class="visually-hidden" role="status" aria-live="polite">{{ announcement() }}</p>

      @if (queue().length) {
        <section class="queue" aria-labelledby="queue-title">
          <div class="section-head">
            <h2 id="queue-title" class="section-title">This session</h2>
            @if (!uploadingNow()) {
              <button type="button" class="btn-link" (click)="clearQueue()">clear</button>
            }
          </div>
          <ul class="list">
            @for (item of queue(); track item.id) {
              <li class="row" [attr.data-state]="item.state">
                <div class="row-main">
                  <span class="filename">{{ item.file.name }}</span>
                  <span class="meta">
                    {{ formatBytes(item.file.size) }} ·
                    <span [class.warn]="item.format === 'unknown' || item.format === 'ios-array'">{{ formatLabel(item.format) }}</span>
                  </span>
                  @if (item.message) {
                    <span class="row-msg" [class.err]="item.state === 'invalid' || item.state === 'failed'">{{ item.message }}</span>
                  }
                </div>
                <div class="row-side">
                  @switch (item.state) {
                    @case ('uploading') {
                      <progress max="100" [value]="item.uploadPercent" [attr.aria-label]="'Uploading ' + item.file.name"></progress>
                      <span class="num">{{ item.uploadPercent }}%</span>
                    }
                    @case ('waiting') { <span class="chip">queued</span> }
                    @case ('uploaded') { <span class="chip ok">uploaded</span> }
                    @case ('invalid') { <span class="chip bad">skipped</span> }
                    @case ('failed') { <span class="chip bad">failed</span> }
                  }
                </div>
              </li>
            }
          </ul>
        </section>
      }

      <!-- ── Server-side jobs ── -->
      <section class="jobs" aria-labelledby="jobs-title">
        <div class="section-head">
          <h2 id="jobs-title" class="section-title">Import history</h2>
          @if (activeJobs().length) {
            <span class="meta">{{ activeJobs().length }} processing…</span>
          }
        </div>

        @if (loadError()) {
          <p class="banner err" role="alert">{{ loadError() }}</p>
        }

        @if (jobs().length === 0 && !loadError()) {
          <p class="empty">No imports yet. Once a file finishes processing, your trails show up on the <a routerLink="/dashboard">dashboard</a>.</p>
        } @else {
          <ul class="list">
            @for (job of jobs(); track job.id) {
              <li class="row">
                <div class="row-main">
                  <span class="filename">{{ job.filename }}</span>
                  <span class="meta">
                    <time [attr.datetime]="job.createdAt">{{ job.createdAt | date: 'medium' }}</time>
                    @if (job.fileSizeBytes) { · {{ formatBytes(job.fileSizeBytes) }} }
                    @if (duration(job); as d) { · took {{ d }} }
                  </span>
                  @if (isActive(job)) {
                    @if (job.totalRecords) {
                      <progress max="100" [value]="job.progressPercent" [attr.aria-label]="'Processing ' + job.filename"></progress>
                    } @else {
                      <progress [attr.aria-label]="'Processing ' + job.filename"></progress>
                    }
                  }
                  <span class="meta stats">
                    <span class="num">{{ job.processed | number }}</span> points
                    @if (job.totalRecords && isActive(job)) { of <span class="num">{{ job.totalRecords | number }}</span> }
                    @if (job.duplicates) { · <span class="num">{{ job.duplicates | number }}</span> duplicates skipped }
                    @if (job.errors) { · <span class="num err">{{ job.errors | number }}</span> errors }
                  </span>
                </div>
                <div class="row-side">
                  <span class="chip" [ngClass]="job.status.toLowerCase()">{{ job.status | lowercase }}</span>
                  @if (job.status === 'FAILED') {
                    <button type="button" class="btn-sm" [disabled]="retrying().has(job.id)" (click)="retry(job)">
                      {{ retrying().has(job.id) ? 'retrying…' : 'retry' }}
                    </button>
                  }
                </div>
              </li>
            }
          </ul>
        }
      </section>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .import-page {
      padding: 24px;
      max-width: 860px;
      margin-inline: auto;
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 12.5px;
      color: var(--ink);
    }
    .page-title { font-family: 'Instrument Serif', serif; font-weight: 400; font-size: 2rem; letter-spacing: -0.01em; }
    .page-sub { color: var(--ink-3); margin-top: 6px; max-width: 62ch; line-height: 1.6; }
    .section-title { font-size: 10px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-3); }
    .section-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }

    /* How-to accordion (native <details>, grouped with name= so one opens at a time) */
    .howto { margin-top: 24px; display: grid; gap: 6px; }
    .howto .section-title { margin-bottom: 4px; }
    details { border: 1px solid var(--line); background: var(--bg-2); }
    summary { cursor: pointer; padding: 10px 14px; color: var(--ink-2); }
    summary:hover { color: var(--ink); }
    details[open] summary { border-bottom: 1px solid var(--line-2); color: var(--ink); }
    details ol { padding: 10px 14px 12px 34px; display: grid; gap: 6px; line-height: 1.6; color: var(--ink-2); }
    details .note { padding: 0 14px 12px; color: var(--ink-3); line-height: 1.6; }
    details a { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }
    code { background: var(--bg-3); border: 1px solid var(--line-2); padding: 0 4px; font-size: 0.95em; }

    /* Drop zone */
    .drop-zone {
      margin-top: 20px;
      display: grid; justify-items: center; gap: 6px;
      padding: 40px 24px;
      text-align: center;
      border: 1.5px dashed var(--line);
      background: var(--panel);
      cursor: pointer;
      transition: border-color 150ms, background-color 150ms;
    }
    .drop-zone:hover, .drop-zone.dragging { border-color: var(--accent); background: var(--accent-soft); }
    .drop-zone:has(input:focus-visible) { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
    .drop-icon {
      width: 36px; height: 36px; display: grid; place-items: center;
      border: 1.5px solid var(--accent); color: var(--accent); font-size: 16px;
    }
    .drop-title { font-size: 13.5px; color: var(--ink); margin-top: 4px; }
    .drop-hint { color: var(--ink-3); font-size: 11px; }

    /* Lists */
    .queue, .jobs { margin-top: 28px; }
    .list { list-style: none; display: grid; gap: 6px; }
    .row {
      display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center;
      padding: 12px 14px;
      border: 1px solid var(--line);
      background: var(--panel);
    }
    .row-main { display: grid; gap: 4px; min-width: 0; }
    .row-side { display: flex; align-items: center; gap: 8px; }
    .filename { color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .meta { color: var(--ink-3); font-size: 11px; }
    .meta .warn { color: var(--warning-text); }
    .row-msg { font-size: 11px; color: var(--ink-2); }
    .err { color: var(--danger-text); }
    .num { font-variant-numeric: tabular-nums; }
    .empty { color: var(--ink-3); padding: 18px 0; line-height: 1.6; }
    .empty a { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }
    .banner { padding: 10px 14px; border: 1px solid var(--danger-border); background: var(--danger-bg); margin-bottom: 8px; }

    .chip { padding: 2px 8px; font-size: 10px; letter-spacing: 0.06em; border: 1px solid var(--line); color: var(--ink-3); background: var(--bg-2); }
    .chip.ok, .chip.completed { color: var(--success-text); background: var(--success-bg); border-color: transparent; }
    .chip.processing, .chip.pending { color: var(--warning-text); background: var(--warning-bg); border-color: transparent; }
    .chip.bad, .chip.failed { color: var(--danger-text); background: var(--danger-bg); border-color: transparent; }

    .btn-sm {
      padding: 3px 10px; font: inherit; font-size: 11px; cursor: pointer;
      background: transparent; color: var(--ink-2); border: 1px solid var(--line);
    }
    .btn-sm:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
    .btn-sm:disabled { opacity: 0.6; cursor: progress; }
    .btn-link { background: none; border: 0; font: inherit; font-size: 11px; color: var(--ink-3); cursor: pointer; text-decoration: underline; }

    .row-side progress { inline-size: 120px; }

    @media (max-width: 560px) {
      .import-page { padding: 16px; }
      .row { grid-template-columns: 1fr; }
    }
  `],
})
export class ImportComponent implements OnInit {
  private api = inject(ApiService);
  private destroyRef = inject(DestroyRef);

  private nextId = 1;
  private pollSub?: Subscription;

  queue = signal<QueueItem[]>([]);
  jobs = signal<ImportJob[]>([]);
  loadError = signal('');
  announcement = signal('');
  dragDepth = signal(0);
  retrying = signal<ReadonlySet<number>>(new Set());

  activeJobs = computed(() => this.jobs().filter((j) => this.isActive(j)));
  uploadingNow = computed(() => this.queue().some((q) => q.state === 'uploading' || q.state === 'waiting'));

  ngOnInit(): void {
    // Loads history and keeps polling while anything is still processing (also resumes after a reload).
    this.pollJobs();
  }

  // ── File selection ────────────────────────────────────────────────

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) this.addFiles(Array.from(input.files));
    input.value = ''; // allow choosing the same file again
  }

  onDragEnter(event: DragEvent): void {
    if (!this.hasFiles(event)) return;
    event.preventDefault();
    this.dragDepth.update((d) => d + 1);
  }

  onDragOver(event: DragEvent): void {
    if (!this.hasFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }

  onDragLeave(): void {
    this.dragDepth.update((d) => Math.max(0, d - 1));
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragDepth.set(0);
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length) this.addFiles(files);
  }

  clearQueue(): void {
    this.queue.set([]);
  }

  // ── Validation + upload ──────────────────────────────────────────

  private async addFiles(files: File[]): Promise<void> {
    const items = await Promise.all(files.map((f) => this.inspect(f)));
    this.queue.update((q) => [...items, ...q]);

    const valid = items.filter((i) => i.state === 'waiting');
    const skipped = items.length - valid.length;
    this.announce(
      `${valid.length} file${valid.length === 1 ? '' : 's'} queued for import` +
        (skipped ? `, ${skipped} skipped` : ''),
    );

    // Upload one file at a time to keep memory and bandwidth predictable.
    from(valid)
      .pipe(
        concatMap((item) => this.upload(item)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private async inspect(file: File): Promise<QueueItem> {
    const item: QueueItem = { id: this.nextId++, file, format: 'unknown', state: 'waiting', uploadPercent: 0 };
    const name = file.name.toLowerCase();

    if (name.endsWith('.zip') || name.endsWith('.tgz') || name.endsWith('.tar.gz')) {
      return { ...item, state: 'invalid', message: 'Unzip the Takeout archive first, then pick the .json files inside.' };
    }
    if (!name.endsWith('.json')) {
      return { ...item, state: 'invalid', message: 'Only .json files can be imported.' };
    }
    if (file.size > MAX_FILE_BYTES) {
      return { ...item, state: 'invalid', message: `File is larger than the server limit of ${this.formatBytes(MAX_FILE_BYTES)}.` };
    }
    if (file.size === 0) {
      return { ...item, state: 'invalid', message: 'File is empty.' };
    }

    const format = await this.sniff(file);
    if (format === 'ios-array') {
      return {
        ...item,
        format,
        state: 'invalid',
        message: 'This export is a top-level list, which the server cannot read yet.',
      };
    }
    return {
      ...item,
      format,
      message: format === 'unknown' ? 'Format not recognised from the first part of the file; the server will try anyway.' : undefined,
    };
  }

  /** Reads the start of the file to identify which Google export it is. */
  private async sniff(file: File): Promise<DetectedFormat> {
    try {
      const head = (await file.slice(0, SNIFF_BYTES).text()).replace(/^﻿/, '').trimStart();
      if (head.startsWith('[')) return 'ios-array';
      if (head.includes('"semanticSegments"')) return 'device';
      if (head.includes('"timelineObjects"')) return 'semantic';
      if (head.includes('"locations"')) return 'records';
    } catch {
      /* unreadable — let the server decide */
    }
    return 'unknown';
  }

  private upload(item: QueueItem) {
    return new Promise<void>((resolve) => {
      this.patch(item.id, { state: 'uploading', uploadPercent: 0 });
      this.api.importGoogleTimelineWithProgress(item.file).subscribe({
        next: (event) => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            this.patch(item.id, { uploadPercent: Math.round((event.loaded / event.total) * 100) });
          } else if (event.type === HttpEventType.Response) {
            const job = event.body?.data;
            this.patch(item.id, { state: 'uploaded', uploadPercent: 100, jobId: job?.id, message: 'Processing on the server…' });
            this.announce(`${item.file.name} uploaded, processing started`);
            this.pollJobs();
          }
        },
        error: (err: HttpErrorResponse) => {
          const message =
            err.status === 413
              ? 'Rejected by the server: file too large.'
              : err.status === 0
                ? 'Could not reach the server.'
                : (err.error?.message ?? `Upload failed (${err.status}).`);
          this.patch(item.id, { state: 'failed', message });
          this.announce(`${item.file.name} failed: ${message}`);
          resolve();
        },
        complete: () => resolve(),
      });
    });
  }

  // ── Server jobs ──────────────────────────────────────────────────

  retry(job: ImportJob): void {
    this.retrying.update((s) => new Set(s).add(job.id));
    this.api
      .retryImportJob(job.id)
      .pipe(finalize(() => this.clearRetrying(job.id)))
      .subscribe({
        next: () => {
          this.announce(`Retrying ${job.filename}`);
          this.pollJobs();
        },
        error: () => this.announce(`Could not retry ${job.filename}`),
      });
  }

  private clearRetrying(id: number) {
    this.retrying.update((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
  }

  /** Fetch jobs now, then every 2s while any is still pending/processing. */
  private pollJobs(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = timer(0, 2000)
      .pipe(
        switchMap(() => this.api.getImportJobs()),
        takeWhile((jobs) => jobs.some((j) => this.isActive(j)), true),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (jobs) => {
          this.announceFinished(jobs);
          this.jobs.set(jobs);
          this.loadError.set('');
        },
        error: () => this.loadError.set('Could not load import history from the server.'),
      });
  }

  private announceFinished(next: ImportJob[]): void {
    const prev = new Map(this.jobs().map((j) => [j.id, j.status]));
    for (const j of next) {
      const before = prev.get(j.id);
      if (before && before !== j.status && (j.status === 'COMPLETED' || j.status === 'FAILED')) {
        this.announce(
          j.status === 'COMPLETED'
            ? `${j.filename} finished: ${j.processed.toLocaleString()} points imported`
            : `${j.filename} failed to import`,
        );
      }
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────

  isActive(job: ImportJob): boolean {
    return job.status === 'PENDING' || job.status === 'PROCESSING';
  }

  formatLabel(f: DetectedFormat): string {
    return FORMAT_LABELS[f];
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    return new Intl.NumberFormat(undefined, {
      style: 'unit',
      unit: bytes >= 1024 ** 3 ? 'gigabyte' : bytes >= 1024 ** 2 ? 'megabyte' : 'kilobyte',
      unitDisplay: 'short',
      maximumFractionDigits: 1,
    }).format(bytes / (bytes >= 1024 ** 3 ? 1024 ** 3 : bytes >= 1024 ** 2 ? 1024 ** 2 : 1024));
  }

  duration(job: ImportJob): string | null {
    if (!job.startedAt || !job.completedAt) return null;
    const secs = Math.max(0, Math.round((Date.parse(job.completedAt) - Date.parse(job.startedAt)) / 1000));
    if (secs < 60) return `${secs}s`;
    const m = Math.floor(secs / 60);
    return m < 60 ? `${m}m ${secs % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
  }

  private hasFiles(e: DragEvent): boolean {
    return !!e.dataTransfer?.types?.includes('Files');
  }

  private patch(id: number, changes: Partial<QueueItem>): void {
    this.queue.update((q) => q.map((i) => (i.id === id ? { ...i, ...changes } : i)));
  }

  private announce(msg: string): void {
    // Clear first so repeating the same message is still announced.
    this.announcement.set('');
    queueMicrotask(() => this.announcement.set(msg));
  }
}
