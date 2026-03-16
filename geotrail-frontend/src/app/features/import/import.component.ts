import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { ImportJob } from '../../core/models/api.models';

@Component({
  selector: 'app-import',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="import-page">
      <h2 class="page-title">Import Location Data</h2>

      <div class="upload-section">
        <div
          class="drop-zone"
          (drop)="onDrop($event)"
          (dragover)="onDragOver($event)"
          (click)="fileInput.click()"
        >
          <div class="drop-icon">📂</div>
          <p>Drop your Google Timeline JSON here</p>
          <p class="drop-hint">or click to browse</p>
          <input
            #fileInput
            type="file"
            accept=".json"
            (change)="onFileSelected($event)"
            hidden
          />
        </div>
      </div>

      @if (uploading()) {
        <div class="progress-card">
          <h3>Importing {{ currentJob()?.filename }}</h3>
          <div class="progress-bar">
            <div class="progress-fill" [style.width.%]="currentJob()?.progressPercent ?? 0"></div>
          </div>
          <div class="progress-stats">
            <span>{{ currentJob()?.processed | number }} / {{ currentJob()?.totalRecords | number }} points</span>
            <span>{{ currentJob()?.progressPercent }}%</span>
          </div>
          @if (currentJob()?.errors) {
            <span class="error-count">{{ currentJob()!.errors }} errors</span>
          }
        </div>
      }

      @if (jobs().length > 0) {
        <div class="jobs-section">
          <h3>Import History</h3>
          <div class="jobs-list">
            @for (job of jobs(); track job.id) {
              <div class="job-card">
                <div class="job-info">
                  <span class="job-filename">{{ job.filename }}</span>
                  <span class="job-date">{{ job.createdAt | date:'medium' }}</span>
                </div>
                <div class="job-meta">
                  <span class="job-status" [class]="job.status.toLowerCase()">{{ job.status }}</span>
                  <span>{{ job.processed | number }} points</span>
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .import-page { padding: 24px; max-width: 800px; }
    .page-title { margin: 0 0 24px; font-size: 1.5rem; color: var(--text-primary); }

    .drop-zone {
      border: 2px dashed var(--border-color);
      border-radius: 16px;
      padding: 48px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
      background: var(--bg-card);
    }
    .drop-zone:hover { border-color: #4fc3f7; background: var(--bg-hover); }
    .drop-icon { font-size: 3rem; margin-bottom: 12px; }
    .drop-zone p { margin: 4px 0; color: var(--text-muted); }
    .drop-hint { font-size: 0.85rem; color: var(--text-hint); }

    .progress-card {
      margin-top: 24px;
      background: var(--bg-card);
      padding: 24px;
      border-radius: 12px;
      box-shadow: var(--shadow-md);
    }
    .progress-card h3 { margin: 0 0 16px; font-size: 1rem; color: var(--text-secondary); }
    .progress-bar { height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #4fc3f7, #0288d1); border-radius: 4px; transition: width 0.3s; }
    .progress-stats { display: flex; justify-content: space-between; margin-top: 8px; font-size: 0.85rem; color: var(--text-muted); }
    .error-count { color: var(--danger-text); font-size: 0.85rem; }

    .jobs-section { margin-top: 32px; }
    .jobs-section h3 { margin: 0 0 16px; font-size: 1.1rem; color: var(--text-secondary); }
    .jobs-list { display: flex; flex-direction: column; gap: 8px; }
    .job-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--bg-card);
      padding: 16px;
      border-radius: 10px;
      box-shadow: var(--shadow-sm);
    }
    .job-info { display: flex; flex-direction: column; gap: 2px; }
    .job-filename { font-weight: 500; color: var(--text-secondary); }
    .job-date { font-size: 0.8rem; color: var(--text-hint); }
    .job-meta { display: flex; align-items: center; gap: 12px; font-size: 0.85rem; color: var(--text-muted); }
    .job-status { padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
    .job-status.completed { background: var(--success-bg); color: var(--success-text); }
    .job-status.processing { background: var(--warning-bg); color: var(--warning-text); }
    .job-status.failed { background: var(--danger-bg); color: var(--danger-text); }
    .job-status.pending { background: var(--bg-surface); color: var(--text-hint); }
  `],
})
export class ImportComponent implements OnInit, OnDestroy {
  private apiService = inject(ApiService);
  private pollInterval: any;

  uploading = signal(false);
  currentJob = signal<ImportJob | null>(null);
  jobs = signal<ImportJob[]>([]);

  ngOnInit(): void {
    this.loadJobs();
  }

  ngOnDestroy(): void {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.uploadFile(input.files[0]);
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file && file.name.endsWith('.json')) {
      this.uploadFile(file);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  private uploadFile(file: File): void {
    this.uploading.set(true);
    this.apiService.importGoogleTimeline(file).subscribe({
      next: (job) => {
        this.currentJob.set(job);
        this.startPolling(job.id);
      },
      error: () => this.uploading.set(false),
    });
  }

  private startPolling(jobId: number): void {
    this.pollInterval = setInterval(() => {
      this.apiService.getImportJob(jobId).subscribe({
        next: (job) => {
          this.currentJob.set(job);
          if (job.status === 'COMPLETED' || job.status === 'FAILED') {
            clearInterval(this.pollInterval);
            this.uploading.set(false);
            this.loadJobs();
          }
        },
      });
    }, 2000);
  }

  private loadJobs(): void {
    this.apiService.getImportJobs().subscribe({
      next: (jobs) => this.jobs.set(jobs),
    });
  }
}
