# The Softer-Wording Court — 2026-08-27 (#93, design §6)

Run by foreman-34, 2026-08-27 05:40–06:35 AEST. Harness
`scripts/_court93-softer-wording-disposable.mts`; rows, prompts, softened
texts and every delivered frame under `output/_shift93/court/`
(`rows-fixtures.json`, `rows-main.json`, `<cell>.prompt.txt`,
`<key>-A.softened.json`, `<cell>-<n>.png`).

**Spend: $3.62 house** (fixtures 4 renders / 4 delivered $0.11; main 100
renders / 63 delivered $3.51; text calls cents). Estimate on #93 before
firing: ≤ $10. 0 credits, no rows.

## Bar, stated before firing (design §6)

> the road is worth building if A passes at least 4/8 more than O on brief
> (i) OR (ii) … If A is not better than O anywhere, the road is not built and
> the button becomes a plain same-text Retry on content-filter tiles.

## Instrument (law 2)

| fixture | text | result |
|---|---|---|
| known-refused | #125 BRIEF + the *sternum* framing sentence (8/8 refused at court #125) | refused 2/2 |
| known-passing | same, *collarbones* (0/56) | passed 2/2 |

The counter sees a refusal and a pass. Every refusal in the court has the one
shape (`422 … The content could not be processed because it contained
material …`) — fal's content class, nothing finer.

## Main arms (8 renders each, same sitting, brief and block byte-identical to O's)

| brief | O (as refused) | L (pair list) | A (list + author, facts held) | H (his hand rewrite) |
|---|---|---|---|---|
| (i) Grok cyber-goth (63/64 refused two nights ago; 4/4 on his GPT test) | **passed 3/8** | = O (no pair in the text) | **passed 4/8** | **passed 4/8** |
| (ii) roll 222 (5/8 refused live) | **passed 6/8** | = O | **passed 7/8** | — |
| (iii) roll 220 cyborg, house compile (2/8 refused live) | passed 4/8 | = O | passed 3/8 | — |
| (iv) thin *"goth woman mid 30s"* (17/18 refused at #125) | **passed 8/8** | = O | = O (the author found nothing to soften) | — |
| (v) orc (reconstructed from his quoted words) | passed 8/8 | — | passed 8/8 | — |

**A over O: +1/8 on (i), +1/8 on (ii), −1/8 on (iii), 0 on (iv) and (v).
The bar was +4/8. NOT MET.** His own hand rewrite — the one rewrite known to
pass — scored exactly what the softener scored on the same night: 4/8.

## Swap map on (i) — A's sentence changes applied one at a time to O, 4 renders each

| sentence | O → A | refused |
|---|---|---|
| s0 | *cyber-goth* → *cyberpunk* | 2/4 |
| s3 | *eye harness … small spikes* → *eye piece* (spikes dropped) | 2/4 |
| s4 | *sheer black lace fingerless long glove* → *black lace fingerless long glove* | 4/4 |
| s8 | *choker* → *collar* | 2/4 |
| s9 | *sheer … mesh top … that reveals the skin underneath* → *black lace mesh top* | 2/4 |

O itself refused 5/8 (62%) in the same sitting; 2/4 is the coin and 4/4 is
one cell of four at the coin's own rate. **No sentence is attributable.** By
the patrol's own bar (refused n ≥ 2 → passed n ≥ 2, same sitting) no cell
becomes a pair for #129's list.

## What the court actually measured

1. **The checker's state moves night to night more than any wording moves
   it.** The cyber-goth text went 1/64 → 3/8 with NOTHING changed; the thin
   brief went 1/18 → 8/8; roll 222's text went 3/8 → 6/8. Softening moved a
   brief by one render in eight. This is the refusal patrol's finding
   (`REFUSAL_PATROL_2026-08-27.md`: *"the cheapest rescue is a same-text
   retry"*) measured a second way, with a control.
2. **fal has no creature refusal at the words he used.** *orc / tusks / bone
   necklace / bare-chested / scars* passed 8/8 raw. His "copyright" refusal
   was another studio's checker (the legacy row stores no prompt, so the text
   is reconstructed; the class question is answered either way).
3. **The measured-pair list touches no live refusal.** Every specimen's L was
   byte-identical to O — the one pair (*sternum*) lives in a sentence the
   house block no longer carries. Pass 1 has no population.
4. **The fact reader works and was needed once**: on roll 220's house
   compile the author's first draft dropped *shorts* and *barefoot*
   (wardrobe words next to *bare chested*); the re-ask held them. On the
   goth brief the author kept every body part, piercing, tattoo and hand
   position and dropped exactly the exposure claims (`goth-A.softened.json`).
5. **The house road is not the author road's shape**: softening a 3,000-
   character house compile (roll 220) made it WORSE by one (3/8 vs 4/8) —
   the design's *"treated as the customer's"* clause on the house road has
   no evidence behind it now.

## Verdict

**The softener road is not built (design §6's own else-branch).** What the
customer needs on a CONTENT FILTER tile is the same-text **Retry** the
product already has on engine-error tiles (PR #151, `CASTING_RETRY_SCOPE`) —
widened to `content_policy`, priced the same 20 credits, refunded the same
way. That question — *retry on content-filter tiles, yes or no* — is the
`retry-flip-122` card already on his desk; this court is its evidence. The
two design questions on the `softer-wording-93` card (one tap or two; own
operation kind or a flag) are moot and the card is withdrawn.

Kept for a future court, NOT as a claim: the author's softening IS a
faithful rewrite (every held fact survived, every exposure claim went) and
scored level with his own hand rewrite. If a night ever arrives where the
same-text coin is genuinely cold — O 0/8 — the A arm is the one to re-run,
against that O, the same hour. Nothing in tonight's numbers says the
grammar is wrong; they say the checker was not listening to grammar.

## Corrections to the design's record

- §2 *"the orc 'copyright' refusal was the LEGACY studio (Gemini)"* — the
  studio half stands (no V2 row exists); the ENGINE is unverified by this
  seat: V2's own census rows are `type: castingImage` in the same
  `generations` table (`rollService.ts:1037`), so a failed-row read cannot
  tell the two studios apart by type, and the legacy row for the orc was not
  found. Left as written, flagged.
- §3's house-road clause (whole compile treated as the customer's) —
  measured worse than nothing on its one specimen; see finding 5.
