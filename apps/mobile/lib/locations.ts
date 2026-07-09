/**
 * Local airport typeahead search — the mobile twin of web's
 * `api.locations.search` (apps/web/src/lib/api.ts). Filters the static
 * OurAirports dataset with the same relevance scoring so the From/To
 * autocomplete ranks results identically on both surfaces.
 */
import { airports, type Airport } from './airports-data';

export interface LocationResult {
  code: string;
  name: string;
  city: string;
  country: string;
  type: 'AIRPORT';
}

const MAX_RESULTS = 8;

export function searchAirports(query: string): LocationResult[] {
  if (query.length < 2) {
    return [];
  }

  const normalizedQuery = query.toLowerCase();
  const scored: { airport: Airport; score: number }[] = [];

  for (const airport of airports) {
    const code = airport.code.toLowerCase();
    const name = airport.name.toLowerCase();
    const city = airport.city?.toLowerCase() ?? '';

    // Exact code match (highest priority)
    if (code === normalizedQuery) {
      scored.push({ airport, score: 0 });
    // Code starts with query
    } else if (code.startsWith(normalizedQuery)) {
      scored.push({ airport, score: 1 });
    // City exact match
    } else if (city === normalizedQuery) {
      scored.push({ airport, score: 2 });
    // City starts with query
    } else if (city.startsWith(normalizedQuery)) {
      scored.push({ airport, score: 3 });
    // City contains query
    } else if (city.includes(normalizedQuery)) {
      scored.push({ airport, score: 4 });
    // Airport name starts with query
    } else if (name.startsWith(normalizedQuery)) {
      scored.push({ airport, score: 5 });
    // Airport name contains query
    } else if (name.includes(normalizedQuery)) {
      scored.push({ airport, score: 6 });
    }
  }

  scored.sort((a, b) => a.score - b.score);

  return scored.slice(0, MAX_RESULTS).map(({ airport }) => ({
    code: airport.code,
    name: airport.name,
    city: airport.city || '',
    country: airport.country,
    type: 'AIRPORT' as const,
  }));
}
