# THE FRAMING TRIM — build design

⚠ **RETIRED 2026-09-03 (card #11). THIS DOCUMENT IS HISTORY, NOT LAW.**

The founder judged the framing on his own flagged sheets, 2026-09-02, and his
whole word was: **"11 heads look fine."** Read with rule 15 of
`PROMPT_AUTHOR_RULING_2026-08-26.md` — *if a stated framing sentence holds head
size inside the trim's own bar, the trim retires* — that closes the road this
document designed. The author's framing sentence does the work now, in words,
before the render, instead of a paid crop after it.

**What was deleted with it:** `server/castingV2/framingTrimStep.ts` and
`framingTrim.ts` (and their suites), the 1536x2304 render, the two fal region
reads a frame, the kept-original write, and `CASTING_FRAMING_TRIM_SCOPE`
everywhere it was declared or documented (the production variable removed from
the service in the same act). **What SURVIVES and is deliberate:** the
`sourceKey` column and `candidateRetention.ts`'s sweep of it — rows written
while the flag was live still point at real R2 objects, and dropping the column
would orphan them. `server/castingV2/framingTrimRetirement.test.ts` holds the
retirement; its arms are driven by `scripts/_11-sabotage-disposable.mts`.

**Nothing below this line was changed.** It is kept because a road that leaves
no trace is how the next seat re-derives it.

---

✅ **STATUS: COUNTERSIGNED (fable-1576). Building.** All four open items ruled:
the corrected cost line stands (**two reads, +$0.26/roll**); the courtesy-pool
contention stays **named-unmeasured** and the dark rolls measure it, with his gate
told plainly if it moves the wall clock his *"non issue"* was priced against; the
thumbnail is a proof-list item; and **§7 is KEEP**.

Ordered fable-1574 on the founder's own eye, 2026-08-24, verbatim:

> *"hate to say it but the strips genuinely look better and it gives us more
> control over framing just need to make sure the hair is fully in the image and
> after you said your timing guess wasnt 30% only 11% its a non issue."*

Its evidence is `CASTING_FRAMING_CONSISTENCY_COURT.md` — closed, PASS, $4.09 —
plus the ship-size court at $1.81. **This design buys no new measurement before
countersign and spends nothing to exist.**

---

## 1. The arc, because it went out and came back and that matters

This item was **retired outright** eight hours before it was ordered. The record
in one place, because a design that hides its own reversal teaches nobody:

| | |
|---|---|
| ordered | *"id like the framing to be consistent across casts personally"* |
| court | clause + cut proven: across-cast gap **6.2pt → 0.9pt**, wobble 6.6–7.4 → 3.5/3.6 |
| his eye, 1 | *"i honestly dont understand why we even need to be cropping STRIP-A Suit raw looks absolutely fine"* → the cut retired |
| his ruling | *"frames do not need to be identical 100% just within a good boundary"* |
| his ruling | *"its just over engineerings for no reason what so ever"* → everything but one sentence retired |
| his eye, 2 | *"hate to say it but the strips genuinely look better… its a non issue"* → **the cut ordered** |

**Nothing about the mechanism changed between retirement and revival. What
changed is that he looked at the cut strips beside the raw ones.** That is law 9
working in both directions in one day, and it is the reason this design leads
with pictures at every gate rather than with numbers.

⚠ **Two things died on the way out and stay dead**: the common-`R` policy (its
feasible interval is EMPTY on real frames) and arm V2's wording question. **One
thing died and came back as the design itself**: option (ii).

---

## 2. What the build is, in one paragraph

A roll renders at **1536×2304** instead of today's 1024×1536, with **one added
sentence** in `FRAMING_FIXED`. Each delivered frame is then measured (`face` and
`head`), **trimmed to a common head size with per-frame headroom**, and
**downscaled** to the 1024×1536 the product delivers today. Nothing downstream
changes: the stored candidate is the same size, the same aspect, at the same key,
and every refine still anchors on it.

```
  today   compile → render 1024x1536 → fault check → store → land
  built   compile → render 1536x2304 → fault check → read face + head
                  → trim to (T, R_frame) → downscale to 1024x1536 → store → land
```

---

## 3. The clause — the one sentence

`FRAMING_FIXED`'s landmark sentence is REPLACED, not appended to (ROUND2's
specimen was an added framing sentence that widened its own population's spread
by 5.0 points, and *context is not additive* is a written lesson here):

