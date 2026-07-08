import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { searchAirports } from '../locations';

describe('searchAirports', () => {
  it('returns nothing for queries under 2 characters', () => {
    assert.deepEqual(searchAirports(''), []);
    assert.deepEqual(searchAirports('s'), []);
  });

  it('ranks an exact code match first, case-insensitively', () => {
    const results = searchAirports('sea');
    assert.ok(results.length > 0);
    assert.equal(results[0].code, 'SEA');
    assert.equal(results[0].type, 'AIRPORT');
  });

  it('finds airports by city name', () => {
    const results = searchAirports('seattle');
    assert.ok(results.some((r) => r.code === 'SEA'));
  });

  it('finds airports by airport name', () => {
    const results = searchAirports('heathrow');
    assert.ok(results.some((r) => r.code === 'LHR'));
  });

  it('caps results at 8', () => {
    // Broad two-letter prefix matches far more than 8 airports.
    assert.equal(searchAirports('sa').length, 8);
  });

  it('prefers code prefix matches over name substring matches', () => {
    const results = searchAirports('og');
    const codes = results.map((r) => r.code);
    assert.ok(codes.includes('OGG'));
    // Every code starting with the query outranks name-only matches.
    const prefixCount = codes.filter((c) => c.toLowerCase().startsWith('og')).length;
    assert.deepEqual(codes.slice(0, prefixCount), codes.slice(0, prefixCount).filter((c) => c.toLowerCase().startsWith('og')));
  });

  it('normalizes null cities to empty strings', () => {
    const results = searchAirports('sfo');
    for (const r of results) {
      assert.equal(typeof r.city, 'string');
      assert.equal(typeof r.country, 'string');
    }
  });
});
