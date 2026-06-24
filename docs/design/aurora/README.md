# Handoff: Vacation Price Tracker — "Aurora" redesign

## Overview
A personal vacation price tracker that monitors **flights & hotels across flexible dates** for one or more users. Live flight/hotel data comes from a Skiplagged MCP; a custom MCP server exposes trip-management tools to a **Groq chat assistant**; **Temporal** orchestrates daily price checks. This package is the **"Aurora" visual redesign** of the existing web app, plus **mobile (iOS + Android) and tablet** prototypes.

The redesign covers:
- **Web** (desktop, full-width) — Sign in, Dashboard (trips table + assistant), Trip detail, Create trip, Settings.
- **Web** (half-width / responsive, 720px) — single-column reflow of all five pages.
- **Tablet** (iPad) — landscape sidebar two-pane + portrait trip detail.
- **Phone** — iOS (Sign in, Trips, Trip detail, Create, price-drop alert, Assistant) and Android (Material adaptation).

## About the Design Files
The files in this bundle are **design references created in HTML** — a prototype showing the intended look and behavior. They are **not production code to copy directly**. The task is to **recreate these designs in the target codebase's existing environment**. The existing web app is **Next.js (App Router) + React + TypeScript + Tailwind + shadcn/ui**, with CSS Modules per route and **Manrope** as the body font — rebuild the designs using those established patterns (Tailwind tokens, shadcn primitives, the existing `globals.css` theme variables). For the mobile apps (no codebase yet), implement natively (SwiftUI / Jetpack Compose) or with the team's chosen cross-platform framework, following the same visual system.

`Price Tracker - Aurora.dc.html` is a single self-contained prototype. It uses a small in-house runtime (`support.js`) to render components and a `<image-slot>` web component (`image-slot.js`) for the user-fillable hotel photos. **Do not port the runtime** — read the markup/logic as a spec and reimplement in the target stack.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, radii, shadows, and interactions are all specified below and present in the HTML. Recreate the UI pixel-faithfully using the codebase's existing libraries. The one interactive screen (Trip detail) demonstrates real behavior (selection updates the chart/totals) — match that behavior, not just the static look.

---

## Design Tokens

These mirror the existing app's theme (`apps/web/src/app/globals.css`). Prefer the codebase's CSS variables / Tailwind tokens over re-hardcoding.

### Color
| Token | Hex | Use |
|---|---|---|
| Primary (violet) | `#7C3AED` | buttons, selected state, key numbers, links |
| Primary hover/deep | `#6D28D9` | badge text, pressed |
| Primary gradient | `linear-gradient(135deg, #A78BFA, #7C3AED)` | logo, avatars, total card |
| Total card gradient | `linear-gradient(135deg, #7C3AED, #9333EA)` | "Trip total" stat |
| Accent pink | `#EC4899` (light `#F9A8D4`) | gradient accents, second avatar |
| Accent cyan | `#22D3EE` | hotel line on chart |
| Violet tint bg | `#FAF8FF` | page background |
| Violet surface | `#F4F1FC` / `#F8F5FE` | selected rows, icon chips |
| Violet chip bg | `#EDE9FE` | "ACTIVE" badge bg |
| Card white | `#FFFFFF` | cards |
| Hairline | `#F1EEF8` / `#ECE8F5` | borders/dividers |
| Selected border | `#C9B8F5` | selected flight/hotel outline |
| Text strong | `#1A1A2E` | headings, values |
| Text body | `#4A4660` / `#6B6680` | body |
| Text muted | `#8B86A0` / `#A8A2BD` | labels, captions |
| Text faint | `#BDB6D4` / `#CFC8E0` | axis labels, chevrons |
| Success | `#059669` on `#ECFDF5` | NON-STOP badge, price drops |
| Warning/stops | `#9A7B18` on `#FEF6DD` | "1 STOP"/PAUSED badge |
| Layover amber | `#C98A3A` on `#FDF6E9` (border `#F6E7C8`) | layover pill |
| Star gold | `#F5A623` (empty star `#E0D9EF`) | hotel ratings |

