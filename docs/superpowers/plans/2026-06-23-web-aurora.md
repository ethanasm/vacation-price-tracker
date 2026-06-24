# Web "Aurora" Redesign — Implementation Plan (P1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan **task-by-task, in order**. This is **plan P1** in the orchestration index (`docs/superpowers/plans/2026-06-23-AURORA-INDEX.md`). It owns `apps/web/**` **only** and is a **single sequential plan run by one agent** — the tasks are internally ordered (tokens → shared primitives → pages → responsive sweep) so the single owner never races on `globals.css` or the shared `components/ui/**` primitives. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the existing Next.js web app to the "Aurora" hi-fi design across all five routes (Sign in, Dashboard + Assistant, Trip detail, Create trip, Settings) at full-width **and** at a ~720px half-width single-column reflow. This is a **visual + interaction refresh only** — no data-model, API, schema, or route changes. The one screen with real behavior (Trip detail) keeps and is re-verified for its selection→total→chart recompute. Airline logos are **original CSS monogram chips**, never real trademarks. No "Trip members"/sharing UI anywhere.

**Architecture:** The app is Next.js 16 App Router with **CSS Modules per route** (`page.module.css`), a Tailwind v4 `@theme` block + CSS variables in `apps/web/src/app/globals.css`, shadcn/Radix primitives in `apps/web/src/components/ui/**`, Recharts for the price chart, and `lucide-react` for icons. We **map** the Aurora token palette into `globals.css` (the `@theme` block + `:root` vars), add a small set of reusable Aurora utility classes (gradient logo/avatar, total-card gradient, status chips, monogram airline chips, hairlines, card shadow) consumed by the route CSS Modules, update the shared shadcn primitives that the new look changes, then reskin each route's `page.tsx` + `page.module.css` building on the existing component structure, props, and data types (`TripDetail`, `PriceSnapshot`, `ApiFlightOffer`/`itineraries`/`segments`, `ApiHotelOffer`, the `lib/format.ts` + `lib/price-history.ts` helpers). New pure-logic helpers (airline-chip metadata, multi-carrier subtitle, layover/leg derivation) live in **new `lib/` modules with their own Jest tests** so the page code that consumes them stays testable. The monogram airline chips, hotel property photos (with placeholder fallback), and the multi-carrier "Operated by …" treatment are **always on** — driven purely by the real segment data, with no feature flags.

**Tech Stack (do not change versions):** Next.js **16.2.6** (App Router) · React **19.2.0** · TypeScript **5.5.4** · Tailwind CSS **v4.1.18** (`@theme` block in `globals.css`, **not** a JS color map) · shadcn/Radix primitives · **Biome 1.8.3** (lint/format) · **Jest 30** + React Testing Library · Playwright (e2e) · Recharts **2.15.4** · `lucide-react` **0.562.0** · `@assistant-ui/react` **0.12.3**. Manrope (`next/font/google`) is the body font (`--font-body`).

---

## Global Constraints

*Every task in this plan implicitly includes this section. Web-relevant values copied verbatim from the orchestration index and the Aurora handoff.*

### Monorepo / toolchain
- **Package manager:** `pnpm@9.12.1` (pinned in root `package.json`). **Single `pnpm-lock.yaml` at the repo root** — never generate a nested lockfile in `apps/web`. Run pnpm from the repo root or with `pnpm --filter vacation-price-tracker-web …`.
- **Verify gate:** `pnpm verify` must stay green (install --frozen-lockfile → build → lint → typecheck → test:coverage → audit).

### Web (P1) stack — do not change versions
- Next.js **16.2.6** (App Router) · React **19.2.0** · TypeScript **5.5.4** · Tailwind CSS **v4.1.18** (`@theme` block in `globals.css`, **not** a JS config color map) · shadcn/Radix primitives in `apps/web/src/components/ui/**` · **Biome 1.8.3** (lint/format) · **Jest 30** + React Testing Library · Playwright (e2e) · Recharts **2.15.4** (price chart) · `lucide-react` **0.562.0** (icons) · `@assistant-ui/react` **0.12.3** (chat).
- **Coverage gate (web):** branches **85**, functions **95**, lines **95**, statements **95**. `apps/web/src/components/ui/**` is excluded from coverage; new non-ui logic must be tested.
- **Fonts:** `next/font/google` — `Manrope` is the body font (`--font-body`). Aurora needs Manrope weights **400, 500, 600, 700, 800**; extend the existing `Manrope({...})` call in `apps/web/src/app/layout.tsx`. Do **not** add a `<link>` tag or a second font loader.

### Aurora design tokens (shared source of truth)
- **Primary violet** `#7C3AED` (≈ existing `--color-primary: hsl(262 83% 58%)` — already aligned) · hover/deep `#6D28D9` · **primary gradient** `linear-gradient(135deg,#A78BFA,#7C3AED)` · **total-card gradient** `linear-gradient(135deg,#7C3AED,#9333EA)`.
- **Accents:** pink `#EC4899`, cyan `#22D3EE` (hotel chart line). **Backgrounds:** page `#FAF8FF`, surfaces `#F4F1FC`/`#F8F5FE`, chip `#EDE9FE`, card `#FFFFFF`, hairline `#F1EEF8`/`#ECE8F5`, selected border `#C9B8F5`.
- **Text:** strong `#1A1A2E`, body `#4A4660`/`#6B6680`, muted `#8B86A0`, faint `#BDB6D4`.
- **Status:** success `#059669` on `#ECFDF5`; warning/stops `#9A7B18` on `#FEF6DD`; layover amber `#C98A3A` on `#FDF6E9` (border `#F6E7C8`); star gold `#F5A623`.
- **Radius:** cards 14–16px · inner 12–13px · pills/chips 8–10px · status badges 999px. **Shadows:** card-on-canvas `0 16px 50px rgba(60,40,120,.13)`; primary button `0 4–6px 12–16px rgba(124,58,237,.32)`; total card `0 8px 22px rgba(124,58,237,.30)`.
- **Airline monogram chips (original marks, not real trademarks):** Alaska `AS` `linear-gradient(135deg,#10617F,#093247)`; United `UA` `linear-gradient(135deg,#2456C9,#13357F)`; Delta `DL` `linear-gradient(135deg,#C8102E,#7A0A1C)`; white text weight 800, radius 8px. Multi-carrier flights overlap two chips (−10px margin, 2px white ring).

### Verified behavioral checks (Trip detail — Task 5)
The selection→total→chart recompute MUST reproduce these exact totals (`total = flightPrice + hotelTotal`):
- Alaska (non-stop) + Riverhouse = **$789**
- United (1-stop) + Riverhouse = **$754**
- Delta + Eviva = **$680**

### Product guardrails
- **No "Trip members"/sharing UI** anywhere (intentionally removed). Settings = Notifications only (Email + SMS toggles).
- Sign-in is **Google-OAuth only**; "We never store passwords" caption.
- Airline logos are **original CSS monogram chips**, never real airline trademarks.

### Verification tooling
- Use the project's **`debug-web`** skill / Playwright (`mcp__playwright__*`) to screenshot routes at **full-width (1440×900)** and **half-width (720×1024)** against `https://localhost:3000`. The Docker dev stack must be up (`docker ps` shows `web`); start with `pnpm nx run web:dev` only if it is not.
- Jest + RTL per `apps/web/jest.config.ts`. `testMatch` is `**/__tests__/**/*.test.{ts,tsx}` and `**/*.test.{ts,tsx}`; `@/` maps to `src/`. `components/ui/**` and `app/**/layout.tsx` are coverage-excluded; **page/logic code needs 95% lines/functions/statements, 85% branches.**
- Commit scope is `feat(web): …` / `fix(web): …`. Conventional Commits. **No** `Co-authored-by` / session-link / "Generated with Claude" trailers in commits (per repo `CLAUDE.md`).

### PR operator docs (required)
Every PR opened for this plan MUST include an **"Operator / Deployment Steps"** section in its description listing: new **environment variables** (name · where set — web `.env` / api `.env`·`.env.prod` / `eas.json` / GitHub secret / GitHub variable · required-vs-optional · example or placeholder value); **DB migrations**; **new GitHub secrets/variables**; and any **one-time infra / runner / credential provisioning** the change introduces. If it introduces none, state **"No operator steps"** explicitly.

*(Note: P1 introduces no new env vars, migrations, or secrets — its operator section says "No operator steps.")*

---

## File Structure

### Files to Create

- `apps/web/src/lib/aurora.ts` — pure helpers for the Aurora flight UI: `airlineChip(carrierCode)` → `{ initials, gradient }` for the monogram chips (AS/UA/DL + generic fallback); `operatingCarriers(flight)` → ordered unique carrier names across all segments; `multiCarrierSubtitle(flight)` → e.g. `"Operated by United & Alaska"` or `null`; `stopsBadge(flight)` → `{ label, tone }` (`NON-STOP`/`1 STOP · DEN`, tone `success`|`warning`); `layoverLabel(prevSeg, seg)` → e.g. `"1h 10m layover in Denver (DEN)"` or `null`.
- `apps/web/src/__tests__/aurora.test.ts` — Jest tests for every `lib/aurora.ts` helper (chip mapping, multi-carrier subtitle on/off, stops badge tones, layover label).
- `apps/web/src/components/aurora/airline-chip.tsx` — presentational monogram chip component (consumes `airlineChip`); always renders the chip, and supports an overlapping two-chip "multi-carrier" stack.
- `apps/web/src/components/aurora/airline-chip.module.css` — chip gradients/ring/overlap styles.
- `apps/web/src/components/aurora/hotel-photo.tsx` — hotel image with `object-fit: cover`, always rendered, with a graceful violet-surface icon placeholder fallback when there is no photo URL.
- `apps/web/src/components/aurora/hotel-photo.module.css` — photo/placeholder styles.
- `apps/web/src/__tests__/trip-detail-selection.test.tsx` — RTL tests for the Trip-detail selection state machine and the three verified totals + chart "Now $X" recompute.
- `apps/web/src/__tests__/sign-in-aurora.test.tsx` — RTL render test for the Sign-in screen (gradient H1 line, feature row, two stats, Google button, "never store passwords").
- `apps/web/src/__tests__/dashboard-aurora.test.tsx` — RTL render test for the Dashboard table columns/footer/status chips + assistant panel.
- `apps/web/src/__tests__/settings-aurora.test.tsx` — RTL test for Settings (Email on, SMS off, no "Trip members").

### Files to Modify

