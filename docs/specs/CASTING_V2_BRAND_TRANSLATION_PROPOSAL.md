# Brand translation — the C7 descendant

**Status: APPROVED FOR BUILD, sequenced behind the review-hardening batch
(founder ruling 2026-08-01). Nothing built yet.**

Requested as a design-before-build; the rulings that settled it are recorded in
§9, and this document is now the build spec.

---

## 1. What the founder reported

> "The miu-miu finding — brand references scrubbed but never translated."

Right in effect. Wrong in mechanism, and the difference matters for what to
build.

## 2. What actually happens, measured

Live interpreter, current production code, four brand briefs:

| brief | `role` | `archetype` | `look` | brand token survived? |
|---|---|---|---|---|
| "a miu miu campaign model" | "campaign model" | **null** | **null** | no |
| "a Margiela runway face, early 20s" | "runway model" | null | "severe minimal" | no |
| "a young male Mediterranean model inspired by versace editorial" | "editorial model" | null | "commanding glamour" | no |

Three things follow, and only the third is a problem.

**The scrub is not deleting anything.** The interpreter never writes the house
name in the first place — it is already following the instruction added after
the Versace incident. `scrubBrands` runs and finds nothing. The safety half of
this works, and **it must not be touched**: a trademark reaching the image
provider cost a real roll five of eight candidates.

**Sometimes the aesthetic partially lands.** Margiela → "severe minimal",
Versace → "commanding glamour". Those are decent captures by the `look` shelf.

**Sometimes it lands nowhere.** Miu Miu → role "campaign model", archetype
null, look null. The reference is simply gone. Nothing in the sheet knows the
user said Miu Miu, and the sheet they get is indistinguishable from one that
said "campaign model".

That last row is the whole bug. It is C7's problem statement almost verbatim —
legacy warned about *"snapping an unusual house to the nearest of eight and
losing the reference"* — except V2 does not even snap. It drops.

The port audit already called this: C7 is recorded as **"deliberately dropped —
scheduled"**, with the replacement named as *"the archetype-composition path…
the interpreter composes a thesis and anti-pattern in the archetype grammar when
no shelf entry fits."* This proposal is that scheduled item.

## 3. Why the shelf cannot just be extended

The obvious cheap fix — add "quirky prep subversion" and a few more entries to
`ARCHETYPES` — fails for a structural reason. There is no finite shelf of
houses. Every added entry narrows the gap without closing it, and each one is a
permanent maintenance and taste liability. C7 exists precisely because a closed
enum cannot hold an open set.

## 4. Design principles

**P1. The token never reaches the image model.** Non-negotiable, unchanged.
`scrubBrands` stays exactly as it is, as the backstop for the interpreter's
tendency rather than guarantee.

**P2. No brand dictionary in the repository.** We will not ship a map of
"what Miu Miu looks like". Two reasons, and the second is the load-bearing one:
it rots, and it commits *us* to published claims about a trademark's aesthetic.
The translation happens at interpretation time, from the interpreter's own
knowledge of the world; the repo carries only the refusal list and the grammar
that receives the answer.

**P3. Translate the CASTING, not the brand.** The output is never "Miu Miu
looks like X". It is "this brief is asking for a casting with these facial and
bearing qualities" — our vocabulary, describing a person, in the same grammar
our own shelf uses.

**P4. Face, hair and bearing only.** No garments, no accessories, no makeup, no
setting. This is C6's ratified rule and the wardrobe constant depends on it: the
frame is a plain grey tee on seamless paper, so a direction that describes
clothing is a direction that will be ignored at best and fought at worst.

**P5. It is prose from a language model, so it gets the prose treatment.**
Capped, scrubbed, and positioned before the code-owned constant, which retains
override authority. Same containment as `role` and `characterNotes` — the two
fields this type system already treats as the honest weak point.

## 5. The proposed change

### 5.1 Wire contract

One new optional field on `CastingIntent`, in the **archetype grammar** rather
than free prose:

```
"composedDirection": { "thesis": string, "avoid": string } | null
```

