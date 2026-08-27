# THE FRAMING COURT 2 — record, 2026-08-27 late (issue #182)

**Status: RUN AND SHIPPED IN THE SAME SITTING, on his own sequencing** (relay,
2026-08-27 23:12: *"Court first, then the sentence + trim retarget in one
PR"*). The court was the CALIBRATION, not the decision — the decision is his,
verbatim: *"our pictures are 2:3 the one i sent you was 9:16 i wanted to test
the framing on 2:3 same as our cards it works. chest up is far too tight we
need to see the outfit more. run it."* Harness
`scripts/_court-framing-182-disposable.mts` (disposable; `--instrument` law-2
controls, `--dry-run`). Frames and readings under `output/_shift182/court/`
(`readings.run1.json` + `readings.json`, `court.run1.log` + `court.log`,
`prompt-K.txt`, `prompt-M.txt`, `STRIP-FINAL.png`). The strip is in his eye
gallery (`framing-court-2-182`).

## 0. What the court found, in five lines

1. **The mid-torso sentence lands on his reference's geometry.** His 2:3 frame
   measures **22.0%** face share; the M pair delivered **median 23.0%
   (20.7–28.1, n=10)** against K's replication at **32.1% (25.8–35.9, n=7)** —
   today's sentence reproduced its own #130 figure (32.6%), and the new one
   moved the whole population ~9 points looser.
2. **The outfit is the difference his eye asked for.** Every delivered M frame
   shows the garment world — corset closures, lace sleeves, necklines — where
   K's frames crop at the collar. Verified at the frames, not the numbers.
3. **The mid-torso sentence refuses more, and the refusal is the coin.** M
   pass 1 refused 4/8; the SAME BYTES re-sent (pass 2, the #93 court's move)
   refused 2/8 — so 6/16 against K's 1/8, all `content_policy` at fal's
   checker, same door as #125/#128/#130. Consistent with #130's finding that
   sentences naming the body refuse more, and with #93's coin-per-render
   finding; recorded for #129, not decided here.
4. **The trim and the sentence were fighting and now are not** (the card's
   interplay 1, declared): at the old T = 31.6% the trim would have cropped
   most M frames back toward the chest-up look he just refused. T moved to
   **0.230** — the M population's median and the closest reachable value to
   his reference's 22.0% (a crop only tightens). It serves 6/10 courted
   frames; the 4 untrimmed (24.7–28.1%) were looked at by eye and all show
   the outfit. The full-serving alternative T = 0.281 was REFUSED — it
   normalizes every sheet to the tightest frame painted, the direction he
   ruled against; T = 0.251 (serves 9/10) declined for the same reason,
   3 points tighter than the frame he sent. His eye on strips from his own
   rolls (#11) is what moves T next.
5. **"mid-torso" came off the forbidden-token list in the same commit** — it
   was banned under §3a's chest-up ruling, and a guard whose ruling has been
   reversed is a guard pointed at the product's own new sentence. "waist-up"
   and "sternum" stay banned.

Spend: **24 renders × $0.0557 = $1.34 + 40 region reads × $0.005 = $0.20 ≈
$1.54** (estimate on the issue before firing: ~$1.08, worst case ≤ $2 — the
delta is pass 2, bought to separate the sentence from the coin and to fill
his strip). fal $19.25 → $18.47 read at both ends of the runs. No rows, no
credits, dev `.env`.

## 1. Instrument (law 2), before a cent

- Framing reader (`face` + `head` region reads, the #128/#130 instrument
  verbatim) on the OLD chest-up reference → **28.2%**, its known figure —
  positive control, exact.
- His NEW 2:3 reference (1280×1928) → **face share 22.0%, headroom 1.11
  face-heights, hair gap 0.93, eyes ~33% down (proxy)** — the measurement the
  M sentence was then written to (the card's own order: measure first, write
  after).
- A blank grey 1024×1536 frame → NO FACE — negative control.
- Guards: both prompts clear NEVER_WRITTEN; K clears the full
  `DROPPED_FROM_BLOCK`; M is exempted from exactly `mid-torso`/`waist-up`
  (declared — the ruling under test reverses the ruling that banned them) and
  from the `collarbones` pin (the old sentence's own token); M → K by the
  pair swap alone, asserted byte-for-byte.
- `eyesAt` is a PROXY (40% down the face box), not a landmark read.

## 2. Arms, as sent

Brief `goth woman mid 30s` (the #128/#130 brief — K is a replication). LOW =
seed + block, no author call. One prompt per arm, ×8 (M ×16 across two
passes of identical bytes), 1024×1536 medium.

⚠ **M swaps BOTH sentences of the framing pair, and that is one variable:**
sentence 1 names the crop family ("chest-up" → "mid-torso up"), and leaving
it while sentence 2 says mid-torso sends the engine a contradiction. The
harness asserts M differs from K in exactly the pair.

| arm | the pair's second sentence | words |
|---|---|---|
| K | today's (the #130 F2, his reply-#13 pick): *"…the face takes up about a quarter of the frame's height, the eyes about 30% of the way down…the crop line across the chest below the collarbones, shoulders running off both edges…"* | 471 |
| M | written to the measured reference: *"Frame from mid-torso up in a 2:3 portrait: the face takes up about a fifth of the frame's height, the eyes about a third of the way down from the top edge, a small margin of headroom above the hair, the crop line at mid-torso between the chest and the waist so the outfit's upper body is fully visible, both shoulders fully inside the frame with air at both sides."* | 485 |

## 3. Readings

| arm | delivered | refused | face share median (min–max) | headroom med | gap med |
|---|---|---|---|---|---|
| K | 7 | 1 | 32.1% (25.8–35.9) | 0.72 | 0.55 |
| M pass 1 | 4 | 4 | 23.0% (20.7–28.1) | 1.06 | 0.57 |
| M pass 2 (same bytes) | 6 | 2 | 24.7% (20.9–25.1) | 0.95 | 0.69 |
| M pooled | 10 | 6 | 23.0% (20.7–28.1) | — | — |
| his 2:3 reference | — | — | 22.0% | 1.11 | 0.93 |
| #130 K (the same sentence) | 6 | 2 | 32.6% (30.2–35.0) | 0.90 | 0.75 |

Per-slice shares (pooled M, as delivered): 0.2070, 0.2077, 0.2090, 0.2188,
0.2298, 0.2298, 0.2467, 0.2493, 0.2507, 0.2813 — pinned as the fixture
population in `server/castingV2/framingTrimStep.test.ts`.

## 4. What shipped (PR of this sitting), and what remains his

- `AUTHOR_ROAD_FRAMING` → the mid-torso pair, verbatim as courted.
- `FRAMING_TRIM_TARGET.headShare` 0.316 → **0.230** (derivation and refused
  alternatives in §0.4 and in the constant's own docblock).
- `DROPPED_FROM_BLOCK`: `mid-torso` lifted, `waist-up`/`sternum` kept.
- Suite pins moved with the sentence (`creativeRegisterScope.test.ts`'s
  framing token, the trim fixtures re-based on this court's real rows).
- `PROMPT_AUTHOR_RULING_2026-08-26.md` §3a stamped: the 2:3 frame is the
  FRAMING reference; the 9:16 pair remain the LOOK.
- **His eye is the gate that remains**: the strip (`framing-court-2-182`) is
  on his desk; K stays one revert away if his eye disagrees; the next flagged
  roll on his account carries the new pair, and #11 holds the trim readings.
- The refusal-rate reading (6/16 vs 1/8, coin included) is #129's input, not
  a widening here.