- `apps/web/src/app/layout.tsx` — extend the `Manrope({...})` `next/font` call to `weight: ["400","500","600","700","800"]` (Task 1).
- `apps/web/src/app/globals.css` — map every Aurora color/radius/shadow token into the `@theme` block + `:root` CSS vars; add reusable Aurora utility classes (Task 1).
- `apps/web/src/components/ui/button.tsx` + the `.btn-*` classes in `globals.css` — primary violet+glow / secondary white+hairline variants (Task 2).
- `apps/web/src/components/ui/badge.tsx` — add Aurora badge variants (`active` violet, `paused` amber, `nonstop` green, `stop` amber) (Task 2).
- `apps/web/src/components/ui/card.tsx` — Aurora radius/shadow/hairline (Task 2).
- `apps/web/src/components/ui/tabs.tsx` — pill segmented-control styling (Task 2).
- `apps/web/src/components/ui/switch.tsx` — confirm/adjust violet `data-[state=checked]` (Task 2).
- `apps/web/src/app/page.tsx` + `apps/web/src/app/page.module.css` — Sign-in Aurora reskin (Task 3).
- `apps/web/src/app/layout.module.css` — top-bar / footer Aurora tokens (Task 4).
- `apps/web/src/app/trips/page.tsx` + `apps/web/src/app/trips/page.module.css` — Dashboard Aurora reskin (Task 4).
- `apps/web/src/components/chat/chat-panel.tsx` + `apps/web/src/components/chat/chat-message.tsx` + `apps/web/src/components/chat/tool-call-display.tsx` — Assistant Aurora reskin (Task 4).
- `apps/web/src/app/trips/[tripId]/page.tsx` + `apps/web/src/app/trips/[tripId]/page.module.css` — Trip detail Aurora reskin + verified selection behavior (Task 5).
- `apps/web/src/app/trips/new/page.tsx` + `apps/web/src/app/trips/new/page.module.css` — Create-trip Aurora reskin (Task 6).
- `apps/web/src/components/trip-form/flight-prefs-section.tsx` + `…/hotel-prefs-section.tsx` + `…/notification-section.tsx` + their `.module.css` files — Aurora prefs cards / cabin chips / alert card (Task 6).
- `apps/web/src/app/trips/settings/page.tsx` — Settings Aurora reskin (Task 7).
- (Task 8 is the responsive sweep only — it introduces no new files; it verifies all five routes reflow at 720px.)

---

## Task 1: Design tokens & fonts (foundation — blocks everything)

**Files:**
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/app/globals.css`
- Test: `apps/web/src/__tests__/aurora-tokens.test.ts` (Create) — asserts the token strings/utility classes exist in the compiled CSS source.

**Interfaces:**
- Produces (CSS vars in `:root`, consumed by all later tasks): `--aurora-violet` `#7C3AED`, `--aurora-violet-deep` `#6D28D9`, `--aurora-pink` `#EC4899`, `--aurora-cyan` `#22D3EE`, `--aurora-page` `#FAF8FF`, `--aurora-surface` `#F4F1FC`, `--aurora-surface-2` `#F8F5FE`, `--aurora-chip` `#EDE9FE`, `--aurora-card` `#FFFFFF`, `--aurora-hairline` `#F1EEF8`, `--aurora-hairline-2` `#ECE8F5`, `--aurora-selected-border` `#C9B8F5`, `--aurora-ink` `#1A1A2E`, `--aurora-body` `#4A4660`, `--aurora-body-2` `#6B6680`, `--aurora-muted` `#8B86A0`, `--aurora-faint` `#BDB6D4`, `--aurora-success` `#059669`, `--aurora-success-bg` `#ECFDF5`, `--aurora-warn` `#9A7B18`, `--aurora-warn-bg` `#FEF6DD`, `--aurora-layover` `#C98A3A`, `--aurora-layover-bg` `#FDF6E9`, `--aurora-layover-border` `#F6E7C8`, `--aurora-star` `#F5A623`, `--aurora-grad-primary`, `--aurora-grad-total`, `--aurora-shadow-card`, `--aurora-shadow-btn`, `--aurora-shadow-total`, `--aurora-radius-card` `15px`, `--aurora-radius-inner` `12px`, `--aurora-radius-chip` `9px`.
- Produces (utility classes consumed by later tasks): `.aurora-logo` (gradient brand square), `.aurora-avatar` (gradient circle), `.aurora-total-card` (total-card gradient + shadow + white text), `.aurora-chip-active` (violet status chip), `.aurora-chip-paused` (amber status chip), `.aurora-chip-nonstop` (green), `.aurora-chip-stop` (amber), `.aurora-hairline` (1px hairline border), `.aurora-card` (white card + radius + card shadow), `.aurora-layover-pill` (amber layover pill).

**Notes for the mapping:** `#7C3AED` already ≈ existing `--color-primary: hsl(262 83% 58%)` and `--ring`; **leave those in place** and add the explicit `--aurora-*` hex tokens alongside so route CSS reads exact Aurora hexes. Page background `#FAF8FF` matches existing `--paper`. Do not touch the `.dark` block beyond what already exists — Aurora is the light theme; the existing FOUC theme script stays.

- [ ] **Step 1: Write the failing token test**

Create `apps/web/src/__tests__/aurora-tokens.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(
  join(__dirname, "..", "app", "globals.css"),
  "utf8",
);

describe("Aurora design tokens in globals.css", () => {
  it.each([
    ["--aurora-violet", "#7C3AED"],
    ["--aurora-violet-deep", "#6D28D9"],
    ["--aurora-pink", "#EC4899"],
    ["--aurora-cyan", "#22D3EE"],
    ["--aurora-page", "#FAF8FF"],
    ["--aurora-surface", "#F4F1FC"],
    ["--aurora-surface-2", "#F8F5FE"],
    ["--aurora-chip", "#EDE9FE"],
    ["--aurora-hairline", "#F1EEF8"],
    ["--aurora-selected-border", "#C9B8F5"],
    ["--aurora-ink", "#1A1A2E"],
    ["--aurora-success", "#059669"],
    ["--aurora-warn", "#9A7B18"],
    ["--aurora-layover", "#C98A3A"],
    ["--aurora-star", "#F5A623"],
  ])("defines %s = %s", (name, hex) => {
    const re = new RegExp(`${name}:\\s*${hex}`, "i");
    expect(css).toMatch(re);
  });

  it("defines the primary and total gradients", () => {
    expect(css).toMatch(/--aurora-grad-primary:\s*linear-gradient\(135deg,\s*#A78BFA,\s*#7C3AED\)/i);
    expect(css).toMatch(/--aurora-grad-total:\s*linear-gradient\(135deg,\s*#7C3AED,\s*#9333EA\)/i);
  });

  it("defines the card-on-canvas shadow", () => {
    expect(css).toMatch(/--aurora-shadow-card:\s*0 16px 50px rgba\(60,\s*40,\s*120,\s*\.13\)/i);
  });

  it.each([
    ".aurora-logo",
    ".aurora-avatar",
    ".aurora-total-card",
    ".aurora-chip-active",
    ".aurora-chip-paused",
    ".aurora-chip-nonstop",
    ".aurora-chip-stop",
    ".aurora-card",
    ".aurora-hairline",
    ".aurora-layover-pill",
  ])("defines utility class %s", (cls) => {
    expect(css).toContain(cls);
  });
});
```

- [ ] **Step 2: Run it and confirm FAIL**

Run: `pnpm --filter vacation-price-tracker-web exec jest src/__tests__/aurora-tokens.test.ts`
Expected: **FAIL** — none of the `--aurora-*` vars or `.aurora-*` classes exist yet.

- [ ] **Step 3: Extend the Manrope font weights**

In `apps/web/src/app/layout.tsx`, change the `body` font call:

Find:
```tsx
const body = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "600"],
});
```
Replace with:
```tsx
const body = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700", "800"],
});
```

- [ ] **Step 4: Map the Aurora tokens + add utility classes in `globals.css`**

In `apps/web/src/app/globals.css`, inside the existing `:root { … }` block, **append** the Aurora variables (after the existing `--chart-*` lines, before the closing `}`):

```css
  /* ===== Aurora design tokens (light theme; source of truth) ===== */
  --aurora-violet: #7C3AED;
  --aurora-violet-deep: #6D28D9;
  --aurora-pink: #EC4899;
  --aurora-pink-light: #F9A8D4;
  --aurora-cyan: #22D3EE;
  --aurora-page: #FAF8FF;
  --aurora-surface: #F4F1FC;
  --aurora-surface-2: #F8F5FE;
  --aurora-chip: #EDE9FE;
  --aurora-card: #FFFFFF;
  --aurora-hairline: #F1EEF8;
  --aurora-hairline-2: #ECE8F5;
  --aurora-selected-border: #C9B8F5;
  --aurora-ink: #1A1A2E;
  --aurora-body: #4A4660;
  --aurora-body-2: #6B6680;
  --aurora-muted: #8B86A0;
  --aurora-faint: #BDB6D4;
  --aurora-success: #059669;
  --aurora-success-bg: #ECFDF5;
  --aurora-warn: #9A7B18;
  --aurora-warn-bg: #FEF6DD;
  --aurora-layover: #C98A3A;
  --aurora-layover-bg: #FDF6E9;
  --aurora-layover-border: #F6E7C8;
  --aurora-star: #F5A623;
  --aurora-star-empty: #E0D9EF;
  --aurora-grad-primary: linear-gradient(135deg, #A78BFA, #7C3AED);
  --aurora-grad-total: linear-gradient(135deg, #7C3AED, #9333EA);
  --aurora-shadow-card: 0 16px 50px rgba(60, 40, 120, .13);
  --aurora-shadow-soft: 0 2px 10px rgba(60, 40, 120, .04);
  --aurora-shadow-btn: 0 5px 14px rgba(124, 58, 237, .32);
  --aurora-shadow-total: 0 8px 22px rgba(124, 58, 237, .30);
  --aurora-radius-card: 15px;
  --aurora-radius-inner: 12px;
  --aurora-radius-chip: 9px;
```

Then **append** the Aurora utility classes at the end of the file (after the existing select-chevron rules):

```css
/* ============================================
   AURORA UTILITY CLASSES (light theme)
   ============================================ */
.aurora-card {
  background: var(--aurora-card);
  border: 1px solid var(--aurora-hairline);
  border-radius: var(--aurora-radius-card);
  box-shadow: var(--aurora-shadow-card);
}
.aurora-hairline { border: 1px solid var(--aurora-hairline); }

.aurora-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--aurora-grad-primary);
  color: #fff;
  border-radius: 11px;
  box-shadow: var(--aurora-shadow-btn);
}
.aurora-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--aurora-grad-primary);
  color: #fff;
  border-radius: 50%;
  font-weight: 700;
  letter-spacing: .02em;
}

.aurora-total-card {
  background: var(--aurora-grad-total);
  color: #fff;
  border-radius: var(--aurora-radius-inner);
  box-shadow: var(--aurora-shadow-total);
}

.aurora-chip-active,
.aurora-chip-paused,
.aurora-chip-nonstop,
.aurora-chip-stop {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: 999px;
  padding: 2px 9px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .06em;
  text-transform: uppercase;
}
.aurora-chip-active { background: var(--aurora-chip); color: var(--aurora-violet-deep); }
.aurora-chip-paused { background: var(--aurora-warn-bg); color: var(--aurora-warn); }
.aurora-chip-nonstop { background: var(--aurora-success-bg); color: var(--aurora-success); }
.aurora-chip-stop { background: var(--aurora-warn-bg); color: var(--aurora-warn); }

.aurora-layover-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--aurora-layover-bg);
  color: var(--aurora-layover);
  border: 1px solid var(--aurora-layover-border);
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 600;
}
```

- [ ] **Step 5: Run the token test and confirm PASS**

