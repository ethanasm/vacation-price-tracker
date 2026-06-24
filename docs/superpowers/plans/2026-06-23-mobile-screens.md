# Mobile Aurora Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full set of Aurora phone screens on top of the booting foundation P2 produced — Sign in, Trips list, Trip detail (the interactive selection→total→chart screen), Create trip, Assistant chat, and the Alerts tab + price-drop local notification — plus the shared `components/aurora/**` primitives every screen consumes and the pure `lib/aurora.ts` flight/hotel helpers (unit-tested, mirroring the web P1 semantics without importing web code). Android Material polish and an explicit iPad two-pane follow-up note close it out.

**Architecture:** This is plan **P3** of the "Aurora" effort (see `docs/superpowers/plans/2026-06-23-AURORA-INDEX.md`). It owns **`apps/mobile/app/**` and `apps/mobile/components/**` ONLY** (the Aurora screens + their tests), plus the screen-supporting pure helpers in `apps/mobile/lib/aurora.ts` and one `apps/mobile/package.json` dependency-addition task. It **depends on P2 (mobile-foundation)** and consumes P2's interfaces **exactly as produced** — `createApiClient`/`useApiClient` (`listTrips`/`getTrip`/`createTrip`/`sendChatMessage`), `useAuth()`, the `tokens` theme module + `useTheme`/`useThemedStyles`/`formatUsd`, the Manrope `useAppFonts` loader, and the route stub names (`(tabs)/index`, `(tabs)/alerts`, `(tabs)/chat`, `trip/[id]`, `trip/new`, `(auth)/sign-in`). It replaces the bodies of those P2 route stubs with the real screens; it does **not** redefine P2's lib modules.

