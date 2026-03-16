import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { Place } from '../../core/models/api.models';

@Component({
  selector: 'app-places',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="places-page">
      <div class="page-header">
        <h2 class="page-title">Places</h2>
        <button class="btn-add" (click)="showForm.set(!showForm())">
          {{ showForm() ? 'Cancel' : '+ Add Place' }}
        </button>
      </div>

      @if (showForm()) {
        <div class="place-form">
          <div class="form-row">
            <input type="text" [(ngModel)]="newPlace.name" placeholder="Place name" />
            <input type="text" [(ngModel)]="newPlace.category" placeholder="Category (home, work...)" />
          </div>
          <div class="form-row">
            <input type="number" [(ngModel)]="newPlace.latitude" placeholder="Latitude" step="0.000001" />
            <input type="number" [(ngModel)]="newPlace.longitude" placeholder="Longitude" step="0.000001" />
            <input type="number" [(ngModel)]="newPlace.radiusMeters" placeholder="Radius (m)" />
          </div>
          <button class="btn-save" (click)="createPlace()">Save Place</button>
        </div>
      }

      <div class="places-list">
        @for (place of places(); track place.id) {
          <div class="place-card">
            <div class="place-info">
              <span class="place-name">{{ place.name }}</span>
              @if (place.category) {
                <span class="place-category">{{ place.category }}</span>
              }
              <span class="place-coords">{{ place.latitude.toFixed(4) }}, {{ place.longitude.toFixed(4) }}</span>
            </div>
            <div class="place-actions">
              <span class="place-radius">{{ place.radiusMeters }}m</span>
              <button class="btn-delete" (click)="deletePlace(place.id)">Delete</button>
            </div>
          </div>
        } @empty {
          <p class="empty-msg">No places added yet. Add your home, work, or favorite spots.</p>
        }
      </div>
    </div>
  `,
  styles: [`
    .places-page { padding: 24px; max-width: 800px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .page-title { margin: 0; font-size: 1.5rem; color: var(--text-primary); }
    .btn-add { padding: 8px 20px; background: #4fc3f7; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-weight: 500; }
    .btn-add:hover { background: #29b6f6; }

    .place-form {
      background: var(--bg-card);
      padding: 20px;
      border-radius: 12px;
      margin-bottom: 24px;
      box-shadow: var(--shadow-md);
    }
    .form-row { display: flex; gap: 12px; margin-bottom: 12px; }
    .form-row input {
      flex: 1;
      padding: 10px 14px;
      border: 1px solid var(--border-light);
      border-radius: 8px;
      font-size: 0.9rem;
      background: var(--bg-input);
      color: var(--text-secondary);
    }
    .btn-save { padding: 10px 24px; background: #4caf50; color: #fff; border: none; border-radius: 8px; cursor: pointer; }

    .places-list { display: flex; flex-direction: column; gap: 8px; }
    .place-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--bg-card);
      padding: 16px 20px;
      border-radius: 10px;
      box-shadow: var(--shadow-sm);
    }
    .place-info { display: flex; flex-direction: column; gap: 2px; }
    .place-name { font-weight: 600; color: var(--text-secondary); font-size: 1rem; }
    .place-category { font-size: 0.8rem; color: #4fc3f7; font-weight: 500; text-transform: uppercase; }
    .place-coords { font-size: 0.8rem; color: var(--text-hint); font-family: monospace; }
    .place-actions { display: flex; align-items: center; gap: 12px; }
    .place-radius {
      font-size: 0.85rem;
      color: var(--text-muted);
      background: var(--bg-surface);
      padding: 2px 8px;
      border-radius: 4px;
    }
    .btn-delete { padding: 4px 12px; background: transparent; color: #ef5350; border: 1px solid #ef5350; border-radius: 6px; cursor: pointer; font-size: 0.8rem; }
    .btn-delete:hover { background: var(--danger-bg); }
    .empty-msg { text-align: center; color: var(--text-hint); padding: 40px; }
  `],
})
export class PlacesComponent implements OnInit {
  private apiService = inject(ApiService);

  places = signal<Place[]>([]);
  showForm = signal(false);
  newPlace = { name: '', latitude: 0, longitude: 0, radiusMeters: 100, category: '' };

  ngOnInit(): void {
    this.loadPlaces();
  }

  loadPlaces(): void {
    this.apiService.getPlaces().subscribe({ next: (p) => this.places.set(p) });
  }

  createPlace(): void {
    if (!this.newPlace.name) return;
    this.apiService.createPlace(this.newPlace).subscribe({
      next: () => {
        this.loadPlaces();
        this.showForm.set(false);
        this.newPlace = { name: '', latitude: 0, longitude: 0, radiusMeters: 100, category: '' };
      },
    });
  }

  deletePlace(id: number): void {
    this.apiService.deletePlace(id).subscribe({ next: () => this.loadPlaces() });
  }
}
