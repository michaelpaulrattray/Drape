# Hairstyle vocabulary: demographic coverage audit

**Status:** proposal, for founder review. Nothing ships from this document.
**Date:** 2026-08-01
**Owner:** Fable, at founder request ("the library's blind spots are demographic, not aesthetic")
**Method:** the shipped vocabulary (`server/castingV2/hairStyles.ts` as of slice-zero era) read
against everyday real-world coverage per heritage/sex/age lens — the coiled up-styles gap
(founder-caught, since shipped) is the template: styles that are *ordinary on a real street*
but unsayable by the dice.

---

## 1. What exists, counted

Four lists: MALE (13 entries), FEMALE (13), NONBINARY (12), COILED (11 — replaces the
sex lists entirely for West African and Afro-Caribbean heritage). Worn-states and the D10
modifier layer multiply these well; the texture axis carries grain independently. Statement
discipline, share conservation, and age adjustment are all sound and none of this proposal
touches them.

The audit lens: for each demographic the heritage system casts, is the *everyday* style set
of that population reachable by the dice? Stated hair is out of scope — words already reach
everything.

## 2. Findings

### F1 — The single long plait is unsayable, and it is one of the most common
hairstyles on earth. **(HIGH — population-weighted)**

The only braid entries live in the COILED list with `texture: "coiled"` (cornrow-family
braids). A South Asian, Latina, Slavic, or Mediterranean woman wearing one long plait —
a daily default for hundreds of millions of people — cannot be produced: the dice have no
texture-open braid entry, and the coiled entries never appear outside the two gated
heritages. Every "woman in her 30s" open sheet quietly excludes it.

**Proposal:** `LONG_PLAIT = { name: "a single long plait", family: "long", worn: "tied back" }`
(texture-open — the plait reads in any grain). FEMALE list, ordinary weight 4, funded
within long: SIMPLE_LONG 15→13, PONYTAIL 10→8. Long stays 44. NONBINARY: weight 2,
funded from SIMPLE_LONG 8→6.

### F2 — The COILED list is sex-blind, and male coiled barbering is missing.
**(HIGH — the coiled up-styles lesson, second half)**

`stylesFor` picks the COILED list *before* consulting sex, so West African and
Afro-Caribbean men and women draw one shared list. Two consequences: men can draw
female-typical up-styles (high puff, pineapple — real but uncommon on men), and the
male coiled barbering that is genuinely everywhere has no entries at all: **waves
(brushed 360 waves), the tapered afro / afro fade, sponge twists**. A Black man's sheet
today offers afro, braids, locs, twist-out, curly crop, standard crop, buzz — no waves,
no taper, which between them are arguably the two commonest Black male cuts in the world.

**Proposal:** split COILED into COILED_MALE / COILED_FEMALE (the function already
receives sex — this is two lists, not new plumbing).
- COILED_MALE, share-conserved against today's totals (coiled 18, long 34, mid 22,
  cropped 20, shaved 6): `WAVES = { name: "brushed waves", family: "cropped",
  texture: "coiled" }` at 8 (from CURLY_CROP 12→6, STANDARD_CROP 8→6);
  `TAPERED_AFRO = { name: "tapered afro", family: "coiled", texture: "coiled" }` at 6
  (from AFRO 9→6, HIGH_PUFF 4→2, PINEAPPLE 3→2 — puff/pineapple stay possible on men,
  rare, which matches the street); `SPONGE_TWISTS = { name: "sponge twists",
  family: "cropped", texture: "coiled" }` at 2 (from CURLY_CROP's remainder).
- COILED_FEMALE: today's list plus **goddess braids** (braids interwoven with loose
  curly strands — contemporary everyday styling, not editorial) at ordinary-low weight,
  funded within the long family.
- **The line-up (founder images, 2026-08-01 — three independent photos wear it):** the
  crisp edge-up hairline is the signature barbering finish on Black men's cuts — it sits
  ON TOP of waves, afros, locs, or a buzz and is what makes them read barbered rather
  than merely short. Add as a modifier-tier detail for COILED_MALE entries ("a crisp
  line-up at the hairline"), moderate weight — it is closer to default than garnish in
  real barbershops — with the D10 rules (own hash, null option, prescribe tier).

### F3 — Older women's set curls are missing at the ages where they are the
default. **(MEDIUM)**

`ageAdjust` correctly bumps tied-back/bun/plain-short for 60s+, but the short set/permed
curl — the single most recognisable 70s+ women's style in most of the world — has no
entry. Sheets of older women read as younger hair on older faces.

**Proposal (founder-corrected):** presence, not default — "not every old lady looks like
a granny" is the ruling, and an older sheet full of set curls would be the age-bracket
version of every-fourth-cast-art-directed. `SET_CURLS = { name: "short set curls",
family: "short", texture: "curly" }`, weight 0 in the base FEMALE list, added at **+3**
by `ageAdjust` for 70s+ only (funded from NATURAL_MID −2, SOFT_LAYERS −1) — roughly one
appearance every fourth 70s+ sheet, beside the sleek bobs, crops, and worn-up long hair
the age adjustment already favours. Category briefs are naturally unaffected: a role
puts hair at bias tier, where named cuts do not render — "a model in her 70s" keeps her
editorial silhouette regardless.

### F4 — Brow weights are sex-conditioned but never age-conditioned. **(MEDIUM —
founder-prompted: "eyebrows do a lot to a person's face")**