**Scope boundaries (do not cross):**
- **Do NOT edit `apps/mobile/app.config.ts`** — that file's only later editor is P4 (release/version/submit fields). The one config touch this plan needs (the `expo-notifications` plugin) is already present in P2's `app.config.ts` plugin list, so P3 adds **no** plugin. If a later UI dep needs a config plugin, this plan flags it for P4 rather than editing the file.
- **Do NOT edit `eas.json`, the workflows, `scripts/bump-mobile-version.mjs`, or `apps/mobile/e2e/**`** — all P4's.
- **`apps/mobile/package.json`:** P3 appends UI/runtime deps in **Task 1 only**; P4 is told (in this plan's report) not to touch `package.json`, which guarantees no merge conflict when P3 and P4 run simultaneously in Wave 2.
- **Root config / `apps/api` / `apps/worker`** are out of scope (P2 / P5).

**Tech Stack:** Expo SDK ~56 · React Native 0.85.3 · React 19.2.3 · Expo Router ~56.2.10 · `react-native-svg` 15.15.5 (price chart) · `expo-linear-gradient` ~56.0.4 (gradients) · `react-native-gesture-handler` ~2.31.1 (already in P2 deps) · `expo-notifications` ~56.0.17 (price-drop alert) · `@tanstack/react-query` (list/detail fetching) · `lucide-react-native` (icons) · TypeScript · `node:test` + `@testing-library/react-native` / `react-test-renderer` (unit tests, run via Nx; mobile coverage gate 80% on `lib/**`).

## Global Constraints

*Every task in this plan implicitly includes this section. Values copied verbatim from `2026-06-23-AURORA-INDEX.md` (screen-relevant entries) and the repo.*

### Monorepo / toolchain
- **Package manager:** `pnpm@9.12.1` (pinned in root `package.json`). **Single `pnpm-lock.yaml` at the repo root** — never generate a nested lockfile in `apps/*`.
- **Workspace:** Nx monorepo, `pnpm-workspace.yaml` globs `apps/*` (P2 already registered `apps/mobile`).
- **Node:** `.nvmrc` = `22` (P2). All CI uses `actions/setup-node@v6` with `node-version: 22`.
- **Verify gate:** `pnpm verify` must stay green (install --frozen-lockfile → build → lint → typecheck → test:coverage → audit).
- **Mobile coverage scope:** mirror showbook — gate only `apps/mobile/lib/**` (layout-heavy `app/**` + `components/**` excluded), threshold 80% lines/branches/functions. Unit tests use `node --test` + `@testing-library/react-native` / `react-test-renderer`, run via the `mobile` Nx project. So **all real logic lives in `lib/aurora.ts` (pure) and is unit-tested there**; the screen + component files carry no coverage gate but get a headless web-export compile check + a described simulator/Maestro-style manual check.

### Mobile stack — mirror showbook
- **Expo SDK 56** (`expo ~56.0.x`) · **React Native 0.85.3** · React **19.2.3** · **Expo Router ~56.2.10** · `react-native-svg` + a charting approach (this plan: hand-rolled SVG area/line — no extra chart lib) · `expo-linear-gradient` (P2 already declared it) · `expo-notifications` (price-drop push registration/handler; the server push trigger is P5) · `lucide-react-native` (icons).
- **API access:** REST + JWT via P2's `useApiClient()`. Screens never construct fetch calls directly — they call the typed methods.
- **Bundle identifiers:** iOS `me.ethanasm.vpt`, Android `me.ethanasm.vpt`.

### Aurora design tokens (consumed from P2's `lib/theme/tokens.ts` — never redefined here)
- **Primary violet** `#7C3AED` (`tokens.color.primary`) · hover/deep `#6D28D9` (`primaryDeep`) · **primary gradient** `tokens.gradient.primary` = `['#A78BFA','#7C3AED']` · **total-card gradient** `tokens.gradient.totalCard` = `['#7C3AED','#9333EA']`.
- **Accents:** pink `#EC4899` (`accentPink`), cyan `#22D3EE` (`accentCyan`, hotel chart line). **Backgrounds:** page `#FAF8FF` (`pageBg`), surfaces `#F4F1FC`/`#F8F5FE` (`surface`/`surfaceAlt`), chip `#EDE9FE` (`chipBg`), card `#FFFFFF` (`card`), hairline `#F1EEF8`/`#ECE8F5` (`hairline`/`hairlineAlt`), selected border `#C9B8F5` (`selectedBorder`).
- **Text:** strong `#1A1A2E` (`textStrong`), body `#4A4660`/`#6B6680` (`textBody`/`textBodyAlt`), muted `#8B86A0` (`textMuted`), faint `#BDB6D4` (`textFaint`).
- **Status:** success `#059669` on `#ECFDF5` (`success`/`successBg`); warning/stops `#9A7B18` on `#FEF6DD` (`warning`/`warningBg`); layover amber `#C98A3A` on `#FDF6E9` (`layover`/`layoverBg`) border `#F6E7C8` (`layoverBorder`); star gold `#F5A623` (`star`).
- **Radius:** `tokens.radius` (`card` 16 · `inner` 13 · `pill` 10 · `badge` 999). **Shadows:** `tokens.shadow.cardOnCanvas` / `.primaryButton` / `.totalCard` (RN shadow objects).
- **Airline monogram chips (original marks, not real trademarks):** `tokens.airline.AS/UA/DL` each `{ colors: readonly [string,string]; label }` — Alaska `['#10617F','#093247']`, United `['#2456C9','#13357F']`, Delta `['#C8102E','#7A0A1C']`; white text weight 800, radius 8px. Multi-carrier flights overlap two chips (−10px margin, 2px white ring).
- **Fonts:** `tokens.font[400|500|600|700|800]` = `Manrope_*` family names (loaded by P2's `useAppFonts`).

### Verified behavioral checks (Trip detail — both web P1 and mobile P3)
The selection→total→chart recompute MUST reproduce these exact totals (`total = flightPrice + hotelTotal`):
- Alaska (non-stop) + Riverhouse = **$789**
- United (1-stop) + Riverhouse = **$754**
- Delta + Eviva = **$680**

### Product guardrails
- **No "Trip members"/sharing UI** anywhere. Settings = Notifications only (Email + SMS) — out of phone scope per the handoff (phone has no Settings screen; notification prefs live on the web). Phone tabs are **Trips · Alerts · Chat**.
- Sign-in is **Google-OAuth only**; "We never store passwords" caption.
- Airline logos are **original CSS monogram chips**, never real airline trademarks.

### Trip-detail sample fixture (matches the handoff + P1)
Derived to satisfy the documented totals (per the index "Open confirmations"): Alaska (non-stop) `$177` · United (1-stop via DEN) `$142` · Delta (non-stop) `$142` · Riverhouse `$612` total (`$153/night`) · Eviva `$538` total. So Alaska+Riverhouse `$789`, United+Riverhouse `$754`, Delta+Eviva `$680`. These are the values the Trip-detail RN tests assert against the **pure selection reducer** in `lib/aurora.ts`.

### PR operator docs (required)
Every PR opened for this plan MUST include an **"Operator / Deployment Steps"** section in its description listing: new **environment variables** (name · where set — web `.env` / api `.env`·`.env.prod` / `eas.json` / GitHub secret / GitHub variable · required-vs-optional · example or placeholder value); **DB migrations**; **new GitHub secrets/variables**; and any **one-time infra / runner / credential provisioning** the change introduces. If it introduces none, state **"No operator steps"** explicitly.

---

## File Structure

### Files to Create

**Task 1 — UI deps + shared primitives + pure helpers:**
- `apps/mobile/lib/aurora.ts` — pure, RN-free helpers: `airlineChip`, `stopsBadge`, `layoverLabel`, `multiCarrierSubtitle`, `flightSummaryLine`, `formatMoneyString`, `parsePrice`, `hotelPerNight`, plus the Trip-detail selection state + reducer (`initialSelection`, `selectReducer`, `computeTripTotal`) and the chart series builder (`buildChartSeries`). **No React/RN imports** so `node:test` imports it directly. (This is where the 80% coverage lives.)
- `apps/mobile/lib/__tests__/aurora.test.ts` — unit tests for every helper + the three verified totals + the one-expanded-at-a-time reducer + chart "Now $X" recompute.
- `apps/mobile/components/aurora/aurora-card.tsx` — `AuroraCard` (white card, radius 16, `cardOnCanvas` shadow, optional accent left-border for multi-carrier).
- `apps/mobile/components/aurora/status-chip.tsx` — `StatusChip` (tones: `active`/`paused`/`nonstop`/`stop`/`success`/`layover`).
- `apps/mobile/components/aurora/airline-chip.tsx` — `AirlineChip` (single monogram gradient) + `AirlineChipPair` (overlapping two chips for multi-carrier).
- `apps/mobile/components/aurora/hotel-photo.tsx` — `HotelPhoto` (cover image + graceful violet-surface placeholder with a building glyph).
- `apps/mobile/components/aurora/gradient-button.tsx` — `GradientButton` (primary violet gradient fill + glow shadow; `secondary` white+hairline variant).
- `apps/mobile/components/aurora/segmented-control.tsx` — `SegmentedControl<V>` (rule track + white active pill w/ shadow).
- `apps/mobile/components/aurora/price-chart.tsx` — `PriceChart` (react-native-svg: violet Total area + dashed cyan Hotel line + moving "current" dot + "Now $X" badge; y-axis `$0–$1000`).
- `apps/mobile/components/aurora/index.ts` — barrel re-exporting the primitives.
- `apps/mobile/components/__tests__/_setup-rn-mocks.cjs` + the stub `.cjs` files (`_rn-stub.cjs`, `_safe-area-stub.cjs`, `_icons-stub.cjs`, `_svg-stub.cjs`, `_linear-gradient-stub.cjs`) — mirror showbook's `react-test-renderer` shim so a handful of primitive component tests can render without the native runtime. (These render-smoke tests are **not** in the coverage gate but guard the chip-tone / monogram / multi-carrier logic visually.)
- `apps/mobile/components/__tests__/aurora-primitives.test.cjs` — render-smoke for `StatusChip` tones, `AirlineChipPair` (two chips when multi-carrier), `GradientButton` press, `SegmentedControl` change.

**Task 2 — Sign in:** body of `apps/mobile/app/(auth)/sign-in.tsx` (replaces P2 stub).
**Task 3 — Trips list:** body of `apps/mobile/app/(tabs)/index.tsx` + `apps/mobile/components/aurora/trip-card.tsx`.
**Task 4 — Trip detail:** body of `apps/mobile/app/trip/[id].tsx` + `apps/mobile/components/aurora/flight-row.tsx` + `apps/mobile/components/aurora/hotel-row.tsx` + `apps/mobile/components/aurora/stat-trio.tsx`.
**Task 5 — Create trip:** body of `apps/mobile/app/trip/new.tsx` + `apps/mobile/components/aurora/form-field.tsx` + `apps/mobile/components/aurora/toggle-row.tsx` + `apps/mobile/components/aurora/collapsible-section.tsx`.
**Task 6 — Assistant:** body of `apps/mobile/app/(tabs)/chat.tsx` + `apps/mobile/components/aurora/chat-bubble.tsx` + `apps/mobile/components/aurora/quick-reply-chips.tsx` + `apps/mobile/lib/chat-stream.ts` (pure SSE-line parser) + `apps/mobile/lib/__tests__/chat-stream.test.ts`.
**Task 7 — Alerts + notifications:** body of `apps/mobile/app/(tabs)/alerts.tsx` + `apps/mobile/components/aurora/alert-row.tsx` + `apps/mobile/lib/notifications.ts` (registration/handler + pure `buildPriceDropNotification`) + `apps/mobile/lib/__tests__/notifications.test.ts`.
**Task 8 — Android polish + tablet note:** edits to the screens (platform branches) + a documented follow-up; no new files except possibly `apps/mobile/lib/__tests__` additions.

### Files to Modify
- `apps/mobile/package.json` — **Task 1 only**: confirm/append UI deps. P2 already declared `react-native-svg`, `expo-linear-gradient`, `react-native-gesture-handler`, `expo-notifications`, `lucide-react-native`, `@tanstack/react-query`. So Task 1's job is to **verify they are present** and append only what is genuinely missing (expected: nothing new — but see Task 1 Step 1). No chart library is added (SVG hand-rolled).
- `apps/mobile/app/(auth)/sign-in.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/alerts.tsx`, `app/(tabs)/chat.tsx`, `app/trip/[id].tsx`, `app/trip/new.tsx` — replace P2 stub bodies (Tasks 2–7).

---

## E2E testID contract (consumed by P4's Maestro flows)

**This is a hard contract.** P4's Maestro e2e flows (`apps/mobile/e2e/**`, owned by P4) tap and assert against these screens **by `testID`**. Every element listed below MUST carry the **exact canonical `testID` verbatim** (and a matching `accessibilityLabel` with the same human-readable intent) — a rename or typo silently breaks P4's flows. When this plan's task steps reference an element below, the canonical name is authoritative; do not invent alternatives. (P3 does **not** write the Maestro flows — that's P4 — it only exposes the IDs.)

| Element | Canonical `testID` | Screen / Task |
|---|---|---|
| Continue-with-Google button | `sign-in-google-button` | Sign in (Task 2) |
| Trips list container (FlatList) | `trips-list` | Trips (Task 3) |
| Each trip card | `trip-card` (suffix `-${id}` for per-item, see convention) | Trips (Task 3) |
| Total stat on a trip card | `trip-card-total` | Trips (Task 3) |
| New-trip FAB | `new-trip-fab` | Trips (Task 3) |
| Trip-detail Flight stat chip | `trip-detail-flight-stat` | Trip detail (Task 4) |
| Trip-detail Hotel stat chip | `trip-detail-hotel-stat` | Trip detail (Task 4) |
| Trip-detail Total stat chip | `trip-detail-total-stat` | Trip detail (Task 4) |
| Each selectable flight row | `flight-option` (suffix `-${id}` for per-item) | Trip detail (Task 4) |
| Each selectable hotel row | `hotel-option` (suffix `-${id}` for per-item) | Trip detail (Task 4) |
| Create-trip name input | `create-trip-name-input` | Create (Task 5) |
| Create-trip From (origin) input | `create-trip-origin-input` | Create (Task 5) |
| Create-trip To (destination) input | `create-trip-destination-input` | Create (Task 5) |
| Create-trip submit button | `create-trip-submit` | Create (Task 5) |
| Chat input | `chat-input` | Assistant (Task 6) |
| Chat send button | `chat-send` | Assistant (Task 6) |
| Each assistant message bubble | `assistant-message` | Assistant (Task 6) |
| Alerts list container | `alerts-list` | Alerts (Task 7) |

**Per-item uniqueness convention:** for list rows Maestro may need to target a specific item rather than the first match. Where an element repeats (`trip-card`, `flight-option`, `hotel-option`), give it **both** the bare canonical name as a stable prefix **and** an id suffix — i.e. set `testID={\`flight-option-${offer.id}\`}` and `accessibilityLabel` accordingly. Maestro can then match the prefix (`id: "flight-option.*"`) for "any" or the exact suffixed id for a specific row. The `trip-card-total` / stat / input / button IDs are singletons and stay bare.

---

## Task 1: UI dependencies + shared Aurora primitives + pure helpers

**Files:**
- Modify: `apps/mobile/package.json` (verify/append UI deps)
- Create: `apps/mobile/lib/aurora.ts`
- Test: `apps/mobile/lib/__tests__/aurora.test.ts`
- Create: `apps/mobile/components/aurora/{aurora-card,status-chip,airline-chip,hotel-photo,gradient-button,segmented-control,price-chart,index}.tsx`
- Create: `apps/mobile/components/__tests__/_setup-rn-mocks.cjs` + `_rn-stub.cjs` + `_safe-area-stub.cjs` + `_icons-stub.cjs` + `_svg-stub.cjs` + `_linear-gradient-stub.cjs`
- Test: `apps/mobile/components/__tests__/aurora-primitives.test.cjs`

**Interfaces:**
- Consumes (from P2): `tokens` + `useTheme`/`useThemedStyles`/`formatUsd` (`@/lib/theme`); `TripSummary`/`TripDetail`/`TripDetailResponse`/`PriceSnapshot` types re-exported by `@/lib/api/client`; the generated `components['schemas']['FlightOffer'|'HotelOffer'|'FlightSegment'|'FlightItinerary']` shapes from `@/lib/api/types`.
- Produces (consumed by Tasks 2–8):
  - **Pure helpers in `lib/aurora.ts`** (no RN):
    ```ts
    type AirlineCode = 'AS' | 'UA' | 'DL';
    function airlineChip(code?: string | null): { code: AirlineCode | null; colors: readonly [string, string]; label: string };
    function stopsBadge(stops: number, viaAirport?: string | null): { tone: 'nonstop' | 'stop'; label: string };   // 0 -> {nonstop,'NON-STOP'}; 1 -> {stop,'1 STOP · DEN'}
    function layoverLabel(durationMinutes: number, airportName: string, airportCode: string): string;               // '1h 10m layover in Denver (DEN)'
    function multiCarrierSubtitle(carriers: string[]): string | null;                                               // ['United','Alaska'] -> 'Operated by United & Alaska'; single/empty -> null
    function flightSummaryLine(offer: FlightOffer): string;                                                          // '7:05a SFO → 9:00a RDM · nonstop'
    function parsePrice(value?: string | null): number | null;
    function formatMoneyString(value?: string | null): string;                                                      // '177.00' -> '$177'
    function hotelPerNight(total: number, nights: number): number;                                                  // 612,4 -> 153
    // Trip-detail selection state (same shape as P1):
    interface Selection { selectedFlightId: string | null; expandedFlightId: string | null; selectedHotelId: string | null; expandedHotelId: string | null; }
    type SelectAction = { kind: 'flight'; id: string } | { kind: 'hotel'; id: string };
    function initialSelection(flights: FlightOffer[], hotels: HotelOffer[]): Selection;     // cheapest of each pre-selected
    function selectReducer(state: Selection, action: SelectAction): Selection;              // one-expanded-at-a-time; tap selected+expanded collapses but keeps selected
    function computeTripTotal(flight: FlightOffer | null, hotel: HotelOffer | null): number; // flightPrice + hotelTotal
    interface ChartPoint { label: string; total: number; hotel: number; }
    function buildChartSeries(history: PriceSnapshot[], currentTotal: number, currentHotel: number): { points: ChartPoint[]; nowLabel: string };  // appends a 'Now' point at currentTotal
    ```
  - **Components in `components/aurora/` (consume `useTheme`):** `AuroraCard`, `StatusChip`, `AirlineChip`, `AirlineChipPair`, `HotelPhoto`, `GradientButton`, `SegmentedControl`, `PriceChart` — all exported from `components/aurora/index.ts`.

- [ ] **Step 1: Verify the UI deps P2 declared are present; write the failing helper test first**

Confirm P2's deps cover this plan (no `package.json` edit expected). Run:
```bash
node -e "const d=require('./apps/mobile/package.json').dependencies; for (const k of ['react-native-svg','expo-linear-gradient','react-native-gesture-handler','expo-notifications','lucide-react-native','@tanstack/react-query']) console.log(k, d[k] ?? 'MISSING')"
```
Expected: every line shows a version, none `MISSING`. **If any is `MISSING`**, append it to `apps/mobile/package.json` `dependencies` at the showbook-pinned version (svg `15.15.5`, gradient `~56.0.4`, gesture-handler `~2.31.1`, notifications `~56.0.17`, lucide `^1.17.0`, react-query `^5.101.0`), run `pnpm install` from the repo root, and confirm no nested lockfile (`git status --porcelain | grep 'apps/mobile/pnpm-lock.yaml'` → empty). **No chart library is added** — the chart is hand-rolled SVG. Record in the commit body which deps (if any) were added so P4 knows to stay out of `package.json`.

Then create the failing test `apps/mobile/lib/__tests__/aurora.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  airlineChip,
  stopsBadge,
  layoverLabel,
  multiCarrierSubtitle,
  parsePrice,
  formatMoneyString,
  hotelPerNight,
  initialSelection,
  selectReducer,
  computeTripTotal,
  buildChartSeries,
  type Selection,
} from '../aurora';

// --- Fixture matching the handoff + the three verified totals ---
const flights = [
  { id: 'f-as', airline_code: 'AS', airline_name: 'Alaska', price: '177.00', stops: 0,
    departure_time: '2025-08-22T07:05:00', arrival_time: '2025-08-22T09:00:00',
    itineraries: [{ direction: 'outbound', stops: 0, segments: [
      { carrier_code: 'AS', flight_number: '120', departure_airport: 'SFO', arrival_airport: 'RDM', departure_time: '2025-08-22T07:05:00', arrival_time: '2025-08-22T09:00:00' }] }] },
  { id: 'f-ua', airline_code: 'UA', airline_name: 'United', price: '142.00', stops: 1,
    itineraries: [{ direction: 'outbound', stops: 1, segments: [
      { carrier_code: 'UA', flight_number: '508', departure_airport: 'SFO', arrival_airport: 'DEN', departure_time: '2025-08-22T06:00:00', arrival_time: '2025-08-22T09:30:00', duration_minutes: 150 },
      { carrier_code: 'AS', flight_number: '2201', departure_airport: 'DEN', arrival_airport: 'RDM', departure_time: '2025-08-22T10:40:00', arrival_time: '2025-08-22T12:10:00' }] }] },
  { id: 'f-dl', airline_code: 'DL', airline_name: 'Delta', price: '142.00', stops: 0,
    itineraries: [{ direction: 'outbound', stops: 0, segments: [
      { carrier_code: 'DL', flight_number: '900', departure_airport: 'SFO', arrival_airport: 'RDM', departure_time: '2025-08-22T08:00:00', arrival_time: '2025-08-22T10:00:00' }] }] },
] as never[];
const hotels = [
  { id: 'h-river', name: 'Riverhouse', price: '153.00', rating: 4 },     // $153/night * 4 nights = $612 total
  { id: 'h-eviva', name: 'Eviva', price: '134.50', rating: 3 },          // $134.50 * 4 = $538 total
] as never[];
const NIGHTS = 4;

// Hotel `price` from the API is per-night; tests pass total via hotelPerNight inverse below.
const hotelTotal = (h: { price: string }) => parsePrice(h.price)! * NIGHTS;

test('airlineChip maps known carriers and falls back to null', () => {
  assert.deepEqual(airlineChip('AS').colors, ['#10617F', '#093247']);
  assert.equal(airlineChip('UA').label, 'UA');
  assert.equal(airlineChip('DL').code, 'DL');
  assert.equal(airlineChip('XX').code, null);
  assert.equal(airlineChip(null).code, null);
});

test('stopsBadge renders NON-STOP green vs 1 STOP amber with via airport', () => {
  assert.deepEqual(stopsBadge(0), { tone: 'nonstop', label: 'NON-STOP' });
  assert.deepEqual(stopsBadge(1, 'DEN'), { tone: 'stop', label: '1 STOP · DEN' });
  assert.equal(stopsBadge(2, 'DEN').label, '2 STOPS · DEN');
});

test('layoverLabel + multiCarrierSubtitle compose the amber pill + subtitle', () => {
  assert.equal(layoverLabel(70, 'Denver', 'DEN'), '1h 10m layover in Denver (DEN)');
  assert.equal(multiCarrierSubtitle(['United', 'Alaska']), 'Operated by United & Alaska');
  assert.equal(multiCarrierSubtitle(['United']), null);
  assert.equal(multiCarrierSubtitle([]), null);
});

test('price parsing + formatting', () => {
  assert.equal(parsePrice('177.00'), 177);
  assert.equal(parsePrice(null), null);
  assert.equal(formatMoneyString('177.00'), '$177');
  assert.equal(formatMoneyString('1838'), '$1,838');
  assert.equal(hotelPerNight(612, 4), 153);
});

test('initialSelection pre-selects the cheapest flight and hotel', () => {
  const sel = initialSelection(flights, hotels);
  // Cheapest flight is a tie at 142 (UA, DL) — the first cheapest wins: UA.
  assert.equal(sel.selectedFlightId, 'f-ua');
  assert.equal(sel.selectedHotelId, 'h-eviva'); // 134.50 < 153
  assert.equal(sel.expandedFlightId, null);
  assert.equal(sel.expandedHotelId, null);
});

test('selectReducer: selecting expands; re-tapping selected collapses but stays selected; one-expanded-at-a-time', () => {
  let s: Selection = { selectedFlightId: null, expandedFlightId: null, selectedHotelId: null, expandedHotelId: null };
  s = selectReducer(s, { kind: 'flight', id: 'f-as' });
  assert.equal(s.selectedFlightId, 'f-as');
  assert.equal(s.expandedFlightId, 'f-as');     // selecting also expands
  s = selectReducer(s, { kind: 'flight', id: 'f-ua' });
  assert.equal(s.selectedFlightId, 'f-ua');
  assert.equal(s.expandedFlightId, 'f-ua');     // only one expanded
  s = selectReducer(s, { kind: 'flight', id: 'f-ua' });
  assert.equal(s.selectedFlightId, 'f-ua');     // still selected
  assert.equal(s.expandedFlightId, null);       // re-tap collapses
  // hotels are independent of flights
  s = selectReducer(s, { kind: 'hotel', id: 'h-river' });
  assert.equal(s.selectedHotelId, 'h-river');
  assert.equal(s.expandedHotelId, 'h-river');
  assert.equal(s.selectedFlightId, 'f-ua');     // flight untouched
});

test('computeTripTotal reproduces the three verified totals (total = flightPrice + hotelTotal)', () => {
  const as = flights.find((f) => f.id === 'f-as')!;
  const ua = flights.find((f) => f.id === 'f-ua')!;
  const dl = flights.find((f) => f.id === 'f-dl')!;
  const river = { id: 'h-river', name: 'Riverhouse', price: String(612 / NIGHTS) } as never;
  const eviva = { id: 'h-eviva', name: 'Eviva', price: String(538 / NIGHTS) } as never;
  // computeTripTotal takes hotel TOTAL via a {total} accessor; the screen passes nights.
  assert.equal(computeTripTotal(as, river, NIGHTS), 789); // 177 + 612
  assert.equal(computeTripTotal(ua, river, NIGHTS), 754); // 142 + 612
  assert.equal(computeTripTotal(dl, eviva, NIGHTS), 680); // 142 + 538
});

test('buildChartSeries appends a Now point at the current total and labels it', () => {
  const history = [
    { created_at: '2025-08-01T00:00:00Z', flight_price: '200', hotel_price: '650' },
    { created_at: '2025-08-10T00:00:00Z', flight_price: '180', hotel_price: '620' },
  ] as never[];
  const { points, nowLabel } = buildChartSeries(history, 789, 612);
  assert.equal(points[points.length - 1].total, 789);
  assert.equal(points[points.length - 1].hotel, 612);
  assert.equal(nowLabel, 'Now $789');
});
```

- [ ] **Step 2: Run the helper test to verify it fails**

Run:
```bash
pnpm --filter mobile exec node --import tsx --test lib/__tests__/aurora.test.ts
```
Expected: FAIL — `Cannot find module '../aurora'`.

- [ ] **Step 3: Implement `apps/mobile/lib/aurora.ts` (pure helpers)**

Create `apps/mobile/lib/aurora.ts`:
```ts
/**
 * Pure flight/hotel rendering + Trip-detail selection helpers for the Aurora
 * mobile screens. No React/RN imports so node:test imports this directly — this
 * file carries the mobile lib/** coverage. Mirrors the SEMANTICS of the web
 * app's helpers (airlineChip / stopsBadge / layoverLabel / multiCarrierSubtitle)
 * but is an independent recreation (mobile never imports apps/web code).
 */
import type { components } from './api/types';

export type FlightOffer = components['schemas']['FlightOffer'];
export type FlightSegment = components['schemas']['FlightSegment'];
export type HotelOffer = components['schemas']['HotelOffer'];
export type PriceSnapshot = components['schemas']['PriceSnapshotResponse'];

export type AirlineCode = 'AS' | 'UA' | 'DL';

const AIRLINE: Record<AirlineCode, { colors: readonly [string, string]; label: string }> = {
  AS: { colors: ['#10617F', '#093247'], label: 'AS' },
  UA: { colors: ['#2456C9', '#13357F'], label: 'UA' },
  DL: { colors: ['#C8102E', '#7A0A1C'], label: 'DL' },
};
const NEUTRAL: readonly [string, string] = ['#6B6680', '#4A4660'];

export function airlineChip(code?: string | null): {
  code: AirlineCode | null;
  colors: readonly [string, string];
  label: string;
} {
  const key = (code ?? '').toUpperCase();
  if (key === 'AS' || key === 'UA' || key === 'DL') {
    return { code: key, colors: AIRLINE[key].colors, label: AIRLINE[key].label };
  }
  return { code: null, colors: NEUTRAL, label: key.slice(0, 2) || '··' };
}

export function stopsBadge(
  stops: number,
  viaAirport?: string | null,
): { tone: 'nonstop' | 'stop'; label: string } {
  if (stops <= 0) return { tone: 'nonstop', label: 'NON-STOP' };
  const noun = stops === 1 ? 'STOP' : 'STOPS';
  const via = viaAirport ? ` · ${viaAirport}` : '';
  return { tone: 'stop', label: `${stops} ${noun}${via}` };
}

export function layoverLabel(durationMinutes: number, airportName: string, airportCode: string): string {
  const h = Math.floor(durationMinutes / 60);
  const m = durationMinutes % 60;
  const dur = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return `${dur} layover in ${airportName} (${airportCode})`;
}

export function multiCarrierSubtitle(carriers: string[]): string | null {
  const unique = [...new Set(carriers.filter(Boolean))];
  if (unique.length < 2) return null;
  if (unique.length === 2) return `Operated by ${unique[0]} & ${unique[1]}`;
  return `Operated by ${unique.slice(0, -1).join(', ')} & ${unique[unique.length - 1]}`;
}

export function parsePrice(value?: string | null): number | null {
  if (value === null || value === undefined) return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

export function formatMoneyString(value?: string | null): string {
  const n = parsePrice(value) ?? 0;
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

export function hotelPerNight(total: number, nights: number): number {
  if (nights <= 0) return total;
  return Math.round(total / nights);
}

/** '7:05a' style clock from an ISO datetime. */
export function clockLabel(iso?: string | null): string {
  if (!iso) return '';
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return '';
  let h = Number.parseInt(m[1], 10);
  const min = m[2];
  const ampm = h >= 12 ? 'p' : 'a';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${min}${ampm}`;
}