Run: `pnpm --filter vacation-price-tracker-web exec jest src/__tests__/aurora-tokens.test.ts`
Expected: **PASS** (all token + utility-class assertions green).

- [ ] **Step 6: Typecheck + lint**

Run: `pnpm --filter vacation-price-tracker-web typecheck && pnpm --filter vacation-price-tracker-web lint`
Expected: both PASS (font weight change + CSS additions are type-neutral).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/layout.tsx apps/web/src/app/globals.css apps/web/src/__tests__/aurora-tokens.test.ts
git commit -m "feat(web): map Aurora design tokens and font weights"
```

---

## Task 2: Shared UI primitives (button, badge, card, tabs, switch)

**Files:**
- Modify: `apps/web/src/components/ui/button.tsx`
- Modify: `apps/web/src/app/globals.css` (the `.btn-primary` / `.btn-outline` blocks)
- Modify: `apps/web/src/components/ui/badge.tsx`
- Modify: `apps/web/src/components/ui/card.tsx`
- Modify: `apps/web/src/components/ui/tabs.tsx`
- Modify: `apps/web/src/components/ui/switch.tsx`
- Test: `apps/web/src/__tests__/badge-aurora.test.tsx` (Create)

**Interfaces:**
- Produces (consumed by Tasks 3–7): `Badge` gains `variant` values `"active" | "paused" | "nonstop" | "stop"` (in addition to existing `default | secondary | destructive | outline`), each emitting the matching `.aurora-chip-*` class. `Button` `variant="default"` = primary violet+glow; `variant="outline"`/`"secondary"` = white + hairline border. `Card` renders the Aurora radius + card shadow + hairline. `TabsList`/`TabsTrigger` render a pill segmented control (active segment = white pill + soft shadow).
- These primitives are **coverage-excluded** (`components/ui/**`), so the badge test is a smoke test only; it does not need to hit thresholds.

> `components/ui/**` is shared by every page, so these come **before** any page work to avoid re-editing them per route.

- [ ] **Step 1: Write a failing badge-variant test**

Create `apps/web/src/__tests__/badge-aurora.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { Badge } from "@/components/ui/badge";

describe("Badge Aurora variants", () => {
  it("active variant uses the violet chip class", () => {
    const { getByText } = render(<Badge variant="active">ACTIVE</Badge>);
    expect(getByText("ACTIVE")).toHaveClass("aurora-chip-active");
  });
  it("paused variant uses the amber chip class", () => {
    const { getByText } = render(<Badge variant="paused">PAUSED</Badge>);
    expect(getByText("PAUSED")).toHaveClass("aurora-chip-paused");
  });
  it("nonstop variant uses the green chip class", () => {
    const { getByText } = render(<Badge variant="nonstop">NON-STOP</Badge>);
    expect(getByText("NON-STOP")).toHaveClass("aurora-chip-nonstop");
  });
  it("stop variant uses the amber stop chip class", () => {
    const { getByText } = render(<Badge variant="stop">1 STOP</Badge>);
    expect(getByText("1 STOP")).toHaveClass("aurora-chip-stop");
  });
});
```

- [ ] **Step 2: Run it and confirm FAIL**

Run: `pnpm --filter vacation-price-tracker-web exec jest src/__tests__/badge-aurora.test.tsx`
Expected: **FAIL** — `variant="active"` is not yet a valid variant (TS error / class missing).

- [ ] **Step 3: Add Aurora variants to `Badge`**

In `apps/web/src/components/ui/badge.tsx`, extend the `variants.variant` map (keep the existing four, append four). The Aurora chips own their full visual (radius/padding/size) via the `.aurora-chip-*` utility, so the new variant values map straight to those classes:

```tsx
const badgeVariants = cva(
  "inline-flex items-center transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "rounded-full border border-transparent px-3 py-1 text-xs font-semibold uppercase tracking-wide bg-primary text-primary-foreground",
        secondary: "rounded-full border border-transparent px-3 py-1 text-xs font-semibold uppercase tracking-wide bg-secondary text-secondary-foreground",
        destructive: "rounded-full border border-transparent px-3 py-1 text-xs font-semibold uppercase tracking-wide bg-destructive text-destructive-foreground",
        outline: "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-foreground border-border",
        active: "aurora-chip-active",
        paused: "aurora-chip-paused",
        nonstop: "aurora-chip-nonstop",
        stop: "aurora-chip-stop",
      },
    },
    defaultVariants: { variant: "default" },
  },
);
```

- [ ] **Step 4: Primary/secondary button + card + tabs + switch**

In `apps/web/src/app/globals.css`, replace the `.btn-primary` background and shadow to the Aurora violet+glow (keep the `.btn-modern` base, transitions, and disabled rules):

Find (inside `.btn-primary`):
```css
  background: linear-gradient(135deg, hsl(262 83% 58%) 0%, hsl(262 83% 48%) 100%);
  color: white;
  border: none;
  box-shadow:
    0 2px 8px rgba(124, 58, 237, 0.3),
    0 1px 2px rgba(0, 0, 0, 0.1);
```
Replace with:
```css
  background: var(--aurora-violet);
  color: white;
  border: none;
  box-shadow: var(--aurora-shadow-btn);
```
And in `.btn-primary:hover` set `background: var(--aurora-violet-deep);` (keep the lift transform).

In `.btn-outline`, replace the frosted-glass background/border with the Aurora white + hairline (drop the blur):
```css
  background: var(--aurora-card);
  border: 1px solid var(--aurora-hairline-2);
  color: var(--aurora-ink);
  box-shadow: none;
```
(`.btn-outline:hover` → `background: var(--aurora-surface-2); border-color: var(--aurora-selected-border);`).

`Button` variants already route `default → btn-primary`, `outline/secondary → btn-outline` (no `button.tsx` change needed beyond verifying; leave the `cva` map intact).

In `apps/web/src/components/ui/card.tsx`, change the root `cn(...)` first argument to:
```tsx
"rounded-[15px] border border-[var(--aurora-hairline)] bg-white text-gray-900 shadow-[0_16px_50px_rgba(60,40,120,0.13)] dark:border-white/20 dark:bg-[rgb(18,18,28)] dark:text-white",
```

In `apps/web/src/components/ui/tabs.tsx`, change `TabsList` background to `bg-[var(--aurora-surface)]` and `TabsTrigger` active state to `data-[state=active]:bg-white data-[state=active]:text-[var(--aurora-violet-deep)] data-[state=active]:shadow-[0_2px_8px_rgba(60,40,120,0.10)]` (keep the rounded-full pill shape).

In `apps/web/src/components/ui/switch.tsx`, confirm `data-[state=checked]:bg-primary` (already violet via `--primary`); no change required — note it in the commit if untouched.

- [ ] **Step 5: Run the badge test + typecheck**

Run: `pnpm --filter vacation-price-tracker-web exec jest src/__tests__/badge-aurora.test.tsx`
Expected: **PASS** (all four variant classes present).

Run: `pnpm --filter vacation-price-tracker-web typecheck && pnpm --filter vacation-price-tracker-web lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/ui/button.tsx apps/web/src/components/ui/badge.tsx apps/web/src/components/ui/card.tsx apps/web/src/components/ui/tabs.tsx apps/web/src/components/ui/switch.tsx apps/web/src/app/globals.css apps/web/src/__tests__/badge-aurora.test.tsx
git commit -m "feat(web): Aurora variants for button, badge, card, tabs primitives"
```

---

## Task 3: Sign in (`app/page.tsx`)

**Files:**
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/app/page.module.css`
- Test: `apps/web/src/__tests__/sign-in-aurora.test.tsx` (Create)

**Interfaces:**
- Consumes: Task 1 tokens/utilities (`.aurora-logo`, `--aurora-grad-primary`, page bg, radial glows), Task 2 `Badge` (the "Date-Range Optimizer" eyebrow stays a `Badge`). Existing `GoogleButton` from `react-google-button` and `redirectTo(googleStartUrl)` are unchanged — **do not touch auth wiring**.
- Produces: none (leaf screen).

**Layout (full-width, exact):** Two-column hero (`grid-template-columns: 1.05fr .95fr` per spec).
- **Left column:** eyebrow `Badge` "Date-Range Optimizer" (violet chip); H1 weight 800 / 24–28px / `-0.02em` with two lines — line 1 "Find your cheapest" in `--aurora-ink`, line 2 "vacation window" via the **violet→pink text gradient** (`background: linear-gradient(135deg,#7C3AED,#EC4899); -webkit-background-clip: text; color: transparent;` — apply on `.titleAccent`); supporting paragraph in `--aurora-body`; a **feature row** (Plane / Building2 / Bell lucide icons, each in an `.aurora-logo`-tinted icon chip, with vertical `Separator`s); **two stats** ("$186" + "avg. savings per trip", "90+" + "date combinations checked"), stat values weight 800 / 19–24px.
- **Right column:** white **sign-in card** (`.aurora-card`) containing an `.aurora-logo` gradient logo square, "Ready to get started?", the `GoogleButton` (full-color Google glyph), and a "Google OAuth only. We never store passwords." caption in `--aurora-muted`.
- **Background:** three soft radial glows (`.blob1` violet, `.blob2` pink, `.blob3` cyan) at low opacity — keep the existing `.backdrop`/`.blob*` structure, just retint to Aurora hexes.

**Half-width (720px):** single centered column, order: logo → eyebrow → H1 → paragraph → inline `Flights · Hotels · Price alerts` (the feature row collapses to inline text) → sign-in card. Achieve by switching `.heroGrid` to `grid-template-columns: 1fr` and centering at `@media (max-width: 820px)`.

- [ ] **Step 1: Write the failing render test**

Create `apps/web/src/__tests__/sign-in-aurora.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import HomePage from "@/app/page";

jest.mock("@/lib/navigation", () => ({ redirectTo: jest.fn() }));

describe("Sign-in (Aurora)", () => {
  it("renders the eyebrow, gradient H1 line, feature row, two stats, and the no-passwords caption", () => {
    render(<HomePage />);
    expect(screen.getByText("Date-Range Optimizer")).toBeInTheDocument();
    // gradient second line lives in its own element so it can carry the text-gradient
    expect(screen.getByText(/vacation window/i)).toBeInTheDocument();
    expect(screen.getByText(/Flight combinations/i)).toBeInTheDocument();
    expect(screen.getByText(/Hotel matching/i)).toBeInTheDocument();
    expect(screen.getByText(/Price alerts/i)).toBeInTheDocument();
    expect(screen.getByText("$186")).toBeInTheDocument();
    expect(screen.getByText("90+")).toBeInTheDocument();
    expect(screen.getByText(/never store passwords/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and confirm current state**

Run: `pnpm --filter vacation-price-tracker-web exec jest src/__tests__/sign-in-aurora.test.tsx`
Expected: it may already PASS for some strings (the page exists) but **FAIL** on `/Price alerts/i` (current copy is "Price alerts" inside a span — verify) — the test pins the Aurora copy. If it passes wholesale, still proceed; the visual reskin in Step 3 is the substantive change and is verified by Playwright in Step 4.

- [ ] **Step 3: Reskin `page.tsx` + `page.module.css`**

Keep the JSX component tree from the current `page.tsx` (it already has the two-column hero, badge, feature row, stats, sign-in card). Apply Aurora styling **in `page.module.css`** and ensure the second H1 line is its own element (`<span className={styles.titleAccent}>vacation window</span>`). Concretely, in `page.module.css`:
- `.main` background `var(--aurora-page)`.
- `.heroGrid` `display: grid; grid-template-columns: 1.05fr .95fr; gap: 48px; align-items: center;`.
- `.title` `font-weight: 800; font-size: 28px; line-height: 1.15; letter-spacing: -0.02em; color: var(--aurora-ink);`.
- `.titleAccent` `background: linear-gradient(135deg, var(--aurora-violet), var(--aurora-pink)); -webkit-background-clip: text; background-clip: text; color: transparent;`.
- `.tagline` `color: var(--aurora-body); font-weight: 500;`.
- `.featureIcon` `background: var(--aurora-surface); color: var(--aurora-violet); border-radius: 10px; width: 40px; height: 40px;`.
- `.statValue` `font-weight: 800; font-size: 22px; letter-spacing: -0.02em; color: var(--aurora-ink);`; `.statLabel` `color: var(--aurora-muted);`.
- `.ctaCard` → add `composes`? (CSS Modules `composes` is fine) OR set the same props as `.aurora-card` inline: `background: var(--aurora-card); border: 1px solid var(--aurora-hairline); border-radius: var(--aurora-radius-card); box-shadow: var(--aurora-shadow-card); padding: 28px;`.
- `.oauthNote` `color: var(--aurora-muted); font-size: 12px;`.
- `.blob1/2/3` retint to `var(--aurora-violet)` / `var(--aurora-pink)` / `var(--aurora-cyan)` radial gradients at ~0.18 opacity.
- Half-width: `@media (max-width: 820px) { .heroGrid { grid-template-columns: 1fr; } .heroContent { text-align: center; align-items: center; } .featuresRow { justify-content: center; } }`.

- [ ] **Step 4: Visual verification at both widths**

Ensure the dev stack is up (`docker ps` → `web`; else `pnpm nx run web:dev`). Using the `debug-web` skill / Playwright:
- Navigate to `https://localhost:3000/` at **1440×900**; screenshot. Assert: two-column hero with the eyebrow chip, the "vacation window" line rendered with the violet→pink gradient (transparent text fill), the three-item feature row, two stats, and the white sign-in card with the gradient logo + Google button on the right.
- Resize to **720×1024**; screenshot. Assert: single centered column in the documented order (logo → eyebrow → H1 → paragraph → inline features → sign-in card).
- Confirm no console/pageerror output.

- [ ] **Step 5: Run the test + typecheck + lint**

Run: `pnpm --filter vacation-price-tracker-web exec jest src/__tests__/sign-in-aurora.test.tsx`
Expected: **PASS**.
Run: `pnpm --filter vacation-price-tracker-web typecheck && pnpm --filter vacation-price-tracker-web lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/page.tsx apps/web/src/app/page.module.css apps/web/src/__tests__/sign-in-aurora.test.tsx
git commit -m "feat(web): Aurora reskin of the sign-in screen"
```

---

## Task 4: Dashboard + Assistant (`app/trips/page.tsx` + `components/chat/**`)

**Files:**
- Modify: `apps/web/src/app/trips/page.tsx`
- Modify: `apps/web/src/app/trips/page.module.css`
- Modify: `apps/web/src/app/layout.module.css` (top bar / footer tokens)
- Modify: `apps/web/src/components/chat/chat-panel.tsx`
- Modify: `apps/web/src/components/chat/chat-message.tsx`
- Modify: `apps/web/src/components/chat/tool-call-display.tsx`
- Test: `apps/web/src/__tests__/dashboard-aurora.test.tsx` (Create)

**Interfaces:**
- Consumes: Task 1 utilities, Task 2 `Badge` (status chips), `Button`, `Table` primitives. Existing data flow (`api.trips.list()`, `mapApiTripToDisplayTrip`, SSE, `ChatProvider`) is **unchanged** — reskin only. Reuse existing `formatPrice`, `formatShortDate`, `formatTimestamp`.
- Produces: replace the `getStatusVariant` mapping so `ACTIVE → "active"`, `PAUSED`/`EXPIRED → "paused"`, `ERROR → "stop"` (was `default`/`secondary`/`outline`). The columns set is fixed (below) so Task 8's responsive sweep can assert it.

**Layout (full-width, exact):**
- **App top bar** (lives in `layout.module.css` / the existing layout chrome): `.aurora-logo` gradient square + "Price Tracker" wordmark, a "Live" pill (SSE-connected indicator — reuse `isConnected`), and an `.aurora-avatar` user avatar. Background `var(--aurora-card)`, bottom `--aurora-hairline`.
- **Page header:** "Your Trips" H1 (weight 800 / 24px), subcount, and right-aligned **Refresh All** (outline) + **New Trip** (primary) buttons (keep the existing `ChatToggle` + `Delete All` controls; style as outline). Keep `headerActions` order.
- **Two-pane grid `1fr 360px`:** left = trips table panel (`.aurora-card`), right = assistant panel (`.aurora-card`). Update `.columns` lg breakpoint to `grid-template-columns: 1fr 360px;`.
- **Trips table** columns, left→right: **Trip · Route (`SFO ↔ RDM`) · Dates · Flight $ · Hotel $ · Total $ (violet, weight 800) · Status**. (The existing table also has an "Updated" col + a kebab actions col — **keep both**; the seven Aurora columns plus those two is acceptable, but the visible spec columns must render with the Aurora styling.) First data row tinted `#FBFAFF` (`.tripTable tbody tr:first-child { background: #FBFAFF; }`). Header row uppercase 10–12px `--aurora-muted`. Status cell uses the Task-2 `Badge` variants. **Pinned footer row** at the bottom of the panel: "Showing N of N trips" (left) + "Prices refresh daily at 6:00 AM" (right) — add a `.tableFooter` flex bar inside `.tablePanel` after `.tableWrapper`, `border-top: 1px solid var(--aurora-hairline)`.
- **Assistant panel:** header (gradient `.aurora-logo` icon, "Assistant", "Powered by Groq" caption), message thread (user bubble = violet fill, assistant bubble = white + `--aurora-hairline` border), the **tool-call chip** (reskin `tool-call-display.tsx` header to a pill with a check icon), and the "Ask anything…" input pinned to the bottom with a violet send button. Panel fills height; input pinned (existing `ChatPanel` already pins the input — restyle only).

**Half-width (720px):** single column — header, a segmented control **Trips | Assistant** (use the Task-2 `Tabs` pill), and **stacked trip cards** (name + status chip, `route · dates`, three mini-stats Flight/Hotel/Total). Add a `.tripCards` list rendered at `@media (max-width: 820px)` while the `<table>` is hidden; reuse the same `trips` array.

- [ ] **Step 1: Write the failing dashboard test**

Create `apps/web/src/__tests__/dashboard-aurora.test.tsx`. Mock `@/lib/api` to return two trips (one ACTIVE, one PAUSED) and assert columns + chips + footer:

```tsx
import { render, screen, waitFor, within } from "@testing-library/react";
import DashboardPage from "@/app/trips/page";

jest.mock("@/hooks/use-sse", () => ({ useSSE: () => ({ isConnected: true }) }));
jest.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error { status = 0; detail = ""; },
  api: {
    trips: {
      list: jest.fn().mockResolvedValue({
        data: [
          { id: "1", name: "Test 2", origin_airport: "SFO", destination_code: "RDM",
            depart_date: "2025-08-22", return_date: "2025-08-26", status: "active",
            current_flight_price: "177", current_hotel_price: "612", total_price: "789",
            last_refreshed: "2025-08-01T00:00:00Z" },
          { id: "2", name: "Tokyo", origin_airport: "LAX", destination_code: "HND",
            depart_date: "2026-03-20", return_date: "2026-03-28", status: "paused",
            current_flight_price: "842", current_hotel_price: "1180", total_price: "2022",
            last_refreshed: "2025-08-01T00:00:00Z" },
        ],
      }),
    },
  },
}));

describe("Dashboard (Aurora)", () => {
  it("renders the trip columns, violet ACTIVE + amber PAUSED chips, and the pinned footer", async () => {
    render(<DashboardPage />);
    await waitFor(() => expect(screen.getByText("Test 2")).toBeInTheDocument());

    // headers
    for (const h of ["Trip", "Route", "Dates", "Flight", "Hotel", "Total", "Status"]) {
      expect(screen.getAllByText(new RegExp(`^${h}`, "i")).length).toBeGreaterThan(0);
    }
    // status chips use the Aurora variant classes
    expect(screen.getByText("ACTIVE")).toHaveClass("aurora-chip-active");
    expect(screen.getByText("PAUSED")).toHaveClass("aurora-chip-paused");
    // verified total renders
    expect(screen.getByText("$789")).toBeInTheDocument();
    // pinned footer
    expect(screen.getByText(/Showing 2 of 2 trips/i)).toBeInTheDocument();
    expect(screen.getByText(/refresh daily at 6:00 AM/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and confirm FAIL**

Run: `pnpm --filter vacation-price-tracker-web exec jest src/__tests__/dashboard-aurora.test.tsx`
Expected: **FAIL** — current badges use `default`/`secondary` (no `aurora-chip-*` class), and the footer text does not exist yet.

- [ ] **Step 3: Reskin the dashboard**

In `apps/web/src/app/trips/page.tsx`:
- Replace `getStatusVariant` to return the Aurora variants:
```tsx
function getStatusVariant(
  status: DisplayStatus,
): "active" | "paused" | "stop" {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "ERROR":
      return "stop";
    default:
      return "paused"; // PAUSED, EXPIRED
  }
}
```
- After the `</Table>`/`.tableWrapper` close (inside `.tablePanel`, both the loaded and loading branches share the panel — add it once at the panel level after the conditional), render the pinned footer:
```tsx
<div className={styles.tableFooter}>
  <span>Showing {trips.length} of {trips.length} trip{trips.length === 1 ? "" : "s"}</span>
  <span>Prices refresh daily at 6:00 AM</span>
</div>
```
- Keep the existing column set; the table already renders Trip/Route/Dates/Flight/Hotel/Total/Status/Updated/Actions. Ensure the "Total" cell keeps `styles.priceTotal`.

In `apps/web/src/app/trips/page.module.css`:
- `.tablePanel`, `.chatPanel` → swap the glass background for `.aurora-card` props (`background: var(--aurora-card); border: 1px solid var(--aurora-hairline); border-radius: var(--aurora-radius-card); box-shadow: var(--aurora-shadow-card);`).
- `.title` → `font-weight: 800; letter-spacing: -0.02em; color: var(--aurora-ink);`.
- `.columns` lg breakpoint → `grid-template-columns: 1fr 360px;` (and `1280px` likewise `1fr 360px`).
- `.tripTable th` → `color: var(--aurora-muted); font-size: 11px; letter-spacing: .06em;`, background `var(--aurora-card)`.
- `.tripTable tbody tr:first-child { background: #FBFAFF; }`.
- `.priceTotal { color: var(--aurora-violet); font-weight: 800; }`.
- `.tableFooter { display: flex; justify-content: space-between; padding: 10px 16px; border-top: 1px solid var(--aurora-hairline); font-size: 12px; color: var(--aurora-muted); flex-shrink: 0; }`.
- Half-width: at `@media (max-width: 820px)` hide `.tableWrapper table` and render the stacked `.tripCards` (add the JSX list + `.tripCard` styles: name + status chip, `route · dates`, three mini-stats).

In `apps/web/src/components/chat/chat-panel.tsx`: change the header to show the `.aurora-logo` gradient icon + "Assistant" + a "Powered by Groq" caption; restyle the header border to `--aurora-hairline`. In `chat-message.tsx`: user bubble keeps `bg-primary` (violet); assistant bubble → `bg-white border border-[var(--aurora-hairline)]`. In `tool-call-display.tsx`: the `ToolCallHeader` becomes a rounded pill `bg-[var(--aurora-surface)] border-[var(--aurora-hairline)]` with the existing check/loader status icon.

In `apps/web/src/app/layout.module.css`: retint `.brandIcon` to `.aurora-logo` gradient, `.avatar` to the Aurora gradient, header border to `--aurora-hairline`, footer text to `--aurora-muted`.

- [ ] **Step 4: Visual verification at both widths**

Via `debug-web`/Playwright (dev stack up; you may need a test session — `POST /v1/auth/test-login` when `ENVIRONMENT=test`, or use existing seeded data):
- `https://localhost:3000/trips` at **1440×900**: assert the `1fr 360px` two-pane layout; the trips table with the seven spec columns; the **first row tinted `#FBFAFF`**; the **ACTIVE chip violet** + **PAUSED chip amber**; **Total column violet/bold**; the **pinned footer** ("Showing N of N trips" + "Prices refresh daily at 6:00 AM"); the assistant panel with gradient icon header, message bubbles, a tool-call chip, and pinned input.
- At **720×1024**: assert single column with the **Trips | Assistant** segmented control and **stacked trip cards** (name + status, route · dates, three mini-stats).
- No console/pageerror output.

- [ ] **Step 5: Run tests + typecheck + lint**

Run: `pnpm --filter vacation-price-tracker-web exec jest src/__tests__/dashboard-aurora.test.tsx`
Expected: **PASS**.
Run: `pnpm --filter vacation-price-tracker-web typecheck && pnpm --filter vacation-price-tracker-web lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/trips/page.tsx apps/web/src/app/trips/page.module.css apps/web/src/app/layout.module.css apps/web/src/components/chat/chat-panel.tsx apps/web/src/components/chat/chat-message.tsx apps/web/src/components/chat/tool-call-display.tsx apps/web/src/__tests__/dashboard-aurora.test.tsx
git commit -m "feat(web): Aurora reskin of the dashboard and assistant"
```

---

## Task 5: Trip detail — THE interactive screen (`app/trips/[tripId]/page.tsx`)

**Files:**
- Create: `apps/web/src/lib/aurora.ts`
- Create: `apps/web/src/__tests__/aurora.test.ts`
- Create: `apps/web/src/components/aurora/airline-chip.tsx` + `airline-chip.module.css`
- Create: `apps/web/src/components/aurora/hotel-photo.tsx` + `hotel-photo.module.css`
- Modify: `apps/web/src/app/trips/[tripId]/page.tsx`
- Modify: `apps/web/src/app/trips/[tripId]/page.module.css`
- Test: `apps/web/src/__tests__/trip-detail-selection.test.tsx` (Create)

**Interfaces:**
- Consumes: `TripDetail`, `PriceSnapshot`, `ApiFlightOffer` (with `itineraries[].segments[]`, `stops`, `price`, `airline_code`/`airline_name`), `ApiHotelOffer` (`name`, `price`, `rating`), and the existing helpers `flightStableKey`, `hotelStableKey`, `parsePrice`, `aggregateDailyPriceHistory` (from `lib/price-history.ts`), `formatPrice`, `formatFlightTime`, `formatDuration`, `getAirlineName`, `renderStars` (from `lib/format.ts`). The existing data fetch (`api.trips.getDetails`), SSE refetch, status toggle, refresh, and delete flows are **unchanged**.
- Produces (`lib/aurora.ts`, consumed here and unit-tested in `aurora.test.ts`):
  - `airlineChip(carrierCode: string | null | undefined): { initials: string; gradient: string }` — `AS`→`linear-gradient(135deg,#10617F,#093247)`, `UA`→`linear-gradient(135deg,#2456C9,#13357F)`, `DL`→`linear-gradient(135deg,#C8102E,#7A0A1C)`; any other code → first two letters uppercased + a neutral violet gradient `linear-gradient(135deg,#A78BFA,#7C3AED)`.
  - `operatingCarriers(flight: ApiFlightOffer): string[]` — unique airline **names** (via `getAirlineName`) across every segment of every itinerary, in first-seen order.
  - `multiCarrierSubtitle(flight: ApiFlightOffer): string | null` — `null` when ≤1 distinct carrier, else `"Operated by " + names.join(" & ")` (e.g. `"Operated by United & Alaska"`).
  - `stopsBadge(flight: ApiFlightOffer): { label: string; tone: "success" | "warning" }` — `stops === 0` → `{ label: "NON-STOP", tone: "success" }`; else `{ label: \`${stops} STOP${stops>1?"S":""}${via ? " · "+via : ""}\`, tone: "warning" }` where `via` is the first outbound connection airport code.
  - `layoverLabel(prevSeg, seg): string | null` — minutes between `prevSeg.arrival_time` and `seg.departure_time` via `formatDuration`, formatted `"<dur> layover in <City> (<CODE>)"`; uses the arrival airport code; falls back to just the code when no city map entry; `null` when times missing/negative.

**Layout (exact):** Inside the scroll container, a **sticky top region** (`position: sticky; top: 0;` on `.stickyRegion`, `background: var(--aurora-page)`):
1. Breadcrumb "Your Trips / {trip.name}" (`--aurora-muted`, the leading part links to `/trips`).
2. **Title row, single line:** `{trip.name}` + the Task-2 ACTIVE/PAUSED `Badge`, then trip meta **to the right of the title** (route `SFO ↔ RDM`, `Aug 22 – 26, 2025` via `formatDateRange`/`formatShortDate`, a `4 nights · 2 adults` chip), then **Edit** / **Refresh** buttons (outline) pushed to the far right (`margin-left: auto`).
3. **Three short stat chips** (horizontal flex; each = icon + label + value): **Flight** `formatPrice(effectiveFlightPrice)`, **Hotel** `formatPrice(effectiveHotelPrice)` + a `$X/night` sub, **Trip total** `formatPrice(effectiveTotalPrice)` rendered on a `.aurora-total-card` gradient card. These reflect the current selection.
4. **Price-history chart** — keep the Recharts chart from `PriceHistoryChart`; retint: **Total** line `var(--aurora-violet)` with a moving "current" dot, **Hotel** line dashed `var(--aurora-cyan)`; add a **"Now $X" badge** anchored to the latest point showing `formatPrice(effectiveTotalPrice)`.

**Below the sticky region (scrolls):** two-column grid (`grid-template-columns: 1.05fr .95fr`) — **Flights** (left) and **Hotels** (right) as **collapsible rows**:
- **Flight row (collapsed):** filled-violet radio (selected) + `AirlineChip` (monogram, always shown) + airline name + the `stopsBadge` (`Badge variant="nonstop"` green / `variant="stop"` amber, label e.g. `1 STOP · DEN`) + `formatPrice` + chevron; a one-line summary underneath (`7:05a SFO → 9:00a RDM · nonstop`).
- **Flight row (expanded, non-stop):** OUTBOUND and RETURN sections (reuse `ItinerarySection`/`SegmentRow`) with times, codes, duration · flight number, the progress line + ✈ marker.
- **Flight row (expanded, multi-stop / multi-carrier):** per-leg rows each with **its own `AirlineChip`** (leg 1 `UA 508` SFO→DEN, leg 2 `AS 2201` DEN→RDM), an **amber layover pill** (`.aurora-layover-pill`, text from `layoverLabel`), a "RETURN … 1 stop via DEN" summary, and an `multiCarrierSubtitle` subtitle ("Operated by United & Alaska") rendered whenever the flight's segments span >1 carrier (driven by the real data; no flag). Card gets a **3px amber left accent** (`border-left: 3px solid var(--aurora-layover)`).
- **Hotel row:** `HotelPhoto` (always rendered; placeholder fallback when no URL) + name + star rating (`renderStars`, gold) + descriptor + `$153 /night · $612 total` + radio + chevron; expanded shows a cancellation/amenities info line.
- Each list ends with a dashed **"Show N more flights" / "Show all N hotels"** affordance.
- **Selected** flight/hotel rows: `background: var(--aurora-surface-2)` (`#F8F5FE`), `border: 1px solid var(--aurora-selected-border)` (`#C9B8F5`), filled violet radio, violet price.

**Selection state machine (exact — replace the two ad-hoc `useState`s + per-list `expandedCards`):** the page owns four states `selectedFlightId`, `expandedFlightId`, `selectedHotelId`, `expandedHotelId` (using the existing **stable keys** as ids). Selecting a row both **selects** it and **toggles its expansion**; one expanded at a time per list; tapping the already-expanded/selected row collapses it but keeps it selected.

```tsx
// in app/trips/[tripId]/page.tsx
type SelectionState = {
  selectedFlightId: string | null;
  expandedFlightId: string | null;
  selectedHotelId: string | null;
  expandedHotelId: string | null;
};

type SelectionAction =
  | { type: "selectFlight"; id: string }
  | { type: "selectHotel"; id: string }
  | { type: "preselect"; flightId: string | null; hotelId: string | null };

function selectionReducer(
  state: SelectionState,
  action: SelectionAction,
): SelectionState {
  switch (action.type) {
    case "selectFlight":
      return {
        ...state,
        selectedFlightId: action.id,
        // toggle expansion: collapse if it was the expanded one, else expand it
        expandedFlightId: state.expandedFlightId === action.id ? null : action.id,
      };
    case "selectHotel":
      return {
        ...state,
        selectedHotelId: action.id,
        expandedHotelId: state.expandedHotelId === action.id ? null : action.id,
      };
    case "preselect":
      return {
        selectedFlightId: action.flightId,
        expandedFlightId: null,
        selectedHotelId: action.hotelId,
        expandedHotelId: null,
      };
  }
}
```

The derived total stays exactly as the current page computes it (kept verbatim so behavior is identical):

```tsx
const selectedFlight = state.selectedFlightId
  ? latestOffers.flights.find((f) => flightStableKey(f) === state.selectedFlightId)
  : null;
const selectedHotel = state.selectedHotelId
  ? latestOffers.hotels.find((h) => hotelStableKey(h) === state.selectedHotelId)
  : null;

const effectiveFlightPrice = selectedFlight ? parsePrice(selectedFlight.price) : flightPriceValue;
const effectiveHotelPrice = selectedHotel ? parsePrice(selectedHotel.price) : hotelPriceValue;
const effectiveTotalPrice =
  effectiveFlightPrice != null && effectiveHotelPrice != null
    ? effectiveFlightPrice + effectiveHotelPrice
    : effectiveFlightPrice ?? effectiveHotelPrice;
```

The chart's "current" point and the "Now $X" badge both read `effectiveTotalPrice`; `aggregateDailyPriceHistory(priceHistory, { selectedFlightKey: state.selectedFlightId, selectedHotelKey: state.selectedHotelId })` already recomputes the selected series, so passing the reducer's ids preserves the existing recompute path.

**Half-width (720px):** same content, single column — sticky stat chips + chart, then full-width Flights card, then Hotels card (`@media (max-width: 820px) { .offersGrid { grid-template-columns: 1fr; } }`).

- [ ] **Step 1: Write the failing `lib/aurora.ts` tests**

Create `apps/web/src/__tests__/aurora.test.ts`:

```ts
import {
  airlineChip,
  operatingCarriers,
  multiCarrierSubtitle,
  stopsBadge,
  layoverLabel,
} from "@/lib/aurora";
import type { ApiFlightOffer, ApiFlightSegment } from "@/lib/api";

const seg = (over: Partial<ApiFlightSegment>): ApiFlightSegment => ({
  carrier_code: "UA", flight_number: "UA508",
  departure_airport: "SFO", arrival_airport: "DEN",
  departure_time: "2025-08-22T07:05:00", arrival_time: "2025-08-22T10:30:00",
  duration_minutes: 205, ...over,
});

const nonstop: ApiFlightOffer = {
  id: "as1", airline_code: "AS", price: "177", stops: 0,
  itineraries: [{ direction: "outbound", stops: 0, segments: [seg({ carrier_code: "AS", flight_number: "AS1", arrival_airport: "RDM" })] }],
};
const oneStopMulti: ApiFlightOffer = {
  id: "ua1", airline_code: "UA", price: "154", stops: 1,
  itineraries: [{ direction: "outbound", stops: 1, segments: [
    seg({ carrier_code: "UA", flight_number: "UA508", arrival_airport: "DEN", arrival_time: "2025-08-22T10:30:00" }),
    seg({ carrier_code: "AS", flight_number: "AS2201", departure_airport: "DEN", arrival_airport: "RDM", departure_time: "2025-08-22T11:40:00" }),
  ] }],
};

describe("airlineChip", () => {
  it("maps AS/UA/DL to their gradients", () => {
    expect(airlineChip("AS")).toEqual({ initials: "AS", gradient: "linear-gradient(135deg,#10617F,#093247)" });
    expect(airlineChip("UA")).toEqual({ initials: "UA", gradient: "linear-gradient(135deg,#2456C9,#13357F)" });
    expect(airlineChip("DL")).toEqual({ initials: "DL", gradient: "linear-gradient(135deg,#C8102E,#7A0A1C)" });
  });
  it("falls back to two-letter initials + violet gradient", () => {
    expect(airlineChip("b6")).toEqual({ initials: "B6", gradient: "linear-gradient(135deg,#A78BFA,#7C3AED)" });
    expect(airlineChip(null).initials).toBe("--");
  });
});

describe("operatingCarriers + multiCarrierSubtitle", () => {
  it("single carrier → no subtitle", () => {
    expect(operatingCarriers(nonstop)).toEqual(["Alaska"]);
    expect(multiCarrierSubtitle(nonstop)).toBeNull();
  });
  it("two carriers → 'Operated by United & Alaska'", () => {
    expect(operatingCarriers(oneStopMulti)).toEqual(["United", "Alaska"]);
    expect(multiCarrierSubtitle(oneStopMulti)).toBe("Operated by United & Alaska");
  });
});

describe("stopsBadge", () => {
  it("non-stop → success NON-STOP", () => {
    expect(stopsBadge(nonstop)).toEqual({ label: "NON-STOP", tone: "success" });
  });
  it("one stop → warning with via airport", () => {
    expect(stopsBadge(oneStopMulti)).toEqual({ label: "1 STOP · DEN", tone: "warning" });
  });
});

describe("layoverLabel", () => {
  it("formats the layover with city + code", () => {
    const [a, b] = oneStopMulti.itineraries![0].segments!;
    expect(layoverLabel(a, b)).toBe("1h 10m layover in Denver (DEN)");
  });
  it("returns null when times are missing", () => {
    expect(layoverLabel({ ...seg({}), arrival_time: null }, seg({}))).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and confirm FAIL**

Run: `pnpm --filter vacation-price-tracker-web exec jest src/__tests__/aurora.test.ts`
Expected: **FAIL** — `@/lib/aurora` does not exist.

- [ ] **Step 3: Implement `lib/aurora.ts`**

Create `apps/web/src/lib/aurora.ts`:

```ts
import type { ApiFlightOffer, ApiFlightSegment } from "@/lib/api";
import { getAirlineName, formatDuration } from "@/lib/format";

const CHIP_GRADIENTS: Record<string, string> = {
  AS: "linear-gradient(135deg,#10617F,#093247)",
  UA: "linear-gradient(135deg,#2456C9,#13357F)",
  DL: "linear-gradient(135deg,#C8102E,#7A0A1C)",
};
const FALLBACK_GRADIENT = "linear-gradient(135deg,#A78BFA,#7C3AED)";

/** Minimal airport-code → city map for layover labels (extend as needed). */
const AIRPORT_CITIES: Record<string, string> = {
  DEN: "Denver", SFO: "San Francisco", RDM: "Redmond", LAX: "Los Angeles",
  JFK: "New York", SEA: "Seattle", ORD: "Chicago", DFW: "Dallas",
  ATL: "Atlanta", PHX: "Phoenix", SLC: "Salt Lake City",
};

