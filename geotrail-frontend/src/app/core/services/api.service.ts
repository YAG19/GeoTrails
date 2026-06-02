import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiResponse,
  LocationPoint,
  LocationQueryParams,
  LocationCreateRequest,
  Place,
  PlaceCreateRequest,
  ImportJob,
  DashboardSummary,
  DailyStat,
  ActivityDistance,
  StatsSnapshot,
  HeatmapCenter,
  HeatmapTileItem,
  RagQueryRequest,
  RagQueryResponse,
  RagEmbedRequest,
  RagEmbedResponse,
} from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ==================== RAG / AI Assistant ====================

  getLMSModels(url: string): Observable<any> {
    const cleanUrl = url.endsWith('/') ? url.substring(0, url.length - 1) : url;
    return this.http.get<any>(`${cleanUrl}/v1/models`);
  }

  queryRag(request: RagQueryRequest): Observable<RagQueryResponse> {
    return this.http
      .post<RagQueryResponse>(`${this.baseUrl}/rag/query`, request);
  }

  triggerRagEmbedding(request: RagEmbedRequest): Observable<RagEmbedResponse> {
    return this.http
      .post<RagEmbedResponse>(`${this.baseUrl}/rag/embed`, request);
  }

  // ==================== Locations ====================

  queryLocations(params: LocationQueryParams): Observable<LocationPoint[]> {
    let httpParams = new HttpParams();
    if (params.from) httpParams = httpParams.set('from', params.from);
    if (params.to) httpParams = httpParams.set('to', params.to);
    if (params.minLat != null) httpParams = httpParams.set('minLat', params.minLat.toString());
    if (params.maxLat != null) httpParams = httpParams.set('maxLat', params.maxLat.toString());
    if (params.minLon != null) httpParams = httpParams.set('minLon', params.minLon.toString());
    if (params.maxLon != null) httpParams = httpParams.set('maxLon', params.maxLon.toString());

    return this.http
      .get<ApiResponse<LocationPoint[]>>(`${this.baseUrl}/locations`, { params: httpParams })
      .pipe(map((res) => res.data));
  }

  createLocation(request: LocationCreateRequest): Observable<LocationPoint> {
    return this.http
      .post<ApiResponse<LocationPoint>>(`${this.baseUrl}/locations`, request)
      .pipe(map((res) => res.data));
  }

  getLocationStats(from: string, to: string): Observable<StatsSnapshot> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http
      .get<ApiResponse<StatsSnapshot>>(`${this.baseUrl}/locations/stats`, { params })
      .pipe(map((res) => res.data));
  }

  getHeatmapCenter(): Observable<HeatmapCenter> {
    return this.http
      .get<ApiResponse<HeatmapCenter>>(`${this.baseUrl}/locations/heatmap-center`)
      .pipe(map((res) => res.data));
  }

  getHeatmapTiles(): Observable<HeatmapTileItem[]> {
    return this.http
      .get<ApiResponse<HeatmapTileItem[]>>(`${this.baseUrl}/locations/heatmap-tiles`)
      .pipe(map((res) => res.data));
  }

  
  // ==================== Activity ====================
  getDistinctAtctivity(): Observable<string[]> {
    return this.http
      .get<string[]>(`${this.baseUrl}/locations/activity-type`)
  }

  // ==================== Places ====================

  getPlaces(): Observable<Place[]> {
    return this.http
      .get<ApiResponse<Place[]>>(`${this.baseUrl}/places`)
      .pipe(map((res) => res.data));
  }

  createPlace(request: PlaceCreateRequest): Observable<Place> {
    return this.http
      .post<ApiResponse<Place>>(`${this.baseUrl}/places`, request)
      .pipe(map((res) => res.data));
  }

  updatePlace(id: number, request: Partial<PlaceCreateRequest>): Observable<Place> {
    return this.http
      .put<ApiResponse<Place>>(`${this.baseUrl}/places/${id}`, request)
      .pipe(map((res) => res.data));
  }

  deletePlace(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/places/${id}`);
  }

  // ==================== Import ====================

  importGoogleTimeline(file: File): Observable<ImportJob> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http
      .post<ApiResponse<ImportJob>>(`${this.baseUrl}/imports/google-timeline`, formData)
      .pipe(map((res) => res.data));
  }

  getImportJob(id: number): Observable<ImportJob> {
    return this.http
      .get<ApiResponse<ImportJob>>(`${this.baseUrl}/imports/${id}`)
      .pipe(map((res) => res.data));
  }

  getImportJobs(): Observable<ImportJob[]> {
    return this.http
      .get<ApiResponse<ImportJob[]>>(`${this.baseUrl}/imports`)
      .pipe(map((res) => res.data));
  }

  // ==================== Stats ====================

  getDashboardSummary(from?: string, to?: string, currentYear?: number): Observable<DashboardSummary> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    if (currentYear != null) params = params.set('currentYear', currentYear.toString());

    return this.http
      .get<ApiResponse<DashboardSummary>>(`${this.baseUrl}/stats/dashboard`, { params })
      .pipe(map((res) => res.data));
  }

getDailyStats(from: string, to: string): Observable<DailyStat[]> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http
      .get<ApiResponse<DailyStat[]>>(`${this.baseUrl}/stats/daily`, { params })
      .pipe(map((res) => res.data));
  }

  getActivityDistances(from: string, to: string): Observable<ActivityDistance[]> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http
      .get<ApiResponse<ActivityDistance[]>>(`${this.baseUrl}/stats/activity-distances`, { params })
      .pipe(map((res) => res.data));
  }

  // ==================== Export ====================

  exportGeoJson(from: string, to: string): Observable<Blob> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get(`${this.baseUrl}/export/geojson`, {
      params,
      responseType: 'blob',
    });
  }

  exportGpx(from: string, to: string): Observable<Blob> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get(`${this.baseUrl}/export/gpx`, {
      params,
      responseType: 'blob',
    });
  }
}
