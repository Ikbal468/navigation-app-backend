# Infra setup

## Database
```
docker compose up -d db
$env:DATABASE_URL="postgres://routely:routely@localhost:5432/routely"; npm run start:dev   # in backend/
```
Without `DATABASE_URL` the backend uses SQLite (`routely.sqlite`). Spatial queries use a
bounding box + Haversine on both, so behaviour is identical; PostGIS is enabled for future `ST_DWithin` use.

## Routing (OSRM)
1. Download a region from https://download.geofabrik.de and save as `infra/osrm/region.osm.pbf`.
2. Build the graph (from repo root):
```
docker run --rm -v ${PWD}/infra/osrm:/data osrm/osrm-backend osrm-extract -p /opt/car.lua /data/region.osm.pbf
docker run --rm -v ${PWD}/infra/osrm:/data osrm/osrm-backend osrm-partition /data/region.osrm
docker run --rm -v ${PWD}/infra/osrm:/data osrm/osrm-backend osrm-customize /data/region.osrm
```
3. `docker compose --profile maps up -d osrm`, then run the backend with `OSRM_URL=http://localhost:5000`.

## Vector tiles
Put an OpenMapTiles `.mbtiles` file in `infra/tiles/` (e.g. from https://openmaptiles.org/downloads/),
run `docker compose --profile maps up -d tiles`, and set `tileStyleUrl` in
`frontend/src/environments/environment.ts` to a style served by TileServer GL
(e.g. `http://localhost:8080/styles/basic-preview/style.json`).