### Airline logo chips (original monogram marks — NOT real airline trademarks)
- Alaska `AS`: `linear-gradient(135deg, #10617F, #093247)`
- United `UA`: `linear-gradient(135deg, #2456C9, #13357F)`
- Delta `DL`: `linear-gradient(135deg, #C8102E, #7A0A1C)`
- White text, weight 800, radius 8px. Multi-carrier flights overlap two chips (−10px margin, 2px white ring).

### Typography
- **Font family:** `Manrope` (Google Fonts), weights **400, 500, 600, 700, 800**. Load: `https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap`. This matches the existing app body font — use the app's existing `@font-face`/next/font setup.
- **Scale (desktop):** Page H1 `800 / 24–28px / -0.02em`; section titles `700 / 15–16px`; stat values `800 / 19–24px / -0.02em`; body `500–600 / 13–14px`; labels/eyebrows `600–700 / 9–12px`, uppercase ones add `letter-spacing: .04–.08em`. Numeric/price text uses weight 800.
- Minimum text size in mobile frames ~9–11px for dense metadata; primary content 13–16px.

### Radius
Cards `14–16px` · inner cards/rows `12–13px` · chips/pills `8–10px` & `999px` for status badges · icon chips `8–11px` · phone bezel `38–46px` · iPad bezel `22–36px`.

### Shadow
- Card on canvas: `0 16px 50px rgba(60,40,120,.13)`
- Soft card: `0 2px 10px rgba(60,40,120,.04)`
- Primary button: `0 4–6px 12–16px rgba(124,58,237,.32)`
- Total card: `0 8px 22px rgba(124,58,237,.30)`
- Device bezels: `0 22px 55–60px rgba(60,40,120,.22)`

### Spacing
Card padding `14–20px`; grid/section gaps `12–18px`; row gaps `8–11px`. Two-column content grids use ~`1.05fr .95fr` (flights/hotels) and `1fr 360px` (dashboard table + chat).

---

## Screens / Views

### 1. Sign in
- **Purpose:** Google-OAuth-only entry. No passwords stored.
- **Layout (full-width):** Two-column hero — left: eyebrow "Date-Range Optimizer", H1 "Find your cheapest **vacation window**" (second line uses the violet→pink text gradient), supporting paragraph, a Flights/Hotels/Price-alerts feature row, and two stats ("$186 avg. savings per trip", "90+ date combos checked"). Right: white sign-in card with gradient logo, "Ready to get started?", **"Sign in with Google"** button (full-color Google glyph), and a "We never store passwords" caption. Soft radial violet/pink/cyan glows in the background.
- **Half-width:** single centered column (logo → eyebrow → H1 → paragraph → inline Flights · Hotels · Price alerts → sign-in card).