export function airlineChip(
  carrierCode: string | null | undefined,
): { initials: string; gradient: string } {
  const code = (carrierCode ?? "").toUpperCase();
  if (CHIP_GRADIENTS[code]) {
    return { initials: code, gradient: CHIP_GRADIENTS[code] };
  }
  const initials = code ? code.slice(0, 2).padEnd(2, code[0] ?? "-") : "--";
  return { initials, gradient: FALLBACK_GRADIENT };
}

function allSegments(flight: ApiFlightOffer): ApiFlightSegment[] {
  return (flight.itineraries ?? []).flatMap((it) => it.segments ?? []);
}

export function operatingCarriers(flight: ApiFlightOffer): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const s of allSegments(flight)) {
    const name = getAirlineName(s.carrier_code);
    if (name && name !== "—" && !seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

export function multiCarrierSubtitle(flight: ApiFlightOffer): string | null {
  const names = operatingCarriers(flight);
  if (names.length <= 1) return null;
  return `Operated by ${names.join(" & ")}`;
}

export function stopsBadge(
  flight: ApiFlightOffer,
): { label: string; tone: "success" | "warning" } {
  const stops = flight.stops ?? 0;
  if (stops === 0) return { label: "NON-STOP", tone: "success" };
  const outbound = flight.itineraries?.[0]?.segments ?? [];
  const via = outbound.length > 1 ? outbound[0]?.arrival_airport ?? null : null;
  const base = `${stops} STOP${stops > 1 ? "S" : ""}`;
  return { label: via ? `${base} · ${via}` : base, tone: "warning" };
}

export function layoverLabel(
  prevSeg: ApiFlightSegment,
  seg: ApiFlightSegment,
): string | null {
  const arr = prevSeg.arrival_time;
  const dep = seg.departure_time;
  if (!arr || !dep) return null;
  const diffMs = new Date(dep).getTime() - new Date(arr).getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return null;
  const dur = formatDuration(Math.round(diffMs / 60000));
  const code = prevSeg.arrival_airport ?? "—";
  const city = AIRPORT_CITIES[code.toUpperCase()];
  return city ? `${dur} layover in ${city} (${code})` : `${dur} layover in ${code}`;
}
```

- [ ] **Step 4: Run the aurora-lib test and confirm PASS**

Run: `pnpm --filter vacation-price-tracker-web exec jest src/__tests__/aurora.test.ts`
Expected: **PASS** (all helper assertions green).

- [ ] **Step 5: Create the `AirlineChip` + `HotelPhoto` components**

Create `apps/web/src/components/aurora/airline-chip.tsx`:

```tsx
import { airlineChip } from "@/lib/aurora";
import styles from "./airline-chip.module.css";

export function AirlineChip({
  carrierCode,
  secondaryCode,
}: {
  carrierCode: string | null | undefined;
  /** When set (multi-carrier), overlaps a second chip behind the first. */
  secondaryCode?: string | null;
}) {
  const primary = airlineChip(carrierCode);
  return (
    <span className={styles.stack}>
      {secondaryCode != null && (
        <span
          className={`${styles.chip} ${styles.behind}`}
          style={{ backgroundImage: airlineChip(secondaryCode).gradient }}
        >
          {airlineChip(secondaryCode).initials}
        </span>
      )}
      <span className={styles.chip} style={{ backgroundImage: primary.gradient }}>
        {primary.initials}
      </span>
    </span>
  );
}
```

Create `apps/web/src/components/aurora/airline-chip.module.css`:

```css
.stack { display: inline-flex; align-items: center; }
.chip {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 8px;
  color: #fff; font-weight: 800; font-size: 11px; letter-spacing: .02em;
}
.behind { margin-right: -10px; box-shadow: 0 0 0 2px #fff; }
```

Create `apps/web/src/components/aurora/hotel-photo.tsx`:

```tsx
import { Hotel } from "lucide-react";
import styles from "./hotel-photo.module.css";

export function HotelPhoto({
  src,
  alt,
}: {
  src?: string | null;
  alt: string;
}) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={styles.photo} src={src} alt={alt} />;
  }
  return (
    <span className={styles.placeholder} aria-hidden="true">
      <Hotel className={styles.placeholderIcon} />
    </span>
  );
}
```

Create `apps/web/src/components/aurora/hotel-photo.module.css`:

```css
.photo { width: 48px; height: 48px; border-radius: 10px; object-fit: cover; }
.placeholder {
  display: inline-flex; align-items: center; justify-content: center;
  width: 48px; height: 48px; border-radius: 10px;
  background: var(--aurora-surface); color: var(--aurora-violet);
}
.placeholderIcon { width: 22px; height: 22px; }
```

- [ ] **Step 6: Write the failing selection + verified-totals test**

Create `apps/web/src/__tests__/trip-detail-selection.test.tsx`. Mock `api.trips.getDetails` to return one snapshot containing Alaska (non-stop, $177) + United (1-stop, $142) flights and Riverhouse ($612) + Eviva ($538) hotels, so the three verified totals are reproducible: Alaska+Riverhouse = **789**, United+Riverhouse = **754**, Delta+Eviva = **680** (add a Delta $142 + Eviva $538 → 680; pick flight prices so the sums match — Alaska 177, United 142, Delta 142; Riverhouse 612, Eviva 538). Adjust the fixture prices to satisfy: `177+612=789`, `142+612=754`, `142+538=680`.

```tsx
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TripDetailPage from "@/app/trips/[tripId]/page";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/lib/sse-provider", () => ({ useSSEContextOptional: () => null }));

const snapshot = {
  id: "s1", created_at: "2025-08-01T00:00:00Z",
  flight_price: "142", hotel_price: "538", total_price: "680",
  flight_offers: [
    { id: "as", airline_code: "AS", price: "177", stops: 0,
      itineraries: [{ direction: "outbound", stops: 0, segments: [
        { carrier_code: "AS", flight_number: "AS1", departure_airport: "SFO", arrival_airport: "RDM",
          departure_time: "2025-08-22T07:05:00", arrival_time: "2025-08-22T09:00:00", duration_minutes: 115 }] }] },
    { id: "ua", airline_code: "UA", price: "142", stops: 1,
      itineraries: [{ direction: "outbound", stops: 1, segments: [
        { carrier_code: "UA", flight_number: "UA508", departure_airport: "SFO", arrival_airport: "DEN",
          departure_time: "2025-08-22T06:00:00", arrival_time: "2025-08-22T09:30:00", duration_minutes: 210 },
        { carrier_code: "AS", flight_number: "AS2201", departure_airport: "DEN", arrival_airport: "RDM",
          departure_time: "2025-08-22T10:40:00", arrival_time: "2025-08-22T12:10:00", duration_minutes: 90 }] }] },
    { id: "dl", airline_code: "DL", price: "142", stops: 0,
      itineraries: [{ direction: "outbound", stops: 0, segments: [
        { carrier_code: "DL", flight_number: "DL77", departure_airport: "SFO", arrival_airport: "RDM",
          departure_time: "2025-08-22T08:00:00", arrival_time: "2025-08-22T10:00:00", duration_minutes: 120 }] }] },
  ],
  hotel_offers: [
    { id: "river", name: "Riverhouse", price: "612", rating: 4 },
    { id: "eviva", name: "Eviva", price: "538", rating: 3 },
  ],
};

const trip = {
  id: "t1", name: "Test 2", origin_airport: "SFO", destination_code: "RDM",
  depart_date: "2025-08-22", return_date: "2025-08-26", status: "active",
  is_round_trip: true, adults: 2,
  current_flight_price: "142", current_hotel_price: "538", total_price: "680",
  hotel_prefs: { rooms: 1 }, track_flights: true, track_hotels: true,
};

jest.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {},
  api: { trips: { getDetails: jest.fn().mockResolvedValue({ data: { trip, price_history: [snapshot] } }) } },
}));