```
  from   "Frame from mid-torso up in a 2:3 portrait."
  to     "Frame from the hips up in a 2:3 portrait. If in doubt include MORE of
          the body rather than less — a little extra room below and at the sides
          is correct."
```

**Measured, at 1536×2304**: across-cast gap 6.2pt → 0.9pt against a 1.2pt
run-to-run floor; within-sheet spread 7.4 → 3.5pt (SUIT) and 6.6 → 3.6pt
(BASICS). Every other sentence of `FRAMING_FIXED` is untouched — including the
two CROP sentences that already demand the whole hair silhouette, which arm V2
established are **not** the thing that needs strengthening.

---

## 4. The trim — the whole rule, and why it has no across-population term

```
  T          a house constant: head share (face-box height ÷ frame height)
  R_frame    max(R_house, gap_frame + CLEARANCE)   capped at the frame's own headroom
  crop       height = faceH / T, width = height × 2/3
             top    = faceTop − R_frame × faceH
  deliver    downscale to 1024×1536
```

⚠ **`R` IS PER FRAME AND THAT IS THE LOAD-BEARING DECISION.** A common `R` has to
clear every head (`R ≥ gap`) and fit inside every frame (`R ≤ headroom`), so its
feasible set is `[max gap, min headroom]` — and across the court's clause cells
that interval is **EMPTY**: the tall-curled woman needs `R ≥ 0.508` while the
tightest-framed man can give at most `0.352`. Dropping the worst frame does not
fix it (0.359 against 0.352). **No wording collapses it either** — it is
across-population variance, and the engine is already obeying: not one delivered
frame is clipped.

**Letting `R` float per frame dissolves the question rather than negotiating with
it.** The condition becomes per-frame — *can this frame hold its own hair* —
which is satisfiable whenever the engine framed the person sanely:

```
  gap + 0.05 <= headroom   holds on 31 of 31 frames the court measured
  tightest slack: basics-clause/pos7, 0.088 face-heights
```

**And it is his own ontology, not a workaround** (fable-1567): *"different hair
styles body types will always change the output releative to the frame."* Head
size consistent; headroom natural per person. **The old build condition 1 — take
`R` from the widest head gap — is DISCHARGED BY DESIGN rather than checked.**

**`CLEARANCE = 0.05` face-heights** is a build constant and stays off his desk:
the smallest air above the hair that reads as deliberate rather than as a near
miss. It is arbitrary within a range and the range is wide (0.088 of slack on the
tightest frame measured).

### 4a. `T`, and the one thing about it that is not settled

**Proposed: `T = 22.7%`** — the value the strips he chose were cut to. It is
`T_min` across the court's clause cells, i.e. the loosest common frame those 15
frames could all reach, and **his eye is the entire argument for it.**

⚠ **A frame whose own share EXCEEDS `T` cannot be trimmed to it** — a crop only
ever crops IN. At 1536×2304 the clause cells ran 16.7%–22.7%, so `T = 22.7` made
all 15 reachable, but that is 15 frames and a house constant meets thousands.
**The unreachable frame is DELIVERED UNTRIMMED** (plain downscale to 1024×1536),
and **the rate is the first thing the dark rolls measure.** If it is more than a
few percent, `T` moves up — a looser common frame, reachable by more, at the cost
of a bigger trim for everyone — and that is a decision with his eye on strips,
not an arithmetic one.

---

## 5. Where it lives, exactly

