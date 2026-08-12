# A slot's words are the state of the object at that site

**Design, owed before code** (fable-285 §shape, fable-286 rulings 2–4). One page.
Shift 56. Zero credits spent producing it.

## The defect, in one sentence

The library derives a slot's words from FACET captions read against the whole
frame, so an earring slot's words are a sentence about everything she is
wearing — and because captions are carried across renders, one row can hold two
captions that contradict each other.

Three consequences, all read off production rows tonight (world declared,
`hayabusa.proxy.rlwy.net:23768`):

| # | what | live where |
|---|---|---|
| 1 | an earring slot's words name her GLASSES | 7 of the 10 selectable versions |
| 2 | one hair row holds copper AND auburn-brown | v#174, v#175 (cand 1600) |
| 3 | a vocabulary DEFINITION filed as her hair's state | v#168, v#169, v#170 |

**The class** (working law 7): *a caption written about the FRAME, filed as the
state of a SLOT.* Wider in KIND (it names glasses) and wider in INSTANCE (it
names both ears) at once.

## The rule

> **A slot's words are the CURRENT STATE of the object at THAT SITE, read at
> mint from the narrowest view that certainly contains it and nothing it could
> be confused with.**

One sentence per slot. The newest read REPLACES; nothing appends and nothing is
carried from an earlier render (fable-286 ruling 2).

## 1. Where the words come from — the read, and its price

Today `mintedSlotsForRender` builds `words` by mapping every facet of the slot
through `captionWording(captions[facet])`. Those captions were read against a
facet-wide question on the whole frame, and `capturedCaptions` spreads the
INHERITED ones, so v1's colour caption sits in v2's row beside v2's cut caption.
That is the pile, and it is the whole of defects 2 and 3.

Replaced by **one read per filed slot at mint**, asked of:

| slot | a cut this render? | words read from |
|---|---|---|
| accessory (always per-instance) | yes | **the cut** |
| accessory | no | **nothing** — the previous version keeps carrying |
| anatomy, one of it, has a question | yes | the cut |
| anatomy, one of it, no question (jaw, skin, teeth) | never | the delivered **frame**, asked by the slot's noun |
| anatomy, per-side, has a question (eye, ear, brow…) | yes | the cut |
| anatomy, per-side, has a question | no | nothing — previous version carries |
| anatomy, per-side, NO question (lashes, cheekbone) | never | the frame, filed on both instances — **latent, see §6** |

**Why the CUT and not the site on the frame.** A crop of her left earlobe cannot
be described as glasses, because the glasses are not in the pixels handed over.
That is structural rather than remembered — *ask what cannot be answered wrong*.
A frame read with the site named in words is the read we already have, and it is
the one that wrote "plus dark tortoiseshell cat-eye glasses" into an earring row
four times.

**The cut exists more often than a stored crop does.** `cutSegments` runs before
the completeness guard, so a slot the guard REFUSES (`brokenOutline`,
`disputedDelivery`) still has a cut to read. Production row #7 is exactly that
case: `crop=0`, clean words. Reading the cut rather than the stored crop is what
keeps a clean cropless render able to supersede a dirty older row.

**Anatomy with no question may use the frame; an accessory may never.** "Her
jaw" names one thing on a face and there is no second jaw to confuse it with.
`statedAccessories` is one facet over every kind of object a face can wear —
naming the site in the question does not narrow what comes back.

**Price: one vision call per filed slot at mint.** A refine files 1–3 slots, so
+1 to +3 calls per render, beside the guard's existing one per cuttable slot and
the repaint's ground read. Counted and named in the mint's log line
(`wordReads`), like `groundReads` and `disputedReads` before it.

**The cheaper variant I am not proposing:** fix accessories only, and leave
anatomy taking facet captions. It is ~1 call cheaper per render and it leaves
fable-286 ruling 2 unimplemented — the copper-vs-auburn row is anatomy, and
"newest replaces" is only true by construction if the words come from one read
of one frame.

**A free consequence:** a PIN can no longer reach a library row. Defect 3 is
`hairWorn`'s pin wording — a vocabulary definition, not a description of her
hair — and under this rule words come from a read of a delivered frame, which a
pin is not.

## 2. The write door refuses cross-kind words

`recordReferenceRows` REFUSES an accessory-slot row whose words name a
catalogued accessory kind that is not this slot's own. The token lists come from
`LANDMARK_OF_ACCESSORY.words` — the same table the kind is derived from, never a
second list (working law 4).

- `earring@left` + "glasses" / "spectacles" / "sunglasses" / "eyewear" / "frames"
  → refusal.
- `earring@left` + "hoop" / "stud" / "drop" → its own kind, fine.
- Refusal throws, like the existing surface refusal. The mint's catch already
  keeps the delivered picture and logs; a render never fails over this.

**Pair claims: a narrow ban, not a broad one.** fable-285 bans pair claims
because mismatched pairs are the founder's ruled feature. But *"a dangling gold
cross charm hanging from each hoop"* — production rows #7/#8/#15/#16 — is the
CLEAN wording, and "each hoop" is about one hoop's own charms. So the refusal
list is only phrases that cannot describe a single site: `both ears`,
`each ear`, `both earlobes`, `each earlobe`, `matching pair`, `both eyes`. A
broader matcher would refuse the four rows this change exists to produce.

