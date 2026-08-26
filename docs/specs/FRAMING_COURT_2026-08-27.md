# THE FRAMING COURT — record, 2026-08-27 (foreman-29, issue #130)

**Status: RUN. The strip is in the Crew tab's eye gallery (edition 38, item `framing-court-130`); nothing built, no constant moved — the court did not find a sentence that lands on 28%, and it found that the two numbers on the issue are not the same target.** Harness `scripts/_court-framing-130-disposable.mts` (disposable; `--instrument` law-2 controls, `--dry-run`). Frames and readings under `output/_shift130/court/` (`readings.json`, `court.log`, `prompt-<arm>.txt`).

Under test: his Crew reply #8 — *"Calibrate the preset's framing to my reference frame (28% head share) and lock framing, lighting and studio across every cast. Never say 'sternum'."* — and ruling §3a (the reference frame `docs/specs/references/prompt-author/house-framing-reference-chest-up.png`). The #128 court measured every arm of the locked block at 35–38% with the same framing pair on all five arms, so the gap is `AUTHOR_ROAD_FRAMING`'s; this court moves the pair's SECOND sentence and nothing else.

## 0. What the court found, in five lines

1. **Words move the frame three to four points, not eight.** K (today's pair) replicated #128 at **36.7%** (31.4–40.6). F2, his §3a geometry said in numbers (*"the face takes up about a quarter of the frame's height"*), landed **32.6%** (30.2–35.0) — the tightest spread of any arm; F3 (*"a little under a third"*) **33.7%** (26.6–34.4); F1, the crop said in anatomy (*"a hand's width below the collarbones"*), **35.9%** — indistinguishable from K by number and by eye. No arm put a single frame within ±3 points of 28.2% more than twice.
2. **The two numbers on the issue are two different pictures.** His reference is **9:16** (1130×1999); the product renders **2:3**. The same field of view carried into a 2:3 frame reads **33.4%** face share, not 28.2% — and F2/F3 landed exactly there. A 28% face in a 2:3 frame is a WIDER picture than his reference (more torso, smaller head), which is a taste question and not a calibration.
3. **The numeric sentences refused where today's pair did not.** K 0/8; F1 1/8, F2 2/8, F3 2/8 — 5 of 24 against 0 of 8 (Fisher two-tailed p ≈ 0.30 at this n; recorded, not claimed). The refusal is fal's content checker, the same door as #125/#128. A framing sentence is not free of #129's question.
4. **Naming the chest more drew chest tattoos.** K 0/8 delivered frames carry chest ink; F1 3/7, F2 2/6, F3 3/6 (by my eye on the strip). The brief says nothing about ink. Every candidate sentence says "chest" once more than today's pair does. Noted for #129 and for the words-road ink lane, not decided here.
5. **By my eye, all four rows are the same studio and the same crop family** — grey seamless, square to camera, lace neckline at the bottom edge. F2/F3 show a little more chest and air; none shows the torso his reference shows. The reference sits letterboxed at the top of the strip so the aspect difference is visible rather than argued.

Spend: **32 renders × $0.0557 = $1.78 + 54 region reads × $0.005 = $0.27 ≈ $2.05**; fal $13.26 → $12.01 (read at both ends). Estimate on the issue before it fired: $2.12. No rows, no credits, dev `.env`.

## 1. Instrument (law 2), before a cent

- Framing reader (`face` + `head` region reads, the #128/#125 instrument verbatim) on his reference frame → **28.2%** (§3a 28.2%), headroom 0.59, hair gap 0.35 — positive control.
- A blank grey 1024×1536 frame → NO FACE — negative control.
- Guards: all four prompts clear `DROPPED_FROM_BLOCK`, `NEVER_WRITTEN` and the suite's `collarbones` pin; F1/F2/F3 → K by replacing the framing sentence alone (bytes equal).
- `eyesAt` is a PROXY (40% down the face box), not a landmark read; the reference reads 28% by it and §3a says ~30%. Stated so it is not read as a measurement it is not.

## 2. Arms, as sent

Brief `goth woman mid 30s` (thin, his own — the #128 brief, so K is a replication). LOW = seed + block, no author call. One prompt per arm, ×8, 1024×1536 medium. The first sentence of the pair (*"FRAMING: Single figure only, chest-up, centred, square to camera."*) is untouched on every arm.

| arm | second sentence of the pair | words |
|---|---|---|
| K | today's: *"Frame from the chest up in a 2:3 portrait: the crop just below the collarbones, shoulders running off both edges of the frame, a small margin of headroom above the hair."* | 445 |
| F1 | *"… the crop line across the chest a hand's width below the collarbones, shoulders and the tops of the arms running off both edges of the frame, a small margin of headroom above the hair."* | 457 |
| F2 | *"… the face takes up about a quarter of the frame's height, the eyes about 30% of the way down from the top edge, a small margin of headroom above the hair, the crop line across the chest below the collarbones, shoulders running off both edges of the frame."* | 471 |
| F3 | *"… the face takes up a little under a third of the frame's height, the eyes about a third of the way down from the top edge, a small margin of headroom above the hair, the crop line across the chest below the collarbones, shoulders running off both edges of the frame."* | 474 |

## 3. Readings

| arm | delivered | refused | head share median (min–max) | within ±3pt of 28.2% | headroom med | hair gap med | chest ink (eye) |
|---|---|---|---|---|---|---|---|
| K | 8 | 0 | 36.7% (31.4–40.6) | 0/8 | 0.79 | 0.65 | 0/8 |
| F1 | 7 | 1 | 35.9% (30.5–38.3) | 1/7 | 0.71 | 0.55 | 3/7 |
| F2 | 6 | 2 | 32.6% (30.2–35.0) | 1/6 | 0.90 | 0.75 | 2/6 |
| F3 | 6 | 2 | 33.7% (26.6–34.4) | 2/6 | 0.84 | 0.36 | 3/6 |
| his reference (9:16) | — | — | 28.2% | — | 0.59 | 0.35 | — |
| aspect-equivalent in 2:3 | — | — | 33.4% | — | — | — | — |
| #128 K (last night) | 8 | 0 | 35.6% (31.4–40.2) | — | 0.88 | 0.64 | — |

## 4. The trim on his account

`CASTING_FRAMING_TRIM_SCOPE` is `users:1` on production and is not road-conditional (`rollService.ts` line ~774): a frame under the trim's T = **31.6%** face share is cropped IN to 31.6%; a frame above it ships untrimmed. So on his own rolls a sentence landing 28% would be undone to 31.6%, and F2's population (30.2–35.0) would be trimmed on roughly a third of its frames. Ruling §4 rule 15 — *"if a stated framing sentence holds head size inside the trim's own bar, the trim retires"* — is his call, and it cannot be made until the target is chosen.

## 5. What this court does NOT decide, and what it asks him

- **Which target.** (a) 28% face share in a 2:3 frame — a wider picture than his reference, which no sentence here reaches and which the trim on his account would crop back to 31.6%; or (b) the same VIEW as his reference in 2:3 — ~33%, which F2 delivers today with the tightest spread. The recommendation put to him: **(b), with F2's sentence**, because it is his frame carried honestly into the product's aspect, it is above the trim's T so the trim and the sentence stop fighting, and it needs no new number anywhere. The cost to state beside it: F2 refused 2/8 on this brief (K 0/8) and drew chest ink 2/6 — both n-of-8 readings and both #129's to measure.
- **A 28% frame by RENDERING rather than by words** — a taller render trimmed to the reference (the trim already renders 1536×2304 and crops to a target; a 2:3 delivered box cannot hold a 9:16 view without a wider crop). That is a different build, not a sentence, and is not scoped here.
- Which light — #128, his eye, still open.

## 6. If his eye picks

- **F2 (or F3)** — `AUTHOR_ROAD_FRAMING[1]` in `server/castingV2/houseBlock.ts` takes the sentence verbatim; the suite's `collarbones` pin and order arms hold as written; one small PR; the next gallery roll carries it. The trim's T (31.6%) is then BELOW the new population's median, and rule 15's question ("retire the trim?") goes on a card with his own flagged rolls' untrimmed rate beside it (#11).
- **K** — nothing moves; #130 records that 28% is not reachable by the sentence and closes or re-scopes to a render-side build.
- **28% and nothing else** — a render-side build (court first, priced): render taller, trim to 28% with the per-frame headroom rule; the words alone have been measured not to get there.