### 2. Dashboard (Trips + Assistant)
- **Purpose:** See all tracked trips; talk to the Groq assistant.
- **Layout (full-width):** App top bar (gradient logo + "Price Tracker", "Live" pill, avatar). Page header ("Your Trips", subcount, **Refresh All** + **New Trip** buttons). Two-pane body grid `1fr 360px`: left = **trips table**, right = **assistant** panel.
- **Trips table columns:** Trip · Route (`SFO ↔ RDM`) · Dates · Flight $ · Hotel $ · **Total $** (violet, bold) · Status (`ACTIVE` violet chip / `PAUSED` amber chip). First row tinted `#FBFAFF`. Footer row (pinned to bottom): "Showing 6 of 6 trips" + "Prices refresh daily at 6:00 AM". The table panel fills the viewport height.
- **Assistant panel:** header (gradient icon, "Assistant", "Powered by Groq"), message thread (user bubble = violet, assistant bubble = white w/ hairline border), a **tool-call chip** (e.g. `create_trip · refresh_prices` with a check icon), and an "Ask anything…" input with a violet send button. Panel fills height; input pinned to bottom.
- **Sample data:** Test 2 (SFO↔RDM, Aug 22–26, $177/$612/**$789**), Maui in March (JFK↔OGG, $498/$1,340/$1,838), Lisbon with Sam (SFO↔LIS, $640/$1,020/$1,660), Reykjavík stopover (BOS↔KEF, $388/$910/$1,298), Tokyo cherry blossom (LAX↔HND, $842/$1,180/$2,022, PAUSED), Aspen New Year (DEN↔ASE, $214/$1,560/$1,774, PAUSED).
- **Half-width:** single column — header, segmented control **Trips | Assistant**, stacked trip cards (name + status, route · dates, three mini-stats Flight/Hotel/Total).

### 3. Trip detail  ⭐ (the interactive screen)
- **Purpose:** Inspect one trip; pick the flight & hotel; watch the price history + totals update.
- **Layout:** Inside the scroll container, a **sticky top region** (stays pinned while the lists scroll):
  1. Breadcrumb "Your Trips / Test 2".
  2. **Title row, single line:** `Test 2` + ACTIVE badge, then trip meta **to the right of the title** (route `SFO ↔ RDM`, `Aug 22 – 26, 2025`, `4 nights · 2 adults` chip), then **Edit** / **Refresh** buttons pushed to the far right.
  3. **Three short stat chips** (horizontal: icon + label + value): **Flight** `$177`, **Hotel** `$612` `$153/night`, **Trip total** `$789` (gradient card). These reflect the current selection.
  4. **Price history chart** — area+line for **Total** (violet) and a dashed **Hotel** line (cyan), a moving "current" dot, y-axis `$0–$1000`, x-axis date ticks, and a "Now $789" badge.
- **Below the sticky region (scrolls):** two-column grid — **Flights** and **Hotels** as **collapsible rows**.
  - **Flight row (collapsed):** radio + airline logo chip + airline name + stops badge (`NON-STOP` green / `1 STOP · DEN` amber) + price + chevron; a one-line summary underneath (`7:05a SFO → 9:00a RDM · nonstop`).
  - **Flight row (expanded, non-stop):** OUTBOUND and RETURN rows with times, airport codes, duration · flight number, a progress line with a ✈ marker.
  - **Flight row (expanded, multi-stop / multi-carrier):** per-leg rows each with **its own airline logo** (e.g. leg 1 `UA 508` SFO→DEN, leg 2 `AS 2201` DEN→RDM), an amber **layover pill** ("1h 10m layover in Denver (DEN)"), a "RETURN … 1 stop via DEN" summary, and an "Operated by United & Alaska" subtitle. Card has a 3px amber left accent.
  - **Hotel row:** photo (see Assets) + name + star rating + descriptor + `$153 /night · $612 total` + radio + chevron; expanded shows an info line (cancellation/amenities). 
  - Each list ends with a dashed **"Show N more flights" / "Show all 9 hotels"** affordance.
- **Selected** flight/hotel rows: `#F8F5FE` bg, `#C9B8F5` border, filled violet radio, violet price.
- **Second frame ("scrolled" snapshot)** in the canvas shows the same screen scrolled down with the **1-stop flight expanded** and the show-more controls visible — use it as the reference for the expanded multi-carrier state.
- **Half-width:** same content, single column (sticky stat chips + chart, then full-width Flights card, then Hotels card).

### 4. Create trip
- **Purpose:** Set up tracking for a new trip.
- **Layout:** Header ("Create new trip"). Card **Trip details** (Trip name; From / ⇄ / To; Depart / Return / Adults). Collapsible **Flight preferences** (open: cabin chips Economy/Premium/Business + Non-stop only/Any stops, with an on/off toggle). Collapsible **Hotel preferences** (collapsed row + toggle + chevron). **Alert me when…** card ("total drops below `$750`"). Footer: **Cancel** + **Create trip**.
- On the full 1440px frame the form sits in a centered ~720px column. Half-width = same form, single column.

### 5. Settings
- **Purpose:** Notification preferences.
- **Layout:** "Settings" title; **Notifications** card with two toggle rows — **Email notifications** (on, "Daily digest when a tracked trip drops below your price target") and **SMS alerts** (off, "Instant text on a major price drop"). Centered ~720px column on the full frame. *(Note: an earlier "Trip members" section was intentionally removed — sharing is not part of this product.)*

### Tablet (iPad)
- **Landscape:** persistent left **sidebar** (Trips / Alerts / Settings + user), center trips list, right assistant pane (three-column).
- **Portrait:** trip detail — back chevron + title, three stat cards, chart, flights (non-stop + 1-stop).

### Phone
- **iOS:** Sign in (centered hero + Continue with Google), Trips (cards + FAB + 3-tab bar Trips/Alerts/Chat), Trip detail (stat trio, chart, cheapest flight), Create (grouped form + toggles), **Price-drop alert** (lock-screen notification: "📉 Test 2 just dropped below $750 … $724 total"), Assistant (chat with quick-reply chips + tool-call chip). Dynamic-island status bar, 44px+ hit targets.
- **Android (Material):** Trips (extended FAB "New trip", pill nav bar), Trip detail (collapsing gradient app bar with the total), Create (Material text fields with violet underlines, pill primary button), **Heads-up notification** (Material card with VIEW TRIP / DISMISS actions).

---

## Interactions & Behavior
- **Trip detail selection (core):** Tapping a flight or hotel **selects** it (fills the radio, highlights the row) **and toggles its expansion** (one expanded at a time per list; tapping the selected/expanded one collapses it but keeps it selected). Selecting recomputes **Flight**, **Hotel**, and **Total** stats (`total = flightPrice + hotelTotal`) and **redraws the price-history chart** — the latest "current" point moves to the new total and the "Now $X" badge updates. Verified examples: Alaska + Riverhouse = **$789**; United(1-stop) + Riverhouse = **$754**; Delta + Eviva = **$680**.
- **Sticky region:** title + stat chips + chart stay pinned at the top of the scroll container; the flight/hotel lists scroll beneath them.
- **Collapsible rows:** chevron flips ▼/▲; collapsed rows show a one-line route summary; expanded show full itinerary (legs, layovers, return).
- **Toggles/segmented controls:** standard on/off; selected segment gets a white pill with a subtle shadow.
- **Buttons:** primary = violet fill + violet glow shadow; secondary = white + hairline border.
- **Responsive:** at ~half-width the layouts reflow to a single column (table → stacked cards, two-pane → segmented tabs, flights/hotels stack vertically). Implement with the codebase's breakpoints.
- **Notifications:** price-drop alerts surface as OS notifications (iOS lock-screen banner, Android heads-up) when a trip's total crosses the user's threshold — wired to the Temporal daily-check job.

## State Management
- `selectedFlightId`, `expandedFlightId`, `selectedHotelId`, `expandedHotelId` (trip detail).
- Derived: `tripTotal = selectedFlight.price + selectedHotel.total`; chart series recompute from `tripTotal`.
- Trip list, per-trip flight offers (with `segments`/`stops`, airline, times, flight numbers, layovers) and hotel offers (star rating, per-night, total, info) come from the API (Skiplagged MCP). Assistant messages + tool-call results stream from the Groq endpoint.
- Notification threshold per trip ("alert when total drops below $X").

## Tweakable options (exposed in the prototype as props — map to real settings/feature flags)
- `showAirlineLogos` (bool) — show airline logo chips on flights.
- `showHotelPhotos` (bool) — show real hotel photos vs. an icon placeholder.
- `multiCarrier` (bool) — render connecting legs as different operating carriers ("Operated by United & Alaska") vs. a single carrier.

## Assets
- **Fonts:** Manrope (Google Fonts) — see Typography. No other fonts.
- **Icons:** inline **Lucide**-style SVG strokes (plane, building/hotel, bell, refresh, chevrons, edit, arrow-swap, settings gear, clock, send, etc.), `stroke-width` 2–2.2, round caps/joins. Use the codebase's existing Lucide set.
- **Airline logos:** rendered as **original CSS monogram chips** (AS/UA/DL gradients above), *not* real airline trademarks — swap for licensed logos if/when available.
- **Hotel photos:** the prototype uses a drop-in `<image-slot>` placeholder so a user can supply a real property photo. In production, use the hotel API's photo URL with an `object-fit: cover` image and a graceful placeholder fallback.
- **Google "G" logo:** standard 4-color Google mark on the sign-in button.
- No raster images are shipped in this bundle.

## Files
- `Price Tracker - Aurora.dc.html` — the full prototype (all screens, on a pannable canvas). Open in a browser to interact (the Trip-detail selection→chart behavior is live).
- `support.js` — the prototype's render runtime. **Reference only — do not port.**
- `image-slot.js` — the user-fillable image placeholder web component used for hotel photos. **Reference only.**
- Source of truth in the app repo: `apps/web/src/app/globals.css` (theme), `apps/web/src/app/trips/**` (pages), `apps/web/src/components/chat/**` (assistant). Lift exact tokens from `globals.css`.
