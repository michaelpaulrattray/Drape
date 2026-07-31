# Casting V2 — UI Vision Reconciliation (2026-07-31)

Reconciles the founder's two vision packages — `Casting-ui-ux-design/design_handoff_studio/` (Klieg Studio: lobby + 7 tabs + casting flow + settings) and `design_handoff_canvas/` (Klieg Canvas) — against the ratified plan (`CASTING_V2_ARCHITECTURE_PLAN.md`) and the foundation (`drape-foundation/`).

**Authority order (binding):** (1) ratified plan rulings → (2) foundation README non-negotiables → (3) vision packages (docs) → (4) prototype HTML (artwork; its inventions are seams unless a doc claims them). Where a vision prototype contradicts a ratified ruling, **the ruling wins and the prototype behavior is a seam** — confirmed per-item below.

**Token verdict:** both packages use the canonical foundation token file **verbatim** (0 changed / 0 added / 0 removed values, incl. the `--cv*` layer). Perfect conformance.

## 1. What binds M5 (the casting flow)

Chapter `design_handoff_studio/07-casting.md` + the studio prototype's casting screens are the **visual binding** for M5's roster/sheet/room, layered UNDER the ratified interaction law. Chapter 07 itself defers to the deeper casting package for flow depth ("this doc covers what the studio prototype ships").

Deviation table — every prototype deviation and its resolution (no new decisions except F2/F3 below):

| Prototype behavior | Ratified law | Resolution |
|---|---|---|
| All 8 tiles flip at once (one fake timer) | Streaming per-candidate arrival (foundation §8 + plan) | Law wins — stream |
| Keeps reset on every roll; no tray (docs assert carry-over; file discards) | Id-keyed keeps per roll + cross-roll tray, carried members tray-only | Law wins — build the tray |
| No roll-history navigation | Rolls immutable + navigable | Law wins |
| **Sign: unpriced, no confirm, multi-select ("Sign 3"), doc says "not final mint"** | Sign = single commitment, one price incl. full package, one candidate per ceremony, no second mint | **Law wins (F2 confirmed by founder)** — chapter 07's sign rendition is a seam |
| No prices anywhere in casting dock | D-15: price on every paid affordance, persistently visible | Law wins — dock carries prices |
| Candidate placeholder art varies lighting/wardrobe/crop | Framing law + wardrobe-baseline ruling: near-constant cohort framing | Law wins |
| No advanced disclosure / no derived chips | Progressive disclosure + removable summary chips (settled) | Law wins — chips ship in M5 |
| "Upload a real person" / "Browse signed roster" cards fake-roll | Tier 2 backlog / **Klieg-owned catalog** respectively | **Both cards ship as honest skeletons (F5).** Upload: inert, coming-soon copy. Roster: **corrected 2026-08-01 — this is the future Klieg-owned public catalog of ready-made signed casts, NOT the account's own roster.** The earlier resolution ("own roster") was wrong and had the card scrolling to the grid directly below it, duplicating what was already on screen. Unwired, inert, copy states it is coming. It is the front door for the **"Pre-made roster (starter casts catalog)"** backlog entry in §5 — when that builds, it lands here. |
| Ambient fictions: "184 performers", "99.4% retention", "Drift 0.6%", "locks in ~4 min" | Honest-capability + no invented numbers (§B-17) | All decorative fiction — real numbers or nothing |
| "Klieg V2" model selector in Home/Create composer | Provider choice server-owned app-wide | **Founder confirmed 2026-07-31: prototype fiction.** No engine dropdown anywhere; casting surfaces show none (prototype conforms there already) |

**Confirms (build as drawn):** room composition (master block + IDENTITY LOCKED + Refine-without-recasting + Takes + Voice + campaigns + siblings), keep/discard/undo/follow mechanics incl. "FROM 0X" lineage pills and "Following 0X ×" chip, dock anatomy + "Keep the ones worth a second look" instruction, grid constants (178/212/104), widths (1180/1240), breadcrumbs, verbs.

## 2. Founder decisions (resolved 2026-07-31)

