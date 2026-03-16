import { Component, OnInit, OnDestroy, inject, signal, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { Subscription } from 'rxjs';
import { WebSocketService } from '../../core/services/websocket.service';
import { LocationPoint } from '../../core/models/api.models';

@Component({
  selector: 'app-live-tracking',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="live-page">
      <div class="live-header">
        <h2>Live Tracking</h2>
        <div class="status-badge" [class.connected]="connected()">
          {{ connected() ? 'Connected' : 'Disconnected' }}
        </div>
        @if (!connected()) {
          <button class="btn-connect" (click)="connect()">Connect</button>
        } @else {
          <button class="btn-disconnect" (click)="disconnect()">Disconnect</button>
        }
      </div>

      @if (lastPoint()) {
        <div class="last-point-info">
          <span>Last: {{ lastPoint()!.latitude.toFixed(6) }}, {{ lastPoint()!.longitude.toFixed(6) }}</span>
          <span>{{ lastPoint()!.recordedAt | date:'medium' }}</span>
          @if (lastPoint()!.batteryLevel) {
            <span>🔋 {{ lastPoint()!.batteryLevel }}%</span>
          }
        </div>
      }

      <div id="live-map" class="map-container"></div>
    </div>
  `,
  styles: [`
    .live-page { height: 100%; display: flex; flex-direction: column; }
    .live-header {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 20px;
      background: var(--bg-card);
      border-bottom: 1px solid var(--border-color);
    }
    .live-header h2 { margin: 0; font-size: 1.2rem; color: var(--text-primary); }
    .status-badge {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 600;
      background: var(--danger-bg);
      color: var(--danger-text);
    }
    .status-badge.connected { background: var(--success-bg); color: var(--success-text); }
    .btn-connect { padding: 6px 16px; background: #4fc3f7; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
    .btn-disconnect { padding: 6px 16px; background: #ef5350; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
    .last-point-info {
      display: flex;
      gap: 16px;
      padding: 8px 20px;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-subtle);
      font-size: 0.85rem;
      color: var(--text-muted);
    }
    .map-container { flex: 1; min-height: 0; }
  `],
})
export class LiveTrackingComponent implements AfterViewInit, OnDestroy {
  private wsService = inject(WebSocketService);
  private map!: L.Map;
  private currentMarker: L.Marker | null = null;
  private trailLine: L.Polyline | null = null;
  private trailPoints: L.LatLngExpression[] = [];
  private sub?: Subscription;

  connected = signal(false);
  lastPoint = signal<LocationPoint | null>(null);

  ngAfterViewInit(): void {
    this.map = L.map('live-map', { center: [20, 0], zoom: 3 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.map);

    this.trailLine = L.polyline([], { color: '#4caf50', weight: 3, opacity: 0.8 }).addTo(this.map);
  }

  connect(): void {
    // TODO: Get actual userId from auth context
    this.wsService.connect(1);

    this.wsService.connected$.subscribe((c) => this.connected.set(c));

    this.sub = this.wsService.livePoints$.subscribe((point) => {
      this.lastPoint.set(point);
      this.updateMap(point);
    });
  }

  disconnect(): void {
    this.wsService.disconnect();
    this.sub?.unsubscribe();
  }

  private updateMap(point: LocationPoint): void {
    const latLng: L.LatLngExpression = [point.latitude, point.longitude];

    // Update or create marker
    if (this.currentMarker) {
      this.currentMarker.setLatLng(latLng);
    } else {
      this.currentMarker = L.marker(latLng, {
        icon: L.divIcon({
          className: 'live-marker',
          html: '<div style="width:16px;height:16px;background:#4caf50;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
      }).addTo(this.map);
    }

    // Extend trail
    this.trailPoints.push(latLng);
    this.trailLine?.setLatLngs(this.trailPoints);

    // Pan to new position
    this.map.panTo(latLng, { animate: true, duration: 0.5 });
    if (this.map.getZoom() < 15) {
      this.map.setZoom(15);
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.map?.remove();
  }
}
