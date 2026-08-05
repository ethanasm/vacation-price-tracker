import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_DATE_DAYS_OUT,
  addDaysIso,
  adjustReturnDate,
  describeHotelOccupancy,
  diffDaysIso,
  formatDisplayDate,
  hasNoErrors,
  hotelOccupancy,
  isoDate,
  monthGrid,
  monthInRange,
  monthLabel,
  parseIsoDate,
  sanitizeDecimal,
  shiftMonth,
  suggestTripName,
  todayIso,
  validateTripForm,
  validateTripFormFields,
  type TripFormValues,
} from '../trip-form';

describe('date helpers', () => {
  it('isoDate formats local dates zero-padded', () => {
    assert.equal(isoDate(new Date(2026, 7, 22)), '2026-08-22');
    assert.equal(isoDate(new Date(2026, 0, 5)), '2026-01-05');
  });

  it('parseIsoDate round-trips valid dates at local midnight', () => {
    const parsed = parseIsoDate('2026-08-22');
    assert.ok(parsed);
    assert.equal(isoDate(parsed), '2026-08-22');
    assert.equal(parsed.getHours(), 0);
  });

  it('parseIsoDate rejects malformed and impossible dates', () => {
    assert.equal(parseIsoDate(''), null);
    assert.equal(parseIsoDate('08/22/2026'), null);
    assert.equal(parseIsoDate('2026-8-22'), null);
    assert.equal(parseIsoDate('2026-02-30'), null);
    assert.equal(parseIsoDate('2026-13-01'), null);
  });

  it('addDaysIso adds days across month and year boundaries', () => {
    assert.equal(addDaysIso('2026-08-30', 3), '2026-09-02');
    assert.equal(addDaysIso('2026-12-31', 1), '2027-01-01');
    assert.equal(addDaysIso('2026-03-01', -1), '2026-02-28');
    // Malformed input passes through untouched.
    assert.equal(addDaysIso('nope', 5), 'nope');
  });

  it('todayIso matches isoDate(now)', () => {
    assert.equal(todayIso(), isoDate(new Date()));
  });

  it('formatDisplayDate renders a short month form', () => {
    assert.equal(formatDisplayDate('2026-08-22'), 'Aug 22, 2026');
    assert.equal(formatDisplayDate('2026-01-05'), 'Jan 5, 2026');
    assert.equal(formatDisplayDate('garbage'), 'garbage');
  });

  it('monthLabel names the 0-based month', () => {
    assert.equal(monthLabel(2026, 7), 'August 2026');
    assert.equal(monthLabel(2027, 0), 'January 2027');
  });
});

describe('monthGrid', () => {
  it('aligns the first day to its weekday and pads to whole weeks', () => {
    // August 2026 starts on a Saturday (weekday 6) and has 31 days.
    const grid = monthGrid(2026, 7);
    assert.equal(grid.length % 7, 0);
    assert.deepEqual(grid.slice(0, 7), [null, null, null, null, null, null, 1]);
    assert.equal(grid.filter((d) => d !== null).length, 31);
    assert.equal(grid[grid.length - 1 - grid.slice().reverse().findIndex((d) => d !== null)], 31);
  });

  it('handles February in a non-leap year', () => {
    const grid = monthGrid(2026, 1);
    assert.equal(grid.filter((d) => d !== null).length, 28);
  });
});

describe('shiftMonth / monthInRange', () => {
  it('shiftMonth steps across year boundaries in both directions', () => {
    assert.deepEqual(shiftMonth(2026, 11, 1), { year: 2027, month: 0 });
    assert.deepEqual(shiftMonth(2026, 0, -1), { year: 2025, month: 11 });
    assert.deepEqual(shiftMonth(2026, 5, 14), { year: 2027, month: 7 });
  });

  it('monthInRange is true only when the month overlaps [min, max]', () => {
    assert.equal(monthInRange(2026, 7, '2026-08-15', '2026-09-10'), true);
    assert.equal(monthInRange(2026, 8, '2026-08-15', '2026-09-10'), true);
    assert.equal(monthInRange(2026, 6, '2026-08-15', '2026-09-10'), false);
    assert.equal(monthInRange(2026, 9, '2026-08-15', '2026-09-10'), false);
  });
});

describe('sanitizeDecimal', () => {
  it('strips non-numeric characters and extra dots', () => {
    assert.equal(sanitizeDecimal('800'), '800');
    assert.equal(sanitizeDecimal('1,250.50'), '1250.50');
    assert.equal(sanitizeDecimal('12.3.4'), '12.34');
    assert.equal(sanitizeDecimal('abc'), '');
    assert.equal(sanitizeDecimal('-42'), '42');
  });
});

