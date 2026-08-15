# Naming the read stage — the purpose label design note

**Ordered:** fable-657 §2 — *"BUILD IT — note first, per your own cited
precedent. A short design note (the slot-count note's shape): the closed purpose
list, the ~dozen call sites named, and THE BOUNDARY AS A TEST."*

**Status:** the note. No code, no diff.

---

## 1. The hole, measured

Read off 56 dev renders and 4 production ones (`scripts/call-census-report.mts`,
`ce11e3de`), zero credits:

```
                    calls   share of the render's own seconds
segment (SAM 3)       294   21.8%   — every call names its question
read    (Sonnet 5)    352   21.3%   — no call names anything
```

The segment stage can be optimised because `eye 2.43/render · earring 1.39 ·
face 0.59` tells you where to look. The read stage is the same size and is one
undifferentiated word: `openrouterText` records `{stage, provider, model}` and
nothing else, so an interpreter ask, a verification reading, a caption and a
refusal door are the same row.

**This is not a reporting gap, it is a collection gap.** The segment half was
"collected, never asserted" and cost one column to fix. This half was never
collected.

## 2. The fact that decides the design: one function, seven purposes

`refineInterpreter.runOnce` is the single door every refine text call goes
through, and it is invoked from seven places:

```
:670   the first ask               interpret
:700   the echo pass               re-ask, their words echoed back
:789   the prior-withheld re-read  the prior-context door
:860   the colour-withheld re-read the colour door  ← the saga's own door
:934   the vouched read            re-ask with the claim vouched
:1154  the hybrid read             re-ask as a compound
:1187  the re-look                 the re-look
```

So **the purpose is a property of why the call was made, never of which
function made it.** It cannot be derived at the transport, and any scheme that
infers it from the prompt is the content-in-telemetry mistake wearing a
different hat. It has to be passed.

That population is exactly the one the last three shifts measured. The colour
door fires 21 times in 360 attempts and rescues 16; **nobody knows what those
21 re-asks cost**, because they are filed as the same word as the ask they
follow.

## 3. The closed list, derived from the ten call sites and not invented

```
interpret   the first ask of a customer's sentence
            interpreter.ts:489 · refineInterpreter.ts:670
reask       a second ask with something deliberately withheld — one member per
            door, because attributing the doors is the point
            reask.echo :700 · reask.prior :789 · reask.colour :860
            reask.vouched :934 · reask.hybrid :1154 · reask.relook :1187
verify      a reading that judges a delivered picture
            renderVerification.ts:665 · viewConformance.ts:187
caption     a reading that describes a picture for the record
            realizationCaption.ts:234 · :321 · presentationState.ts:139
describe    the describer, the scan's own reader — faceDescribe.ts:257
classify    a kind/key decision — openLaneKind.ts:198
gate        a yes/no door that is not a re-ask — refineInterpreter.ts:983
            (`asksNothingOfItsOwn`, the invention door)
```

Twelve members over ten call sites, plus the seven `runOnce` callers.

## 4. It fills the field that already exists

`ProviderCall.about` is already there, already persisted on the row, already
summed by the report's question table, and already documented as *"a region
name, never their prose"*. The read stage simply leaves it empty.

**So this adds no field and no schema change.** `TextRequest` gains
`about?: ReadPurpose`; `openrouterText.complete` passes it into the
`throughCensus` call it already makes; the report's BY QUESTION table starts
covering both stages the day it lands, with no change to the reader.

A second field beside `about` would be working law 4 — a parallel copy of a
fact that already has a home.

## 5. THE BOUNDARY, AS A TEST (fable-657's requirement)

The danger is precise and it is not hypothetical: a customer's sentence reaching
a telemetry field. Three layers, and the first is the real one.

```
TYPE      `about?: ReadPurpose`, a string-literal union. A customer's sentence
          is a compile error, not a policy anybody has to remember. This is the
          layer that actually holds.
TEST      drive a census over the real call sites and assert every read-stage
          `about` is a member of the frozen set — the enumeration is pinned, so
          a new call site with a new word REDDENS rather than lands quietly.
CONTROL   and the negative half, without which the test cannot fail: a call
          recording a non-member must make that test fail. Asserted by driving
          the recorder directly, not through a model.
```

The third line is working law 2 and it is the one that gets skipped. A test that
only ever sees valid members proves nothing about a checker.

## 6. What this does NOT do

- **It does not record tokens**, so it still cannot produce money. Sonnet 5 is
  token-priced and the census counts calls and milliseconds. Naming the reads is
  what makes a token column worth adding later; it is not that column.
- **It does not change any behaviour.** Nothing branches on the label. If every
  one of them were wrong, the product would deliver exactly what it delivers
  today — which is why the risk here is the telemetry boundary and not the
  paint.
- **It does not touch the segment stage**, which already names its questions
  through `aboutOf`.

## 7. What it costs

Twelve call sites touched on the paid path, one optional field, one union type,
one test with its negative control. No migration, no flag, no provider change.

The thing it buys is the ability to answer *"what is the 21%?"* with a query
instead of a special run — which is the same sentence this census exists to make
true, one stage over.
