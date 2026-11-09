import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'landing',
    loadComponent: () =>
      import('./features/landing/landing.component').then((m) => m.LandingComponent),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'map', pathMatch: 'full' },
      {
        path: 'map',
        loadComponent: () =>
          import('./features/map/map.component').then((m) => m.MapComponent),
      },
      {
        path: 'live',
        loadComponent: () =>
          import('./features/live-tracking/live-tracking.component').then(
            (m) => m.LiveTrackingComponent,
          ),
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
      },
      {
        path: 'import',
        loadComponent: () =>
          import('./features/import/import.component').then(
            (m) => m.ImportComponent,
          ),
      },
      {
        path: 'places',
        loadComponent: () =>
          import('./features/places/places.component').then(
            (m) => m.PlacesComponent,
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.component').then(
            (m) => m.SettingsComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