describe('validateTripForm', () => {
  const today = todayIso();
  const valid: TripFormValues = {
    name: 'Summer in Bend',
    origin: 'SFO',
    destination: 'RDM',
    isRoundTrip: true,
    departDate: addDaysIso(today, 10),
    returnDate: addDaysIso(today, 15),
    flightEnabled: true,
    hotelEnabled: true,
    hotelCity: 'Bend',
  };

  it('accepts a valid round-trip form', () => {
    assert.equal(validateTripForm(valid, today), null);
  });

  it('accepts a one-way form and ignores the stale return date', () => {
    const values = { ...valid, isRoundTrip: false, returnDate: '' };
    assert.equal(validateTripForm(values, today), null);
    // A leftover return date before departure is irrelevant once one-way.
    assert.equal(validateTripForm({ ...values, returnDate: addDaysIso(today, 2) }, today), null);
  });

  it('requires a name of at most 100 characters', () => {
    assert.match(validateTripForm({ ...valid, name: '  ' }, today) ?? '', /name is required/i);
    assert.match(validateTripForm({ ...valid, name: 'x'.repeat(101) }, today) ?? '', /100 characters/);
  });

  it('requires 3-letter IATA codes, normalizing case and whitespace', () => {
    assert.match(validateTripForm({ ...valid, origin: 'SF' }, today) ?? '', /origin airport/);
    assert.match(validateTripForm({ ...valid, destination: 'Redmond' }, today) ?? '', /destination airport/);
    assert.equal(validateTripForm({ ...valid, origin: ' sfo ' }, today), null);
  });

  it('bounds the departure date to [min, today + 359]', () => {
    assert.match(validateTripForm({ ...valid, departDate: '' }, today) ?? '', /Departure date is required/);
    assert.match(
      validateTripForm({ ...valid, departDate: addDaysIso(today, -1) }, today) ?? '',
      /cannot be in the past/,
    );
    assert.match(
      validateTripForm({ ...valid, isRoundTrip: false, departDate: addDaysIso(today, MAX_DATE_DAYS_OUT + 1) }, today) ?? '',
      /more than 359 days/,
    );
  });

  it('lets the edit form keep an already-departed date via minDepartIso', () => {
    const past = addDaysIso(today, -30);
    const values = { ...valid, isRoundTrip: false, departDate: past };
    assert.match(validateTripForm(values, today) ?? '', /cannot be in the past/);
    assert.equal(validateTripForm(values, past), null);
  });

  it('requires a return date strictly after departure for round trips', () => {
    assert.match(validateTripForm({ ...valid, returnDate: '' }, today) ?? '', /Return date is required/);
    assert.match(
      validateTripForm({ ...valid, returnDate: valid.departDate }, today) ?? '',
      /after departure/,
    );
    assert.match(
      validateTripForm({ ...valid, returnDate: addDaysIso(today, MAX_DATE_DAYS_OUT + 1) }, today) ?? '',
      /more than 359 days/,
    );
  });

  it('requires at least one tracking target and a hotel city when tracking hotels', () => {
    assert.match(
      validateTripForm({ ...valid, flightEnabled: false, hotelEnabled: false }, today) ?? '',
      /at least flights or hotels/,
    );
    assert.match(validateTripForm({ ...valid, hotelCity: ' ' }, today) ?? '', /Hotel city is required/);
    assert.match(
      validateTripForm({ ...valid, hotelCity: 'x'.repeat(201) }, today) ?? '',
      /200 characters/,
    );
    assert.equal(validateTripForm({ ...valid, hotelEnabled: false, hotelCity: '' }, today), null);
  });
});

describe('validateTripFormFields', () => {
  const today = todayIso();
  const valid: TripFormValues = {
    name: 'Summer in Bend',
    origin: 'SFO',
    destination: 'RDM',
    isRoundTrip: true,
    departDate: addDaysIso(today, 10),
    returnDate: addDaysIso(today, 15),
    flightEnabled: true,
    hotelEnabled: true,
    hotelCity: 'Bend',
  };

  it('returns an empty map for a valid form', () => {
    const errors = validateTripFormFields(valid, today);
    assert.equal(hasNoErrors(errors), true);
    assert.deepEqual(errors, {});
  });

  it('flags every invalid field at once', () => {
    const errors = validateTripFormFields(
      { ...valid, name: '', origin: '', destination: '', departDate: '', returnDate: '', hotelCity: '' },
      today,
    );
    assert.equal(hasNoErrors(errors), false);
    assert.match(errors.name ?? '', /required/i);
    assert.match(errors.origin ?? '', /origin airport/);
    assert.match(errors.destination ?? '', /destination airport/);
    assert.match(errors.departDate ?? '', /required/i);
    assert.match(errors.returnDate ?? '', /required/i);
    assert.match(errors.hotelCity ?? '', /required/i);
  });

  it('skips the after-departure return check while the departure itself is invalid', () => {
    const errors = validateTripFormFields({ ...valid, departDate: '', returnDate: addDaysIso(today, 5) }, today);
    assert.match(errors.departDate ?? '', /required/i);
    assert.equal(errors.returnDate, undefined);
  });

  it('flags tracking when both flights and hotels are off', () => {
    const errors = validateTripFormFields({ ...valid, flightEnabled: false, hotelEnabled: false, hotelCity: '' }, today);
    assert.match(errors.tracking ?? '', /at least flights or hotels/);
    assert.equal(errors.hotelCity, undefined);
  });
});

