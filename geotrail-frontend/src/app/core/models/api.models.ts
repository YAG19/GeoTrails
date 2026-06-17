// ==================== API Response Wrapper ====================
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  errors?: Record<string, string>;
  timestamp: string;
}

// ==================== Auth ====================
export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  username: string;
}

// ==================== Location ====================
export interface LocationPoint {
  id: number;
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  batteryLevel?: number;
  velocity?: number;
  recordedAt: string;
  source: string;
  createdAt: string;
  activityType?: string;
}

export interface LocationCreateRequest {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  batteryLevel?: number;
  velocity?: number;
  recordedAt?: string;
  source?: string;
}

export interface LocationQueryParams {
  from?: string;
  to?: string;
  minLat?: number;
  maxLat?: number;
  minLon?: number;
  maxLon?: number;
  page?: number;
  size?: number;
}

export interface StatsSnapshot {
  totalPoints: number;
  totalDistanceMeters: number;
  earliestPoint?: string;
  latestPoint?: string;
}

export interface HeatmapCenter {
  latitude: number | null;
  longitude: number | null;
  pointCount: number;
}

export interface HeatmapTileItem {
  lat: number;
  lng: number;
  pointCount: number;
}

// ==================== Places ====================
export interface Place {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  category?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlaceCreateRequest {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  category?: string;
}

// ==================== Import ====================
export interface ImportJob {
  id: number;
  filename: string;
  fileSizeBytes: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  totalRecords?: number;
  processed: number;
  duplicates: number;
  errors: number;
  progressPercent: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

// ==================== Stats ====================
export interface DashboardSummary {
  totalPointsAllTime: number;
  distanceLast30DaysM: number;
  distanceLast30DaysKm: number;
  pointsLast30Days: number;
  distanceThisYearM: number;
  distanceThisYearKm: number;
}

export interface DailyStat {
  statDate: string;
  totalDistanceM: number;
  totalDistanceKm: number;
  totalPoints: number;
  citiesVisited: number;
  countriesVisited: number;
  timeAtHomeMin: number;
  timeInTransitMin: number;
}

export interface ActivityDistance {
  activityType: string;
  totalDistanceM: number;
}

// ==================== Timeline (semantic segments / playback / insights) ====================
export interface TimelineSegment {
  id?: number;           // user_activity id for ACTIVITY (correctable); absent for VISIT
  kind: 'VISIT' | 'ACTIVITY';
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  type?: string;         // effective activity_type (ACTIVITY) or semantic_type (VISIT)
  originalType?: string; // Google's original value when corrected
  corrected: boolean;
  startLat?: number;
  startLng?: number;
  endLat?: number;
  endLng?: number;
  distanceMeters?: number;
  probability?: number;
  googlePlaceId?: string;
}

export interface TimelinePathPoint {
  lat: number;
  lng: number;
  recordedAt: string;
  activityType?: string;
}

export interface DayTimeline {
  date: string;
  segments: TimelineSegment[];
  path: TimelinePathPoint[];
}

export interface TransportMode {
  mode: string;
  distanceMeters: number;
  totalMinutes: number;
  count: number;
}

export interface CommuteTrip {
  originLat?: number;
  originLng?: number;
  destLat?: number;
  destLng?: number;
  originPlaceId?: string;
  destPlaceId?: string;
  tripCount?: number;
  typicalMode?: string;
  distanceMeters?: number;
}

export interface DwellStat {
  semanticType: string;
  totalMinutes: number;
  visits: number;
}

export interface LabelSuggestion {
  lat: number;
  lng: number;
  suggestedName: string;
  category?: string;
  areaName?: string;
  visitCount: number;
  totalMinutes: number;
  reasoning?: string;
}

export interface Anomaly {
  date: string;
  type: 'LONG_TRIP' | 'LATE_NIGHT' | 'BUSY_DAY' | 'HIGH_DISTANCE' | string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | string;
}

// ==================== RAG ====================
export interface RagQueryRequest {
  question: string;
  model?: string;
  temperature?: number;
}

export interface RagQueryResponse {
  answer: string;
  sources: string[];
}

export interface NarrativeRequest {
  from: string;
  to: string;
}

export interface NarrativeResponse {
  narrative: string;
}

export interface RagEmbedRequest {
  since?: string;
}

export interface RagEmbedResponse {
  processed: number;
  skipped: number;
  failed: number;
  elapsedSeconds: number;
}

/** A single progress notification streamed from POST /rag/embed/stream over SSE. */
export interface RagEmbedEvent {
  phase: 'started' | 'progress' | 'complete';
  processed: number;
  skipped: number;
  failed: number;
  total: number;
  /** The requested start date (null = full history), echoed back for correlation. */
  since: string | null;
  elapsedSeconds: number;
}