**`server/castingV2/rollService.ts`, between `detectRenderFault` and
`storeImage`** — the only point where the bytes exist and nothing references
them yet. That seam already carries a "throw before the bytes are stored" rule so
a rejected frame never becomes an object anyone has to clean up; the trim inherits
it.

⚠ **The THUMBNAIL is built from the same bytes and must be built from the TRIMMED
ones.** `thumbnailOf({ bytes: image.bytes })` sits four lines below the store
call; a trim that forgets it ships a sheet whose small tiles are framed
differently from the frames they open. Named here because it is one line and
because nothing would fail if it were missed.

**Nothing downstream changes.** The stored candidate is 1024×1536 at the same
key, so refines, the character sheet, ink crops, the face panel and every
geometry row keep the frame they already assume.

---

## 6. What it costs

```
  render, 1536x2304 vs 1024x1536   $0.0777 − $0.0557 = +$0.0220 × 8 = +$0.176/roll
  face + head reads                     2 × $0.005   × 8 =           +$0.080/roll
  ---------------------------------------------------------------------------
                                                        ≈ +$0.26 per roll
```

⚠ **TWO reads per slice, not one** (adopted everywhere, fable-1577 §4). The trim
needs `share` and `headroom`, which are FACE-box quantities, and `gap`, which
needs the HEAD box. **$0.08 per roll, not $0.04.**

**And there is nothing to piggyback on — verified rather than assumed.** The roll
road buys **zero** region reads today: `detectRenderFault`, the only measurement
between render and store, imports `sharp` and nothing else and is a greyscale
seam analysis, not a segmenter call. A one-read version exists only by
re-deriving the court's arithmetic on the head box instead of the face box, which
would discard the measurement his eye ratified — so it is not a saving, it is a
different court.

**Latency: ~+11%, about 4 seconds a frame** (render only — the +32% first relayed
was measured through a harness that also ran two segmenter reads and a 5 MB
composite per frame; §10.0 of the court design carries both figures and what each
interval contains). At 8-parallel dispatch the sheet cost is bounded by the
slowest frame, so a few seconds per sheet — **plus the reads**, which is the part
nobody has measured:

