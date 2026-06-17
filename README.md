# GeoTrail — Private Location History Platform

A self-hosted alternative to Google Timeline. Track your location history, import Google Takeout data, view trips on a map, and analyze your movement patterns — all on your own infrastructure.

## Features

- **Live GPS Tracking** — OwnTracks-compatible endpoint for real-time phone tracking
- **Google Timeline Import** — Import your full location history from Google Takeout JSON
- **Interactive Map** — View your history on an OpenStreetMap-based map with date filtering
- **Statistics Dashboard** — Distance traveled, places visited, daily/yearly breakdowns
- **Place Management** — Label and categorize your frequent locations
- **Trip Detection** — Automatic trip/visit detection with transport mode classification
- **Data Export** — Export your data as GeoJSON or GPX
- **Self-Hosted** — Docker Compose deployment, runs anywhere

## Tech Stack

| Layer     | Technology                                                    |
|-----------|---------------------------------------------------------------|
| Backend   | Java 21, Spring Boot 3.3, Spring Security (JWT), Hibernate Spatial |
| Database  | PostgreSQL 16 + PostGIS 3.4                                   |
| Cache     | Redis 7                                                       |
| Storage   | MinIO (S3-compatible)                                         |
| Frontend  | Angular 18, Leaflet, Chart.js                                 |
| Infra     | Docker Compose, Traefik (reverse proxy)                       |

## Quick Start (Local Development)

### Prerequisites
- Docker & Docker Compose
- Java 21 (for IDE development)
- Node.js 20+ (for Angular frontend)

### 1. Clone and configure
```bash
git clone https://github.com/yourusername/geotrail.git
cd geotrail
cp .env.example .env
# Edit .env with your secrets
```

### 2. Start infrastructure
```bash
docker compose up -d postgres redis minio
```

### 3. Run backend
```bash
cd geotrail-backend
./mvnw spring-boot:run
```
Backend starts at http://localhost:8080/api
Swagger UI at http://localhost:8080/api/swagger-ui.html

### 4. Run frontend
```bash
cd geotrail-frontend
npm install
ng serve
```
Frontend starts at http://localhost:3000

## Production Deployment

### Full Docker Compose
```bash
docker compose up -d
```
Frontend starts at http://localhost:4000 (Grafana at http://localhost:3000)

### Deploy to Oracle Cloud (Always-Free)
See [docs/deploy-oracle-cloud.md](docs/deploy-oracle-cloud.md) for step-by-step guide.

## Phone Setup (OwnTracks)

1. Install OwnTracks on your phone ([Android](https://play.google.com/store/apps/details?id=org.owntracks.android) / [iOS](https://apps.apple.com/app/owntracks/id692424691))
2. Set mode to **HTTP**
3. Set URL to `https://your-domain.com/api/owntracks`
4. Set username/password (same as your GeoTrail account)
5. Done — location points stream in real-time

## API Documentation

With the backend running, visit:
- Swagger UI: http://localhost:8080/api/swagger-ui.html
- OpenAPI JSON: http://localhost:8080/api/api-docs

## Project Structure

```
geotrail/
├── geotrail-backend/          # Spring Boot API
│   ├── src/main/java/com/geotrail/
│   │   ├── auth/              # JWT authentication
│   │   ├── location/          # Core location CRUD + spatial queries
│   │   ├── tracking/          # OwnTracks + WebSocket live tracking
│   │   ├── imports/           # Google Timeline JSON import engine
│   │   ├── places/            # Named places management
│   │   ├── trips/             # Trip & visit detection
│   │   ├── stats/             # Analytics + nightly stats scheduler
│   │   ├── export/            # GeoJSON / GPX export
│   │   ├── config/            # Security, Redis, WebSocket, MinIO config
│   │   └── common/            # Shared DTOs, exceptions, utilities
│   └── src/main/resources/
│       └── db/migration/      # Flyway SQL migrations
├── geotrail-frontend/         # Angular 18 SPA
├── docker-compose.yml
└── .env.example
```

## License

MIT