Returned **only** when the brief names an aesthetic reference that no shelf
`archetype` fits. If a shelf entry fits, the interpreter fills `archetype` as
today and leaves this null — the shelf stays the preferred path, because a
reviewed constant beats generated prose every time.

Structured rather than a single string on purpose: `thesis` and `avoid` are the
shape our own `ARCHETYPES` entries already use, which makes the output
reviewable, gives it an obvious slot in the prompt, and means the anti-pattern —
the half that stops "editorial" collapsing into generic gloss — is a required
field rather than something the model may omit.

Parsing follows this file's existing contract exactly: coerce, cap, drop
unknown, never reject a null, never fail a paid roll over a malformed field.

### 5.2 Caps and scrubbing

- `thesis` ≤ 200 characters, `avoid` ≤ 120. Both run through `scrubBrands`.
- Both run through a **garment guard** — a word list (jacket, coat, dress,
  suit, heel, bag, jewellery, logo, print, fabric…) that rejects the field
  rather than editing it. A direction that talks about clothes is not a
  casting direction and half of it is not salvageable.
- If either field is empty after scrubbing, the whole object is dropped. Half a
  direction is worse than none.

### 5.3 Where it lands in the prompt

In the `DIRECTION` block, beside the archetype's own thesis and avoid — never in
`CASTING CATEGORY`, which is the user's own words and is absolute. The brand
reference is an aesthetic, not a category.

Precedence, extending the existing chain:

> **stated facts > category > archetype (shelf) > composed direction >
> styling-bias > prior**

Composed direction sits *below* the shelf because a reviewed constant outranks
generated prose, and *above* styling-bias for the same reason bias exists at
all — creative context should own styling.

### 5.4 Loss becomes observable

Today the miss is silent. Proposed: when the brief contains a brand token and
the compile produced neither an `archetype`, a `look`, nor a
`composedDirection`, log it as a named miss with the brief. That is the
`promoteStatedRole` pattern — the interpreter is told, and then it is checked —
and it turns "we think this is rare" into a number.

I am **not** proposing a deterministic repair here. There is nothing honest to
fall back to: snapping to the nearest shelf entry is precisely what C7 warns
against, and inventing a direction in code would violate P2.

## 6. What could go wrong

**The plaid-shirt failure, again.** Free prose from a language model reaching an
image prompt is the exact defect `CastingIntent` was built to prevent. Mitigated
by the caps, the two guards, the structured shape, and the constant's positional
override — but it is a real widening of the honest weak point, and the founder
should rule on it knowing that.

**The brand leaking back in disguise.** "Gold hardware and Medusa motifs" names
no house and is still Versace. The garment guard catches most of this because
brand identity in fashion lives in objects, and objects are garments. Not all:
"the house's signature" would pass. A verification assertion should sample for
it.

**Ambiguity between shelf and composed.** A model given two channels may fill
both or neither. The prompt must state the precedence and the tests must cover
"shelf fits" and "shelf does not fit" separately.

**Interpreter-prompt change = D-79 risk class.** Tonight's rollback was caused
by adding a structured field and the model quietly rerouting facts into it,
away from the fields that reach the image. **The same failure mode is available
here**: told to compose a direction, the interpreter could stop putting the
aesthetic into `look`, which is currently where Margiela and Versace land. That
would be a regression disguised as a feature.

The countermeasure is already built: the live golden-brief harness, plus a
prompt instruction that the new field is *additive* and never a substitute. The
goldens must gain brand briefs before the prompt changes, not after.

## 7. Verification plan

Standing rule applies: **interpreter-prompt change means live harness, never
stubs.** That rule exists because two regressions this session hid behind
stubbed intents.

New golden briefs, all `category: true`:

- "a miu miu campaign model" — the no-shelf-fit case; must produce a composed
  direction.
