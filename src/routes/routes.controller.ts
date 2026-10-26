import { BadRequestException, Controller, Get, Header, Query } from '@nestjs/common';

const ROUTING_SERVERS = [
  'https://routing.openstreetmap.de/routed-car',
  process.env.OSRM_URL ?? 'https://router.project-osrm.org',
];
const cache = new Map<string, { at: number; data: unknown }>();
const searchCache = new Map<string, { at: number; data: any[] }>();
const TTL = 60_000;

interface OsrmStep {
  distance: number;
  duration: number;
  name: string;
  maneuver: { type: string; modifier?: string; location: [number, number] };
}

function instruction(s: OsrmStep) {
  const { type, modifier } = s.maneuver;
  const road = s.name ? ` onto ${s.name}` : '';
  if (type === 'depart') return `Head out${s.name ? ' on ' + s.name : ''}`;
  if (type === 'arrive') return 'You have arrived';
  if (type === 'roundabout' || type === 'rotary') return `Enter the roundabout${road}`;
  if (modifier === 'straight') return `Continue straight${s.name ? ' on ' + s.name : ''}`;
  return `Turn ${modifier ?? 'ahead'}${road}`;
}

@Controller('api/v1')
export class RoutesController {
  @Get('routes')
  @Header('Cache-Control', 'public, max-age=60')
  async route(
    @Query('startLng') sLng: string,
    @Query('startLat') sLat: string,
    @Query('destLng') dLng: string,
    @Query('destLat') dLat: string,
  ) {
    const nums = [sLng, sLat, dLng, dLat].map(Number);
    if (nums.some((n) => !Number.isFinite(n))) throw new BadRequestException('Invalid coordinates');
    const key = nums.map((n) => n.toFixed(4)).join(',');
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL) return hit.data;

    let json: any = null;
    let lastError: any = null;

    // Try primary high-speed OSM routing mirror first, then fallback to public OSRM
    for (const server of ROUTING_SERVERS) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const url = `${server}/route/v1/driving/${nums[0]},${nums[1]};${nums[2]},${nums[3]}?overview=full&geometries=geojson&steps=true&alternatives=3`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
          const body = (await res.json()) as any;
          if (body?.routes && body.routes.length > 0) {
            json = body;
            break;
          }
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (!json || !json.routes || json.routes.length === 0) {
      throw new BadRequestException('Routing engine error or timeout: ' + (lastError?.message || 'No route found'));
    }

    const formatRoute = (r: any, index: number) => ({
      index,
      distance: r.distance,
      duration: r.duration,
      geometry: r.geometry,
      summary: r.legs[0]?.steps.find((s: OsrmStep) => s.name && s.distance > 2000)?.name || `Route ${index + 1}`,
      steps: r.legs.flatMap((l: { steps: OsrmStep[] }) =>
        l.steps.map((s: OsrmStep) => ({
          instruction: instruction(s),
          distance: s.distance,
          duration: s.duration,
          name: s.name,
          maneuver: s.maneuver.type,
          modifier: s.maneuver.modifier ?? null,
          location: s.maneuver.location,
        })),
      ),
    });

    const primary = formatRoute(json.routes[0], 0);
    const alternatives = json.routes.slice(1).map((r: any, i: number) => formatRoute(r, i + 1));

    const data = {
      ...primary,
      routes: [primary, ...alternatives],
    };

    cache.set(key, { at: Date.now(), data });
    return data;
  }

  @Get('search')
  async search(
    @Query('q') query: string,
    @Query('lat') userLat?: string,
    @Query('lng') userLng?: string,
  ) {
    if (!query || query.trim().length < 2) return [];
    const trimmed = query.trim();

    // 1. In-memory cache for ultra-fast instant suggestion
    const cacheKey = `${trimmed.toLowerCase()}_${userLat || ''}_${userLng || ''}`;
    if (searchCache.has(cacheKey)) {
      const cached = searchCache.get(cacheKey)!;
      if (Date.now() - cached.at < 600000) { // 10 min cache
        return cached.data;
      }
    }

    const results: { name: string; lat: number; lng: number; type?: string; classType?: string }[] = [];
    const seen = new Set<string>();

    const addUnique = (name: string, lat: number, lng: number, type?: string, classType?: string) => {
      const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
      if (!seen.has(key) && name) {
        seen.add(key);
        results.push({ name, lat, lng, type, classType });
      }
    };

    // Rank helper: cities, towns, villages, places of worship, tourism, amenities get priority over broad jungle administrative polygons
    const calculatePriority = (type?: string, classType?: string, name?: string): number => {
      const t = (type || '').toLowerCase();
      const c = (classType || '').toLowerCase();
      const n = (name || '').toLowerCase();

      // Highest priority: specific points of interest matching query
      if (t === 'city' || t === 'town') return 100;
      if (t === 'village' || t === 'suburb' || t === 'neighbourhood') return 90;
      if (c === 'amenity' || c === 'place_of_worship' || c === 'tourism' || c === 'building' || c === 'shop') return 80;
      if (t === 'commercial' || t === 'residential') return 70;
      // Lower priority: administrative districts/boundaries that often point to uninhabited wilderness centroids
      if (t === 'administrative' || c === 'boundary') return 10;
      return 50;
    };

    // 1. Fast Primary: Nominatim with city/POI prioritization
    try {
      let nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        trimmed,
      )}&limit=10&addressdetails=1&countrycodes=my`;
      if (userLat && userLng) {
        nomUrl += `&viewbox=${parseFloat(userLng)-2},${parseFloat(userLat)+2},${parseFloat(userLng)+2},${parseFloat(userLat)-2}`;
      }
      const nomRes = await fetch(nomUrl, {
        headers: {
          'User-Agent': 'RoutelyNavigationApp/1.0',
          'Accept-Language': 'en,ms',
        },
      });
      if (nomRes.ok) {
        const items = (await nomRes.json()) as any[];
        for (const item of items) {
          addUnique(
            item.display_name,
            parseFloat(item.lat),
            parseFloat(item.lon),
            item.type,
            item.class,
          );
        }
      }
    } catch {
      // Fallback
    }

    // 2. Secondary fallback: Photon (with fast 2s timeout) if fewer than 3 results
    if (results.length < 3) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        let photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=7`;
        if (userLat && userLng) {
          photonUrl += `&lat=${userLat}&lon=${userLng}`;
        }
        const photonRes = await fetch(photonUrl, { signal: controller.signal });
        clearTimeout(timeout);
        if (photonRes.ok) {
          const pData = (await photonRes.json()) as any;
          if (pData?.features && Array.isArray(pData.features)) {
            for (const f of pData.features) {
              const props = f.properties || {};
              const coords = f.geometry?.coordinates;
              if (coords && coords.length >= 2) {
                const parts = [
                  props.name,
                  props.street,
                  props.district || props.locality,
                  props.city,
                  props.state,
                ].filter(Boolean);
                const label = parts.length > 0 ? parts.join(', ') : props.name || 'Location';
                addUnique(label, coords[1], coords[0], props.osm_value || props.type, props.osm_key);
              }
            }
          }
        }
      } catch {
        // Photon failed or timed out
      }
    }

    // Sort results by priority score descending
    results.sort((a, b) => {
      const scoreA = calculatePriority(a.type, (a as any).classType, a.name);
      const scoreB = calculatePriority(b.type, (b as any).classType, b.name);
      return scoreB - scoreA;
    });

    const finalResults = results.slice(0, 8);
    searchCache.set(cacheKey, { at: Date.now(), data: finalResults });
    return finalResults;
  }
}