- **F1 — Rail geography (DECIDED):** the shell adopts the final 7-destination rail now — Home · Create · Canvas · Templates · Casting · Assets · Library (+ Invite, account); **unbuilt destinations render as quiet inert stubs** (the handoff's own rule: the rail never changes shape). Internal keys (`avatars`, `threads`) never surface.
- **F2 — Sign law (CONFIRMED):** the ratified law governs — one candidate per ceremony, one priced confirmation including the complete view package, no second mint. Chapter 07's unpriced/multi-sign/"not final mint" rendition is a prototype seam. The multi-keep tray survives; signing several = several deliberate ceremonies.
- **F3 — Label (DECIDED):** **UNSIGNED** everywhere; DRAFT is retired vocabulary (collides with the legacy draft-model tier being deleted).

**F5 — Vision-skeleton ruling (founder, 2026-07-31, at M5 gate):** the prototype's page anatomy ships **as drawn even where features don't exist yet** — future development, not hallucination. The casting tab keeps its bordered hero card with the right-side media pair, both entry cards (Upload-a-real-person present with honest coming-soon state, not omitted — supersedes the earlier omit resolution; Browse-the-roster targets the real roster), the search + All/Signed/Unsigned row, exact prototype copy ("Meet eight of them.", full blurb, all four TRY chips), and the 178px roster grid. Only *false claims* are stripped (fictional counts like "184 performers"/"212 FRAMES"), never designed structure. Mono remains machine-facts-only — helper sentences are Archivo.

**F4 — Scope ruling (founder, 2026-07-31):** `CASTING_V2_SCOPE=all` is authorized now — only founder-owned accounts exist, so `all` ≡ founder-scoped in fact, and sync_mode means no new images touch fal's CDN. **The M3 retention condition transfers from the flag to the invite:** before any real third-party user is given access (invite code, waitlist approval), the fal data-retention answer must be in hand.

## 3. New shared patterns ADOPTED into the foundation set (additive, from `10-shared-patterns.md`)

Toast law (every non-navigating action toasts, navigating never; ink pill, z-80, ~2.1s) · segmented control · dashed-create-tile-first law · section-header grammar (eyebrow/hairline/right slot) · hover-reveal via data-hoverhost · `--viewerScrim` (sixth scrim role) · popover discipline (capture-phase click-away, containing-block correction) · aspect-ratio sizing rule · slot-id conventions · z-ladder (25/40/60/70/80). Motion names: canonical prefix stays `dp-*`; `dsmarq` adopted as `dp-marq` when the marquee builds. Recorded contradictions to resolve foundation-side at implementation: marquee 62s motion near controls (extend the ambient exception deliberately or don't build it), `--shadowPop` on in-flow media cards (foundation default: don't).

## 4. Canvas package (binds the canvas milestone, M10-era)

Dual-theme confirmed (ruling satisfied). **Implementation rule: the `--cv*` token layer is authority; the prototype HTML is artwork** (484 raw hexes, doesn't load tokens.css — package itself says "build ONE scene on the token system"). Chapter-vs-token divergences (floor, wire hues, media-tile construction, port-rim dark) resolve token-side; `--cvWireLive` and `--cvAgentRow` have tokens but no drawn design yet. **Casting has NO design surface on canvas** — identity arrives as "Avatar · locked identity source" (matches one-Cast-source-of-truth) but the M10 moments (empty cast node, roster picker, cast-new, Sign-fills-node) need a small design addendum before M10. Today's failure/refund UX richness (retry, refund badges, failure reasons) must survive the redesign even though the vision draws no sad paths.

## 5. Roadmap buckets (no scope added to the program without founder say-so)

- **Binding now (M5–M7):** casting tab/sheet/room visuals per §1; naming vocabulary (§6 of studio deep-read): cast member/roster/candidate/roll/sheet/room/Sign/take/Siblings/frame/run/models(=engines)/credits; internal keys (`avatars`, `threads`) never surface.
- **Design-ready, already-scheduled:** Home tab (evolved lobby — the deferred D.14 milestone now has its blueprint); Canvas board (M10 + addendum); Library's Kept/All + 30-day unkept retention (harmonizes with the sheet retention rulings).
- **Vision / post-program (recorded, not scheduled):** Create tab (multi-mode composer, run strips, viewer, references, @mentions, team feed), Templates system (12 seeds, typed inputs, run history — note 7 of 12 take a Cast input: the differentiator), Assets (auto-classified uploads), canvas agent + video/try-on/reframe/upscale nodes + groups/run-scopes, campaigns entity + review workflow, multi-project scope, teams/RBAC/seats (Owner/Admin/Creator/Reviewer), notifications, 2FA/sessions, global search, model registry + intent ranking. Each becomes milestones only by founder decision after M14 (some — teams, workspace billing — align with existing backlog entries).

## 6. Prototype seams (never replicate)

`window.open` exploration links · non-behavioural search/"More options ›"/ratio chips · image-slot Replace/Edit chrome · casting entry cards that fake-roll · unrendered `quickActions`/`stats` JS · the one-boolean sheet timer · scrim raw-rgba literals (use `--scrim*` tokens) · doc/file z-index and topbar mismatches (foundation values win).