**Driven both ways**, with the six live production sentences as the negative
specimens and the four clean ones as the positive controls. A guard whose
negative control cannot fail is not a guard (working law 2).

## 3. The grammar join

`"…at both earlobes., small gold hoop earrings"` and, on the panel tonight,
`"…piled into a high bun., in a bun — gathered and…"`. A stored caption ends in
a full stop and `words.join(", ")` puts a comma after it.

Fixed at the **write door**: terminal `.`/`,`/`;` stripped from each word before
the row is stored, so the stack is stored clean and all four emission sites
(`recipeAssembler` ×3, `FacePanel.tsx:136`) stay a plain join. One place decides
the row's shape, which is where the row's shape belongs.

## 4. The prompt-shape test

The disposable that found this (`repaint-prompt-preview-disposable.mts`)
graduates into the suite, per fable-285: live-shaped library rows → real
`deriveLibrary` → real `repaintAsksFor` → real `assembleRecipe`, asserting that
**no accessory slot's emitted sentence names a kind outside that slot**, and
that no emitted stack contains `., `. Structural tests could not see this
because every one of them asserts shape and none of them read the prose.

## 5. Superseding the production rows

16 rows, 2 faces, one owner (user 1). Every glasses-bearing row is reachable:
selecting v#166–169 or v#172–174 puts one on the panel.

**Method: run the FIXED mint against each row's stored delivered frame.** Reads
only — no render, no credit, no new frame. The repaint's `readGround` reader
supplies the ground the stored frame never carried, exactly as chunk 2 built it.
Old rows retire by the library's own versioning; nothing is edited in place.

Using the real mint rather than a words-only patch script is deliberate: it is
one implementation, and the supersession doubles as the first live proof that
the fix produces correct words on real data.

**Price: ~3 vision calls per row (ground + guard + words) × 16 ≈ 48 calls, zero
credits, zero renders.** To be run on DEV first and proven there.

**The production run WRITES to the production database** (new rows, old rows
retired). That is not a migration and it is the founder's own account, but it is
a production data mutation, so I am not doing it on my own authority: I will
bring the dev proof and ask for an explicit go.

**Verified before running, not assumed:** that each variant's delivered frame is
still present in storage. A missing frame means that row cannot be superseded
and is stated rather than skipped silently.

## 6. Filed with a trigger: the per-side anatomy instance half

`lashes`, `cheekbone`, `brow` are per-side slots the region vocabulary has no
question for, so they never cut and their words must come from the frame — filed
identically on both instances. That is defect 1's instance half, still latent.

It is latent rather than active because a frame read for "her brows" describes
one thing a face has one arrangement of, where a frame read for "her earring"
describes two objects and a third kind.

**Trigger:** the day a per-side anatomy kind acquires a segmentation question or
a completeness specimen, it starts cutting, and this rule's table already routes
it to its own cut. Open-vocabulary regions (roadmap §5) is the same trigger.

## What this hands chunk 3 — one problem dissolved, one created

Chunk 3 is removal under the library, and D-244 describes it as *strike matching
words from the stack*. `stackFor` implements that literally
(`recipeAssembler.ts:328`): `survived.indexOf(strike)`, an exact match against
one array element. Removal refuses outright today
(`repaintCannotRemove`), which is why none of this has bitten yet.

**The current-state ruling dissolves most of the problem before chunk 3 starts.**
The immortal bun — production row #5's *"tight curls piled into a high bun"*,
carried forever — was immortal because the stack ACCUMULATED. It cannot be now:
a later render's read of the hair slot returns one sentence about the hair on
the frame that landed, and that sentence REPLACES. The dev receipt shows it
working (`["auburn","worn up in a loose bun","a soft fringe"]` → one current
sentence). There is nothing left to strike, because nothing accumulates.

So a removal does not need string surgery at all. It needs the slot to stop
carrying: the glasses come off, the next read of the `glasses` slot finds no
glasses, the slot files nothing and its crop stops riding. **Removal proved by
the same read that files everything else**, rather than by matching prose — and
prose-matching was always going to over-strike, which is the specific worry
fable-284 raised.

**And here is the edge this design creates, which chunk 3 must settle.**
`captionSlot` now answers `visible: false`, and that one answer currently means
two different things:

| what happened | what the reader says |
|---|---|
| the thing is GONE — she took the glasses off | `visible: false` |
| the crop is too dark to read — production earring cutouts | `visible: false` |

Both file nothing, which is right for now and wrong for a removal: a departure
must retire the slot's crop, and an unreadable crop must leave it exactly where
it is. Told apart wrongly, a dark crop reads as a removal (her earrings vanish
from the library) or a removal reads as a dark crop (the thing she paid to take
off keeps riding — finding 4 again).

The distinction is available and is not being asked for: the reader is looking at
a crop cut from a REGION the segmenter found. *No region found at all* is a
different signal from *a region found whose pixels are unreadable*, and the mint
already has the first (`noCut`). Chunk 3's design should state which of those
carries a departure, and prove it both ways — an unreadable crop that must NOT
retire, and a real removal that must.

## Order of work

1. This design ratified.
2. Build §1 + §2 + §3, with §4's test, behind nothing — it is a fix to what the
   live mint writes, and it ships on its own merits.
3. Dev supersession run (§5), proven.
4. Production supersession, on an explicit go.
5. Then the dark proof, tiles, chunk 3's design, the five-ask proof, the flip.