export function flightSummaryLine(offer: FlightOffer): string {
  const segs = (offer.itineraries ?? [])[0]?.segments ?? [];
  const first = segs[0];
  const last = segs[segs.length - 1];
  const dep = first?.departure_airport ?? '';
  const arr = last?.arrival_airport ?? '';
  const depT = clockLabel(first?.departure_time ?? offer.departure_time);
  const arrT = clockLabel(last?.arrival_time ?? offer.arrival_time);
  const stops = offer.stops <= 0 ? 'nonstop' : `${offer.stops} stop${offer.stops > 1 ? 's' : ''}`;
  return `${depT} ${dep} → ${arrT} ${arr} · ${stops}`.trim();
}

// --- Trip-detail selection state (same shape as P1) ---

export interface Selection {
  selectedFlightId: string | null;
  expandedFlightId: string | null;
  selectedHotelId: string | null;
  expandedHotelId: string | null;
}
export type SelectAction = { kind: 'flight'; id: string } | { kind: 'hotel'; id: string };

function cheapestId<T extends { id: string; price: string }>(items: T[]): string | null {
  let best: T | null = null;
  for (const it of items) {
    const p = parsePrice(it.price);
    if (p === null) continue;
    if (best === null || p < (parsePrice(best.price) ?? Infinity)) best = it;
  }
  return best?.id ?? null;
}

export function initialSelection(flights: FlightOffer[], hotels: HotelOffer[]): Selection {
  return {
    selectedFlightId: cheapestId(flights),
    expandedFlightId: null,
    selectedHotelId: cheapestId(hotels),
    expandedHotelId: null,
  };
}

export function selectReducer(state: Selection, action: SelectAction): Selection {
  if (action.kind === 'flight') {
    const reTap = state.selectedFlightId === action.id && state.expandedFlightId === action.id;
    return {
      ...state,
      selectedFlightId: action.id,
      expandedFlightId: reTap ? null : action.id, // selecting expands; re-tap collapses, stays selected
    };
  }
  const reTap = state.selectedHotelId === action.id && state.expandedHotelId === action.id;
  return {
    ...state,
    selectedHotelId: action.id,
    expandedHotelId: reTap ? null : action.id,
  };
}

/** total = flightPrice + hotelTotal, where hotelTotal = hotel.price (per-night) * nights. */
export function computeTripTotal(
  flight: FlightOffer | null,
  hotel: HotelOffer | null,
  nights: number,
): number {
  const f = flight ? parsePrice(flight.price) ?? 0 : 0;
  const perNight = hotel ? parsePrice(hotel.price) ?? 0 : 0;
  return Math.round(f + perNight * Math.max(nights, 0));
}

