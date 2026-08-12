# A removal is a slot going vacant, and the recipe says so

**Design, owed before code** (chunk 3 of the compositor swap; fable-284 promoted
it to a FLIP PRECONDITION and asked for a proposal rather than a diff). Shift 57.
Zero credits spent producing it.

## Where this starts

`refineService:2183` — a repaint reaching a removal calls `repaintCannotRemove()`
and throws into the refund. The stated reason is D-244 line 5: *removal strikes
matching words from the library's stack*, "which is not yet derived from the
chain's own pruning". So today the swap can add and change and cannot take away,
and a user who asks for a removal on the repaint road gets her money back
instead of a picture.

## 1. One problem dissolved before this design starts

`stackFor` (`recipeAssembler.ts:328`) implements the strike literally:
`survived.indexOf(strike)`, an exact string match against one element of the
stack, and `removeNotInStack` refuses when it misses. That was always going to be
brittle — fable-284's specific worry was over-striking — and it is now
**unnecessary**.

The current-state ruling (`LIBRARY_SLOT_WORDS_DESIGN.md`) makes a slot's words
ONE sentence read from the delivered frame, replacing rather than appending. The
immortal bun — *"tight curls piled into a high bun"*, carried forever — was
immortal because the stack ACCUMULATED. Nothing accumulates now, so **there is
nothing left to strike**. The dev receipt shows it:
`["auburn","worn up in a loose bun","a soft fringe"]` → one current sentence.

**A removal therefore needs no prose surgery at all.** It needs the slot to stop
carrying. `Ask.remove` and the `removeNotInStack` refusal become dead weight the
flip pass can delete (filed in the checklist, not deleted here).

## 2. The rule

> **A removal is a slot declared VACANT for this render: it is neither asked nor
> carried, the recipe states the absence in the slot's own words, and the
> library retires the slot's crop only when the delivered frame agrees.**

Three parts, and each is a different file.

## 3. The recipe — `vacate`, and why silence is not enough

A new ask shape, replacing `remove`:

```ts
type Ask = { slot: FeatureSlot; noun?: string; words?: string; vacate?: true };
```

`vacate` puts the slot in `editedSet`, so its crop never rides (the carry loop
already skips edited slots — no change there). Its word stack becomes empty. And
then the part that cannot be skipped:

**A vacated slot must SAY the absence.** Dropping the words and the crop leaves
the recipe silent about the feature, and the master is reference 1 — so a
born-worn item (her own glasses, in the master by definition) is repainted right
back onto her face by the very instruction that was supposed to remove it. D-244
§3 already draws this line for anchors; it applies to absence the same way:

| what she is removing | dropping the crop | what else is needed |
|---|---|---|
| an INTRODUCED item (a tattoo, added earrings) | drops its anchor too | the absence sentence, so the master's bare site is not overpainted from words |
| a BORN-WORN item (her own glasses, in the master) | nothing to drop | **the absence sentence is the whole removal** |

The sentence is **derived from the slot catalogue, never authored per ask** —
the same law that governs `describe()` (fable-195: derived at emission, never
authored beside it, because a derived sentence has nowhere to diverge to). Each
accessory kind gains one `vacantPhrase` beside the vocabulary it already owns in
`LANDMARK_OF_ACCESSORY`: *"no earrings — bare earlobes"*, *"no glasses — her
face uncovered"*. It is a STATE, not an instruction, so it passes
`IMPERATIVE_OPENER` by construction rather than by care.

Two refusals need amending, both narrowly and both for the same reason — they
were written when an empty stack could only mean a mistake:

- `emptyWordStack` (an empty stack with no anchor) must permit a vacate, and
  must go on refusing everything else. A vacate IS an empty stack with a
  sentence; today's message — *"would regenerate from the master with nothing
  said about it"* — is exactly right about every other caller.
- `nothingAsked` in `repaintAsksFor` stays as it is: a vacate is an ask.

## 4. The mint — which signal carries a departure, and the answer is neither of them

