# THE PROMPT AUTHOR COURT — record, 2026-08-26 (foreman-19, issue #125)

**Status: RUN. Frames in the Crew tab's eye gallery (edition 22); his eye is the verdict on quality and spread. Nothing built.** Harness `scripts/court-prompt-author-disposable.mts` (disposable; `--prove-guard` 12 fixtures, `--instrument` law-2 controls, `--dry-run`), probe `scripts/_probe-preset-refusal-disposable.mts`. Runs on disk: `output/prompt-author-court-run2/` (the full court), `output/prompt-author-court-run3/` (B + F re-run with the preset re-worded), `output/_shift125/preset-refusal-probe/`.

The ruling under test: `docs/specs/PROMPT_AUTHOR_RULING_2026-08-26.md` §8.

## 0. What the court found, in six lines

1. **His thesis replicates.** His 73-word prompt raw (arm A, brief ii) delivered 8/8: eight distinct women, consistent chest-up framing (head share mean 30.0%, his reference frame reads 28.2%), the studio held — the four-women result, at n = 8.
2. **The MAX author delivers the aesthetic with conviction — as ONE identity, eight times.** On both the 73-word brief and the thin brief, arms C and Cr are eight near-identical women (same cut, same garment, same choker). When the author states everything, the engine has nothing left to vary. "One prompt per sheet" and "stated on every slice, unstated the engine's" are both true — and at MAX the author leaves nothing unstated. **Spread is the imagination meter's job, not the engine's.**
3. **Today's compile (arm D) loses the ask.** "goth woman mid 30s" compiled house → eight women in the grey house tee with NO goth styling at all (pointer 0/8 on "goth", his eye on the strip agrees); the 73-word brief compiled creative → tees on 7/8, the cyber-goth aesthetic on 3/8 by the pointer. This is the complaint he made, measured.
4. **The engine refuses lean prompts erratically and one house word reliably.** His full cyber-goth brief (i) is refused by fal's content checker **63/64 across every arm — raw included** (his "beautiful results" came from a different door: ChatGPT's, not fal's). The thin brief raw is refused 9/10. And the LOW author's one added sentence turned a brief that passes 8/8 raw into 8/8 refused: the probe names the word — **"the crop just below the sternum"** refuses 2/2 alone, the same sentence with "collarbones" passes 2/2. Rule 16 (the author sanitises) is load-bearing and #93 has its first measured specimen.
5. **Text fidelity holds on every authored arm except free rewording.** 33/33, 19/19, 3/3 stated facts present for B and C on all three briefs; the reworded MAX arm (Cr) contradicted one fact on brief (ii) in both the dry run and the court (*"subtle specular highlights on dark structured fabrics"* → *"crisp specular highlights on the structured fabrics"*). Rule 1 (verbatim first) is the safer construction; rule 4's reword loses a fact at n = 2.
6. **No length cliff from inert text, and the LOW author is the sheet he described.** The re-run (§5) on the re-worded preset: B on the thin brief delivered six distinct goth women in their thirties; padding B to 1,600 words of non-visual prose changed nothing the pointer or the eye can see (93–96% facts visible, framing flat, refusals fell). The cliff, if it exists, is a cliff of competing INSTRUCTIONS, which this court did not measure.

Spend, read off the fal balance at both ends: **$27.34 → $20.22 = $7.12** for everything (full run $3.27, probe ≈ $0.56, re-run $3.39 — a refused render is not charged, which is why 152 refusals cost nothing); region reads 240 × $0.005 = $1.20 inside that; OpenRouter text 8 + 33 + 91 + 74 calls, cents. **Total ≈ $7.5 against the $14.50 estimate.**

## 1. Instrument (law 2), before a cent

