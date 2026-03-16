import { Component, OnInit, OnDestroy, inject, signal, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { ApiService } from '../../core/services/api.service';
import { LocationPoint } from '../../core/models/api.models';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="map-page">
      <div class="map-controls">
        <div class="date-controls">
          <label>From</label>
          <input type="date" [(ngModel)]="dateFrom" (change)="loadPoints()" />
          <label>To</label>
          <input type="date" [(ngModel)]="dateTo" (change)="loadPoints()" />
          <button class="btn-sm" (click)="setToday()">Today</button>
          <button class="btn-sm" (click)="setWeek()">7 Days</button>
          <button class="btn-sm" (click)="setMonth()">30 Days</button>
        </div>
        <div class="stats-bar">
          <span>{{ pointCount() }} points</span>
          <span>{{ distanceKm() }} km</span>
        </div>
      </div>
      <div id="map" class="map-container"></div>
    </div>
  `,
  styles: [`
    .map-page {
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    .map-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 20px;
      background: #fff;
      border-bottom: 1px solid #e0e0e0;
      flex-shrink: 0;
    }

    .date-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .date-controls label {
      font-size: 0.85rem;
      color: #666;
      font-weight: 500;
    }

    .date-controls input {
      padding: 6px 10px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 0.9rem;
    }

    .btn-sm {
      padding: 6px 12px;
      background: #f0f0f0;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-sm:hover {
      background: #4fc3f7;
      color: #fff;
      border-color: #4fc3f7;
    }

    .stats-bar {
      display: flex;
      gap: 16px;
      font-size: 0.9rem;
      color: #555;
    }

    .stats-bar span {
      padding: 4px 12px;
      background: #f5f5f5;
      border-radius: 12px;
      font-weight: 500;
    }

    .map-container {
      flex: 1;
      min-height: 0;
    }
  `],
})
export class MapComponent implements AfterViewInit, OnDestroy {
  private apiService = inject(ApiService);
  private map!: L.Map;
  private pointsLayer = L.layerGroup();
  private routeLayer = L.layerGroup();

  dateFrom = this.formatDate(new Date());
  dateTo = this.formatDate(new Date());
  pointCount = signal(0);
  distanceKm = signal('0.0');

  ngAfterViewInit(): void {
    this.initMap();
    this.loadPoints();
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private initMap(): void {
    this.map = L.map('map', {
      center: [20, 0],
      zoom: 3,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(this.map);

    this.pointsLayer.addTo(this.map);
    this.routeLayer.addTo(this.map);
  }

  loadPoints(): void {
    const from = new Date(this.dateFrom).toISOString();
    const to = new Date(this.dateTo + 'T23:59:59').toISOString();

    this.apiService.queryLocations({ from, to }).subscribe({
      next: (points) => {
        this.renderPoints(points);
        this.pointCount.set(points.length);
      },
    });

    this.apiService.getLocationStats(from, to).subscribe({
      next: (stats) => {
        this.distanceKm.set((stats.totalDistanceMeters / 1000).toFixed(1));
      },
    });
  }

  private renderPoints(points: LocationPoint[]): void {
    this.pointsLayer.clearLayers();
    this.routeLayer.clearLayers();

    if (points.length === 0) return;

    // Draw route line
    const latLngs: L.LatLngExpression[] = points.map((p) => [p.latitude, p.longitude]);
    const polyline = L.polyline(latLngs, {
      color: '#4fc3f7',
      weight: 3,
      opacity: 0.7,
    });
    this.routeLayer.addLayer(polyline);

    // Draw point markers (limit for performance)
    const step = Math.max(1, Math.floor(points.length / 2000));
    for (let i = 0; i < points.length; i += step) {
      const p = points[i];
      const circle = L.circleMarker([p.latitude, p.longitude], {
        radius: 4,
        fillColor: '#4fc3f7',
        color: '#0288d1',
        weight: 1,
        fillOpacity: 0.8,
      });

      circle.bindPopup(`
        <strong>${new Date(p.recordedAt).toLocaleString()}</strong><br/>
        Lat: ${p.latitude.toFixed(6)}<br/>
        Lon: ${p.longitude.toFixed(6)}<br/>
        ${p.accuracy ? `Accuracy: ${p.accuracy}m<br/>` : ''}
        ${p.velocity ? `Speed: ${(p.velocity * 3.6).toFixed(1)} km/h<br/>` : ''}
        Source: ${p.source}
      `);

      this.pointsLayer.addLayer(circle);
    }

    // Fit map to points
    this.map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
  }

  setToday(): void {
    const today = this.formatDate(new Date());
    this.dateFrom = today;
    this.dateTo = today;
    this.loadPoints();
  }

  setWeek(): void {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 7);
    this.dateFrom = this.formatDate(from);
    this.dateTo = this.formatDate(to);
    this.loadPoints();
  }

  setMonth(): void {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    this.dateFrom = this.formatDate(from);
    this.dateTo = this.formatDate(to);
    this.loadPoints();
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
