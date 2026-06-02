import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiResponse,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
} from '../models/api.models';

const TOKEN_KEY = 'geotrail_access_token';
const REFRESH_KEY = 'geotrail_refresh_token';
const USER_KEY = 'geotrail_username';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;

  private _username = signal<string | null>(this.getStoredUsername());
  private _isAuthenticated = signal<boolean>(this.hasValidToken());

  readonly username = this._username.asReadonly();
  readonly isAuthenticated = this._isAuthenticated.asReadonly();

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

  login(request: LoginRequest): Observable<ApiResponse<AuthResponse>> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${this.apiUrl}/login`, request)
      .pipe(
        tap((res) => this.handleAuthSuccess(res.data)),
        catchError((err) => {
          this.clearTokens();
          return throwError(() => err);
        }),
      );
  }

  register(request: RegisterRequest): Observable<ApiResponse<AuthResponse>> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${this.apiUrl}/register`, request)
      .pipe(
        tap((res) => this.handleAuthSuccess(res.data)),
        catchError((err) => throwError(() => err)),
      );
  }

  refreshToken(): Observable<ApiResponse<AuthResponse>> {
    const refreshToken = this.getRefreshToken();
    return this.http
      .post<ApiResponse<AuthResponse>>(`${this.apiUrl}/refresh`, {
        refreshToken,
      })
      .pipe(
        tap((res) => this.handleAuthSuccess(res.data)),
        catchError((err) => {
          this.logout();
          return throwError(() => err);
        }),
      );
  }

  logout(): void {
    this.clearTokens();
    this.router.navigate(['/login']);
  }

  getAccessToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  }

  private handleAuthSuccess(auth: AuthResponse): void {
    localStorage.setItem(TOKEN_KEY, auth.accessToken);
    localStorage.setItem(REFRESH_KEY, auth.refreshToken);
    localStorage.setItem(USER_KEY, auth.username);
    this._username.set(auth.username);
    this._isAuthenticated.set(true);
  }

  private clearTokens(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    this._username.set(null);
    this._isAuthenticated.set(false);
  }

  private hasValidToken(): boolean {
    return !!localStorage.getItem(TOKEN_KEY);
  }

  private getStoredUsername(): string | null {
    return localStorage.getItem(USER_KEY);
  }
}