- Text fidelity reader (ledger → audit, `anthropic/claude-sonnet-5` via OpenRouter, temperature 0): brief (ii) vs itself 19/19 present; background sentence deleted → caught `absent`; porcelain → deep bronze → caught `contradicted`, zero collateral.
- Frame pointer (one vision read per frame, a POINTER to look — law 9): "cybernetic augmentation" on roll 217 pos0/pos1 (his eye 8/8) → yes/yes; "young woman" on `founder-raw-01.png` → no. ⚠ The first draft's control fact was *"ports above the RIGHT temple"* and the reader answered no on pos1 — opened: the ports sit above his LEFT temple. The reader was right; a side is the known weak reading and the control is side-free now.
- Framing calibration on his reference (§3a): head share 28.2%, headroom 0.59 face-heights, hair gap 0.35, top of head at 6.8% of frame height (§3a's read-off said ~8%).

## 2. Arms, as sent (court-must-assert-its-road)

One prompt per sheet ×8 except D. A = the brief alone. B = brief verbatim + LOW author (preset sentences only where the brief is silent). C = brief verbatim + MAX author (his §5 instruction byte-verbatim, house rules after it, append-only). Cr = the same MAX author writing the whole prompt. D = `castingBriefCompiler` with `creativeRegister: true` (his account's road today), eight prompts. F = B padded with non-visual administrative prose to 400/800/1,600 words. Author word allowance = 400 − brief words; every author stayed within 4% of it (Cr on brief i: 416).

Text fidelity at the wire (present/absent/contradicted): brief (i) 33 facts — B 33/0/0, C 33/0/0, Cr 33/0/0, D 33/0/0 (interpreted, creative); brief (ii) 19 — B 19/0/0, C 19/0/0, **Cr 18/0/1**, D 19/0/0; brief (iii) 3 — all 3/0/0. ⚠ In the dry run, D on brief (i) fell back (`interpreted: false`) once and read 2/33 present, 20 contradicted (*"A male, in their early 50s"*, *"no accessories, no jewellery"*, *"arms relaxed at the sides"*) — roll 219's own sheet. The same brief driven alone interpreted in 45.9 s; the court takes a second attempt on a fallback and records both (the court's own compile interpreted first time). #121's fallback is rarer with #124, not gone.

## 3. The full run (run2) — refusals, pointer, framing

| brief | arm | refused | pointer: facts visible | head share (face-box / frame height) |
|---|---|---|---|---|
| (i) 249 w | A raw | **8/8** | — | — |
| | B LOW | 8/8 | — | — |
| | C MAX | 7/8 | 94% (n=1) | 25.3% |
| | Cr MAX-reword | 8/8 | — | — |
| | D compile | 8/8 | — | — |
| | F800 / F1600 | 8/8 / 8/8 | — | — |
| (ii) 73 w | **A raw** | **0/8** | 93% | **30.0% sd 3.7** |
| | B LOW (sternum) | 8/8 | — | — |
| | C MAX | 0/8 | 90% | 38.7% sd 2.1 |
| | Cr MAX-reword | 1/8 | 92% | 33.8% sd 2.3 |
| | D compile (creative) | 0/8 | 79% | 27.0% sd 3.4 |
| | F400 / F800 / F1600 (sternum) | 7/8 / 8/8 / 7/8 | — | — |
| (iii) 4 w | A raw | **7/8** | 67% (n=1; an environment scene, not a studio) | 20.4% |
| | B LOW (sternum) | 8/8 | — | — |
| | C MAX | 0/8 | 71% | 38.9% sd 1.8 |
| | Cr MAX-reword | 1/8 | 67% | 39.0% sd 2.3 |
| | D compile (house) | 0/8 | 46% — **"goth" 0/8** | 28.5% sd 1.8 |
| | F ladder (sternum) | 24/24 | — | — |

Per-fact pointer on brief (ii), the facts under 75%: A misses only "8k" (unreadable from a frame); C "deep shadows" 1/8; D "intense cyber-goth aesthetic" 3/8, "specular highlights on dark structured fabrics" 1/8, "intricate textures" 4/8, "deep shadows" 0/8. On brief (iii): "mid 30s" reads yes on C 1/8, Cr 0/7, D 3/8 — the pointer's age reading, and his eye's.

Framing: the MAX arms frame TIGHTER than his reference (38–39% head share against 28.2%) — the author's own chest-up sentence plus "character-focused" pulls in; raw A on the 73-word prompt sits on the reference (30.0%); today's compile sits at 27–28%. The trim's T = 31.6% would trim A/D and refuse C/Cr as `share-above-target`. Headroom: A 0.75 face-heights, C 0.35, D 0.98, reference 0.59.

## 4. The refusal probe — which words

Two renders per cell, brief (ii) + one sentence: full sternum sentence 1/2 refused (8/8 in the court); "Chest-up framing." 1/2; "Shoulders running off both edges of the frame." 0/2; **"The crop just below the sternum." 2/2**; "A small margin of headroom above the hair." 0/2; **the full sentence with "collarbones" 0/2**. Thin brief: "goth woman mid 30s" raw 2/2 refused (9/10 with the court); "+ Photorealistic casting portrait." 0/2; "+ …neutral grey seamless studio background, soft frontal studio lighting." 2/2; "A woman in her mid 30s with goth styling…" 1/2. **Reading: one word is a reliable trigger and short prompts are a coin flip; the checker is not monotonic in content.** n is small on purpose (cents); #93's court owns the wider map.

## 5. The re-run — B and the F ladder on the re-worded preset (run3)

Same harness, `--briefs=ii,iii --arms=A,B,F`, preset now saying "collarbones". fal $23.61 → $20.22 (62 delivered × $0.0557 = $3.45), 124 region reads, 74 text calls.

| brief | arm | refused | pointer | head share | headroom |
|---|---|---|---|---|---|
| (ii) | A raw (replication) | 2/8 | 94% | 30.7% sd 2.7 | 0.65 |
| | **B LOW (collarbones)** | 3/8 | 93% | 35.5% sd 2.1 | 0.65 |
| | F400 | 1/8 | 93% | 36.3% sd 2.6 | 0.66 |
| | F800 | 0/8 | 95% | 36.1% sd 5.3 | 0.64 |
| | F1600 | 0/8 | 95% | 34.6% sd 2.6 | 0.71 |
| (iii) | A raw | **8/8** | — | — | — |
| | **B LOW (collarbones)** | 2/8 | 78% | 43.4% sd 1.7 | 0.42 |
| | F400 | 0/8 | 96% | 42.7% sd 2.3 | 0.40 |
| | F800 | 0/8 | 92% | 41.5% sd 1.4 | 0.40 |
| | F1600 | 2/8 | 83% | 41.5% sd 2.0 | 0.40 |

Read at the strips (my eye; his is the verdict):
- **Arm B is the sheet he described** — on the thin brief, six distinct goth women who read as their thirties, black lips, chokers, lace, a clean studio; on the 73-word brief, five distinct women holding the aesthetic with A's spread and a steadier chest-up frame than A. The LOW author (28–67 added words) delivers the basic user's result without collapsing the spread the way MAX does.
- **No length cliff up to 1,600 words of NON-VISUAL filler**: pointer fidelity 93–96%, framing flat, spread intact, and refusals FELL as the prompt grew (B 3/8 → F1600 0/8 on brief ii). ⚠ This is the filler's cliff, not the content's: his 13,000-character compile disobeyed because it carried 13,000 characters of INSTRUCTIONS. The court measured that dilution by inert text does not degrade the render; it did not measure competing instructions, which is the next arm if the budget question is re-opened.
- **The preset frames tighter than his reference**: B/F sit at 35–43% head share against the reference's 28.2% and raw A's 30%; "the crop just below the collarbones" plus "chest-up" pulls the engine in. If his eye wants the reference frame, the preset's framing sentence should describe the reference (shoulders running off, crop below the sternum-line — said without the word) rather than the collarbones.
- Raw thin brief: **17/18 refused across both runs.** Four words are a coin the checker mostly loses; the author's preset alone rescues it (B 6/8, F400 8/8).

## 6. What this means for the build (recommendation, not a ruling)

- Build the author as ruled — verbatim first (rule 1); rule 4's free reword is the one construction that lost a fact.
- **The imagination meter must leave things open on purpose.** MAX as specified produces one identity; a sheet needs the author to state the brief's facts and the style bundle and name *what it leaves to the engine*, or to run below MAX by default. His eye decides whether C's eight identical women are what MAX should mean.
- The preset never says "sternum". The author's sanitising duty (rule 16) is real: the engine refuses his full cyber-goth brief 63/64 in every form, so #93's rewrite-and-retry is the road for that brief, not a corner case.
- Arm D's failure is the ask lost under the house wardrobe line and the category scaffolding — retiring them is what the ruling already orders.