⚠ **THE READS RIDE THE COURTESY POOL AND WILL CONTEND.** `FAL_CONCURRENCY` is 5
and a roll dispatches 8 slices at once, so up to 16 reads queue behind a
five-wide door while 8 renders are in flight. **No new fal allowance is declared**
— `assertFalBudget`'s sum stays exactly at the account ceiling of 20, which is
what makes this affordable at all — but the contention is new and its cost is
unmeasured. **The dark rolls measure real per-sheet wall-clock and his feel gets
the last word** (fable-1565's condition, surviving).

**No credit price changes.** A roll costs the customer what it costs today; this
is house money.

---

## 7. ✅ KEEP THE LARGE ORIGINAL — ruled fable-1576 §1

**Ruled: the 1536×2304 original is KEPT.** Four conditions ride with the ruling
and all four are build items:

1. **Same storage guarantees as the delivered frame** — a `crypto.randomUUID()`
   key under the candidate prefix, never a pseudo-random one.
2. **It dies with the cast, PROVEN IN THE SUITE** — not asserted. See the
   correction below for what that costs.
3. ⚠ **It is NEVER served to any surface.** No URL for it leaves the server until
   a future design says otherwise. It is a source, not a picture anyone can
   fetch — and the R2 bucket is public, so *not projected* is the only thing
   between it and a stranger.
4. **The ~5 MB/candidate storage delta is a stated line here, not a discovery.**
   Eight per roll ≈ **+40 MB per roll**, roughly tripling a candidate's storage
   footprint (~2.4 MB delivered + ~0.1 MB thumb + ~5 MB source).

   ✅ **AND HE ASKED THE SCALABILITY QUESTION BEFORE SAYING "run it"** (2026-08-24,
   his word verbatim; relayed fable-1579). The answer he was given, recorded here
   so the next reader does not have to reconstruct it: **the DATABASE holds one
   ~60-byte key per candidate** — the bytes live in R2 under the unconditional
   purge path and die with the cast — which is roughly **$6/month at a
   1000-user scale.**

   ⚠ **The aging-out knob is NAMED AND NOT BUILT.** Originals are a
   CONVENIENCE, never a dependency: nothing in the product reads one, and the
   delivered frame is complete on its own. So if the storage line ever stops
   being worth it, expiring originals older than some age is a POLICY CHANGE on
   this same column — a sweep that nulls the key and queues the object — and
   costs nothing anyone can see except that a re-trim of an old cast becomes a
   re-render again. It is the future lever; it is not on the board.

⚠ **AND THE MANIFEST ENTRY IS UNCONDITIONAL — never gated on
`CASTING_FRAMING_TRIM_SCOPE`.** Every purge block in `candidateRetention.ts` is
written in the same voice: *the flag governs whether it is WRITTEN, nothing
governs whether it is PURGED*, because a flag turned back off after objects exist
must not strand them. This is the fifth such block and it takes the same posture.

**The question as it was put, kept because the reasoning is the ruling's own:**

**Do we KEEP the 1536×2304 original, or discard it once the trim is stored?**

- **Discard** — one object per candidate exactly as today, no storage change, no
  purge change, no migration. **But every later framing change becomes a
  RE-RENDER** (paid, slow, and a different face, because the engine is
  stochastic).
- **Keep** — a second object per candidate, ~5 MB against ~2.4 MB. **Every later
  framing change becomes a RE-TRIM: free, instant, and the same person.**

⚠ **AND KEEP COSTS MORE THAN STORAGE — THIS PARAGRAPH SAID *"under the
candidate's existing purge path"* AND THAT WAS A GUESS, CORRECTED AT THE CODE.**
`candidateRetention.ts` does not sweep by prefix. It builds a manifest from
**enumerated keys**, and a candidate's own line is literally
`[candidate.imageKey, candidate.thumbKey]` — a two-element list. Every other
object class a candidate owns (refinement variants, segments, reference-library
crops and their masks, kept-scan stencils) has its own explicit block collecting
its keys into that manifest, each one written because *"a flag turned back off
after rows exist must not strand them."*

**So KEEP is: a migration adding a column to `casting_candidates`, that column in
every INSERT that writes a candidate, one more entry in the retention manifest,
and the storage** — the well-worn pattern of four existing blocks, but a build
item rather than an inheritance. **An untrimmed original with no manifest entry
would be a photograph of a person at a permanently public URL outliving the cast
it belongs to**, which is precisely the failure every one of those blocks exists
to prevent.

**I recommend KEEP, and the reason is in his own sentence**: *"it gives us more
control over framing"* — and framing is already on his candidate list as a
customer-facing axis (fable-1548, the settings modal §10b). **A customer axis
served by re-trimming a kept master is a slider; served by re-rendering it is a
paid operation with a different face at the end of it.** Discarding the source
forecloses the cheaper product, and the court's own §10 already recorded that a
cut can only ever serve targets tighter than what was rendered.

The cost of being wrong is asymmetric: keeping costs a migration, a manifest line
and storage — all of it reversible — while discarding costs a capability that can
only be recovered by re-rendering every cast, with a different face at the end of
each one.

**I still recommend KEEP with that price attached**, because the price is one
column and one line in a pattern this file already runs four times, and the thing
it buys is the axis he named. But it is now a build item to be countersigned
rather than something that rides along free.

---

## 8. Failure policy — every branch, and none of them charge her twice

| what fails | what happens |
|---|---|
| `face` read returns nothing | deliver UNTRIMMED (plain downscale). She gets her frame; it is not in the common frame. Logged and counted. |
| `head` read returns nothing | trim at `R_house`, and **skip the frame if that would clip** — i.e. treat it as untrimmed. Never guess a gap. |
| either read throws | untrimmed, logged. **A read failure is our problem, not hers.** |
| the frame's share exceeds `T` | untrimmed (§4a). Counted — this is the rate that moves `T`. |
| the crop would UPSCALE | impossible by construction at these sizes, and asserted anyway: a crop shorter than 1536 refuses and the frame goes untrimmed. **No delivered pixel is ever invented.** |
| the trim itself throws | untrimmed, logged. |

**Every branch ends in a delivered frame.** Nothing here creates a refund path,
because nothing here can fail the candidate — the trim is a courtesy on top of a
frame she has already paid for and received, exactly the shape `thumbKey` uses
four lines away.

### 8a. ⚠ THE FIRST ROW OF THAT TABLE SAYS *"plain downscale"* AND THE BUILD DID
### NOT DO IT — found in production on the first flagged sheet (2026-08-24)

**The design specified the right thing and the implementation dropped one word
of it, and no arm in the suite could see the difference.** `applyFramingTrim`'s
`untouched()` returned `input.bytes` — the 1536×2304 RENDER — on every decline,
so a frame the trim declined shipped at 2.25× the area of its sheet-mates.

**The specimens are real and they are his** (roll 209, the first and only sheet
cast under the flag, read at the bytes rather than at a log line):

```
roll 209  candidates 1665..1672
  #1666  delivered 1536x2304   UNTRIMMED   position 1
  #1671  delivered 1536x2304   UNTRIMMED   position 6
  the other six                delivered 1024x1536, kept originals written
```

`output/framing-live-roll-209/STRIP-B-true-scale-roll-209.png` is the picture —
eight tiles at one scale factor, bottom-aligned, and the two stand a head proud
of their own row. **Those two frames are left exactly as they shipped** (ruled
fable-1592 §1): his sheet, already seen, and a retroactive byte-swap of
delivered frames is not a thing this product does.

**Three things this cost, and the third is the lesson:**

1. the feature's own failure mode wearing its clothes — the whole point is a
   sheet that reads as framed alike;
2. everything downstream inherited it, the thumbnail included, since it is built
   from the delivered bytes;
3. ⚠ **`rollService.ts`'s own docblock asserted the opposite** — *"trims it back
   to the delivered size before a byte is stored, so nothing downstream sees a
   different frame"* — which was true of the trimmed path and false of the one
   the sentence was written to reassure about. **The claim was in a comment and
   the fact was in the bytes** (working law 1), and what found it was measuring
   the stored objects rather than re-reading the code that wrote them.

**Fixed the same day**: `untouched()` downscales to `FRAMING_TRIM_DELIVERED`
before returning, the docblock is true of both paths, and — the part that was
actually missing — **the suite gained an arm that can SEE a sheet.** Every arm
before it drove one frame, and the defect was only visible across eight:
`framingTrimStep.test.ts`'s *"delivers every frame of a sheet at ONE size"*
drives eight frames with a reader that trims six and declines two, at positions
1 and 6, which is where his actually fell. Watched failing: with the resize
removed it reddens that arm and the four decline arms, and nothing else.

⚠ **A resize that throws still returns the bytes it was given** — the old
behaviour kept as the LAST resort rather than the first, because a candidate is
never failed by this step.

---

## 9. The flag and the ratchet

**`CASTING_FRAMING_TRIM_SCOPE`** — `off`/absent, `all`, or `users:<ids>`.
Parent: `CASTING_V2_SCOPE`, and nothing narrower — a roll is what it governs.

**Off, and absent means off, the roll road is BYTE-IDENTICAL to today's**: the
size constant is unchanged, `FRAMING_FIXED` carries its current sentence, no read
is bought, no trim runs. That matters more than usual here: *context is not
additive* was measured in this very campaign, so a prompt change that leaks to
unflagged accounts is a change to every cast in the product.

⚠ **This is dark-first's proper subject and 1573 §6's direct-ship ruling does NOT
carry over.** That ruling was for the sentence-only route — one prompt constant,
no code, no per-roll cost — and it dies with that route. This is code on the roll
road plus a per-roll cost change.

**The ratchet: dark → his account → his gate on real sheets → wider.** The gate
is strips, not numbers: cut sheets from his own rolls, beside the raw frames they
came from, and the untrimmed-rate and per-sheet wall-clock beside them.

---

## 10. What proves it, before any of it is believed

- **The trim's arithmetic gets a unit suite with a NEGATIVE control**: a frame
  whose gap exceeds the house `R` must come back with more headroom, and the
  suite must go red if the per-frame `R` is replaced by the house one. A guard
  whose failure mode nobody has watched is not a guard.
- **The untrimmed branches are each driven directly**, not through a model: a
  null face, a null head, a share above `T`, a crop that would upscale. Every one
  must deliver a frame.
- **The thumbnail is asserted to come from the trimmed bytes**, because that is
  the defect that would ship silently.
- **`assertFalBudget` is re-run** and must still sum to the account ceiling.
- **Frames before numbers at every gate.** The court's own instrument
  (`_framing-shipsize-disposable.mts`) already reads `face` and `head` and prints
  a contact strip; the dark-roll reading reuses it rather than growing a second
  reader of the same quantity.

---

## 11. ✅ Countersigned — the four items and how each was ruled

| | ruled |
|---|---|
| **§7** keep or discard the large original | **KEEP**, with four conditions and an unconditional manifest entry |
| **§4a** `T = 22.7%` | **as proposed**, anchored to the strips his eye chose; the untrimmable rate is the dark rolls' first measurement, and **`T` moves on STRIPS ONLY, never arithmetic** |
| **§6** the corrected cost line | **stands** — two reads, +$0.26/roll; contention **named-unmeasured**, and if the dark rolls show it moving the wall clock, his gate is told plainly, because his *"non issue"* was priced against the render delta alone |
| **§9** the flag | **as filed**, with 1573 §6's direct-ship ruling explicitly dead |

**The build order, from here:** dark behind the flag → real sheets on his account
→ **his gate, on strips** → the ratchet. The cost package at his gate carries all
three corrected numbers: **+$0.26 per roll**, **~+11%** render time with its
provenance, and **whatever the dark rolls say contention actually costs.**

### ⚠ 11a. THE SEQUENCE, because §7's column makes the order load-bearing

**Every push deploys.** So a commit that writes a column production does not have
yet is the crash the *migration-before-code* rule is named for, and §7's KEEP
gives this build exactly such a column. The ruled sequencing (fable-1577 §3) is
that the **production ceremony is the last gate before the code that needs it** —
and since the ceremony is the founder's, the build is split so that nothing waits
on him that does not have to:

```
  A  THE WIRE, dark, NO schema dependency
     flag · render size · the clause · the two reads · the trim · the thumbnail
     from the TRIMMED bytes · a counter for every untrimmed reason.
     Safe to deploy the hour it is written: with the flag off the roll road is
     byte-identical to today's, and nothing touches a column.

  B  THE DEV MIGRATION + the card              (pre-authorized / his desk)
     `pnpm db:push` against dev, and the production ceremony carded with its
     one command.

  C  THE PRODUCTION CEREMONY                    ← HIS WORD, the last gate
     the column exists on the service.

  D  THE KEPT ORIGINAL: the column's write + its UNCONDITIONAL manifest entry.
     Deploys only after C.
```

⚠ **AND THE FLAG DOES NOT FLIP BEFORE D.** A dark roll under A alone would trim
its frames and **discard the originals** — which is the one thing KEEP was ruled
to prevent, and it is unrecoverable for those casts except by re-rendering
different faces. The flip is a step after D, not after A, and this sentence is
the only thing standing between the two.

No credit is spent by this document, and the dark rolls price themselves fresh
when they are ordered.
