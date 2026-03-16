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
    .page-title { margin: 0 0 24px; font-size: 1.5rem; color: #1a1a2e; }

    .drop-zone {
      border: 2px dashed #ccc;
      border-radius: 16px;
      padding: 48px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
      background: #fff;
    }
    .drop-zone:hover { border-color: #4fc3f7; background: #f0faff; }
    .drop-icon { font-size: 3rem; margin-bottom: 12px; }
    .drop-zone p { margin: 4px 0; color: #555; }
    .drop-hint { font-size: 0.85rem; color: #999; }

    .progress-card {
      margin-top: 24px;
      background: #fff;
      padding: 24px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }
    .progress-card h3 { margin: 0 0 16px; font-size: 1rem; }
    .progress-bar { height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #4fc3f7, #0288d1); border-radius: 4px; transition: width 0.3s; }
    .progress-stats { display: flex; justify-content: space-between; margin-top: 8px; font-size: 0.85rem; color: #666; }
    .error-count { color: #d32f2f; font-size: 0.85rem; }

    .jobs-section { margin-top: 32px; }
    .jobs-section h3 { margin: 0 0 16px; font-size: 1.1rem; color: #333; }
    .jobs-list { display: flex; flex-direction: column; gap: 8px; }
    .job-card { display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 16px; border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
    .job-info { display: flex; flex-direction: column; gap: 2px; }
    .job-filename { font-weight: 500; color: #333; }
    .job-date { font-size: 0.8rem; color: #999; }
    .job-meta { display: flex; align-items: center; gap: 12px; font-size: 0.85rem; color: #666; }
    .job-status { padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
    .job-status.completed { background: #e8f5e9; color: #2e7d32; }
    .job-status.processing { background: #fff3e0; color: #f57c00; }
    .job-status.failed { background: #ffeef0; color: #d32f2f; }
    .job-status.pending { background: #f5f5f5; color: #999; }
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
