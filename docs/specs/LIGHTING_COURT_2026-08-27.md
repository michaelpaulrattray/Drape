# THE LIGHTING / REALISM COURT — record, 2026-08-27 (foreman-28, issue #128)

**Status: RUN. The two sheets are in the Crew tab's eye gallery (edition 37, item `lighting-court-128`); his eye is the verdict. Nothing built, no constant moved.** Harness `scripts/_court-lighting-128-disposable.mts` (disposable; `--instrument` law-2 controls, `--dry-run`). Frames and readings under `output/_shift128/court/` (`readings.json`, `court.log`, `prompt-<arm>.txt`).

Under test: ruling `docs/specs/PROMPT_AUTHOR_RULING_2026-08-26.md` §5c (the locked block is code; *"the B+R court becomes: author content + the FULL locked block vs + the distilled clause"*) and his lighting words (§5 line 145–146: *"a few different options would be good to look at"*; his own candidate as the lead variant).

## 0. What the court found, in five lines

1. **The rebuilt block does not trip the engine's checker, whichever light is in it.** K, L1, L2, L3: **0 of 32 refused** on the thin brief. The distilled clause with no block (R): **3 of 8 refused** — the original B+R shape is the one that refuses, and it is the lean prompt (the #125 finding again: lean prompts refuse erratically).
2. **The four block arms are the same studio.** Grey seamless, chest-up, square to camera, mouth closed, goth styling landed 32/32 by my eye. The light differences are REAL but subtle at sheet size — L1 carries more shape under the jaw, L3 is the flattest, K and L2 sit between — which is why a 3-tile-per-arm DETAIL sheet went to his gallery beside the strip.
3. **R is a different picture, not a different light.** Darker grey behind the head, more contrast, leather and tattoos invented, a tighter crop (headroom 0.34 face-heights against 0.72–1.02 for the block arms). The block does more than light the face: it holds the room.
4. **Every arm frames tighter than his reference.** Head share medians 35.3–38.0% against the reference's 28.2% (calibrated the same run). That is #130's question — the framing pair is the same across all five arms here, so this court says nothing about which light fixes it; it says the light does not move it much (L2's 38.0% is the tightest, K's 35.6%).
5. **No refusal word in any variant.** Every arm passed the block's own dropped-phrase guard and `NEVER_WRITTEN` before a cent; L1/L2/L3 differ from K in the LIGHTING line only (asserted by swapping it back and comparing bytes).

Spend: **40 renders × $0.0557 = $2.23 + 74 region reads × $0.005 = $0.37 ≈ $2.60**; fal balance $15.30 → $13.30 (read at both ends; settles late, no top-up landed mid-run). Estimate on the issue before it fired: $2.65. No rows, no credits, dev `.env`.

## 1. Instrument (law 2), before a cent

- Framing reader (`face` + `head` region reads) on his reference frame → head share **28.2%** (§3a 28.2%), headroom 0.59, hair gap 0.35 — positive control.
- A blank grey 1024×1536 frame → NO FACE — negative control.
- Guards: all five prompts clear `DROPPED_FROM_BLOCK` and `NEVER_WRITTEN`; L1/L2/L3 → K by replacing the lighting line alone.

## 2. Arms, as sent

Brief: `goth woman mid 30s` (thin, his own). LOW = seed + block, no author call (his LOW spec). One prompt per arm, ×8, 1024×1536 medium, the product's own size and quality.

| arm | what changed | words |
|---|---|---|
| K | `staticPrompt(brief)` — today's block byte for byte (§5e lighting; roll 223's bytes) | 445 |
| L1 | LIGHTING → *"Soft frontal key with moderate fill, speculars where the person's skin and wardrobe naturally catch the source, and a deep but open shadow under the jaw that gives the face its shape. Grey seamless slightly brighter behind the head, gentle falloff to the edges. Minimal rim. No coloured gels."* | 434 |
| L2 | LIGHTING → his candidate verbatim: *"soft frontal beauty lighting, high fill, open shadows, grey seamless with a gentle centre falloff, minimal rim, photoreal fashion studio."* | 405 |
| L3 | LIGHTING → *"Clean, even studio light — a large soft frontal source with near-full fill, shadows lifted almost flat, only a faint shadow under the jaw. Grey seamless evenly lit behind the head, soft falloff to the edges. No rim. No coloured gels."* | 426 |
| R | brief + a three-sentence distilled photographic clause (chest-up/grey seamless/soft frontal light; medium-format 85mm f/5.6–8, fine grain; RAW skin, pores, no retouching) — NO block | 67 |

## 3. Readings

| arm | delivered | refused | head share median (min–max) | headroom med (face-heights) | hair gap med |
|---|---|---|---|---|---|
| K | 8 | 0 | 35.6% (31.4–40.2) | 0.88 | 0.64 |
| L1 | 8 | 0 | 35.7% (29.8–40.9) | 1.02 | 0.71 |
| L2 | 8 | 0 | 38.0% (33.6–41.2) | 0.72 | 0.46 |
| L3 | 8 | 0 | 35.3% (29.9–42.3) | 0.99 | 0.70 |
| R | 5 | **3** | 36.6% (33.9–39.2) | 0.34 | 0.22 |
| his reference | — | — | 28.2% | 0.59 | 0.35 |

The refusals are fal's content checker (`422 … could not be processed because it contained material`), the same door as #125's; a refused render is not charged.

## 4. What this court does NOT decide

- Which light is right — his eye, on the DETAIL sheet (3 frames per arm at 560 px) and the strip.
- The framing gap to 28% — #130, a different constant (`AUTHOR_ROAD_FRAMING`).
- Whether R's 3/8 is the clause's words or leanness alone — #129's patrol owns trigger words; this court records the count.

## 5. If his eye picks

- **K** — nothing moves; #128 closes.
- **L1 / L2 / L3** — `LIGHTING_LINE` in `server/castingV2/houseBlock.ts` takes the chosen sentence verbatim (the guard arm asserting his §5e line verbatim moves with it, declared), one small PR, the next gallery roll carries it. The other two are candidates for the advanced-settings lighting list (N3), recorded here.
- **R's look** (the darker, contrastier room) — that is not a light, it is the absence of the block; the honest path is to say which of its qualities he wants and write THAT into the block's BACKGROUND/LIGHTING lines, then re-court.
