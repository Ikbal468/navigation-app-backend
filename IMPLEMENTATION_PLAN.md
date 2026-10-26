# Routely System — Implementation Status & Architecture

> **Current Database Engine**: TypeORM with SQLite (`better-sqlite3`). Multi-engine support ready via `DATABASE_URL` environment variable to instantly switch to PostgreSQL + PostGIS.

---

## 1. System Architecture Overview

```
       [ Ionic + Angular Standalone Mobile Client ]
         ├── MapLibre GL JS (Vector / Raster Map Canvas)
         ├── Capacitor Geolocation (Native GPS watcher & heading rotation)
         ├── Socket.IO Client (Real-time live incident alerts)
         └── Offline Route Caching (Local persistent fallback)
                        │
                        ▼ (HTTP / WebSocket)
             [ NestJS API Gateway ]
         ├── TypeORM Module (Dual Engine: SQLite / PostgreSQL)
         ├── PlacesModule (CRUD for user saved locations)
         ├── ReportsModule (Incident ingestion, Bounding Box + Haversine nearby query)
         ├── Decay Engine (@nestjs/schedule cron auto-expiration)
         ├── Routing Proxy (OSRM integration with turn-by-turn maneuvers & cache)
         └── TrafficGateway (Socket.IO geohash grid rooms & telemetry batching)
                        │
                        ▼
      [ Database: SQLite or PostgreSQL + PostGIS ]
         ├── reports (id, type, description, lat, lng, geohash, votes, isActive)
         ├── report_votes (reportId, deviceId, up)
         ├── speed_logs (geohash, lat, lng, speed, heading, timestamp)
         └── saved_places (id, deviceId, label, lat, lng)
```

---

## 2. Implementation Status Checklist

### Phase 1: Database & TypeORM Setup
- [x] Backend dependencies installed (`@nestjs/typeorm`, `typeorm`, `better-sqlite3`, `pg`, `class-validator`, `ngeohash`).
- [x] Entities defined with portable data types:
  - [x] `Report` (`report.entity.ts`)
  - [x] `ReportVote` (`vote.entity.ts`)
  - [x] `SpeedLog` (`speed-log.entity.ts`)
  - [x] `SavedPlace` (`saved-place.entity.ts`)
- [x] SQLite spatial workaround: Bounding box pre-filter + Haversine SQL formula.
- [x] Dynamic database switch: SQLite by default; switches to PostgreSQL automatically when `DATABASE_URL` is set.

### Phase 2: NestJS Core Modules & WebSockets
- [x] `ReportsModule`:
  - [x] `POST /api/v1/reports` (Create report + broadcast to geohash room)
  - [x] `GET /api/v1/reports/nearby` (Proximity search with radius)
  - [x] `POST /api/v1/reports/:id/verify` (Crowd upvoting/downvoting + auto-expire on net negative)
- [x] `PlacesModule`:
  - [x] `GET /api/v1/places?deviceId=...`
  - [x] `POST /api/v1/places`
  - [x] `DELETE /api/v1/places/:id?deviceId=...`
- [x] `RoutesController`:
  - [x] `GET /api/v1/routes` (OSRM proxy with turn-by-turn maneuver extraction & 60s memory cache)
- [x] `TrafficGateway`:
  - [x] Socket.IO `/traffic` namespace with geohash-5 cell clustering.
  - [x] Real-time vehicle position & speed telemetry ingestion.
- [x] `SpeedService`:
  - [x] In-memory buffered queue flushing to database every 10 seconds.
  - [x] Rolling speed average endpoint (`GET /api/v1/traffic/cell/:geohash`).
  - [x] Background speed prune interval.
- [x] `Decay Engine`:
  - [x] `@nestjs/schedule` cron running every 5 minutes (auto-expires reports >2h or downvotes > upvotes + 3).

### Phase 3: Ionic + Angular Mobile Client
- [x] MapLibre GL integration with map container and marker layers.
- [x] Native Geolocation tracking via `@capacitor/geolocation`.
- [x] Vehicle puck with directional orientation & camera follow mode.
- [x] Turn-by-turn navigation overlay with maneuver instructions banner and distance/ETA cards.
- [x] Incident reporting bottom sheet (Police, Hazard, Accident, Closure, Traffic).
- [x] Real-time incident updates via Socket.IO.
- [x] Offline route fallback caching.

### Phase 4: Production Infrastructure & Native Platforms
- [x] `docker-compose.yml` configured:
  - PostGIS (`postgis/postgis:16-3.4`)
  - OSRM Backend container (`osrm/osrm-backend`)
  - TileServer GL container (`maptiler/tileserver-gl`)
- [x] `infra/init-postgis.sql` extension script.
- [x] `infra/README.md` step-by-step documentation for regional `.osm.pbf` extraction and vector tiles.
- [x] Capacitor Native projects added and synchronized:
  - [x] `frontend/android/`
  - [x] `frontend/ios/`

---

## 3. How to Run

### Development Mode (Local SQLite)
1. **Backend**:
   ```powershell
   cd backend
   npm run start:dev
   ```
2. **Frontend**:
   ```powershell
   cd frontend
   ionic serve
   ```

### Production Docker Mode (PostgreSQL + PostGIS)
```powershell
# 1. Start PostGIS container
docker compose up -d db

# 2. Run backend pointing to PostGIS
$env:DATABASE_URL="postgres://routely:routely@localhost:5432/routely"
cd backend
npm run start:dev
```