async function selectFlight(name: RegExp) {
  await userEvent.click(screen.getByRole("button", { name }));
}

describe("Trip detail selection → total (verified)", () => {
  it("Alaska (non-stop) + Riverhouse = $789", async () => {
    render(<TripDetailPage params={Promise.resolve({ tripId: "t1" })} />);
    await waitFor(() => expect(screen.getByText("Test 2")).toBeInTheDocument());
    await selectFlight(/Alaska/i);
    await selectFlight(/Riverhouse/i);
    const total = screen.getByTestId("trip-total");
    expect(within(total).getByText("$789")).toBeInTheDocument();
    expect(screen.getByTestId("now-badge")).toHaveTextContent("Now $789");
  });

  it("United (1-stop) + Riverhouse = $754", async () => {
    render(<TripDetailPage params={Promise.resolve({ tripId: "t1" })} />);
    await waitFor(() => expect(screen.getByText("Test 2")).toBeInTheDocument());
    await selectFlight(/United/i);
    await selectFlight(/Riverhouse/i);
    expect(within(screen.getByTestId("trip-total")).getByText("$754")).toBeInTheDocument();
    expect(screen.getByTestId("now-badge")).toHaveTextContent("Now $754");
  });

  it("Delta + Eviva = $680", async () => {
    render(<TripDetailPage params={Promise.resolve({ tripId: "t1" })} />);
    await waitFor(() => expect(screen.getByText("Test 2")).toBeInTheDocument());
    await selectFlight(/Delta/i);
    await selectFlight(/Eviva/i);
    expect(within(screen.getByTestId("trip-total")).getByText("$680")).toBeInTheDocument();
    expect(screen.getByTestId("now-badge")).toHaveTextContent("Now $680");
  });

  it("re-tapping the expanded flight collapses it but keeps it selected", async () => {
    render(<TripDetailPage params={Promise.resolve({ tripId: "t1" })} />);
    await waitFor(() => expect(screen.getByText("Test 2")).toBeInTheDocument());
    const alaska = screen.getByRole("button", { name: /Alaska/i });
    await userEvent.click(alaska); // select + expand
    expect(alaska).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(alaska); // collapse, still selected
    expect(alaska).toHaveAttribute("aria-expanded", "false");
    expect(alaska).toHaveAttribute("aria-checked", "true");
  });
});
```

- [ ] **Step 7: Run the selection test and confirm FAIL**

Run: `pnpm --filter vacation-price-tracker-web exec jest src/__tests__/trip-detail-selection.test.tsx`
Expected: **FAIL** — the page does not yet expose `data-testid="trip-total"`/`"now-badge"`, the radios are not the row buttons, and selecting a flight does not toggle expansion via the reducer.

- [ ] **Step 8: Reskin + rewire `app/trips/[tripId]/page.tsx`**

Replace the two `useState`s for `selectedFlightKey`/`selectedHotelKey` and the per-list `expandedCards` with a single `useReducer(selectionReducer, …)` (definition above). Wiring:
- `preselectCheapest` dispatches `{ type: "preselect", flightId, hotelId }` after fetch.
- Each flight row is a single `<button role="radio" aria-checked={isSelected} aria-expanded={isExpanded}>` whose accessible name includes the airline name (so the test's `getByRole("button", { name: /Alaska/i })` resolves); `onClick` → `dispatch({ type: "selectFlight", id: stableKey })`. Same for hotels with `selectHotel`.
- Render the **three stat chips**; the Trip-total chip wraps its value in `<span data-testid="trip-total">…</span>` on a `.aurora-total-card`.
- Render the chart "Now $X" badge as `<span data-testid="now-badge">Now {formatPrice(effectiveTotalPrice)}</span>` anchored over the chart's latest point.
- Use `AirlineChip` (collapsed: primary carrier; expanded multi-carrier legs: per-leg chip; pass `secondaryCode` when `multiCarrierSubtitle(flight)` is non-null for the overlapping stack), `stopsBadge` → `Badge variant={tone === "success" ? "nonstop" : "stop"}`, `layoverLabel` → `.aurora-layover-pill`, the `multiCarrierSubtitle` subtitle rendered unconditionally whenever it is non-null (real multi-carrier data; no flag), `HotelPhoto`, and `renderStars` for hotel ratings.
- Keep `ItinerarySection`/`SegmentRow`, `PriceHistoryChart`, the SSE refetch, status toggle, refresh, and delete handlers **unchanged** except for reading the reducer's ids in place of the old keys.

In `apps/web/src/app/trips/[tripId]/page.module.css`:
- `.stickyRegion { position: sticky; top: 0; z-index: 5; background: var(--aurora-page); }` wrapping breadcrumb + title row + stat chips + chart.
- `.statChip` → `.aurora-card`-like inner card; `.totalChip` → `.aurora-total-card`.
- `.flightCardBest` / `.hotelSelected` → `background: var(--aurora-surface-2); border: 1px solid var(--aurora-selected-border);`.
- `.radioSelected` filled `var(--aurora-violet)`; `.cardPrice` selected → `color: var(--aurora-violet); font-weight: 800;`.
- Multi-carrier card → `.flightCardMultiCarrier { border-left: 3px solid var(--aurora-layover); }`.
- `.offersGrid { display: grid; grid-template-columns: 1.05fr .95fr; gap: 16px; }`; half-width `@media (max-width: 820px) { .offersGrid { grid-template-columns: 1fr; } }`.

- [ ] **Step 9: Run the selection test and confirm PASS**

Run: `pnpm --filter vacation-price-tracker-web exec jest src/__tests__/trip-detail-selection.test.tsx`
Expected: **PASS** — all three verified totals ($789 / $754 / $680), the "Now $X" badge recompute, and the collapse-keeps-selected case green.

- [ ] **Step 10: Visual verification at both widths**

Via `debug-web`/Playwright on a real trip route (`https://localhost:3000/trips/<id>`):
- **1440×900:** sticky region stays pinned (breadcrumb, single-line title row with meta chips + Edit/Refresh on the far right, three stat chips with the **violet gradient Trip-total card**, retinted chart with the **"Now $X" badge**); below it the two-column Flights/Hotels lists; select a **1-stop** flight and confirm the **expanded multi-carrier legs** each show their own **AS/UA monogram chip**, the **amber layover pill**, and the **"Operated by …" subtitle**; the selected rows show the `#F8F5FE` bg + `#C9B8F5` border + filled violet radio + violet price; the **"Show all N hotels"** dashed control renders.
- **720×1024:** single column — sticky stat chips + chart, then Flights card, then Hotels card.
- No console/pageerror output.