`captionSlot` answers `visible: false` for two different worlds, and the words
design named this as the edge chunk 3 must settle:

| what happened | the reader says |
|---|---|
| the thing is GONE — she took the glasses off | `visible: false` |
| the crop is too dark to read | `visible: false` |

The mint separates them one level up already — `noCut` (no region was found at
all) versus `readFailedSoft` (a region was found and the read came back empty,
`referenceMint.ts:628`). It is tempting to rule that `noCut` carries the
departure. **It must not**, and this is the proposal's one real decision:

> **A departure is carried by the RECIPE's vacate list, never by the reader's
> silence. The reader can only CONFIRM a departure; it can never originate one.**

The reason is finding 4 wearing a new hat. `noCut` on an untouched slot has at
least three causes with no departure in them — the segmenter missed, the slot
has no question, the crop is dark — and a library that retires a crop on that
signal deletes her earrings because a render came out shadowy. Made structural:
**nothing retires that this render did not ask to vacate.** A slot nobody
mentioned is not a candidate however loudly the reader shrugs.

So, per vacated slot, at mint:

| vacated | delivered frame says | outcome |
|---|---|---|
| yes | absent (`noCut` or `visible:false`) | **retire the carry**, file no words. The slot goes quiet. |
| yes | still present | the removal **did not land** — D-246 (c)'s own mirror: the asked thing is completely un-done. Refuse into the refund; the library is left exactly as it was. |
| no | absent / unreadable | **nothing happens** — today's behaviour, byte for byte. |

Row 2 is worth stating plainly because it is the failure a "just retire it"
design hides: retiring the crop of a thing that is still on her face would file a
LIE about the picture she was charged for, and would do it precisely on the
render that failed her.

"Retire the carry" is the store's own mechanic (`retiredAt`), not a new one —
`liveReferences` stops returning the row, `deriveLibrary` stops building a
`carry` for the slot, and the next recipe carries nothing for it. No deletion, no
string surgery, and the history stays readable.

## 5. What proves it, and both ways every time

Every claim above is a null result in one direction, so each gets a fixture that
could have produced the other (the campaign's own instrument law):

1. **An unreadable crop does NOT retire.** A slot nobody vacated, reader
   answering `visible:false` on a black cutout — the founding specimen
   `earring-left-v141.png` is on disk and is exactly this. Assert the row is
   still live afterwards. *This is the test that fails if anyone later "tidies"
   §4's rule into reading the shrug.*
2. **A real removal DOES retire.** Vacated slot, reader finding nothing —
   assert the carry is retired and the next assembled recipe carries no crop for
   the slot.
3. **A removal that did not land REFUSES.** Vacated slot, reader still seeing
   the thing — assert the refund path, and assert the library is byte-identical
   to before the render.
4. **A born-worn removal says the absence at the wire.** Assert on the
   OUTGOING recipe (invariant: assert at the wire) that the vacated slot's
   sentence is present, so a future refactor cannot silently drop the one clause
   the master would otherwise overpaint.
5. **A vacate carries no crop for its own slot.** The existing carry-loop
   behaviour, pinned against the new ask shape.

## 6. What this does not do

- **It does not touch the chain-prune road.** `refineRemoval` keeps serving the
  old compositor exactly as it does today; the vacate ask is derived from the
  same removal arithmetic that already resolves the subject and the departure's
  home, so there is ONE reading of what she asked for and two ways of painting
  it. (Working law 4: derive, never mirror.)
- **It does not add a detector.** Row 2 of §4's table is D-246 (c) read in the
  mirror, using the reader the mint already pays for. No new instrument, no new
  vision call.
- **It does not settle open-vocabulary removals** — a kind with no catalogue
  entry has no `vacantPhrase`, so it refuses at `uncatalogued` exactly as it
  does now. Roadmap §5 is where that opens, and it will arrive with its own
  vocabulary rather than by loosening this door.

## 7. The cost

One vision call per vacated slot at mint — the read the mint already makes for
every filed slot, so **no new call**. No credits beyond the render itself. The
refusal path costs nothing, as it does today.
