# A SETTINGS MODAL FOR CASTING — design report

**Status: FOR COUNTERSIGN. It decides nothing and nothing here is built.**
Ordered fable-1531 §2 from the founder's own question, with the Higgsfield "Film
setup" screen he sent as the reference
(`docs/specs/references/settings-modal-higgsfield-reference.png`). Written
2026-08-24, opus-1190, against the code and the reference rather than from
recollection.

His words, verbatim:

> *"as for settings like wardrobe path etc should we have a popout modal design
> like higgsfield which allows selection of wardrobe/eventually style/ anything
> else relevant? allows people to customize their results they recieve? without
> having to type it in the prompt? if they left settings as default and typed in
> the prompt the style/wardrobe etc thats fine also - this is a question this
> allows us to expand styles etc ion the future?"*

---

## 1. The answer in one paragraph, before the detail

**Yes, and the shape is smaller than the reference and the constraint is not the
UI.** A modal that carries Path and Outfit is buildable today from controls that
already exist. What the modal cannot do is make new axes cheap: **every axis it
exposes is a new field in a prompt, and this program has MEASURED that context is
not additive** — a subset of prompt context raised the stage wall twice as often
as its superset. So the modal makes axes cheap on the UI side and on no other
side, and each one still ships dark, gets measured, and is opened. ⚠ **And one
piece of the reference's grammar cannot be honestly copied at all: its power is a
picture per option, and a picture per option is only truthful for a CLOSED
vocabulary. Outfit is open.** That is §7, and it is the finding that shapes the
whole thing.

---

## 2. The reference's bones, translated

Read at the screenshot rather than described from memory:

```
"Film setup" modal        title · Reset all · close
  left rail               Genre · Era · Tempo, each with a SET-INDICATOR dot
  right panel             the category's name + one line of what it does
  the option itself       one large VISUAL preview, a carousel, the name below
  behind the modal        a row of category chips (References, Film setup,
                          Camera, Color palette, Lighting AUTO) and a GENERATE
                          button carrying its price, struck-through and current
```

Five things transfer and one does not:

- **The category rail with set-indicators.** The dot is the whole information
  design: it answers *what have I touched* without opening anything.
- **"Auto" as a first-class value.** Their Lighting chip reads `Auto`, not
  *unset*. A default that names itself is a default a customer can reason about.
- **Reset all**, one control, top right.
- **A price on the paid button.** Already our law, and it is a UI assertion in
  our suite rather than review memory.
- **The one-line description under the category name.** It is the difference
  between a menu and a question.
- ⚠ **The visual carousel does NOT transfer wholesale** — §7.

