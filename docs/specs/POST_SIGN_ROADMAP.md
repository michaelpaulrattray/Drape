# Post-Sign Roadmap — founder-ruled items awaiting their slot

Canonical home for roadmap rulings and deferred commitments. Each item
cites its ruling. Nothing here is built before its stated gate;
nothing here may be silently dropped. Session memory and the mailbox
POINT here — this file is the survivor. Reconciled against the full
mailbox archive, memory, and DECISION_LOG by the lost-pin audit of
2026-08-09; items marked (L#) were recovered by that audit.

## 0. CAMPAIGN PRECONDITIONS — owed BEFORE Tier A scores (not post-Sign)

- **Frame-05 / removal-composite hair silhouette** (L1): owed its own
  frames before Tier A scores removals against `hairWorn`
  (fable-059/060/061). The segments pivot does NOT moot it — removals
  still ride the departed/vacancy machinery.
- **Seam-check shadow→enforce flip decision** (L12): the trigger
  ("bring the flip decision with the second specimen") has been MET —
  specimens: 775 torn px (opus-024) + GPT2's torn frames at 848
  (opus-068). Raise the decision before Tier A; the manual double-read
  that currently covers the gap ends with Tier A.
- **Truncation-notice verification** (L17): confirm the >2000-char
  brief rejection surfaces honestly in the client; close or fix.
- **`bornWornCatalogue` has NO CALLERS** (opus-094, filed by
  fable-121). Built, tested, guarded by two sabotage runs, and invoked
  from nowhere in the product — so **no `detected_born` row can exist**,
  and the whole "she came with it" half of the segment vocabulary is
  unreachable. Verified 2026-08-09: the only importers are its own test
  and the sabotage roster; `bornWornDetector` reaches production code
  through the catalogue alone, plus one calibration script. The
  invariant-7 shape exactly — helper written, docs written, call site
  never added.
  *Not a Tier-A blocker*, and deliberately not built inside the
  stop-line. **Its first honest consumer is the Sign-time scan
  (fable-092), which is ACTIVE work** — that is where the call site
  belongs, so this is filed as a linkage rather than a task of its own.
  The segments panel wanted a "she came with it" row and could not
  honestly draw one (opus-094); the row returns the day the catalogue is
  invoked.

## 1. Latency AND COST program (first, after the walk campaign; founder-elevated 2026-08-10)

Median 39s → 151s regression (2026-08-08); founder: "5 minutes for 1
generation is absurd." Stopwatch every stage before optimising.
Enumerated sub-items (L3): **the gateway-outliving-refine topology**
(~300s Railway edge timeout swallowing honest refusals — may need a
founder Railway ask) and **the run-15 timestamp audit** (was an
honest refusal shown as "we lost contact"? settle by artifacts —
ordered fable-067/068, never reported done). Related: first-generation
paint softness (hair ~0.51–0.56, brows ~0.48–0.56 vs master, twice
measured) → the **engine sharpness comparison** (NBP vs GPT2 on
hair/brows) rides with item 6's routing question.
**COST half (founder, 2026-08-10: "costs are getting ridiculous — after
we lock everything in we need to optimize massively, both render times
and cost"):** a per-render call census (calls × model × when), the
invoice split campaign-instrumentation vs product-per-render, and
cost-per-render vs the 25-credit price per edit class. Named levers:
master-region CACHING (same unchanged master re-segmented every render
— free win, may land pre-program), retry economics per class (every
miss costs two paints), NBP routing pending its n≥20 court, and
text-call budgets (verification readings are the OpenRouter driver).

**Filed here by fable-132, deliberately NOT slipped in behind the D-238
fix:** a bilateral region now costs **three** segmentation calls instead of
two (the face, for her own midline, then the plain noun once per half) and
one extra round trip, the two halves still parallel. An `eye.colour` refine
pulls `eyebrows` as an occlusion companion, so it goes **5 calls → 7**. The
clean way to get the extra call back is to thread an **optional midline
hint** through the `RegionReader` interface from callers that already hold a
face mask — a real interface change, decided here on latency evidence rather
than inside a bug fix. Deleting `readCanthalTilt`'s rung 1 (also D-238) pays
four calls per tilt read back immediately.

## 2. The honest loader (with #1 — same instrumentation)

Real stage transitions only, product voice, NO invented percentages
(fable-020). Interim copy shipped. Owed inside it: **the D-169
loading mock including the re-ask chip states** — the one artifact
still promised to the founder from the paraphrase thread. Small UX
rider (L13): the follow-up-queue chip (a refused compound chip
queues its second half as a follow-up sentence) — filed fable-069.

## 3. The face chart + tattoo studio (post-Sign; skeleton is M12)

**Panel v1 PULLED FORWARD (founder, 2026-08-09, fable-113):** a
read-only segments panel (crop thumbnails, stylist-named, per-variant
via lineage, tap-to-prefill) builds right after the fable-112
stop-the-line fixes — mock to the founder first per D-101/F5. The
full chart below stays post-Sign.

Tappable, human-named chart of her segments (stylist's ontology);
tap → sentence box pre-scoped; per-segment version history. Segment
store (live 2026-08-09) is the foundation. **Tattoo-studio
extension** (founder 2026-08-08): detected ink as INDIVIDUALS,
restyle/resize/move/remove on the patch machinery. **Governing law
D-138 stands:** ALL ink — asked or reference-supplied — via the
FLASH-SHEET path (mannequin templates, tone ladder, no text);
references frozen at introduction (D-192); D-139/140/141 carry.

**Makeup face charts (founder idea, 2026-08-10 — parked here, not
ruled):** "maybe it should be designed on a face mannequin same as
the tattoos idea — every iteration of makeup is stored on a
mannequin face." I.e. a whole makeup LOOK designed/recorded on a
neutral mannequin face chart (the real MUA tool), frozen at
introduction like a flash sheet, transferable to any cast, removable
as one thing. Sits ON TOP of the ruled per-feature handling
(fable-168: words propose, acceptance mints the anatomy-slot
reference — per-feature slots remain the source of truth). The
fable-168 "grouped Makeup look row" taste question folds into this
item; both deferred together until this studio's turn.

## 4. "Show her the refused frame" (walk-campaign's END; founder judges)

Founder 2026-08-09 (fable-106): option to show a twice-refused render
("you weren't charged; keep it if you disagree"). Until ruled:
refuse-and-refund. Companion principle: **the checker judges
EXISTENCE against her own words only; intensity/density belongs to
her words or nobody; any widening is a founder gate.**

## 5. Open-vocabulary regions — the map becomes a cache

Founder question 2026-08-09. When the facet→region map is silent,
derive the region from HER WORDS via the segmenter; map = cache of
proven territories. Needs its own court (a hallucinated region is a
confinement hole). Known missing territories (L11): **`allSkin` is
declared and unimplemented** — `skinTone`/`skinCharacter` (a tan!)
cannot reach the masked path, and Tier A's catalogue contains tan
asks; **cheeks** ("the day a cheek region exists, the placement
table is the only thing that changes"); accessory regions —
**CLOSED 2026-08-09 (`6bc2b75e`)**, and not by adding a region to the
map. `statedAccessories` cannot have a `REGION_OF_FACET` entry, because
the region depends on the described OBJECT rather than the facet; the
placement corridor the harvest already builds is now filed under the
accessory's kind id and reaches the cutter as an override, unioned with
the master's own read and with the delivered extent read off the painted
frame. Accessories persist by PATCH from that commit. The remaining
territories above are untouched by it.

## 6. Engine routing for marks (evidence exists; engineering item)

NBP 6/6 at 848×1264 (its only size) vs GPT2 6/8 native; GPT2 tore
half its frames at 848. Routing is NOT a config change (NBP ignores
`image_size`). **Gate: n≥20 before any routing claim goes near the
bar** (opus-068). Over-delivery watched under item 4's principle.
Also filed: interpreter placement field (trigger: a specimen the
table can't place — fable-103); `earring`/`nose stud` detector
courts; the retry-as-safety-net is CLOSED by this item (routing
superseded it — fable-071/080).

## 7. Pre-launch checklist (M13 gate) — reconciled with the pre-campaign debts

- **Klieg rebrand M5b** (L4, founder-held): domain cutover, OAuth
  redirect, Resend domain, Stripe copy + the tail: TM knockout
  search, .ai/.studio/typo domains, social handles. **Plus (added
  2026-08-10): the R2 CORS policy on `drape-production` names the
  Railway domain verbatim — add the new domain to AllowedOrigins at
  cutover or in-browser pixel reads break silently.**
- **Hero assets** (L5): `hero/*` never migrated from Manus — home
  hero 502s in dev AND prod; needs founder's source files +
  `scripts/upload-hero-v3.mjs`.
- **Stripe**: live keys **+ env-tag/account separation so cross-env
  webhooks cannot credit prod users** (L6 — dev checkouts currently
  fire webhooks at prod trusting `metadata.userId`).
- **Cookie consent** (L7): flagged 2026-07-10, never built.
- **`mintModel` concurrency double-charge** (L8): fix, or record
  that M14 legacy retirement deletes the path.
- **R7 evidence migrations 0015/0016** (L9): never applied to prod
  (the 2026-07-31 crash-loop); decide re-enable-by-ceremony vs
  retire-with-legacy.
- **Refine deferred-delete determination** (L10): image-referenced
  edits were owed a deferred-delete migration (no `notBefore`
  concept exists); record whether D-192's frozen-reference rule
  moots it.
- Shared R2 credential split (founder re-prioritized here);
  real-inbox Resend test; fal retention answer (founder confirms
  answered, 2026-08-09); the five inert
  security controls (CLAUDE.md's "currently not enforced" list).
- Hygiene batch (L2): **11 dev-fixture `getDb()` scripts still lack
  world guards** (list in the 2026-08-09 audit) — guard when next
  touched, or burn down in one sitting.
- Hygiene batch (L2, added 2026-08-10, fable-127): **a script that
  touches an app service never exits.** `getDb()` hands out a
  module-level pool with no exported shutdown, so the process stays
  resident with all its work done — eighteen such processes from four
  scripts were found alive from the previous day, and the shift that
  left them had reported "no background jobs of mine running" in good
  faith, because nothing showed them. Two parts: scripts calling app
  services end with an explicit `process.exit(0)`, and the park
  checklist's hygiene step becomes a `Get-CimInstance Win32_Process`
  sweep **by command line** rather than a claim from memory.
- **A CORS rule on the image buckets** — ✅ **DONE and VERIFIED IN A
  BROWSER, 2026-08-10.** The founder applied both policies himself
  (fable-176); `scripts/verify-bucket-cors.mts` then proved it the only
  way that counts. A CORS misfire is silent — the image loads, paints,
  looks perfect, and the canvas is quietly tainted — so the probe is
  `getImageData` on a canvas the image was drawn into, from two origins
  at once:

  ```
  PASS  ON the allow-list    localhost:3000  loaded, pixels readable [82,88,86,255]
  PASS  NOT on it (control)  localhost:4321  did not load at all
  ```

  The negative control is what makes the pass mean anything: a checker
  that only runs against the allowed origin cannot fail. **So the panel
  and the M12 face chart may read stencils directly**, and
  `/api/image-proxy` stays as the fallback for any host not on the
  bucket's list (boards still use it). One note for whoever reads the
  output: the script prints `allow-origin header (none)` on the passing
  arm, and that is correct — the browser does not expose that header to
  script. At the wire, `curl` with an allowed `Origin` gets
  `Access-Control-Allow-Origin: http://localhost:3000` and a foreign one
  gets nothing.

## 8. Dormant founder items — mostly CLOSED 2026-08-09 (fable-122)

Remaining: (L14) roster-card coherence question (sheets era,
unanswered); the D-169 mock eyeball (waits for item 2's loader mock
to exist). CLOSED by founder ruling 2026-08-09: the canvas intro
(KILLED); the fal retention question (founder confirms already
answered — annotated on item 7's checklist); D-82 vocabulary reading
and the D-166 glasses clause (both "fine as shipped" —
founder-ratified, no longer provisional).

## 9. Shelved-with-trigger register (durable in DECISION_LOG; pointers here)

**The contamination instrument** (what a paint borrowed from a reference
crop's background) — deferred by fable-184 with an explicit trigger: build
it **when an occlusion-aware cutter reopens the crop-vs-cutout question**
(`COMPOSITOR_SWAP_DESIGN.md` §5.1/§7). Until then the reference-format
ruling stands on shape + material, and neither of those counts borrowing.
Beside it, the **img-left/img-right hoop asymmetry** is an open row rather
than a shelved item: test the mechanism only if the edit-law cell leans the
same way. Both are stated as owed rather than absent.


Hair-matting shop (trigger: strand-gap artifacts visible to the
founder in a real case); fine strand tips clipped (cosmetic ceiling,
future shop round); advisory degree/intensity check (bounded by item
4's principle); D-213's record gate has no call site (ADD of an
absent distributed facet still segments — current-behaviour test
marks it); `requestMatte`/`changesSilhouette` documented as
spec-not-control; reliability-report build-id column (prod migration
= founder gate).

**`refineService`'s open noun to the segmenter** (filed fable-132, off
D-238's class sweep): `region({ name: parsed.match })` at
`refineService.ts:939` and `:1073` sends an **interpreter-authored noun
phrase** — "round wire-frame glasses", "smokey eye" — straight to SAM 3,
which is D-213's *"a segmenter is never asked an open question"* under
strain. Pre-existing and NOT this class; **no evidence of harm was
gathered**, so it is filed rather than fixed. Trigger: any read on that
path returning a mask nobody can account for, or the vocabulary work in
item 5 (open-vocabulary regions), which meets the same question head-on.