export interface ChartPoint {
  label: string;
  total: number;
  hotel: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function dayLabel(day: string): string {
  const [, mo, dom] = day.split('-');
  const idx = Number.parseInt(mo, 10) - 1;
  return MONTHS[idx] && dom ? `${MONTHS[idx]} ${Number.parseInt(dom, 10)}` : day;
}

/**
 * One point per calendar day (cheapest total that day), then append a synthetic
 * "Now" point at the live selection's total/hotel so the chart's current dot and
 * the "Now $X" badge track the selection. Mirrors the web price-history chart.
 */
export function buildChartSeries(
  history: PriceSnapshot[],
  currentTotal: number,
  currentHotel: number,
): { points: ChartPoint[]; nowLabel: string } {
  const cheapestByDay = new Map<string, { total: number; hotel: number }>();
  for (const snap of history) {
    const day = (snap.created_at ?? '').slice(0, 10);
    if (!day) continue;
    const flight = parsePrice(snap.flight_price) ?? 0;
    const hotel = parsePrice(snap.hotel_price) ?? 0;
    const total = flight + hotel;
    const existing = cheapestByDay.get(day);
    if (!existing || total < existing.total) cheapestByDay.set(day, { total, hotel });
  }
  const days = [...cheapestByDay.keys()].sort((a, b) => a.localeCompare(b));
  const points: ChartPoint[] = days.map((day) => {
    const v = cheapestByDay.get(day) as { total: number; hotel: number };
    return { label: dayLabel(day), total: v.total, hotel: v.hotel };
  });
  points.push({ label: 'Now', total: currentTotal, hotel: currentHotel });
  return { points, nowLabel: `Now $${Math.round(currentTotal).toLocaleString('en-US')}` };
}
```

- [ ] **Step 4: Run the helper test to verify it passes**

Run:
```bash
pnpm --filter mobile exec node --import tsx --test lib/__tests__/aurora.test.ts
```
Expected: PASS — all 8 tests pass, including the three verified totals 789/754/680 and the one-expanded reducer.

- [ ] **Step 5: Implement the component-test RN stubs (mirror showbook)**

Copy showbook's render-shim approach so a `react-test-renderer` can mount the primitives without the native runtime. Create `apps/mobile/components/__tests__/_rn-stub.cjs` (maps `react-native` exports to plain host components `rn-view`/`rn-text`/`rn-pressable`/`rn-image`/`rn-textinput`/`rn-scrollview` + a `StyleSheet.create`/`Platform`/`Animated` passthrough), `_safe-area-stub.cjs` (`SafeAreaView`→`rn-view`, `useSafeAreaInsets`→`{top:0,bottom:0,left:0,right:0}`), `_icons-stub.cjs` (every `lucide-react-native` icon → a no-op `rn-view` named by its export), `_svg-stub.cjs` (`Svg`/`Path`/`Line`/`Circle`/`Defs`/`LinearGradient`/`Stop`/`Rect`/`G`/`Text` → host `svg-*` elements), `_linear-gradient-stub.cjs` (`LinearGradient`→`rn-view` that keeps its `colors` prop), and `_setup-rn-mocks.cjs` that registers all five via `require('module')._cache` aliasing (copy showbook's `_setup-rn-mocks.cjs` verbatim and extend its alias map with `react-native-svg` → `_svg-stub.cjs` and `expo-linear-gradient` → `_linear-gradient-stub.cjs`). Reference: `/Users/ethansmith/Developer/showbook/apps/mobile/components/__tests__/_setup-rn-mocks.cjs` and its sibling `_rn-stub.cjs`/`_safe-area-stub.cjs`/`_icons-stub.cjs`.

Then create `apps/mobile/components/__tests__/aurora-primitives.test.cjs`:
```cjs
require('./_setup-rn-mocks.cjs');

const { describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const TestRenderer = require('react-test-renderer');

const { ThemeProvider } = require('../../lib/theme/index.ts');
const { StatusChip } = require('../aurora/status-chip.tsx');
const { AirlineChip, AirlineChipPair } = require('../aurora/airline-chip.tsx');
const { GradientButton } = require('../aurora/gradient-button.tsx');
const { SegmentedControl } = require('../aurora/segmented-control.tsx');

function render(node) {
  let r;
  TestRenderer.act(() => {
    r = TestRenderer.create(React.createElement(ThemeProvider, null, node));
  });
  return r;
}
function texts(r) {
  return r.root.findAllByType('rn-text').map((n) => n.props.children);
}

describe('StatusChip', () => {
  it('renders the label for each tone', () => {
    const r = render(React.createElement(StatusChip, { tone: 'active', label: 'ACTIVE' }));
    assert.ok(texts(r).includes('ACTIVE'));
  });
});

describe('AirlineChipPair', () => {
  it('renders two monogram chips for a multi-carrier flight', () => {
    const r = render(React.createElement(AirlineChipPair, { codes: ['UA', 'AS'] }));
    const labels = texts(r);
    assert.ok(labels.includes('UA'));
    assert.ok(labels.includes('AS'));
  });
  it('AirlineChip renders one monogram', () => {
    const r = render(React.createElement(AirlineChip, { code: 'DL' }));
    assert.ok(texts(r).includes('DL'));
  });
});

describe('GradientButton', () => {
  it('fires onPress', () => {
    const onPress = mock.fn();
    const r = render(React.createElement(GradientButton, { label: 'Create trip', onPress }));
    const btn = r.root.findAllByType('rn-pressable')[0];
    TestRenderer.act(() => btn.props.onPress?.());
    assert.equal(onPress.mock.callCount(), 1);
  });
});

describe('SegmentedControl', () => {
  it('fires onChange for the tapped segment', () => {
    const onChange = mock.fn();
    const r = render(
      React.createElement(SegmentedControl, {
        options: [{ value: 'trips', label: 'Trips' }, { value: 'chat', label: 'Assistant' }],
        value: 'trips',
        onChange,
      }),
    );
    const pressables = r.root.findAllByType('rn-pressable');
    TestRenderer.act(() => pressables[1].props.onPress?.());
    assert.equal(onChange.mock.callCount(), 1);
    assert.equal(onChange.mock.calls[0].arguments[0], 'chat');
  });
});
```

- [ ] **Step 6: Run the component test to verify it fails**

Run:
```bash
pnpm --filter mobile exec node --import tsx --test components/__tests__/aurora-primitives.test.cjs
```
Expected: FAIL — `Cannot find module '../aurora/status-chip.tsx'`.

- [ ] **Step 7: Implement the shared primitives**

Create `apps/mobile/components/aurora/aurora-card.tsx`:
```tsx
import React from 'react';
import { View, StyleSheet, type ViewProps } from 'react-native';
import { useTheme } from '@/lib/theme';

/** White surface card: radius 16, card-on-canvas shadow. `accent` paints a 3px
 * left border (used for the multi-carrier flight card). */
export function AuroraCard({
  children,
  accent,
  style,
  ...rest
}: ViewProps & { accent?: string }): React.JSX.Element {
  const { tokens } = useTheme();
  return (
    <View
      {...rest}
      style={[
        styles.card,
        {
          backgroundColor: tokens.color.card,
          borderRadius: tokens.radius.card,
          ...tokens.shadow.cardOnCanvas,
        },
        accent ? { borderLeftWidth: 3, borderLeftColor: accent } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ card: { padding: 16 } });
```

Create `apps/mobile/components/aurora/status-chip.tsx`:
```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/lib/theme';

export type ChipTone = 'active' | 'paused' | 'nonstop' | 'stop' | 'success' | 'layover';

/** Pill badge (radius 999). Tone selects fg/bg from the Aurora status tokens. */
export function StatusChip({ tone, label }: { tone: ChipTone; label: string }): React.JSX.Element {
  const { tokens } = useTheme();
  const c = tokens.color;
  const map: Record<ChipTone, { fg: string; bg: string; border?: string }> = {
    active: { fg: c.primaryDeep, bg: c.chipBg },
    paused: { fg: c.warning, bg: c.warningBg },
    nonstop: { fg: c.success, bg: c.successBg },
    stop: { fg: c.warning, bg: c.warningBg },
    success: { fg: c.success, bg: c.successBg },
    layover: { fg: c.layover, bg: c.layoverBg, border: c.layoverBorder },
  };
  const t = map[tone];
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: t.bg, borderRadius: tokens.radius.badge },
        t.border ? { borderWidth: StyleSheet.hairlineWidth, borderColor: t.border } : null,
      ]}
    >
      <Text style={{ color: t.fg, fontFamily: tokens.font[700], fontSize: 10, letterSpacing: 0.5 }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start' },
});
```

Create `apps/mobile/components/aurora/airline-chip.tsx`:
```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/lib/theme';
import { airlineChip } from '@/lib/aurora';

const SIZE = 30;

/** A single original-mark airline monogram chip (NOT a real trademark). */
export function AirlineChip({ code, size = SIZE }: { code?: string | null; size?: number }): React.JSX.Element {
  const { tokens } = useTheme();
  const chip = airlineChip(code);
  return (
    <LinearGradient
      colors={chip.colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ color: '#FFFFFF', fontFamily: tokens.font[800], fontSize: size * 0.4 }}>{chip.label}</Text>
    </LinearGradient>
  );
}

/** Two overlapping chips for a multi-carrier itinerary (−10px overlap, 2px white ring). */
export function AirlineChipPair({ codes }: { codes: [string, string] | string[] }): React.JSX.Element {
  return (
    <View style={styles.pairRow}>
      {codes.slice(0, 2).map((code, i) => (
        <View key={`${code}-${i}`} style={[styles.ring, i > 0 ? { marginLeft: -10 } : null]}>
          <AirlineChip code={code} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pairRow: { flexDirection: 'row', alignItems: 'center' },
  ring: { borderRadius: 9, borderWidth: 2, borderColor: '#FFFFFF' },
});
```

Create `apps/mobile/components/aurora/hotel-photo.tsx`:
```tsx
import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Building2 } from 'lucide-react-native';
import { useTheme } from '@/lib/theme';

/** Cover photo with a graceful violet-surface placeholder when no URL / on error. */
export function HotelPhoto({
  uri,
  size = 56,
}: {
  uri?: string | null;
  size?: number;
}): React.JSX.Element {
  const { tokens } = useTheme();
  const [failed, setFailed] = React.useState(false);
  const radius = tokens.radius.inner;
  if (!uri || failed) {
    return (
      <View
        style={[styles.ph, { width: size, height: size, borderRadius: radius, backgroundColor: tokens.color.surface }]}
      >
        <Building2 size={size * 0.4} color={tokens.color.textFaint} strokeWidth={2} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, borderRadius: radius }}
      resizeMode="cover"
    />
  );
}

const styles = StyleSheet.create({ ph: { alignItems: 'center', justifyContent: 'center' } });
```

Create `apps/mobile/components/aurora/gradient-button.tsx`:
```tsx
import React from 'react';
import { Pressable, Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/lib/theme';

/** Primary = violet gradient + glow shadow; secondary = white + hairline border. */
export function GradientButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  testID,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}): React.JSX.Element {
  const { tokens } = useTheme();
  const isPrimary = variant === 'primary';
  const inner = loading ? (
    <ActivityIndicator color={isPrimary ? '#FFFFFF' : tokens.color.primary} />
  ) : (
    <Text
      style={{
        color: isPrimary ? '#FFFFFF' : tokens.color.textStrong,
        fontFamily: tokens.font[700],
        fontSize: 15,
      }}
    >
      {label}
    </Text>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.wrap, { borderRadius: tokens.radius.pill, opacity: disabled ? 0.5 : 1 }, isPrimary ? tokens.shadow.primaryButton : null]}
    >
      {isPrimary ? (
        <LinearGradient colors={tokens.gradient.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.fill, { borderRadius: tokens.radius.pill }]}>
          {inner}
        </LinearGradient>
      ) : (
        <View style={[styles.fill, { borderRadius: tokens.radius.pill, backgroundColor: tokens.color.card, borderWidth: StyleSheet.hairlineWidth, borderColor: tokens.color.hairline }]}>
          {inner}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'visible' },
  fill: { paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
});
```

Create `apps/mobile/components/aurora/segmented-control.tsx`:
```tsx
import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '@/lib/theme';

export interface SegmentedOption<V extends string> {
  value: V;
  label: string;
}

/** Rule-track segmented control with a white active pill (subtle shadow). */
export function SegmentedControl<V extends string>({
  options,
  value,
  onChange,
  testID,
}: {
  options: SegmentedOption<V>[];
  value: V;
  onChange: (v: V) => void;
  testID?: string;
}): React.JSX.Element {
  const { tokens } = useTheme();
  return (
    <View testID={testID} style={[styles.track, { backgroundColor: tokens.color.surface, borderRadius: tokens.radius.pill }]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(opt.value)}
            style={[styles.segment, { borderRadius: tokens.radius.pill }, active ? { backgroundColor: tokens.color.card, ...tokens.shadow.cardOnCanvas, shadowOpacity: 0.06, shadowRadius: 6 } : null]}
          >
            <Text style={{ color: active ? tokens.color.textStrong : tokens.color.textMuted, fontFamily: tokens.font[active ? 700 : 500], fontSize: 13 }}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: 3 },
  segment: { flex: 1, paddingVertical: 7, alignItems: 'center', justifyContent: 'center' },
});
```

Create `apps/mobile/components/aurora/price-chart.tsx`:
```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { useTheme } from '@/lib/theme';
import type { ChartPoint } from '@/lib/aurora';

/**
 * Price-history chart: violet Total area + dashed cyan Hotel line + a moving
 * "current" dot, y-axis fixed $0–$1000, with a "Now $X" badge near the last
 * point. Hand-rolled with react-native-svg (no chart lib dependency).
 */