The brow axis itself is healthy (realized biology tier, D8 expansions, A8 protocol,
authors even at bias tier). But `BROW_BY_SEX` is static across age, so two of the most
face-defining brows in casting are unsayable: the **wiry, overgrown 70s+ male brow**
(a feature casting directors genuinely hunt for) and the **sparse, faded older-female
brow**. Same presence-not-default framing as F3: an age adjustment on the brow weights —
70s+ men gain `["wiry and overgrown", ~8]` (new value + D8-style render expansion:
"long wiry strands, individual hairs curling past the brow line, unruly rather than
groomed"), 60s+ women shift a few points from full/feathered toward thin/sparse.
Rare-but-possible tails, category briefs unaffected in what they already lock, stated
brows defer as always.

### F5 — Facial hair: the goatee is missing, and beard grey is chained to hair grey.
**(MEDIUM)**

The goatee — ordinary worldwide, not a statement — has no entry. And greying lives only
on the hair-colour axis, so the salt-and-pepper beard under still-dark hair (one of the
most recognisable middle-aged male looks there is) is unsayable; beards commonly grey
first and independently. **Proposal:** add `goatee` at ordinary weight to
FACIAL_HAIR_BY_AGE (30s+ bands, funded within the bearded shares); give beard grey its
own age-driven roll (independent of hair grey, correlated but not chained — e.g. from
40s up, beard-grey chance runs a band ahead of hair-grey); 70s+ gains a rare
`long full beard` at presence-not-default weight.

### F6 — FLAG, not a proposal: heritage coverage is the deepest gap in the library.

Southeast Asia (~700M people — Thai, Vietnamese, Filipino, Indonesian) has no heritage
row; nor do East Africa (Ethiopian/Somali — features distinct from the West African row)
or North Africa. The dice never produce these populations and stated briefs have no
clean row to land on (cousin of the fixed "asian → East Asian wrong-lock" bug). NOT
proposed here because a heritage row is a column across every conditioned table (eye
palette, hair colours, textures, style gates, neighbourhood recompute + snapshot
review) — hasty rows are how stereotype tables get written. This is its own
properly-researched workstream, natural companion to the pre-M9 vocabulary effort.

### F7 — Slicked/wet-look styling is missing as a worn-state. **(LOW, cheap)**

"Slicked back" and the wet-look flow are ordinary styling states (not statements) with
no worn-state entry — currently unsayable by dice in any world. **Proposal:** add
`slicked back` to the worn-state shelf for short/mid-length/long families at modest
weight, with the FINISH_RENDER-style expansion ("combed back wet-look, held flat to the
skull, ridges of the comb visible") so the word renders as the thing.

### F8a-KPOP — the kpop world's seed vocabulary (founder-supplied references, 2026-08-02,
sixteen images, Fable-named). Styles, in trade terms: **two-block** (full top, clipped
sides — THE male idol cut), **down perm / comma fringe** (soft textured perm falling
forward), **hush cut** (jaw-to-collarbone wispy layers, curtain-parted), **soft mullet /
wolf** (permed, neck-length), **wet slick-back mullet** (stage worn-state — composes
with F7), **bowl cut** (statement); women: **long-straight hime with blunt full bangs**,
**high ponytail with wispy bangs**, **see-through bangs** over long waves. Colour
latitude for this world when F8 builds: ash, blonde, lilac-grey, money-piece streaks.
Accessories note: every male reference wears earrings — the earned-accessory tier's
strongest evidence yet. Interim ceiling (post silhouette-vocabulary fix): the
silhouettes render in natural colours, bare-eared — ~70% of the references; the
remaining 30% is exactly F8 colour latitude + earned accessories, not new findings.

### F8a — World-shelf style seeds (founder images, 2026-08-01, Fable-triaged):
**space buns** are the first entry on the future world style shelf — not composable from
existing entries, art-directed on the default street, Tuesday in the K-pop/streetwear
world. Stated-only until F8's world latitude builds. (The rest of that image set needed
nothing new: wispy-bangs-updo and blunt-fringe-long compose from shipped D10 modifiers
today; wet curtain part, slick-back undercut, bleached buzz + goatee, and silver crop
with independently-grey beard are all covered by F5/F7/F8 as already written — the
silver-crop image is F5's evidence photograph.)

### F8 — RECORDED LAW, builds later: ordinariness is world-relative (founder images,
2026-08-01).

