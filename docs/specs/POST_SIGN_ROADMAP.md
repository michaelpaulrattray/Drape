# Post-Sign Roadmap — founder-ruled items awaiting their slot

Canonical home for roadmap rulings made during the M8 walk campaign
(2026-08-08/09). Each item cites its ruling. Nothing here is built
before its stated gate; nothing here may be silently dropped. The
Fable/Opus mailbox and session memory POINT here — this file is the
survivor.

## 1. Latency investigation (first, after the walk campaign)

Renders regressed from median 39s to median 151s (last-20 window,
measured 2026-08-08); the founder's felt complaint: "5 minutes for 1
generation is absurd." Prime suspect: our own segmentation spend
(the territory rule's author self-reported understating its cost).
Step one is a stopwatch on every pipeline stage — dispatch, paint,
retry, verification, composite, delivery — no optimising on hunches.
Related finding, first hard number on paint quality: a single hair
edit costs ~44% of the region's high-frequency energy vs the master
(hair 0.556/0.514, brows 0.479/0.556, two independent runs,
2026-08-09) — first-generation softness, not chain degradation.

## 2. The honest loader (with #1 — same instrumentation)

Thin progress indicator advancing on REAL stage transitions only,
stage named in the product's voice ("being drawn", "taking a second
pass", "checking", "assembling"). NO invented percentages, ever
(founder + Fable ruling, mailbox fable-020). Interim copy "usually a
minute or two" shipped 2026-08-08.

## 3. The face chart + tattoo studio (post-Sign; skeleton is M12)

Tappable, human-named chart of her segments — hair, brows, eyes,
lips, skin, jewellery (stylist's ontology, never segmenter labels) —
tap → the existing sentence box pre-scoped. Differentiator vs Grok:
segments WITH the byte-identity guarantee, verification, and honest
refunds. The segment store (slice 1, live 2026-08-09) is its
foundation; per-segment version history ships with it.

**Tattoo-studio extension** (founder, 2026-08-08): casts with ink get
tattoos auto-detected and listed as INDIVIDUALS ("rose, left
forearm"), each tappable → restyle / resize / move / remove, riding
the base-worn removal machinery and the patch store.

**Governing law — D-138 (Body-Art Studio, founder-designed
2026-08-04) stands:** ink never renders from words directly onto
her. Every tattoo — asked-for OR reference-supplied — goes through
the FLASH-SHEET path: design document plated on code-owned neutral
mannequin templates (tone ladder, fades-never-cuts, no text on
templates), iterated in its tab, then applied. A supplied reference
is promoted to an immutable asset, frozen at introduction (D-192).
D-139 (no ink inheritance on Follow), D-140 (lettering law), D-141
(hardening) all carry. See DECISION_LOG D-132–D-141, D-192.

## 4. "Show her the refused frame" (walk-campaign's END; founder
##    personally judges)

Option: show a twice-refused render to the customer — "this didn't
look right to us; you weren't charged; keep it if you disagree" —
making her the final judge of borderline checker calls (founder,
2026-08-09, mailbox fable-106). Until ruled: refuse-and-refund
stands. Companion principle, ratified same exchange: **the checker
judges EXISTENCE against her own words only; intensity/density
belongs to her words or to nobody; any widening is a founder gate.**

## 5. Open-vocabulary regions — the map becomes a cache (design
##    direction; wants its own court)

Founder question, 2026-08-09: "I couldn't possibly think of every
territory." Design answer: when the facet→region map is silent,
derive the region from HER OWN WORDS via the segmenter (which
already answers free-text questions), with the hand-built map as the
proven fast path — territories discovered per-ask, ratified into the
map once seen working. Never built without its own court: a
hallucinated region is a confinement hole. Natural substrate for
M12 and the face chart.

## 6. Engine routing for marks (evidence exists; engineering item)

NBP delivered freckles 6/6 (at 848×1264, the only size it returns)
vs GPT2's 6/8 at native size; GPT2 tore half its frames at 848
(caught by the seam detector). Routing marks to NBP is NOT a config
change — NBP ignores `image_size`, so the masked path must drive it
at a size it returns. Watch: NBP over-delivery (density) — judged by
HER words only, per item 4's principle. Also filed: the interpreter
placement field for makeup (built only when a real specimen defeats
the placement table — trigger recorded in fable-103); the
`earring`/`nose stud` detector courts (need hand-classified negative
specimens); accessory-region gap (accessory edits persist by recipe,
not patch, until they get regions).

## 7. Pre-launch checklist items (M13 gate)

The shared production R2 credential split (least-privilege token per
bucket — founder re-prioritized here 2026-08-09); live Stripe keys;
real-inbox test of the Resend verification sender; the fal retention
answer.