- "a Margiela runway face, early 20s" — currently captures via `look`; must
  **still** capture via `look` (the anti-regression for §6's D-79 risk).
- "a young male Mediterranean model inspired by versace editorial" — the
  original incident brief; the trademark must be absent from all eight prompts.

Assertions, at the composed-prompt layer:

1. No brand token in any of the eight prompts. (Already true; pinned so it
   stays true.)
2. A brand brief yields at least one of archetype / look / composedDirection —
   never all three null.
3. `composedDirection`, when present, contains no garment word and no brand
   token.
4. The context-free and non-brand golden briefs are unchanged — the cheapest
   guarantee that this touched nothing else.

Then one paid sheet on "a miu miu campaign model", graded against the same
question as the bogan: does it read as the casting the words asked for, and does
it still read as eight distinct people.

## 8. Rollout

Small enough to ship as one change, but it is an interpreter-prompt change on
the night of a rollback, so: goldens first, prompt second, live harness green
before the paid sheet, and the D-79 re-ship conditions apply in spirit — if the
harness shows any existing brief losing a fact it currently keeps, it does not
ship.

## 9. Rulings — settled 2026-08-01

**All four approved, with conditions. Recorded here because this document is
the build spec.**

1. **Composed free text — YES**, with the caps and both guards as proposed.
   Losing the reference silently is worse than containing authored text
   carefully. **Non-negotiable condition:** the goldens gain brand briefs
   BEFORE the interpreter prompt changes, with Margiela pinned as the
   anti-regression — it must still capture via `look` afterwards.
2. **Garment guard — REJECT, never edit.** A composed direction mentioning
   clothing is dropped entirely and the roll falls back to shelf behaviour.
   Two standing rules stated plainly: never patch LLM output with code, and
   never fail a roll over it.
3. **Non-fashion references — build the field GENERAL**, keep the refusal token
   list fashion-only. One boundary pinned by a golden: a reference to someone's
   AESTHETIC ("a Wes Anderson casting") is direction; casting the PERSON stays
   refused under the named-person law.
4. **No env flag.** Ship with a one-line disable constant beside the other taste
   toggles — sixty-second rollback without growing the flag registry.

### Ratified permanently

**No brand dictionary in this repository, ever.** It rots, and it commits us to
published claims about a trademark's aesthetic. Translation happens at
interpretation time; the repo carries the refusal list and the grammar that
receives the answer, and nothing else.

**Face, hair and bearing only — never garments.** The frame is a plain grey tee
on seamless paper. A direction describing clothing is a direction that will be
ignored at best and fought at worst.

### Build sequence (founder-set)

Hardening batch → founder verification sheets → **this**, goldens first → M7.

## 10. Superseded — the questions as originally posed

1. **Is a composed free-text direction acceptable at all?** It widens the
   honest weak point. The alternative is accepting that unusual houses lose
   their reference, which is today's behaviour and is at least predictable.
   *My recommendation: yes, with the caps and both guards.* The aesthetic is a
   real part of what the user asked for, and losing it silently is worse than
   containing it carefully.

2. **Should the garment guard reject or edit?** I propose reject — a direction
   describing clothes was written against the wrong brief and editing it leaves
   a sentence nobody wrote. Cheap to change if you disagree.

3. **Non-fashion references.** "A Wes Anderson casting", "a Sopranos extra" —
   the same shape, no trademark risk, and the current `BRAND_TOKENS` list does
   not cover them. Do we scope this to fashion houses now, or design the field
   as "aesthetic reference" generally from the start? *My recommendation: build
   the field generally, keep the token list fashion-only, since the list is the
   refusal mechanism and the field is the capture mechanism.*

4. **Does this need its own flag?** Everything in Casting V2 is already behind
   `CASTING_V2_SCOPE`. I do not think it needs a second one, but tonight is an
   argument for asking.

## 11. Explicitly out of scope

- Any change to `scrubBrands` or `BRAND_TOKENS`. The safety half works.
- Any change to the wardrobe constant to let subculture or brand read through
  clothing. That is Path B, and it is the same conclusion D-80 reached about
  the bogan sheet.
- Extending `ARCHETYPES`. §3.
