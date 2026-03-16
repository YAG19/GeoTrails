import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="settings-page">
      <h2 class="page-title">Settings</h2>

      <div class="settings-section">
        <h3>Display Preferences</h3>
        <div class="setting-row">
          <label>Distance Unit</label>
          <select [(ngModel)]="distanceUnit">
            <option value="km">Kilometers</option>
            <option value="mi">Miles</option>
          </select>
        </div>
        <div class="setting-row">
          <label>Timezone</label>
          <select [(ngModel)]="timezone">
            <option value="UTC">UTC</option>
            <option value="America/New_York">Eastern (US)</option>
            <option value="America/Chicago">Central (US)</option>
            <option value="America/Denver">Mountain (US)</option>
            <option value="America/Los_Angeles">Pacific (US)</option>
            <option value="Europe/London">London</option>
            <option value="Europe/Paris">Paris</option>
            <option value="Asia/Kolkata">India (IST)</option>
            <option value="Asia/Tokyo">Tokyo</option>
          </select>
        </div>
      </div>

      <div class="settings-section">
        <h3>Data Export</h3>
        <div class="export-row">
          <div class="export-controls">
            <label>From</label>
            <input type="date" [(ngModel)]="exportFrom" />
            <label>To</label>
            <input type="date" [(ngModel)]="exportTo" />
          </div>
          <div class="export-buttons">
            <button class="btn-export" (click)="exportGeoJson()">Export GeoJSON</button>
            <button class="btn-export" (click)="exportGpx()">Export GPX</button>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h3>OwnTracks Setup</h3>
        <div class="info-card">
          <p>To track your location in real-time, install OwnTracks on your phone:</p>
          <ol>
            <li>Download OwnTracks (<a href="https://play.google.com/store/apps/details?id=org.owntracks.android" target="_blank">Android</a> / <a href="https://apps.apple.com/app/owntracks/id692424691" target="_blank">iOS</a>)</li>
            <li>Set mode to <strong>HTTP</strong></li>
            <li>Set URL to: <code>{{ apiUrl }}/owntracks</code></li>
            <li>Set your GeoTrail username and password</li>
          </ol>
        </div>
      </div>

      <div class="settings-section danger-zone">
        <h3>Danger Zone</h3>
        <p>These actions are irreversible.</p>
        <button class="btn-danger" (click)="confirmDeleteAll()">Delete All Location Data</button>
      </div>
    </div>
  `,
  styles: [`
    .settings-page { padding: 24px; max-width: 800px; }
    .page-title { margin: 0 0 24px; font-size: 1.5rem; color: #1a1a2e; }

    .settings-section {
      background: #fff;
      padding: 24px;
      border-radius: 12px;
      margin-bottom: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }
    .settings-section h3 { margin: 0 0 16px; font-size: 1.1rem; color: #333; }

    .setting-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .setting-row:last-child { border-bottom: none; }
    .setting-row label { font-weight: 500; color: #555; }
    .setting-row select {
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 0.9rem;
      min-width: 200px;
    }

    .export-row { display: flex; flex-direction: column; gap: 12px; }
    .export-controls { display: flex; align-items: center; gap: 8px; }
    .export-controls label { font-size: 0.85rem; color: #666; }
    .export-controls input { padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px; }
    .export-buttons { display: flex; gap: 8px; }
    .btn-export {
      padding: 10px 20px;
      background: #f5f5f5;
      border: 1px solid #ddd;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.2s;
    }
    .btn-export:hover { background: #4fc3f7; color: #fff; border-color: #4fc3f7; }

    .info-card { background: #f8f9fa; padding: 16px; border-radius: 8px; }
    .info-card p { margin: 0 0 12px; color: #555; }
    .info-card ol { margin: 0; padding-left: 20px; color: #555; line-height: 1.8; }
    .info-card code { background: #e8e8e8; padding: 2px 6px; border-radius: 4px; font-size: 0.85rem; }
    .info-card a { color: #4fc3f7; }

    .danger-zone { border: 1px solid #ffcdd2; }
    .danger-zone h3 { color: #d32f2f; }
    .danger-zone p { color: #888; font-size: 0.9rem; margin: 0 0 16px; }
    .btn-danger {
      padding: 10px 20px;
      background: transparent;
      color: #d32f2f;
      border: 1px solid #d32f2f;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 500;
    }
    .btn-danger:hover { background: #ffeef0; }
  `],
})
export class SettingsComponent {
  private apiService = inject(ApiService);

  distanceUnit = 'km';
  timezone = 'UTC';
  exportFrom = '';
  exportTo = '';
  apiUrl = window.location.origin + '/api';

  exportGeoJson(): void {
    if (!this.exportFrom || !this.exportTo) return;
    this.apiService
      .exportGeoJson(
        new Date(this.exportFrom).toISOString(),
        new Date(this.exportTo + 'T23:59:59').toISOString(),
      )
      .subscribe((blob) => this.downloadBlob(blob, 'geotrail-export.geojson'));
  }

  exportGpx(): void {
    if (!this.exportFrom || !this.exportTo) return;
    this.apiService
      .exportGpx(
        new Date(this.exportFrom).toISOString(),
        new Date(this.exportTo + 'T23:59:59').toISOString(),
      )
      .subscribe((blob) => this.downloadBlob(blob, 'geotrail-export.gpx'));
  }

  confirmDeleteAll(): void {
    if (confirm('Are you sure you want to delete ALL location data? This cannot be undone.')) {
      // TODO: Implement delete all endpoint
      alert('Not yet implemented');
    }
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