The dye rule ("dye is a statement someone makes — stated-only") is a law about the
DEFAULT world. On a K-pop sheet, silver hair is Tuesday; on an alt/punk sheet, bleached
two-tone is the street. Styled worlds should therefore be able to **earn colour
latitude on their direction shelf** — a bounded dye palette at that world's real
frequency — exactly as fitness earned bare and fantasy earned linen. The theme shelf's
slots become: ground, garment, finish, accessories, colour latitude. Default world
unchanged forever: no dice-dye on open or ordinary-category sheets. Lands with the
direction-shelf era (post-poolTendencies / Path B adjacent).

## 3. Deliberately NOT proposed

- **Faith-coded coverings (hijab etc.):** presentation is intent, never a dice roll — the
  same law as the sex-coded ruling. Stated-only, forever. If stated support needs work,
  that is a separate (worthwhile) item about the *stated* channel, not the library.
- **A man bun entry:** already emergent — male `simple long hair` × worn-state `worn up`
  produces it. Adding a named entry would double-count.
- **A full style-by-heritage matrix:** beyond the coiled gate (which reflects genuinely
  distinct barbering traditions), per-heritage style lists would be stereotype authoring.
  The texture axis already carries the real variation; restraint here is deliberate.
- **Dyed colours in variation:** ratified law stands — dye is a statement someone makes.
- **Eyewear:** stated-only for now, but the parked question now has a design shape and
  founder taste evidence (2026-08-01: "miu miu would look great with glasses" — and the
  captured miu miu direction is begging for them). Future form: **direction-earned,
  tile-varied** — a direction that authentically owns eyewear (miu miu, streamer,
  professor) earns glasses on SOME tiles (2–3 of 8, never all — all-eight is costume),
  making it the first per-tile world element, an accessory axis gated by direction,
  off by default. Lands with/after poolTendencies. **Immediate cheap check, before any
  of that:** does STATED eyewear survive the framing constant's anti-prop language
  today? One roll or one golden ("a model in her 20s wearing chunky glasses") — if the
  constant eats a stated accessory, that is a drop-a-stated-fact bug now, not a future
  feature.
- **Jewelry: stated-only pre-Sign, full stop (founder-ruled 2026-08-01: "definitely
  more a styling thing").** No direction shelf, no earned tier, no weights — unlike
  eyewear, jewelry never reads as identity, so it has no pre-Sign claim at all. Faith-
  or identity-coded pieces are stated-only at an even harder line (presentation-is-
  intent). The governing law is **anchor inheritance**: whatever the sheet wears, the
  signed identity keeps as pixels — the package and every take inherit it until an M12
  revision. Jewelry lives post-Sign in takes and campaigns, chosen per shoot, where
  styling belongs.
- **Acne, vitiligo, and other skin conditions in variation:** real at real frequencies,
  but dice-assigning them to paid sheets is a dignity/product ruling, not a taste
  weight — stated-only until the founder rules otherwise (stated already renders; that
  enumeration shipped with A9's consequences).
- **More statement cuts:** the street ruling is working; nothing here touches the cap.

## 4. Interactions to check at ship time

- The **neighbourhood computation** reads these vocabularies — the COILED split changes
  the overlap inputs, so the pinned pair snapshot will (correctly) demand review.
- The **twin-breaker/distinct-floor** bars re-verify per changed list (the up-styles
  lesson: even five additions measurably moved the silhouette mix until share-funded).
- All new entries hash their own named strings by construction (they ride `hairStyle`).

## 5. Verification, if approved

Offline distribution tally per changed list (family shares must be identical before/after);
one paid graded sheet each for: an open female brief (plait appears at plausible frequency),
a West African male brief (waves/taper present, sheet reads like a real barbershop's week),
and a 70s women brief (set curls present). Founder eyes on all three.

## 6. Open question for the founder

F2's split leaves NONBINARY drawing the shared logic it draws today for coiled heritages
(the unisex COILED list, i.e. COILED_FEMALE after the split). Acceptable default, or should
nonbinary coiled candidates draw a merged list? Small either way; named so it is chosen
rather than inherited.