export function PriceChart({
  points,
  nowLabel,
  height = 160,
}: {
  points: ChartPoint[];
  nowLabel: string;
  height?: number;
}): React.JSX.Element {
  const { tokens } = useTheme();
  const [w, setW] = React.useState(0);
  const pad = { l: 8, r: 8, t: 12, b: 18 };
  const yMax = 1000;
  const innerW = Math.max(w - pad.l - pad.r, 1);
  const innerH = height - pad.t - pad.b;
  const n = Math.max(points.length - 1, 1);
  const x = (i: number) => pad.l + (innerW * i) / n;
  const y = (v: number) => pad.t + innerH * (1 - Math.min(v, yMax) / yMax);

  const totalLine = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.total)}`).join(' ');
  const area = points.length
    ? `${totalLine} L ${x(points.length - 1)} ${pad.t + innerH} L ${x(0)} ${pad.t + innerH} Z`
    : '';
  const hotelLine = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.hotel)}`).join(' ');
  const last = points[points.length - 1];

  return (
    <View style={{ height }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 ? (
        <Svg width={w} height={height}>
          <Defs>
            <SvgGradient id="totalFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={tokens.color.primary} stopOpacity={0.28} />
              <Stop offset="1" stopColor={tokens.color.primary} stopOpacity={0.02} />
            </SvgGradient>
          </Defs>
          {[0, 250, 500, 750, 1000].map((g) => (
            <Line key={g} x1={pad.l} x2={w - pad.r} y1={y(g)} y2={y(g)} stroke={tokens.color.hairline} strokeWidth={1} />
          ))}
          {area ? <Path d={area} fill="url(#totalFill)" /> : null}
          <Path d={totalLine} stroke={tokens.color.primary} strokeWidth={2.5} fill="none" />
          <Path d={hotelLine} stroke={tokens.color.accentCyan} strokeWidth={2} strokeDasharray="5 4" fill="none" />
          {last ? <Circle cx={x(points.length - 1)} cy={y(last.total)} r={5} fill={tokens.color.primary} stroke="#FFFFFF" strokeWidth={2} /> : null}
        </Svg>
      ) : null}
      <View style={[styles.nowBadge, { backgroundColor: tokens.color.primary, borderRadius: tokens.radius.pill }]}>
        <Text style={{ color: '#FFFFFF', fontFamily: tokens.font[800], fontSize: 11 }}>{nowLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nowBadge: { position: 'absolute', top: 8, right: 8, paddingHorizontal: 8, paddingVertical: 3 },
});
```

Create `apps/mobile/components/aurora/index.ts`:
```ts
export { AuroraCard } from './aurora-card';
export { StatusChip, type ChipTone } from './status-chip';
export { AirlineChip, AirlineChipPair } from './airline-chip';
export { HotelPhoto } from './hotel-photo';
export { GradientButton } from './gradient-button';
export { SegmentedControl, type SegmentedOption } from './segmented-control';
export { PriceChart } from './price-chart';
```

- [ ] **Step 8: Run the component test to verify it passes**

Run:
```bash
pnpm --filter mobile exec node --import tsx --test components/__tests__/aurora-primitives.test.cjs
```
Expected: PASS — StatusChip / AirlineChip(Pair) / GradientButton / SegmentedControl render-smoke all pass.

- [ ] **Step 9: Typecheck + lint**

Run:
```bash
pnpm --filter mobile typecheck && pnpm --filter mobile lint
```
Expected: both exit 0.

- [ ] **Step 10: Confirm coverage on `lib/aurora.ts`**

Run:
```bash
pnpm --filter mobile test:coverage 2>&1 | tail -25
```
Expected: `lib/aurora.ts` is exercised by `aurora.test.ts`; the `lib/**` scope stays ≥80% lines/branches/functions (tokens + api/client + auth from P2, plus aurora). The component `.tsx` files and `.cjs` stubs are outside the `lib/**` gate.

- [ ] **Step 11: Commit**

```bash
git add apps/mobile/lib/aurora.ts apps/mobile/lib/__tests__/aurora.test.ts apps/mobile/components/aurora apps/mobile/components/__tests__
# include apps/mobile/package.json + pnpm-lock.yaml ONLY if Step 1 added a dep
git commit -m "feat(mobile): Aurora screen primitives + pure flight/hotel/selection helpers"
```

---

## Task 2: Sign in screen

**Files:**
- Modify: `apps/mobile/app/(auth)/sign-in.tsx` (replace P2 stub)
- Test: headless web-export compile check + described simulator check.

**Interfaces:**
- Consumes: `useAuth()` (`signIn`, `isSigningIn`, `error`) from `@/lib/auth`; `useTheme`/`tokens` (`@/lib/theme`); `GradientButton` (`@/components/aurora`).
- Produces: the styled Aurora sign-in hero (the route name `(auth)/sign-in` is unchanged).

- [ ] **Step 1: Implement the Aurora sign-in hero**

Replace the body of `apps/mobile/app/(auth)/sign-in.tsx`. Centered hero matching the handoff "Phone → iOS Sign in (centered hero + Continue with Google)": soft radial violet/pink background tint (a `LinearGradient` wash on the page bg), a gradient logo mark (a 56px rounded square `LinearGradient` of `tokens.gradient.primary` with a plane glyph), eyebrow "DATE-RANGE OPTIMIZER" (`tokens.font[700]`, `letterSpacing` 1, `textMuted`), H1 "Find your cheapest **vacation window**" (the second line styled with `tokens.color.primary`), a one-line supporting paragraph (`textBody`), an inline feature row "Flights · Hotels · Price alerts" (muted), then a white sign-in card (`AuroraCard`) holding the Google button and caption. The Google action uses `GradientButton` styled as the spec's full-color button — render a `secondary` (white) `GradientButton` labelled "Continue with Google" with a 4-color Google "G" glyph to its left (build the G from four `View` quarter-arcs or an inline `react-native-svg` `G`; keep it an original mark). Wire `onPress={() => void signIn()}`, show `loading={isSigningIn}`, and render the `error` string (if any) in `tokens.color.warning` beneath. Caption "We never store passwords" in `textFaint` 11px. Use `SafeAreaView` from `react-native-safe-area-context`; 44px+ hit target on the button.

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Plane } from 'lucide-react-native';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { AuroraCard, GradientButton } from '@/components/aurora';

export default function SignInScreen(): React.JSX.Element {
  const { tokens } = useTheme();
  const { signIn, isSigningIn, error } = useAuth();
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: tokens.color.pageBg }]}>
      <View style={styles.center}>
        <LinearGradient colors={tokens.gradient.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logo}>
          <Plane size={26} color="#FFFFFF" strokeWidth={2.2} />
        </LinearGradient>
        <Text style={{ color: tokens.color.textMuted, fontFamily: tokens.font[700], fontSize: 11, letterSpacing: 1, marginTop: 20 }}>
          DATE-RANGE OPTIMIZER
        </Text>
        <Text style={[styles.h1, { color: tokens.color.textStrong, fontFamily: tokens.font[800] }]}>
          Find your cheapest{'\n'}
          <Text style={{ color: tokens.color.primary }}>vacation window</Text>
        </Text>
        <Text style={{ color: tokens.color.textBody, fontFamily: tokens.font[500], fontSize: 14, textAlign: 'center', marginTop: 10, maxWidth: 300 }}>
          Track flights & hotels across flexible dates and get alerted when the total drops.
        </Text>
        <Text style={{ color: tokens.color.textMuted, fontFamily: tokens.font[600], fontSize: 12, marginTop: 14 }}>
          Flights · Hotels · Price alerts
        </Text>
        <AuroraCard style={styles.card}>
          <Text style={{ color: tokens.color.textStrong, fontFamily: tokens.font[700], fontSize: 16, marginBottom: 14, textAlign: 'center' }}>
            Ready to get started?
          </Text>
          <GradientButton variant="secondary" label="Continue with Google" onPress={() => void signIn()} loading={isSigningIn} testID="sign-in-google-button" accessibilityLabel="Continue with Google" />
          <Text style={{ color: tokens.color.textFaint, fontFamily: tokens.font[500], fontSize: 11, marginTop: 12, textAlign: 'center' }}>
            We never store passwords
          </Text>
          {error ? (
            <Text style={{ color: tokens.color.warning, fontFamily: tokens.font[500], fontSize: 12, marginTop: 12, textAlign: 'center' }}>
              {error}
            </Text>
          ) : null}
        </AuroraCard>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  logo: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  h1: { fontSize: 26, lineHeight: 32, letterSpacing: -0.5, textAlign: 'center', marginTop: 8 },
  card: { width: '100%', maxWidth: 360, marginTop: 28 },
});
```

- [ ] **Step 2: Typecheck + lint**

Run:
```bash
pnpm --filter mobile typecheck && pnpm --filter mobile lint
```
Expected: both exit 0.

- [ ] **Step 3: Headless compile check (P2's web-export gate)**

Run:
```bash
pnpm --filter mobile exec expo export --platform web --output-dir /tmp/vpt-mobile-web 2>&1 | tail -8
```
Expected: `Exported …` with no module-resolution errors (confirms the screen + its imports resolve through Metro).

- [ ] **Step 4: Manual simulator check (described — not automated here)**

With the dev stack up (`docker ps` shows `api`), `pnpm mobile:ios` and confirm: the app boots past splash to the Aurora sign-in hero — gradient logo, "DATE-RANGE OPTIMIZER" eyebrow, the two-line violet headline, the white card with "Continue with Google" (4-color G) and "We never store passwords". Tapping the button invokes `useAuth().signIn()` (the OAuth flow; on a misconfigured client it surfaces the descriptive `error` string in amber). A Maestro flow that taps `sign-in-google-button` belongs to **P4** — here it is a manual walk only.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(auth\)/sign-in.tsx
git commit -m "feat(mobile): Aurora sign-in hero (Continue with Google, no-passwords caption)"
```

---

## Task 3: Trips list

**Files:**
- Modify: `apps/mobile/app/(tabs)/index.tsx` (replace P2 stub)
- Create: `apps/mobile/components/aurora/trip-card.tsx`
- Test: headless compile check + described simulator check (the card's pure formatting is covered via `lib/aurora.ts` helpers already tested).

**Interfaces:**
- Consumes: `useApiClient()` (`listTrips`) from `@/lib/api/provider`; `@tanstack/react-query` `useQuery`; `TripSummary` from `@/lib/api/client`; `formatMoneyString`/`formatUsd` (`@/lib/theme` + `@/lib/aurora`); `AuroraCard`/`StatusChip` (`@/components/aurora`); `useRouter` (expo-router) for navigation to `trip/[id]` + `trip/new`.
- Produces: the Trips tab body. A `TripCard` component (name + status chip; route `SFO ↔ RDM` · dates; three mini-stats Flight/Hotel/Total) consumed here and reused nowhere else (kept in `components/aurora` for cohesion).

- [ ] **Step 1: Implement `TripCard`**

Create `apps/mobile/components/aurora/trip-card.tsx`. Renders inside an `AuroraCard`: top row = trip name (`textStrong` 700 16px) + a `StatusChip` (`active`→"ACTIVE" / `paused`→"PAUSED" from `trip.status`); a meta line `${origin} ↔ ${destination} · ${dateRange}` (`textMuted` 500 12px); a three-up mini-stat row (Flight / Hotel / Total) each a small label (`label` token style, uppercase) over a value (`statValue` style; Total in `tokens.color.primary`). Money via `formatMoneyString(trip.flight_price)` etc. (fields read from `TripSummary`; if a price is absent show "—"). The whole card is a `Pressable` calling `onPress`. **Canonical testIDs (E2E contract):** the `Pressable` carries `testID={\`trip-card-${trip.id}\`}` (the bare `trip-card` prefix lets Maestro match any card; the id suffix targets a specific one) with `accessibilityLabel={\`Trip ${trip.name}\`}`; the **Total** stat's value `Text` carries `testID="trip-card-total"`. Use the same field names as `TripSummary` (the generated `TripResponse` — read `id`, `name`, `status`, `origin`, `destination`, depart/return dates, and the latest snapshot flight/hotel/total if present; where the summary lacks per-component prices, show the total only and "—" for the rest, leaving full numbers to Trip detail).

- [ ] **Step 2: Implement the Trips tab body**

Replace `apps/mobile/app/(tabs)/index.tsx`. A `SafeAreaView` page (`pageBg`) with a header ("Your Trips" H1 `tokens.type.h1`, a subcount "N tracked" in `textMuted`). Body = a `FlatList` of `TripCard`s with `useThemedRefreshControl`-style pull-to-refresh wired to react-query `refetch` (mirror showbook's PullToRefresh pattern — build a themed `RefreshControl` inline using `tokens.color.primary` tint, `refreshing={query.isRefetching}`). Data via:
```ts
const api = useApiClient();
const query = useQuery({ queryKey: ['trips'], queryFn: () => api.listTrips() });
```
States: **loading** (a few skeleton `AuroraCard`s — grey blocks), **error** (centered message + a `GradientButton` "Try again" calling `refetch`), **empty** (centered "No trips yet" copy + "New trip" CTA). A FAB (floating violet circular `+` button, `primaryButton` shadow, bottom-right above the tab bar) navigates `router.push('/trip/new')`. Tapping a card navigates `router.push(\`/trip/${trip.id}\`)`. Use `lib/aurora` formatters; do not format money inline. **Canonical testIDs (E2E contract):** the `FlatList` carries `testID="trips-list"`; the FAB `Pressable` carries `testID="new-trip-fab"` + `accessibilityLabel="New trip"` (`accessibilityRole="button"`). (Each `TripCard` already carries `trip-card` / `trip-card-total` per Step 1.)

- [ ] **Step 3: Typecheck + lint, then headless compile check**

Run:
```bash
pnpm --filter mobile typecheck && pnpm --filter mobile lint && pnpm --filter mobile exec expo export --platform web --output-dir /tmp/vpt-mobile-web 2>&1 | tail -8
```
Expected: typecheck + lint exit 0; export prints `Exported …` with no resolution errors.

- [ ] **Step 4: Manual simulator check (described)**

With a mocked session seeded (per P2 Task 6 Step 9) so the auth gate lands in the tab shell: the Trips tab shows trip cards (name + ACTIVE/PAUSED chip, route · dates, Flight/Hotel/Total mini-stats), a working pull-to-refresh spinner, the violet FAB opening the create modal, and tapping a card pushing `trip/[id]`. With the API down, confirm the error state renders a "Try again" button; with an empty trip list, the empty state CTA. (A Maestro list-scroll flow is P4.)

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(tabs\)/index.tsx apps/mobile/components/aurora/trip-card.tsx
git commit -m "feat(mobile): Trips list (cards, status chips, FAB, pull-to-refresh, loading/empty/error)"
```

---

## Task 4: Trip detail (the interactive screen)

**Files:**
- Modify: `apps/mobile/app/trip/[id].tsx` (replace P2 stub)
- Create: `apps/mobile/components/aurora/stat-trio.tsx`
- Create: `apps/mobile/components/aurora/flight-row.tsx`
- Create: `apps/mobile/components/aurora/hotel-row.tsx`
- Test: `apps/mobile/lib/__tests__/aurora.test.ts` already asserts the reducer + the three totals + chart "Now $X" (Task 1). This task adds a render-smoke `.cjs` test for the selection wiring (`apps/mobile/components/__tests__/trip-detail-selection.test.cjs`).

**Interfaces:**
- Consumes: `useApiClient()` (`getTrip`) ; `useLocalSearchParams` (expo-router) for `id`; the `lib/aurora` selection module (`initialSelection`, `selectReducer`, `computeTripTotal`, `buildChartSeries`, plus all the row-formatting helpers); `AuroraCard`/`StatusChip`/`AirlineChip`/`AirlineChipPair`/`HotelPhoto`/`PriceChart`/`GradientButton` (`@/components/aurora`); `TripDetailResponse`/`FlightOffer`/`HotelOffer`/`PriceSnapshot` types.
- Produces: the interactive Trip-detail screen + `StatTrio` (Flight/Hotel/Trip-total gradient card) + collapsible `FlightRow`/`HotelRow`.

- [ ] **Step 1: Write the failing selection render-smoke test**

Create `apps/mobile/components/__tests__/trip-detail-selection.test.cjs`. Using the same RN-stub harness as Task 1 and a small in-file fixture (Alaska $177 / United-1stop $142 / Delta $142 / Riverhouse $153/night / Eviva $134.50/night, `nights=4`), drive a tiny harness component that holds `React.useReducer(selectReducer, initialSelection(flights, hotels))` and renders `computeTripTotal(selectedFlight, selectedHotel, 4)` via `formatUsd`, plus the three `FlightRow`s and two `HotelRow`s. Assert:
- initial render shows `$680` (cheapest UA tie→first-cheapest is UA $142, cheapest hotel Eviva $134.50 → 142 + 538 = 680).

Wait — re-check the verified anchors: the screen must be able to reach 789/754/680 by selection. Assert by dispatching:
- select Alaska + select Riverhouse → total text `$789`.
- select United + Riverhouse → `$754`.
- select Delta + Eviva → `$680`.
- After selecting Alaska (flight) then United (flight), only United's row is expanded (find the OUTBOUND/RETURN detail block — present once). This pins one-expanded-at-a-time through the real components.

```cjs
require('./_setup-rn-mocks.cjs');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const TestRenderer = require('react-test-renderer');
const { ThemeProvider, formatUsd } = require('../../lib/theme/index.ts');
const aurora = require('../../lib/aurora.ts');
const { FlightRow } = require('../aurora/flight-row.tsx');
const { HotelRow } = require('../aurora/hotel-row.tsx');

const flights = [/* AS 177 nonstop, UA 142 1-stop via DEN (UA+AS legs), DL 142 nonstop — full fixture as in lib test */];
const hotels = [/* Riverhouse 153/night, Eviva 134.5/night */];
const NIGHTS = 4;

