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