**The look is ours**: restrained, monochrome, `@/components/ui` inside
`features/castingV2/components`, `CastingModal`'s own portal shell if the weight
matches (it is a 664px two-column card built for sign and delete; a settings
modal is a different weight and may want its own, which is a build decision and
not this report's).

---

## 3. What v1 can honestly carry, read at the code

There are exactly **two** settings that exist as facts on a roll today:

| setting | where it lives now | who authors it |
|---|---|---|
| **Path** — Wardrobe / Basics | `casting_rolls.path`, migration 0051; `PathToggle` on two surfaces | the customer, by a control that already exists |
| **Outfit line** | `casting_rolls.wardrobeLine` | **nobody, directly** — `bornWardrobeLine` resolves it from the BRIEF or the engine's pick |

**The asymmetry is the design's real content.** Path already is a control and the
modal would only move it. Outfit is a stored fact with **no control at all**: on
the Wardrobe path a named outfit from her sentence wins, otherwise the house
line; on Basics the path IS the outfit and a named one is deliberately refused
(`wardrobeLine.ts`: *"a brief that also names a red apron has asked for the other
path"*).

So a modal outfit field would be a **third author** of a value two authors
already resolve, and that is where the conflict rule has to be written down
rather than discovered.

**v1 = Path + Outfit, and nothing else.** Both are named in his question, both
exist as columns, and neither needs a new prompt axis — which is exactly what
makes them the right first two.

---

## 4. The conflict rule — the open question, with a recommendation

The reviewer's stated lean (fable-1531 §2) is *an explicit typed instruction
beats a modal default; the modal updates to show what actually applied — never a
silent conflict.* **I agree with it and I would go one step further, because the
product already has the machinery.**

```
the modal value   is a DEFAULT — what this roll uses when her sentence is silent
her sentence      is an OVERRIDE — it wins, exactly as it wins today
the modal, after  is a RECORD — it shows what actually applied, not what was asked
```

Three reasons this is the right way round rather than the polite way round:

1. **It changes no existing precedence.** `bornWardrobeLine` already answers
   *brief versus path*, and it answers it with a founder ruling behind the
   Basics arm. A modal that sits UNDER the brief inherits that ruling instead of
   re-opening it.
2. **D-180: a question must never dead-end.** A control whose value is silently
   overridden is a question whose answer went nowhere. Showing what applied is
   what keeps it a question rather than a decoration.
3. **The product already tells this kind of truth.** `sheetNotice.ts` exists to
   say *your outfit was not used and here is why* — the modal is the same
   sentence at a different moment, and the two should come from one owner rather
   than two (working law 4).

⚠ **The one case that needs his word rather than mine**: Basics plus a typed
outfit. Today the outfit is refused and a notice explains it. With a modal, a
customer can have SET an outfit and then chosen Basics — two of her own inputs
disagreeing, neither of them a typo. **My recommendation is that Basics still
wins and the modal says so on the spot** (the outfit field goes quiet with its
reason, before the roll rather than after), because the alternative is a path
that silently is not the path she picked. But it is a product decision about
whose choice loses, and that is his.

---

## 5. The risk that governs the whole thing

> **Context is not additive in this product, and it is measured.** A SUBSET of
> prompt context raised the stage wall twice as often as its superset.

Every axis the modal exposes is a field in the interpreter's schema and a
sentence in a composed prompt. So:

- **The modal makes axes cheap on the UI side ONLY.** A category rail with six
  rows is a morning's work; six prompt axes is six courts.
- **Each new axis ships dark, is measured, and is then opened** — the ratchet
  this program has now run end to end once (`CASTING_INK_WORDS_SCOPE`,
  build-dark → dogfood → court → his eyes → flip).
- **So the modal must be comfortable showing fewer categories than it can
  imagine.** A rail that is honest at two rows today and six rows next quarter is
  the design; a rail that ships six with four disabled is D-180's dead end
  wearing six tap targets, and §6 of the two-paths design already refused exactly
  that for one control.

**The corollary for the build**: the category list is DERIVED from what the
server says this account can actually set, never authored in the client. That is
the same shape `twoPathsEnabled` already has, and it is why the toggle can be
absent rather than disabled.

---

## 6. The composite-plate input (attached fable-1543 §2)

Research on ZEPHYR (`research/zephyr-teardown/implications-for-drape.md`) found
that a production shot attaches a **median of 3–4 image references, max 9**, and
that their character bible is **one composite plate** rather than a set of views.
**Six separate views would spend a whole shot's reference budget on one
character.**

It attaches here because the modal is where *what do I get* would be expressed if
it were ever expressible. **It is an input to this report and not work in it**:

- The signed package is **output**, not a roll setting — it is minted at Sign,
  long after the modal has done its job.
- Packaging is a real question and it belongs to whoever owns the package.
- **What this report owes it is only this: do not foreclose it.** A settings
  modal scoped to *how this cast is born* has no packaging control in it, and
  that is the correct v1 scope rather than an oversight.

---

## 7. ⚠ The preview problem, which is the hardest part of copying this reference

The Higgsfield modal's whole power is **a big picture per option**. Ours would
have to obey law 6 at menu scale, and the rule is stricter than it looks:
**every preview is a real render of what the option genuinely does, never a
mock** — a menu that illustrates an option with a picture the option does not
produce is a promise the product breaks at the moment of purchase.

That is affordable for Path and impossible for Outfit, and the reason is
structural rather than budgetary:

```
Path      a CLOSED vocabulary of two. Two real sheets already exist as
          artifacts from the two-paths court. Two pictures, minted once, true
          forever until the path's own spec changes.
Outfit    an OPEN vocabulary — any words she types. There is no set of options
          to picture, and a carousel of house outfits would quietly become the
          menu, which is the opposite of what he asked for.
```

**So the reference's grammar is honest for closed vocabularies and dishonest for
open ones**, and that is a rule worth having before the first control is drawn:

- **Closed axis → picture per option**, minted from real output, re-minted when
  the option's meaning moves.
- **Open axis → a field with EXAMPLES, never a gallery.** Examples are
  suggestions; a gallery is a vocabulary.

⚠ **And this predicts which future axes can ever be modal in the reference's
sense.** "Style" — the axis he names next — is only picturable if it is closed.
If styles are a curated list, the reference's grammar fits perfectly. If they
are open prose, the modal can hold the field but not the carousel. **That is a
product decision that should be made knowing it decides the UI**, and it is the
single most useful thing this report can hand him.

---

## 8. What this report decides: nothing

No control is drawn, no route is added, no schema changes, no flag exists yet.
The two settings it names are already stored; the two questions it raises
(§4's Basics-versus-outfit, §7's open-or-closed styles) are his. **It exists so
that the first build starts from a shape somebody argued with, which is the
1503 §2 form.**

---

## 9. Open questions for the countersign

1. **Is v1 = Path + Outfit the right scope?** Recommendation: yes — both are
   named in his question, both already exist as columns, and neither adds a
   prompt axis, so v1 costs no court.
2. **The conflict rule (§4)**: default / override / record. Recommendation: as
   written. The one case for HIM is Basics-plus-typed-outfit.
3. **Does the modal replace the two `PathToggle` sites or sit beside them?**
   Recommendation: **beside, and the toggle stays.** The lobby's toggle is one
   tap on the surface where the roll is bought; burying it one tap deeper to be
   tidy would make the commonest choice more expensive. The modal is where the
   SECOND and later settings live, and Path appears in both — one owner, two
   surfaces, exactly as `PathToggle`'s own docblock already argues.
4. **§7's rule — closed axes get pictures, open axes get fields.** Is it
   accepted as the modal's grammar? Recommendation: yes, and it should be
   written into the build's own docblock, because the temptation is a gallery.
5. **Does the styles question (§7's last paragraph) go to him now or with the
   build?** Recommendation: **with the build.** It is not blocking v1, and his
   desk is empty — but it is the question this report exists to surface, so it
   should not be answered by whoever builds styles first.