function Harness() {
  const [sel, dispatch] = React.useReducer(aurora.selectReducer, aurora.initialSelection(flights, hotels));
  Harness.dispatch = dispatch;
  const f = flights.find((x) => x.id === sel.selectedFlightId) ?? null;
  const h = hotels.find((x) => x.id === sel.selectedHotelId) ?? null;
  const total = aurora.computeTripTotal(f, h, NIGHTS);
  return React.createElement(
    React.Fragment,
    null,
    React.createElement('rn-text', { testID: 'trip-detail-total-stat' }, formatUsd(total)),
    ...flights.map((fl) =>
      React.createElement(FlightRow, {
        key: fl.id, offer: fl, nights: NIGHTS,
        selected: sel.selectedFlightId === fl.id, expanded: sel.expandedFlightId === fl.id,
        onPress: () => dispatch({ kind: 'flight', id: fl.id }),
      }),
    ),
    ...hotels.map((ho) =>
      React.createElement(HotelRow, {
        key: ho.id, offer: ho, nights: NIGHTS,
        selected: sel.selectedHotelId === ho.id, expanded: sel.expandedHotelId === ho.id,
        onPress: () => dispatch({ kind: 'hotel', id: ho.id }),
      }),
    ),
  );
}

function totalText(r) {
  return r.root.findAll((n) => n.props && n.props.testID === 'trip-detail-total-stat')[0].props.children;
}

describe('Trip detail selection → total', () => {
  it('reproduces 789 / 754 / 680 by selection', () => {
    let r;
    TestRenderer.act(() => { r = TestRenderer.create(React.createElement(ThemeProvider, null, React.createElement(Harness))); });
    TestRenderer.act(() => { Harness.dispatch({ kind: 'flight', id: 'f-as' }); Harness.dispatch({ kind: 'hotel', id: 'h-river' }); });
    assert.equal(totalText(r), '$789');
    TestRenderer.act(() => { Harness.dispatch({ kind: 'flight', id: 'f-ua' }); });
    assert.equal(totalText(r), '$754');
    TestRenderer.act(() => { Harness.dispatch({ kind: 'flight', id: 'f-dl' }); Harness.dispatch({ kind: 'hotel', id: 'h-eviva' }); });
    assert.equal(totalText(r), '$680');
  });
});
```
(Fill the `flights`/`hotels` arrays with the exact same fixture objects as the `lib/__tests__/aurora.test.ts` Step 1 fixture, with hotel `price` per-night: Riverhouse `'153.00'`, Eviva `'134.50'`.)

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
pnpm --filter mobile exec node --import tsx --test components/__tests__/trip-detail-selection.test.cjs
```
Expected: FAIL — `Cannot find module '../aurora/flight-row.tsx'`.

- [ ] **Step 3: Implement `StatTrio`**

Create `apps/mobile/components/aurora/stat-trio.tsx`. A horizontal row of three stat chips (handoff "three short stat chips"): **Flight** (plane icon + label + value), **Hotel** (building icon + value + a `$X/night` subnote), **Trip total** (a `LinearGradient` `tokens.gradient.totalCard` card with `totalCard` shadow, white label + white value). Props: `{ flight: number; hotelTotal: number; hotelPerNight: number; tripTotal: number }`, formatted via `formatUsd`. Icons from `lucide-react-native` (`Plane`, `Building2`). **Canonical testIDs (E2E contract):** each chip's value `Text` carries, respectively, `testID="trip-detail-flight-stat"`, `testID="trip-detail-hotel-stat"`, `testID="trip-detail-total-stat"` (with matching `accessibilityLabel`s, e.g. `Trip total ${formatUsd(tripTotal)}`). The total-stat id is the one the Task-4 selection test asserts against.

- [ ] **Step 4: Implement `FlightRow` (collapsible)**

