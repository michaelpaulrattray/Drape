# The panel STATES a finding of nothing — executing fable-889's founder ruling

> **Status: ✅ BUILT (shift 83, 2026-08-17 — the as-built note below; re-verified at the code 2026-08-28, #69).** `absentSlotsOf` lives in `server/castingV2/faceScanService.ts` and `whenAbsent` in `referenceSlotCatalogue.ts` / `facePanel.ts`, exactly as the note records.


*Written 2026-08-17, shift 82, opus-654. **Nothing here is built.** Source reads
only — no render, no call, no credit. The ruling is the founder's and this note
executes it; the one thing it decides on its own is which features may hold such
a state, and it decides that conservatively and says why.*

> ## ✅ BUILT — shift 83, 2026-08-17
>
> Shipped as designed: `whenAbsent` on the catalogue (hair → *"bald"*, facial
> hair → *"clean-shaven"*, each carrying its reason), `PanelScan.absent` derived
> in `panelScanOf` from the scan's own `empty`, `PanelRow.absent` on the panel,
> and one line in the browser. §7's two opens were answered by **fable-893
> ruling 3** — the row is CLICKABLE (yes), and hair states ONE consolidated
> row (yes, and it needed no work: the catalogue has a single `hair` slot, so
> the "three word rows" the question feared do not exist — its facets share one
> row already).
>
> **§5's control ran BEFORE the word reached any screen**, off 14 production
> readings in `casting_face_scans` — no segmenter call, no credit — and **every
> frame was opened by eye rather than taken from the reader's prose** (law 9):
>
> | arm | reading | verified |
> |---|---|---|
> | POSITIVE | 8 of 8 haired readings returned a hair REGION | 2 opened, incl. a close-cropped grey buzz cut — the nearest thing to bald that still has hair |
> | NEGATIVE | 6 of 6 empty readings are visibly bald | all 6 opened; every one a bald man from his cyborg roll |
>
> Facial hair was answered by the same pass: FOUND on 5 visibly bearded faces,
> EMPTY on the clean-shaven and the female ones.
>
> **And it was rendered before it shipped** (working law 6). The dev world had
> no bald face — all sixteen ready candidates were opened as a contact sheet and
> every one has hair — so one of his own bald production masters was copied into
> the dev bucket as a fixture cast, scanned live by the real reader on house
> money, and photographed: `output/bald-control-2026-08-17/panel-bald-row.png`
> shows **Hair · bald** and **Facial hair · clean-shaven** beside the man they
> are true of, settled and tappable. The fixture's rows were removed afterwards
> by the ids the seeder printed.
>
> **Both themes are on the record** (fable-894 §3): `panel-bald-row-light.png`
> beside the default dark one. The stated absence takes the same treatment as
> every other row's words in each — which is the point, since a state drawn
> more faintly than a description would read as *"we could not read this"*.

> **FOUNDER RULING, fable-889** — asked whether hair should appear on his bald
> cyborg cast or only once asked for: **"yes show bald"**.
>
> A scanned feature whose honest finding is a NONE-state shows its row with that
> state named — hair: *"bald"* — rather than disappearing. Generalizes to any
> catalogued feature with a legitimate none (clean-shaven, no makeup).
>
> **Scope note, verbatim:** distinguish *"scan found none"* (show the state)
> from *"scan did not run / failed"* (show nothing or the loading state, as
> today). **Do not invent none-states for features the scan cannot honestly
> assert none about.**

Grounds already on the record: law 8 (a stylist's ontology — bald is a look, not
an absence) and the absence-vs-zero discipline arriving in the UI, where three
different facts must not share one blank.

---

## 1. THE BLOCKER, and it is one line

The panel cannot obey this ruling today, and not because of how it draws — the
fact never reaches it.

```ts
// faceScanService.ts:639
export function panelScanOf(scan: ScannedFace): PanelScan {
  return { frameUrl: scan.frameUrl, slots: scan.slots, words: scan.words };
}
```

`ScannedFace` carries `empty`, `failed`, `asked` and `found`. **The panel's view
carries none of them.** So a row with no entry in `slots` is, from the panel's
side, exactly one thing — nothing — whether the scan asked and got a clean
nothing, asked and errored, or never ran.

That is invariant 8's shape (a read path returns an explicit projection) working
correctly and excluding a field it now needs. **The fix is to widen the
projection deliberately, not to hand the panel the whole scan.**

And half the machinery is already there: `scanProgressOf` returns `done`, whose
own docblock says why it exists — *"one draws an empty row as absent, the other
as still coming."* The panel can already tell FINISHED from STILL-COMING. What
it cannot tell is FOUND-NOTHING from COULD-NOT-LOOK.

## 2. Three states, and the ruling is about the third

| the panel shows | when |
|---|---|
| **the row, with her feature** | the scan found it — today's behaviour, unchanged |
| **nothing, or the loading state** | the scan is still running (`done: false`), errored for that question, or never ran |
| **the row, stating the finding** | the scan finished, asked this question, and got a clean nothing — **and the feature is one where nothing is an honest answer** |

The last clause is the whole of the risk, and it is §3.

## 3. WHICH FEATURES MAY HOLD ONE — and most may not

`empty` is not a synonym for absent. The scan's own header says so, about the
bilateral summary, and it is the sharpest sentence in the module:

> *"`-` is a side that was asked about and answered nothing, which is an honest
> answer on a face with **an ear behind her hair** and a finding on a face
> looking straight at the camera."*

**One field, two facts.** An empty ear read means *she has no ear* or *I could
not see it*, and which one depends on the pose and the hair — neither of which
the scan knows. Painting *"ears: none"* onto a face turned three-quarters is the
product asserting something false, in the founder's face chart, from a blank.

So the rule for admitting a feature is: **absence must not be confounded with
occlusion or framing.**

| feature | may state a finding? | why |
|---|---|---|
| **hair** | **YES** — *"bald"* | the crown is in frame on every casting framing this product produces, and hair is not something another feature hides. An empty read is bald or broken, never hidden. This is the founder's own case |
| **facial hair** | **YES** — *"clean-shaven"* | the same argument: the jaw is in frame, nothing occludes it, and clean-shaven is a look a stylist names |
| makeup, if the scan ever asks it | probably, *"no makeup"* | named here because the ruling names it; the scan does not ask it today, so it is not admitted by this note |
| ears, eyes, lashes, brows | **NO** | bilateral and routinely occluded by hair or pose. The confound above is theirs |
| nose, lips, teeth | **NO** | nothing to state — a face has them, so an empty read is a reader failure and saying *"nose: none"* would be a bug wearing a caption |
| glasses and the born-worn classes | **NO, separately** | absence there is already a modelled fact with its own machinery; a second path to it is working law 4's parallel copy |

**Admission is stated per slot in the catalogue, never derived**, and defaults to
absent. A feature is admitted by somebody deciding it, in writing, next to the
reason — which is the same discipline `group` and `guardKind` already follow.

## 4. The naming, and a collision worth avoiding

`SlotDefinition.panel` is already a union with a `{ row: "none"; why }` member,
and it means **draw no row at all** — the exact opposite of what this ruling
asks for. Two different meanings of "none" one field apart would be read wrong
inside a month.

So the new field is **`whenAbsent`**, and it says what the row says:

```ts
/** What this row states when the scan asked and found nothing. Absent for
 *  every slot where an empty read is confounded with occlusion — see §3. */
whenAbsent?: { says: string };   //  hair → { says: "bald" }
```

`panel.row` keeps its meaning untouched. A slot with `row: "none"` draws nothing
and can never reach this, which is consistent rather than a special case.

## 5. THE CONTROL — because "bald" is a claim about a picture

Law 9 and working law 2 both land here: *"bald"* is not a UI state, it is an
assertion about the founder's photograph derived from a reader answering
nothing. An instrument gets a negative and a positive control before its
verdicts count.

```
POSITIVE   a haired face must return a hair region        the scan's own daily
                                                          traffic already carries
                                                          this; read it back
                                                          rather than re-buying it
NEGATIVE   a visibly bald face must return EMPTY for      his cyborg cast is the
           hair — not a confident patch of scalp          specimen, and it is why
                                                          the ruling exists
```

This is the horns absence court's shape, and that court passed on a real kind:
*0.0000% on three visibly bare frames against 0.39–0.87% on twelve worn ones.*
So this is a generalisation of a measured procedure, not a new idea.

**The bound: the control runs before the words ship, not after.** If a bald
frame returns a confident scalp region rather than nothing, then `empty` does not
mean bald on this instrument and the honest answer is to show nothing and say so
— exactly as `OPEN_KIND_PROPERTIES_DESIGN` §4 stops rather than shipping a
counter that agrees with the recipe.

**Cheap, and it is house money**: the scan already runs on every selection, so
the negative control is one look at his cast with the scan's `empty` list
printed. No new call.

## 6. What this does not touch

- **The library.** A stated absence is panel furniture, like the rest of the
  scan's output. It mints nothing, files nothing, and no recipe reads it.
  fable-360 ruling 5 governs and is unchanged.
- **The recipe.** *"bald"* on the panel is not a delta, not an ask, and must not
  become one by being visible. A customer who wants her bald asks for it.
- **The scan's questions.** No new region, no extra call — the fact is already
  in `empty` and is being thrown away one function later.

## 7. Open, and named rather than assumed — BOTH ANSWERED (fable-893 ruling 3)

1. ~~**Whether a stated absence is CLICKABLE like a filled row.**~~ **YES.** The
   founder's own grounds — *"the row is the click target"* — were half the
   reason the ruling exists, and a stated *"bald"* that invites *"give him a
   mohawk"* is the row doing its job. Built: the row carries its slot and its
   prefill like every other, and the drive read `tappable=true` on it.
2. ~~**Whether the words row and the picture row differ.**~~ **ONE row**, and it
   cost nothing: the catalogue has a single `hair` slot whose facets are
   `hair.cut`, `hair.colour`, `hair.texture`, `hairFinish` and `hairWorn`, so
   the three word rows this question feared were never three rows. One *"bald"*
   states the state; the words return the moment there is hair to describe,
   because they are the same row's `words`.

## 8. What the build left standing, said plainly

- **A stated absence is the one row admitted without a rectangle**, which is a
  deliberate exception to fable-414 and is written at `hasContent` where the
  rule lives. A bald head has nothing to point at, and the row is not offering
  a picture of his hair — it is telling him there is none.
- **The third fact is RULED, and the answer is that it stays server-side**
  (fable-894 §2, on this note's own question). A question that FAILED renders as
  the row **absent** — today's behaviour for everything — never as a none-state
  word and never as a perpetual still-coming. Two grounds, and the first is the
  law: *a broken reader may never produce "bald"*, because the none-words are
  claims about his photograph and an errored read has no standing to make one.
  The second is the product: *"our reader fell over"* is noise in a visual
  studio — the heal and re-ask machinery owns recovery, the logs own diagnosis.
  So `failed` stops at `panelScanOf` deliberately, and the projection excludes
  it from `absent` for exactly that reason. Founder-overrulable if he ever wants
  visible degraded states.