- [ ] **Step 11: Typecheck + lint, then commit**

Run: `pnpm --filter vacation-price-tracker-web typecheck && pnpm --filter vacation-price-tracker-web lint`
Expected: PASS.

```bash
git add apps/web/src/lib/aurora.ts apps/web/src/components/aurora/ apps/web/src/app/trips/\[tripId\]/page.tsx apps/web/src/app/trips/\[tripId\]/page.module.css apps/web/src/__tests__/aurora.test.ts apps/web/src/__tests__/trip-detail-selection.test.tsx
git commit -m "feat(web): Aurora trip detail with verified selection totals and chart recompute"
```

---

## Task 6: Create trip (`app/trips/new/page.tsx` + `trip-form/**`)

**Files:**
- Modify: `apps/web/src/app/trips/new/page.tsx`
- Modify: `apps/web/src/app/trips/new/page.module.css`
- Modify: `apps/web/src/components/trip-form/flight-prefs-section.tsx` + `flight-prefs-section.module.css`
- Modify: `apps/web/src/components/trip-form/hotel-prefs-section.tsx` + `hotel-prefs-section.module.css`
- Modify: `apps/web/src/components/trip-form/notification-section.tsx` + `notification-section.module.css`
- Modify: `apps/web/src/components/trip-form/collapsible-section.module.css`
- Test: extend `apps/web/src/__tests__` only if a form-behavior assertion is needed; otherwise this is a pure-visual reskin verified by Playwright (the form's existing behavior/tests stay green).

**Interfaces:**
- Consumes: Task 1 tokens, Task 2 `Button`/`Card`/`Badge`. The existing `useTripForm` hook, `TripDetailsSection`, `FlightPrefsSection`, `HotelPrefsSection`, `NotificationSection`, and `api.trips.create` flow are **unchanged** — reskin only. Do **not** alter form state, validation, or the submit handler.
- Produces: none.

**Layout (exact):** Centered ~720px column (`max-width: 720px; margin: 0 auto;` on `.container`).
- Header "Create new trip" (weight 800) + subtitle (`--aurora-muted`).
- **Trip details** `.aurora-card` (Trip name; From / ⇄ / To; Depart / Return / Adults) — keep `TripDetailsSection`.
- Collapsible **Flight preferences** (`CollapsibleSection`): open state shows **cabin chips** Economy/Premium/Business + Non-stop only/Any stops, with the on/off `Track Flight Prices` toggle at the top. Convert the cabin `Select` to **pill chips**: render the `CABIN_CLASSES` as buttons styled `.cabinChip` (`background: var(--aurora-surface)`, selected → `background: var(--aurora-chip); color: var(--aurora-violet-deep); border: 1px solid var(--aurora-selected-border);`). Keep the existing `onCabinChange`/`value` wiring — chips just call `onCabinChange(c.value)`.
- Collapsible **Hotel preferences** (collapsed row + toggle + chevron) — keep `HotelPrefsSection`, retint to Aurora.
- **"Alert me when…" card** (`.aurora-card`): "total drops below `$750`" — keep `NotificationSection`'s threshold-type select + currency input; restyle to Aurora; the Email/SMS toggles here keep their existing wiring.
- Footer: **Cancel** (ghost) + **Create trip** (primary) — already in `new/page.tsx`.

In `*.module.css` files: cards → `.aurora-card` props; section titles weight 700 / 15px / `--aurora-ink`; field labels `--aurora-body-2`; `CollapsibleSection` header retint, chevron `--aurora-faint`; hairlines `--aurora-hairline`.

- [ ] **Step 1: Reskin the form pages/sections (no behavior change)**

Apply the Aurora token styling in the listed `*.module.css` files and convert the cabin `Select` to `.cabinChip` buttons in `flight-prefs-section.tsx` (preserving `cabin`/`onCabinChange`). Keep all props, handlers, and validation intact.

- [ ] **Step 2: Run the existing trip-form tests (must stay green)**

Run: `pnpm --filter vacation-price-tracker-web exec jest trip-form use-trip-form`
Expected: **PASS** — existing form tests unaffected (we changed only styling + the cabin control's presentation, not its value contract). If the cabin test queried a `<select>` role, update that query to the chip `button` role in the same commit and re-run.

- [ ] **Step 3: Visual verification at both widths**

Via `debug-web`/Playwright at `https://localhost:3000/trips/new`:
- **1440×900:** the form sits in a centered ~720px column; Trip details card, collapsible Flight preferences (open shows **cabin pill chips** + stops + on/off toggle), collapsible Hotel preferences, the "Alert me when total drops below $750" card, and the Cancel/Create footer (Create = violet primary).
- **720×1024:** same form, single column, full-width cards.
- No console/pageerror output.

- [ ] **Step 4: Typecheck + lint, then commit**

Run: `pnpm --filter vacation-price-tracker-web typecheck && pnpm --filter vacation-price-tracker-web lint`
Expected: PASS.

```bash
git add apps/web/src/app/trips/new/page.tsx apps/web/src/app/trips/new/page.module.css apps/web/src/components/trip-form/
git commit -m "feat(web): Aurora reskin of the create-trip form"
```

---

## Task 7: Settings (`app/trips/settings/page.tsx`)

**Files:**
- Modify: `apps/web/src/app/trips/settings/page.tsx`
- Test: `apps/web/src/__tests__/settings-aurora.test.tsx` (Create)

**Interfaces:**
- Consumes: Task 2 `Card`/`Switch`/`Button`. Existing `useAuth`, `api.users.updatePreferences` flow is **unchanged**. Currently the page renders only the **Email** toggle (bound to `user.email_notifications_enabled`); Aurora adds a second **SMS** toggle row that is **off** and **disabled** (no SMS backend field exists; render it as a visual-only "off" row with `disabled` so it never calls the API). **No "Trip members"/sharing** anywhere.
- Produces: none.

**Layout (exact):** Centered ~720px column ("Settings" title weight 800). **Notifications** `.aurora-card` with two toggle rows:
- **Email notifications** (on) — "Get a daily digest when a tracked trip drops below your price target." Bound to the existing `handleToggleEmail`.
- **SMS alerts** (off) — "Instant text on a major price drop." Rendered with `checked={false} disabled` (visual-only; no backend wiring).

- [ ] **Step 1: Write the failing settings test**

Create `apps/web/src/__tests__/settings-aurora.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import SettingsPage from "@/app/trips/settings/page";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "a@b.com", email_notifications_enabled: true },
    isLoading: false,
    refreshUser: jest.fn(),
  }),
}));
jest.mock("@/lib/api", () => ({ api: { users: { updatePreferences: jest.fn() } } }));

describe("Settings (Aurora)", () => {
  it("shows Email (on) and SMS (off) toggles and no Trip members section", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Notifications")).toBeInTheDocument();
    const email = screen.getByRole("switch", { name: /email/i });
    expect(email).toBeChecked();
    const sms = screen.getByRole("switch", { name: /sms/i });
    expect(sms).not.toBeChecked();
    expect(sms).toBeDisabled();
    expect(screen.queryByText(/trip members/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sharing/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and confirm FAIL**

Run: `pnpm --filter vacation-price-tracker-web exec jest src/__tests__/settings-aurora.test.tsx`
Expected: **FAIL** — the SMS toggle row does not exist yet.

- [ ] **Step 3: Reskin + add the SMS row**

In `apps/web/src/app/trips/settings/page.tsx`, keep the Email toggle row and the `handleToggleEmail` wiring; add a second toggle row inside the same `CardContent` (below the Email row, with a divider) for **SMS alerts**:

```tsx
<div className="mt-4 flex items-center justify-between gap-4 border-t border-[var(--aurora-hairline)] pt-4">
  <div className="space-y-0.5">
    <Label htmlFor="sms-notifications">SMS alerts</Label>
    <p className="text-sm text-muted-foreground">
      Instant text on a major price drop.
    </p>
  </div>
  <Switch
    id="sms-notifications"
    checked={false}
    disabled
    aria-label="SMS alerts"
  />
</div>
```

Also give the existing Email `Switch` an `aria-label="Email notifications"` (it has one) and set the heading to weight 800. Keep the centered `max-w-2xl` (~672px ≈ "~720px column").

- [ ] **Step 4: Run the settings test and confirm PASS**

Run: `pnpm --filter vacation-price-tracker-web exec jest src/__tests__/settings-aurora.test.tsx`
Expected: **PASS**.

- [ ] **Step 5: Visual verification at both widths**

Via `debug-web`/Playwright at `https://localhost:3000/trips/settings`:
- **1440×900:** centered ~720px column; "Settings" title; Notifications card with Email (on) + SMS (off) toggle rows; **no** Trip members/sharing section.
- **720×1024:** same, single column.
- No console/pageerror output.

- [ ] **Step 6: Typecheck + lint, then commit**

Run: `pnpm --filter vacation-price-tracker-web typecheck && pnpm --filter vacation-price-tracker-web lint`
Expected: PASS.

```bash
git add apps/web/src/app/trips/settings/page.tsx apps/web/src/__tests__/settings-aurora.test.tsx
git commit -m "feat(web): Aurora settings with email + sms notification rows"
```

---

## Task 8: Responsive sweep (all five routes at 720px)

> **No feature flags.** The three behaviors the prototype exposed as props are **always on**, driven purely by the real segment/photo data: `AirlineChip` always renders the monogram chip; `HotelPhoto` always renders the property photo with the violet-surface placeholder fallback when there is no URL; the multi-carrier "Operated by …" subtitle + overlapping chips render whenever `operatingCarriers(flight)`/`multiCarrierSubtitle(flight)` report >1 carrier. This task adds no new source files — it is the final cross-route responsive verification plus the full quality gate.

**Files:**
- Modify: route CSS Modules only, as needed to fix any half-width reflow gaps found during the sweep (no new files).

**Interfaces:**
- Consumes: the finished Tasks 3–7 routes + the always-on `AirlineChip`/`HotelPhoto`/`multiCarrierSubtitle` behaviors from Task 5.
- Produces: none.

- [ ] **Step 1: Full responsive sweep (all five routes, both widths)**

Via `debug-web`/Playwright (dev stack up), for each route screenshot at **1440×900** and **720×1024** and assert the documented reflow:
- `/` — two-column hero → single centered column.
- `/trips` — `1fr 360px` two-pane (table + assistant) → segmented **Trips | Assistant** + stacked trip cards; table footer pinned at full width.
- `/trips/<id>` — two-column Flights/Hotels → single column under the sticky stat chips + chart.
- `/trips/new` — centered ~720px form → single column.
- `/trips/settings` — centered ~720px → single column.
For each: confirm **ACTIVE chip violet / PAUSED chip amber**, **Total column violet**, **dashboard first row tinted `#FBFAFF`**, **footer pinned**, and on trip detail the **monogram chips / amber layover pill / "Operated by …" subtitle** always render for a multi-carrier flight. Fix any reflow gaps in the route `*.module.css` inline before committing.

- [ ] **Step 2: Regression — selection/helper suites still pass**

Run: `pnpm --filter vacation-price-tracker-web exec jest src/__tests__/trip-detail-selection.test.tsx src/__tests__/aurora.test.ts`
Expected: **PASS** (selection totals still $789/$754/$680; the multi-carrier subtitle renders unconditionally from the real data).

- [ ] **Step 3: Full verify gate**

Run: `pnpm --filter vacation-price-tracker-web exec jest --coverage`
Expected: **PASS** with coverage ≥ 85 branches / 95 functions / 95 lines / 95 statements over the non-ui code (the new `lib/aurora.ts` and the page logic are covered by the tests above; `components/ui/**` and `components/aurora/**` presentational components are exercised through the page tests).
Run: `pnpm --filter vacation-price-tracker-web typecheck && pnpm --filter vacation-price-tracker-web lint && pnpm --filter vacation-price-tracker-web build`
Expected: PASS.

- [ ] **Step 4: Commit (only if the sweep touched any CSS)**

```bash
git add apps/web/src/app/
git commit -m "fix(web): close responsive reflow gaps in the Aurora sweep"
```
If the sweep found no gaps, there is nothing to commit — note that and move on.

---

## Coverage / spec-mapping self-check

Every spec section maps to a task:
- **1. Sign in** → Task 3. **2. Dashboard (Trips + Assistant)** → Task 4. **3. Trip detail** ⭐ → Task 5. **4. Create trip** → Task 6. **5. Settings** → Task 7.
- **Interactions & Behavior** (selection core, sticky region, collapsible rows, toggles/segmented controls, buttons, responsive, notifications) → selection/sticky/collapsible/buttons in Task 5; segmented control + responsive reflow in Tasks 4 & 8; primary/secondary buttons in Task 2. (OS **notifications** are backend/Temporal-driven and out of P1's `apps/web/**` scope — noted, not implemented here.)
- **State Management** (`selectedFlightId`/`expandedFlightId`/`selectedHotelId`/`expandedHotelId`, derived `tripTotal`, chart recompute, notification threshold) → Task 5 reducer + verified totals.
- **Tweakable options** (`showAirlineLogos`, `showHotelPhotos`, `multiCarrier`) → **all unconditional / always-on** per product decision: airline monogram chips, hotel photos (placeholder fallback), and the multi-carrier "Operated by …" treatment all render in Task 5 driven by the real data; **no feature flags**.
- **Tablet / Phone** screens are explicitly the mobile plans' (P2–P4) scope, not P1.