Create `apps/mobile/components/aurora/flight-row.tsx`. Props `{ offer: FlightOffer; nights: number; selected: boolean; expanded: boolean; onPress: () => void }`. **Canonical testID (E2E contract):** the row's outer `Pressable` carries `testID={\`flight-option-${offer.id}\`}` (bare `flight-option` prefix for "any", id suffix for a specific row) with `accessibilityLabel={\`${offer.airline_name} ${formatMoneyString(offer.price)}\`}` and `accessibilityState={{ selected }}`. **Collapsed:** a `Pressable` row — a radio (filled violet circle when `selected`, else hairline ring) + `AirlineChip` (or `AirlineChipPair` when the itinerary's segments span two carriers — derive from `offer.itineraries[].segments[].carrier_code` uniqueness) + airline name (`textStrong` 600) + a `StatusChip` with `stopsBadge(offer.stops, viaCode)` (tone `nonstop`→green / `stop`→amber; `viaCode` = the intermediate segment's `arrival_airport`) + price `formatMoneyString(offer.price)` (violet when selected) + a chevron (`ChevronDown`/`ChevronUp` per `expanded`). Under the row, a one-line summary `flightSummaryLine(offer)`. The card gets a 3px amber left accent (`AuroraCard accent={tokens.color.layover}`) when multi-carrier. Selected rows: `surfaceAlt` bg + `selectedBorder`. **Expanded (non-stop):** OUTBOUND / RETURN blocks — times + airport codes + `duration · flightNumber`, a thin progress line with a ✈ marker (a `View` rule + a `Plane` icon). **Expanded (multi-stop / multi-carrier):** per-leg rows each with **its own** `AirlineChip` (leg 1 `UA 508` SFO→DEN, leg 2 `AS 2201` DEN→RDM), an amber layover `StatusChip tone="layover"` with `layoverLabel(...)`, a RETURN summary, and a `multiCarrierSubtitle([...])` subtitle line. All labels via the `lib/aurora` helpers — no inline formatting.

- [ ] **Step 5: Implement `HotelRow` (collapsible)**

Create `apps/mobile/components/aurora/hotel-row.tsx`. Props `{ offer: HotelOffer; nights: number; selected: boolean; expanded: boolean; onPress: () => void }`. **Canonical testID (E2E contract):** the row's outer `Pressable` carries `testID={\`hotel-option-${offer.id}\`}` (bare `hotel-option` prefix for "any", id suffix for a specific row) with `accessibilityLabel={\`${offer.name}\`}` and `accessibilityState={{ selected }}`. Collapsed: `HotelPhoto` (no URL in `HotelOffer` today → placeholder) + name (`textStrong` 600) + a star row (`offer.rating` gold stars via `Star` icons, empty stars `starEmpty`) + descriptor (`offer.description`, 1 line) + `$${perNight} /night · $${total} total` where `perNight = parsePrice(offer.price)`, `total = perNight * nights`, formatted via `formatUsd` + a radio + chevron. Selected styling like `FlightRow`. Expanded: an info line (`offer.address` / cancellation copy from `offer.description`).

- [ ] **Step 6: Implement the Trip-detail screen**

Replace `apps/mobile/app/trip/[id].tsx`. Read `id` via `useLocalSearchParams`. Fetch with `useQuery({ queryKey: ['trip', id], queryFn: () => api.getTrip(id) })`. Derive `flights`/`hotels`/`priceHistory`/`nights` from `TripDetailResponse` (flight offers, hotel offers, snapshots, and trip dates → `nights`). Hold selection with `React.useReducer(selectReducer, initialSelection(flights, hotels))` (re-init via `key`/effect when data loads). Layout matches the handoff:
- A `ScrollView`. **Sticky top region** (achieved by rendering it above the scrolling lists inside a fixed header `View`, with only the flight/hotel lists in the scroll body — or `stickyHeaderIndices` on a `ScrollView`): breadcrumb "Your Trips / {name}", title row (name + `StatusChip` active/paused, route · dates · "{nights} nights · {adults} adults" chip, Edit/Refresh buttons), `StatTrio` (live from selection), `PriceChart` fed by `buildChartSeries(priceHistory, tripTotal, hotelTotal)` with the "Now $X" badge.
- **Scrolling body:** a "Flights" section (the `FlightRow`s, one expanded at a time, dispatch `{kind:'flight'}`), then a "Hotels" section (`HotelRow`s), each ending with a dashed "Show N more" affordance if the list is truncated. Selecting recomputes `StatTrio` + `PriceChart` (the "current" point and badge move). Loading/error states mirror Task 3.

- [ ] **Step 7: Run the selection test to verify it passes**

Run:
```bash
pnpm --filter mobile exec node --import tsx --test components/__tests__/trip-detail-selection.test.cjs lib/__tests__/aurora.test.ts
```
Expected: PASS — the component harness reproduces `$789` / `$754` / `$680` through the real `FlightRow`/`HotelRow` + reducer, and the lib suite stays green.

- [ ] **Step 8: Typecheck + lint + headless compile check**

Run:
```bash
pnpm --filter mobile typecheck && pnpm --filter mobile lint && pnpm --filter mobile exec expo export --platform web --output-dir /tmp/vpt-mobile-web 2>&1 | tail -8
```
Expected: all exit 0 / `Exported …`.

- [ ] **Step 9: Manual simulator check (described)**

Open a trip from the list. Confirm: the sticky stat trio + chart stay pinned while flights/hotels scroll beneath; tapping a flight selects + expands it (radio fills violet, row highlights, chevron flips) and collapses the previously expanded one; tapping the selected+expanded one collapses but keeps it selected; the StatTrio and chart "Now $X" badge update on every selection; selecting Alaska+Riverhouse shows **$789**, United(1-stop)+Riverhouse **$754**, Delta+Eviva **$680**; the 1-stop United row expands to two legs with their own monogram chips, an amber layover pill, and an "Operated by United & Alaska" subtitle. (A Maestro selection flow is P4.)

- [ ] **Step 10: Commit**

```bash
git add apps/mobile/app/trip/\[id\].tsx apps/mobile/components/aurora/stat-trio.tsx apps/mobile/components/aurora/flight-row.tsx apps/mobile/components/aurora/hotel-row.tsx apps/mobile/components/__tests__/trip-detail-selection.test.cjs
git commit -m "feat(mobile): interactive Trip detail (stat trio, price chart, collapsible flights/hotels, verified totals)"
```

---

## Task 5: Create trip

**Files:**
- Modify: `apps/mobile/app/trip/new.tsx` (replace P2 stub)
- Create: `apps/mobile/components/aurora/form-field.tsx`
- Create: `apps/mobile/components/aurora/toggle-row.tsx`
- Create: `apps/mobile/components/aurora/collapsible-section.tsx`
- Test: headless compile check + described simulator check (the `TripCreate` body assembly is plain state; idempotency-key generation is the only logic — add a tiny pure helper + test).

**Interfaces:**
- Consumes: `useApiClient()` (`createTrip`); `TripCreate` from `@/lib/api/client`; `useRouter` (to dismiss the modal + push the new `trip/[id]`); `@tanstack/react-query` `useMutation` + `queryClient.invalidateQueries(['trips'])`; `GradientButton`/`AuroraCard`/`SegmentedControl` (`@/components/aurora`); a new `makeIdempotencyKey()` in `lib/aurora.ts` (or a small `lib/ids.ts`).
- Produces: the Create-trip form modal.

- [ ] **Step 1: Add + test the idempotency-key helper**

Add to `apps/mobile/lib/aurora.ts` a pure `makeIdempotencyKey(rand?: () => string): string` (defaults to `crypto.randomUUID` when available, else a timestamp+random fallback) and extend `lib/__tests__/aurora.test.ts` with a test that two calls differ and the format is a non-empty string. Run the lib test (FAIL→implement→PASS).

- [ ] **Step 2: Implement the form primitives**

Create `apps/mobile/components/aurora/form-field.tsx` (`FormField`: label `label` token + a `TextInput` with `surface` bg, `inner` radius, `textStrong` value; optional `right` adornment for the ⇄ swap; **`FormField` accepts an optional `testID` prop that it forwards to the inner `TextInput`** plus an `accessibilityLabel` defaulting to the field label, so screens can attach canonical E2E ids), `apps/mobile/components/aurora/toggle-row.tsx` (`ToggleRow`: title + subtitle + a RN `Switch` tinted `tokens.color.primary`), and `apps/mobile/components/aurora/collapsible-section.tsx` (`CollapsibleSection`: header row with title + a `Switch` (enable) + chevron; body shown when expanded). These are layout-only (no coverage gate).

- [ ] **Step 3: Implement the Create-trip screen**

Replace `apps/mobile/app/trip/new.tsx`. Header "Create new trip" with a close affordance (modal). `AuroraCard` **Trip details**: `FormField` Trip name; a From / ⇄ / To row (two `FormField`s with a swap button between that swaps the values); Depart / Return (date fields — a simple `FormField` accepting `YYYY-MM-DD` for v1, noted as a follow-up for a native date picker) / Adults (a stepper or `FormField` numeric). `CollapsibleSection` **Flight preferences** (cabin `SegmentedControl` Economy/Premium/Business + a Non-stop-only `ToggleRow`, gated by the section's enable switch). `CollapsibleSection` **Hotel preferences** (collapsed row + enable toggle). `AuroraCard` **Alert me when…** ("total drops below $X" — a `FormField` numeric for the threshold). Footer: a secondary `GradientButton` "Cancel" (`router.back()`) + a primary `GradientButton` "Create trip" calling the mutation. The mutation assembles a `TripCreate` body from the form state and calls `api.createTrip(body, makeIdempotencyKey())`; on success `queryClient.invalidateQueries({ queryKey: ['trips'] })`, then `router.replace(\`/trip/${created.id}\`)`. Show field validation (name + From/To + dates required) inline; show submit errors (from `ApiError.detail`) in `tokens.color.warning`. **Canonical testIDs (E2E contract):** the Trip-name `FormField` carries `testID="create-trip-name-input"`; the **From** `FormField` carries `testID="create-trip-origin-input"` + `accessibilityLabel="From (origin)"`; the **To** `FormField` carries `testID="create-trip-destination-input"` + `accessibilityLabel="To (destination)"`; the primary "Create trip" `GradientButton` carries `testID="create-trip-submit"` + `accessibilityLabel="Create trip"`.

- [ ] **Step 4: Typecheck + lint + headless compile check**

Run:
```bash
pnpm --filter mobile typecheck && pnpm --filter mobile lint && pnpm --filter mobile exec expo export --platform web --output-dir /tmp/vpt-mobile-web 2>&1 | tail -8
```
Expected: all exit 0 / `Exported …`.

- [ ] **Step 5: Manual simulator check (described)**

Open the create modal from the Trips FAB. Confirm the grouped form renders (Trip details, collapsible Flight/Hotel prefs with working toggles, the "alert when total drops below $X" card), the ⇄ button swaps From/To, "Create trip" POSTs with an `X-Idempotency-Key` header (verify in `docker logs api`) and on success dismisses the modal into the new trip's detail. Re-submitting the same idempotency key returns the same trip (idempotency). (Maestro create flow is P4.)

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/trip/new.tsx apps/mobile/components/aurora/form-field.tsx apps/mobile/components/aurora/toggle-row.tsx apps/mobile/components/aurora/collapsible-section.tsx apps/mobile/lib/aurora.ts apps/mobile/lib/__tests__/aurora.test.ts
git commit -m "feat(mobile): Create trip form (grouped fields, prefs toggles, threshold, idempotent create)"
```

---

## Task 6: Assistant chat

**Files:**
- Modify: `apps/mobile/app/(tabs)/chat.tsx` (replace P2 stub)
- Create: `apps/mobile/components/aurora/chat-bubble.tsx`
- Create: `apps/mobile/components/aurora/quick-reply-chips.tsx`
- Create: `apps/mobile/lib/chat-stream.ts`
- Test: `apps/mobile/lib/__tests__/chat-stream.test.ts`

**Interfaces:**
- Consumes: `useApiClient()` (`sendChatMessage` → raw SSE `Response`); `AuroraCard`/`StatusChip` (`@/components/aurora`); `useTheme`.
- Produces: the Assistant chat screen + a pure SSE parser in `lib/chat-stream.ts` (the testable logic) + `ChatBubble`/`QuickReplyChips`.

- [ ] **Step 1: Write the failing SSE-parser test**

The streaming logic is the only real logic; isolate it in `lib/chat-stream.ts` and test it. Create `apps/mobile/lib/__tests__/chat-stream.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSseChunk, type SseState } from '../chat-stream';

test('accumulates assistant text deltas across chunks and surfaces tool-call events', () => {
  let state: SseState = { buffer: '', text: '', toolCalls: [], done: false };
  state = parseSseChunk(state, 'data: {"type":"text","delta":"Hel"}\n\n');
  state = parseSseChunk(state, 'data: {"type":"text","delta":"lo"}\n\ndata: {"type":"tool_call","name":"create_trip"}\n\n');
  assert.equal(state.text, 'Hello');
  assert.deepEqual(state.toolCalls, ['create_trip']);
  state = parseSseChunk(state, 'data: [DONE]\n\n');
  assert.equal(state.done, true);
});

test('keeps a partial trailing line in the buffer until its terminator arrives', () => {
  let state: SseState = { buffer: '', text: '', toolCalls: [], done: false };
  state = parseSseChunk(state, 'data: {"type":"text","delta":"par');
  assert.equal(state.text, '');               // partial — not yet emitted
  state = parseSseChunk(state, 'tial"}\n\n');
  assert.equal(state.text, 'partial');
});
```
(Adjust the event-shape strings to the API's actual `/v1/chat/messages` SSE format — confirm against `apps/api`'s chat router; the parser must tolerate `text`/`token`/`delta` field naming and a `tool_call` event, and treat `[DONE]` as terminal. Keep the parser tolerant: unknown event types are ignored, not fatal.)

- [ ] **Step 2: Run → FAIL → implement `lib/chat-stream.ts` → PASS**

Run `pnpm --filter mobile exec node --import tsx --test lib/__tests__/chat-stream.test.ts` (expect `Cannot find module '../chat-stream'`). Implement `parseSseChunk(state, chunk)`: append `chunk` to `state.buffer`, split on `\n\n`, keep the last partial in `buffer`, for each complete `data: …` event JSON-parse the payload (ignore parse errors), accumulate text deltas into `state.text`, push tool-call names into `state.toolCalls`, and set `state.done` on `[DONE]`. Re-run → PASS.

- [ ] **Step 3: Implement `ChatBubble` + `QuickReplyChips`**

Create `apps/mobile/components/aurora/chat-bubble.tsx` (`ChatBubble`: `role: 'user' | 'assistant'`; user = violet `tokens.color.primary` bg + white text, right-aligned; assistant = white `AuroraCard`-style bubble w/ hairline border + `textBody`, left-aligned; a `tool` variant renders a `StatusChip tone="success"` "🔧 {name}" tool-call chip). **Canonical testID (E2E contract):** an **assistant**-role `ChatBubble` carries `testID="assistant-message"` on its container `View` (user/tool variants do not) with `accessibilityLabel="Assistant message"`, so Maestro can wait on the streamed reply. Create `apps/mobile/components/aurora/quick-reply-chips.tsx` (`QuickReplyChips`: a wrapped row of pressable `chipBg` pills that call `onPick(text)`).

- [ ] **Step 4: Implement the Assistant screen**

Replace `apps/mobile/app/(tabs)/chat.tsx`. Header (gradient icon + "Assistant" + "Powered by Groq" subtitle). A `FlatList`/`ScrollView` thread of `ChatBubble`s (auto-scroll to bottom on new content); `QuickReplyChips` shown when the thread is empty (e.g. "Track a new trip", "Cheapest week to Maui?", "Show my alerts"). An "Ask anything…" input row pinned to the bottom (`KeyboardAvoidingView`) with a violet send button. **Canonical testIDs (E2E contract):** the message `TextInput` carries `testID="chat-input"` + `accessibilityLabel="Ask anything"`; the send `Pressable` carries `testID="chat-send"` + `accessibilityLabel="Send message"` (`accessibilityRole="button"`); each streamed assistant reply renders a `ChatBubble` carrying `assistant-message` (per Step 3). On send: append the user bubble, call `const res = await api.sendChatMessage({ message, thread_id })`, then read `res.body` as a stream — loop `await reader.read()`, `parseSseChunk` each decoded chunk, and update the in-progress assistant bubble's text + any tool-call chips as `state` evolves; finalize on `state.done`. Guard for `res.body` being null (web/test) by falling back to `await res.text()` parsed once.

- [ ] **Step 5: Typecheck + lint + headless compile check + run the parser test**

Run:
```bash
pnpm --filter mobile exec node --import tsx --test lib/__tests__/chat-stream.test.ts && pnpm --filter mobile typecheck && pnpm --filter mobile lint && pnpm --filter mobile exec expo export --platform web --output-dir /tmp/vpt-mobile-web 2>&1 | tail -8
```
Expected: parser test PASS; typecheck/lint exit 0; `Exported …`.

- [ ] **Step 6: Manual simulator check (described)**

Open the Chat tab. Confirm: empty-state quick-reply chips; sending a message renders a right-aligned violet user bubble and a left-aligned white assistant bubble that **streams** token-by-token; a tool call surfaces a success-tone tool-call chip; the input is keyboard-avoiding and the thread auto-scrolls. (Maestro chat flow is P4.)

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/app/\(tabs\)/chat.tsx apps/mobile/components/aurora/chat-bubble.tsx apps/mobile/components/aurora/quick-reply-chips.tsx apps/mobile/lib/chat-stream.ts apps/mobile/lib/__tests__/chat-stream.test.ts
git commit -m "feat(mobile): Assistant chat (streaming bubbles, quick replies, tool-call chip)"
```

---

## Task 7: Alerts tab + price-drop notification

**Files:**
- Modify: `apps/mobile/app/(tabs)/alerts.tsx` (replace P2 stub)
- Create: `apps/mobile/components/aurora/alert-row.tsx`
- Create: `apps/mobile/lib/notifications.ts`
- Test: `apps/mobile/lib/__tests__/notifications.test.ts`

**Interfaces:**
- Consumes: `useApiClient()` (`listTrips` — alerts are derived from each trip's threshold); `expo-notifications`; `AuroraCard`/`StatusChip` (`@/components/aurora`).
- Produces: the Alerts tab + a pure `buildPriceDropNotification(...)` + the registration/handler glue. **Note:** the actual server push *trigger* is P5; this task only does device-side registration/handler + the local-notification *rendering* of a price-drop, plus a dev-only "preview notification" affordance.

- [ ] **Step 1: Write the failing notification-content test**

Create `apps/mobile/lib/__tests__/notifications.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPriceDropNotification } from '../notifications';

test('builds the price-drop notification content matching the handoff copy', () => {
  const n = buildPriceDropNotification({ tripName: 'Test 2', threshold: 750, total: 724, tripId: 't1' });
  assert.equal(n.title, '📉 Test 2 just dropped below $750');
  assert.equal(n.body, 'Now $724 total — tap to view the trip.');
  assert.deepEqual(n.data, { tripId: 't1' });
});

test('omits the threshold phrasing when no threshold is set', () => {
  const n = buildPriceDropNotification({ tripName: 'Maui', threshold: null, total: 1800, tripId: 't2' });
  assert.equal(n.title, '📉 Maui price drop');
  assert.equal(n.body, 'Now $1,800 total — tap to view the trip.');
});
```

- [ ] **Step 2: Run → FAIL → implement `lib/notifications.ts` → PASS**

Run `pnpm --filter mobile exec node --import tsx --test lib/__tests__/notifications.test.ts` (expect module-not-found). Implement `lib/notifications.ts`:
- `buildPriceDropNotification({ tripName, threshold, total, tripId }): { title; body; data }` — pure, the tested piece. Title `📉 {tripName} just dropped below ${threshold}` (or `📉 {tripName} price drop` when `threshold` is null); body `Now $${total.toLocaleString()} total — tap to view the trip.`; `data: { tripId }`.
- `registerForPushNotificationsAsync(): Promise<string | null>` — requests permission, returns the Expo push token (best-effort; returns null on web/denied). **Does not** send the token to the server here — that endpoint is P5; leave a `// TODO(P5): POST device token to /v1/notifications/device-token` marker and a typed `registerDeviceToken` shim that no-ops until P5 wires the endpoint.
- `configureNotificationHandler()` — sets `Notifications.setNotificationHandler` so a foreground notification shows a banner; sets the Android channel (`importance: MAX` for heads-up) and iOS presentation (`shouldShowBanner`/`shouldPlaySound`) so a price-drop renders on the iOS lock screen and as an Android heads-up card.
- `presentLocalPriceDrop(args)` — calls `Notifications.scheduleNotificationAsync({ content: buildPriceDropNotification(args), trigger: null })` (used by the dev preview + as the rendering the P5 push will mirror).

Re-run → PASS.

- [ ] **Step 3: Wire the handler at app start**

In `apps/mobile/app/_layout.tsx` (P2's root layout) the provider chain already mounts; add a single `React.useEffect(() => { configureNotificationHandler(); }, [])` call near the font-load effect (this is a minimal additive edit inside P3's `app/**` ownership — it does **not** touch `app.config.ts`; the `expo-notifications` plugin is already in P2's config). Also register a notification-response listener that routes `data.tripId` to `router.push(\`/trip/${tripId}\`)`.

- [ ] **Step 4: Implement `AlertRow` + the Alerts tab**

Create `apps/mobile/components/aurora/alert-row.tsx` (`AlertRow`: trip name + a `StatusChip` (`active`/`paused`), the threshold "Alert below $X", and the current total with a `success`-tone chip + "↓ $Y" when the latest total is under threshold). Replace `apps/mobile/app/(tabs)/alerts.tsx`: header "Alerts"; a `FlatList` of `AlertRow`s built from `listTrips()` (one row per trip that has a threshold), with the same loading/empty/error pattern as Task 3; tapping a row pushes `trip/[id]`. **Canonical testID (E2E contract):** the `FlatList` carries `testID="alerts-list"`. Include a small dev-only "Preview price-drop" button (gated on `__DEV__`) that calls `presentLocalPriceDrop({ tripName: 'Test 2', threshold: 750, total: 724, tripId: <first trip id> })` so the lock-screen/heads-up rendering is demonstrable without the P5 server trigger.

- [ ] **Step 5: Typecheck + lint + headless compile check + run the notification test**

Run:
```bash
pnpm --filter mobile exec node --import tsx --test lib/__tests__/notifications.test.ts && pnpm --filter mobile typecheck && pnpm --filter mobile lint && pnpm --filter mobile exec expo export --platform web --output-dir /tmp/vpt-mobile-web 2>&1 | tail -8
```
Expected: notification test PASS; typecheck/lint exit 0; `Exported …`.

- [ ] **Step 6: Manual simulator check (described)**

On the Alerts tab confirm: one row per trip-with-threshold, each showing the threshold + current total (success chip when under). Tapping "Preview price-drop" (dev) presents a notification reading "📉 Test 2 just dropped below $750 … Now $724 total"; on iOS it appears on the lock screen, on Android as a heads-up card; tapping it deep-links into `trip/[id]`. (The server-side push that fires this in production is P5's daily-check work.)

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/app/\(tabs\)/alerts.tsx apps/mobile/components/aurora/alert-row.tsx apps/mobile/lib/notifications.ts apps/mobile/lib/__tests__/notifications.test.ts apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): Alerts tab + price-drop local notification (registration, handler, rendering)"
```

---

## Task 8: Android Material polish + responsive/tablet note

**Files:**
- Modify: the screens from Tasks 3–7 (platform branches via `Platform.OS === 'android'`)
- Test: headless compile check (Android target via `Platform.select` is compile-checked through the same export) + described Android-emulator check.

**Interfaces:**
- Consumes: everything built in Tasks 1–7; `Platform` from `react-native`.
- Produces: the Material adaptations the handoff calls out; an explicit iPad two-pane follow-up note.

- [ ] **Step 1: Apply the Material adaptations (spec-driven, platform-branched)**

Per the handoff "Phone → Android (Material)":
- **Trips:** the FAB becomes an **extended FAB** ("New trip" with a `+` icon — a pill, not a circle) on Android; the tab bar reads as a Material **pill nav bar** (already a tab bar from P2 — give it a Material elevation + active-pill indicator on Android via the tab bar style).
- **Trip detail:** a **collapsing gradient app bar** that shows the trip total when collapsed — implement with a scroll-driven header that shrinks the title region and surfaces the gradient total chip into the app-bar on Android (use `Animated`/scroll offset; iOS keeps the sticky region from Task 4).
- **Create:** **Material text fields** (violet underline instead of the filled `surface` field) on Android — branch `FormField` styling by `Platform.OS`; the primary button stays the violet pill.
- **Notifications:** the Android **heads-up** card with **VIEW TRIP / DISMISS** actions — add an Android notification category with two actions (`viewTrip` → deep-link, `dismiss`) in `configureNotificationHandler()`; iOS keeps the lock-screen banner.

Keep all branches behind `Platform.OS`/`Platform.select` so iOS rendering is unchanged. No new dependencies.

- [ ] **Step 2: Typecheck + lint + headless compile check**

Run:
```bash
pnpm --filter mobile typecheck && pnpm --filter mobile lint && pnpm --filter mobile exec expo export --platform web --output-dir /tmp/vpt-mobile-web 2>&1 | tail -8
```
Expected: all exit 0 / `Exported …` (the web export compiles the `Platform.select` branches).

- [ ] **Step 3: Manual Android-emulator check (described)**

`pnpm mobile:android` and confirm: extended "New trip" FAB on Trips; the collapsing gradient app bar surfaces the total on Trip detail scroll; Material underline text fields on Create; the price-drop heads-up notification shows VIEW TRIP / DISMISS actions and VIEW TRIP deep-links to the trip. iOS unchanged (re-verify Tasks 3–7 visually on the simulator).

- [ ] **Step 4: Record the iPad two-pane follow-up**

The handoff's **Tablet (iPad)** views (landscape sidebar two-pane Trips/detail/assistant; portrait trip detail) are **out of scope for P3** and are **not** implemented here. Add a short follow-up note at the end of this plan's Self-Review and (if the repo has one) `docs/specs`/planned-improvements equivalent: "iPad two-pane (`SplitViewLayout`-style) is a follow-up — mirror showbook's `components/SplitViewLayout.tsx` + `tabBarPosition` rail when picked up." The phone screens already reflow acceptably on the larger canvas because they are single-column `FlatList`/`ScrollView` layouts; a dedicated two-pane is the deferred work.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app apps/mobile/components/aurora apps/mobile/lib/notifications.ts
git commit -m "feat(mobile): Android Material polish (extended FAB, collapsing app bar, underline fields, heads-up actions)"
```

---

## Self-Review

**1. Spec coverage — every Phone screen + Interaction/State maps to a task:**
- Sign in (iOS centered hero + Continue with Google + "We never store passwords") → **Task 2**. ✓
- Trips (cards + status chips + FAB + pull-to-refresh, 3-tab bar from P2) → **Task 3**. ✓
- Trip detail ⭐ (sticky stat trio + chart, collapsible flights/hotels, selection→total→chart recompute, the three verified totals 789/754/680, one-expanded-at-a-time, multi-carrier legs + layover pill + "Operated by …") → **Task 4** (+ reducer/total/chart tests in **Task 1**). ✓
- Create (grouped form, From/⇄/To, Depart/Return/Adults, collapsible flight/hotel prefs + toggles, "alert when total drops below $X", idempotent `createTrip`) → **Task 5**. ✓
- Assistant (violet user / white assistant bubbles, quick-reply chips, tool-call chip, "Ask anything…", streams via `sendChatMessage`) → **Task 6**. ✓
- Price-drop alert (Alerts tab list + the "📉 Test 2 just dropped below $750 … $724 total" notification, iOS lock-screen + Android heads-up presentation, `expo-notifications` registration/handler — server trigger deferred to P5) → **Task 7**. ✓
- Android Material adaptation (extended FAB, pill nav, collapsing gradient app bar with total, Material text fields, heads-up VIEW TRIP/DISMISS) → **Task 8**. ✓
- Interactions & Behavior (selection core, sticky region, collapsible rows, toggles/segmented, buttons, notifications) → Tasks 4/5/6/7. ✓
- State Management (`selectedFlightId`/`expandedFlightId`/`selectedHotelId`/`expandedHotelId`, `tripTotal = flight.price + hotel.total`, chart recompute, threshold per trip) → `lib/aurora.ts` (**Task 1**) consumed by **Task 4** + threshold in **Task 5/7**. ✓
- Tablet (iPad two-pane) → **explicitly deferred** (Task 8 Step 4 follow-up note). ✓ (out of P3 scope per the assignment)

**2. P2 interfaces consumed (not redefined):** `useApiClient`/`listTrips`/`getTrip`/`createTrip`/`sendChatMessage`, `useAuth`, `tokens`/`useTheme`/`useThemedStyles`/`formatUsd`, `useAppFonts`, and the route stub names (`(auth)/sign-in`, `(tabs)/index|alerts|chat`, `trip/[id]`, `trip/new`) — this plan only **replaces the stub bodies** P2 created and **imports** P2's lib modules; it never re-declares `tokens`, the api client, or auth. The `lib/aurora.ts` helpers are an **independent recreation** of P1's web semantics (airlineChip/stopsBadge/layoverLabel/multiCarrierSubtitle) — no `apps/web` import.

**3. P4 boundary honored:** P3 does **not** edit `apps/mobile/app.config.ts` (the `expo-notifications` plugin is already in P2's config; the Task 7 handler is runtime code in `lib/` + an effect in `app/_layout.tsx`, not config), `eas.json`, the workflows, `scripts/bump-mobile-version.mjs`, or `e2e/**`. The only `package.json` touch is **Task 1** (verify/append UI deps); **the report tells P4 to stay out of `package.json`** so the simultaneous Wave-2 run is conflict-free.

**3a. E2E testID contract satisfied:** the "## E2E testID contract" subsection (after File Structure) enumerates the canonical IDs P4's Maestro flows depend on; every one is wired into a concrete element in its task — `sign-in-google-button` (Task 2), `trips-list` / `trip-card[-${id}]` / `trip-card-total` / `new-trip-fab` (Task 3), `trip-detail-flight-stat` / `trip-detail-hotel-stat` / `trip-detail-total-stat` / `flight-option-${id}` / `hotel-option-${id}` (Task 4), `create-trip-name-input` / `create-trip-submit` (Task 5), `chat-input` / `chat-send` / `assistant-message` (Task 6), `alerts-list` (Task 7) — each with a matching `accessibilityLabel`. Repeating list rows use the bare-prefix + `-${id}` suffix convention so Maestro can match "any" or a specific item. The earlier ad-hoc names (`sign-in-google`, `trip-total`) were renamed to the canonical ones.

**4. Coverage:** all real logic is in `lib/aurora.ts` (helpers + selection reducer + total + chart series), `lib/chat-stream.ts` (SSE parser), and `lib/notifications.ts` (content builder), each unit-tested under `lib/__tests__/` — the only files in the 80% `lib/**` gate. Screen `.tsx` + the render-smoke `.cjs` tests are layout-only, outside the gate (mirrors showbook), and verified by the headless `expo export` web compile + described simulator/Maestro-style manual checks (Maestro flows themselves are P4).

**5. Placeholder scan:** every code step shows complete code or an exact structural spec with concrete tokens/props; every TDD step shows the failing-test → run/FAIL → implement → run/PASS → commit cycle; every visual step gives a concrete verification (headless compile + a described manual check). No "TBD"/"similar to above". Commit scope `feat(mobile): …`; no Claude/session trailers.

**Deferred / unsure (carry forward):**
- **iPad two-pane** — explicitly out of P3 scope; follow-up noted (Task 8 Step 4).
- **`/v1/chat/messages` exact SSE event shape** — Task 6's parser is written tolerant of `text`/`token`/`delta`/`tool_call`/`[DONE]`; confirm field names against `apps/api`'s chat router when implementing and adjust the test strings (the parser logic does not change).
- **`TripSummary` per-component price fields** — Task 3 reads whatever the generated `TripResponse` exposes; where the list summary lacks flight/hotel breakdowns it shows the total and "—", leaving full numbers to Trip detail. Confirm the exact field names against `lib/api/types.ts` when implementing.
- **Device-token POST endpoint** — Task 7 leaves a typed `registerDeviceToken` no-op shim with a `TODO(P5)` marker; P5 owns the endpoint + the daily-check push trigger.