describe('adjustReturnDate', () => {
  it('keeps a return that is still after the new departure', () => {
    assert.equal(adjustReturnDate('2026-08-20', '2026-08-22', '2026-08-27', '2027-08-01'), '2026-08-27');
  });

  it('preserves the trip length when the departure moves past the return', () => {
    // 7-night trip moved from Aug 20 to Sep 10 keeps 7 nights.
    assert.equal(adjustReturnDate('2026-08-20', '2026-09-10', '2026-08-27', '2027-08-01'), '2026-09-17');
  });

  it('falls back to one night when the previous departure is malformed', () => {
    assert.equal(adjustReturnDate('', '2026-09-10', '2026-08-27', '2027-08-01'), '2026-09-11');
  });

  it('clears the return when the preserved date would exceed maxIso', () => {
    assert.equal(adjustReturnDate('2026-08-20', '2026-09-10', '2026-08-27', '2026-09-12'), '');
  });

  it('passes through empty returns and malformed new departures', () => {
    assert.equal(adjustReturnDate('2026-08-20', '2026-09-10', '', '2027-08-01'), '');
    assert.equal(adjustReturnDate('2026-08-20', 'nope', '2026-08-27', '2027-08-01'), '2026-08-27');
  });
});

describe('diffDaysIso', () => {
  it('returns whole-day differences and null on malformed input', () => {
    assert.equal(diffDaysIso('2026-08-20', '2026-08-27'), 7);
    assert.equal(diffDaysIso('2026-08-27', '2026-08-20'), -7);
    assert.equal(diffDaysIso('2026-12-31', '2027-01-01'), 1);
    assert.equal(diffDaysIso('nope', '2026-08-20'), null);
  });
});

describe('hotelOccupancy', () => {
  it('books one room up to four adults, then splits into more rooms', () => {
    assert.deepEqual(hotelOccupancy(1), { rooms: 1, adultsPerRoom: 1 });
    assert.deepEqual(hotelOccupancy(2), { rooms: 1, adultsPerRoom: 2 });
    assert.deepEqual(hotelOccupancy(4), { rooms: 1, adultsPerRoom: 4 });
    assert.deepEqual(hotelOccupancy(5), { rooms: 2, adultsPerRoom: 3 });
    assert.deepEqual(hotelOccupancy(9), { rooms: 3, adultsPerRoom: 3 });
  });

  it('never books meaningfully past the party size', () => {
    for (let adults = 1; adults <= 9; adults += 1) {
      const { rooms, adultsPerRoom } = hotelOccupancy(adults);
      const capacity = rooms * adultsPerRoom;
      assert.ok(capacity >= adults, `capacity ${capacity} fits ${adults}`);
      assert.ok(capacity - adults < rooms, `capacity ${capacity} not inflated for ${adults}`);
      assert.ok(adultsPerRoom >= 1 && adultsPerRoom <= 4);
    }
  });

  it('clamps nonsense input into the 1–9 adult range', () => {
    assert.deepEqual(hotelOccupancy(0), { rooms: 1, adultsPerRoom: 1 });
    assert.deepEqual(hotelOccupancy(-3), { rooms: 1, adultsPerRoom: 1 });
    assert.deepEqual(hotelOccupancy(42), { rooms: 3, adultsPerRoom: 3 });
    assert.deepEqual(hotelOccupancy(Number.NaN), { rooms: 1, adultsPerRoom: 1 });
  });
});

describe('describeHotelOccupancy', () => {
  it('renders singular, plural, and multi-room forms', () => {
    assert.equal(describeHotelOccupancy(1), '1 room · 1 adult');
    assert.equal(describeHotelOccupancy(2), '1 room · 2 adults');
    assert.equal(describeHotelOccupancy(5), '2 rooms · 3 adults each');
  });
});

describe('suggestTripName', () => {
  it('renders same-month ranges compactly', () => {
    assert.equal(suggestTripName('Maui', '2026-08-20', '2026-08-27', true), 'Maui · Aug 20–27');
  });

  it('spells out cross-month ranges', () => {
    assert.equal(suggestTripName('Kahului', '2026-08-28', '2026-09-03', true), 'Kahului · Aug 28 – Sep 3');
  });

  it('uses only the departure for one-way trips or a missing return', () => {
    assert.equal(suggestTripName('Maui', '2026-08-20', '2026-08-27', false), 'Maui · Aug 20');
    assert.equal(suggestTripName('Maui', '2026-08-20', '', true), 'Maui · Aug 20');
  });

  it('degrades to the bare place, and to empty without a destination', () => {
    assert.equal(suggestTripName('Maui', '', '', true), 'Maui');
    assert.equal(suggestTripName('  ', '2026-08-20', '2026-08-27', true), '');
  });

  it('caps every branch at the 100-character name limit', () => {
    const longPlace = 'x'.repeat(120);
    assert.equal(suggestTripName(longPlace, '2026-08-20', '2026-08-27', true).length, 100);
    assert.equal(suggestTripName(longPlace, '2026-08-20', '', true).length, 100);
    assert.equal(suggestTripName(longPlace, '', '', true).length, 100);
  });
});
