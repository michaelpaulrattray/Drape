# A SETTINGS MODAL FOR CASTING — design report

⚠ **STATUS: COUNTERSIGNED (fable-1545) AND THEN AMENDED IN FIVE PLACES BY THE
FOUNDER THE SAME DAY (fable-1546 and fable-1547). READ §10 FIRST — it is his
words, and this document says things he has overruled wherever §10 is not
consulted.** Nothing here is built.

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
UI.** What the modal cannot do is make new axes cheap: **every axis it exposes is
a new field in a prompt, and this program has MEASURED that context is not
additive** — a subset of prompt context raised the stage wall twice as often as
its superset. So the modal makes axes cheap on the UI side and on no other side,
and each one still ships dark, gets measured, and is opened. ⚠ **And one piece of
the reference's grammar cannot be honestly copied at all: its power is a picture
per option, and a picture per option is only truthful for a CLOSED vocabulary.
Outfit is open.** That is §7, and it is the finding that shapes the whole thing.

⚠ **This paragraph opened *"A modal that carries Path and Outfit is buildable
today"* and HE HAS REMOVED THE OUTFIT HALF** (§10 ruling 1): the modal holds
**selections only**, outfits are typed in the prompt exactly as they are today,
and **v1 is Path.** §7's finding survives that intact and gets simpler for it —
an open axis does not get a field in the modal, it stays where it already lives.

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
| **Path** — Wardrobe / Basics ⚠ **shown to a customer as `Default` / `Basics`**, §10a | `casting_rolls.path`, migration 0051; `PathToggle` on two surfaces | the customer, by a control that already exists |
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

⚠ **THIS SECTION CONCLUDED *"v1 = Path + Outfit, and nothing else"* AND HE HAS
RULED IT DOWN TO ONE** (§10 ruling 1). The modal holds selections; a customer
types an outfit in the prompt box, where she types one today. **v1 = Path.**

**What survives, and it is why the section is kept**: the asymmetry above is
exactly the reason his ruling is the right one. Path is a closed vocabulary with
a control that already exists; Outfit is an open one whose value two authors
already resolve, and a modal field would have made a third. **He removed the
third author rather than arbitrating between three**, which is the simpler
answer and the one §7 was already pointing at from the other direction.

---

## 4. The conflict rule — the open question, with a recommendation

The reviewer's stated lean (fable-1531 §2) is *an explicit typed instruction
beats a modal default; the modal updates to show what actually applied — never a
silent conflict.* **I agree with it and I would go one step further, because the
product already has the machinery.**

```
the modal value   is a DEFAULT — what this roll uses when her sentence is silent
her sentence      is an OVERRIDE — it wins, and the customer is TOLD it won
the modal, after  is a RECORD — it shows what actually applied, not what was asked
```

⚠ **HE HAS RULED ON THIS AND IT IS THE SHAPE ABOVE WITH TWO CHANGES** (§10
rulings 3 and 4). The override is **uniform and notified** — *"it bypasses basics
with a notification to the user"* — so the notification is part of the rule
rather than a nicety. And the RECORD half survives **only within a visit**,
because the modal is ephemeral: it resets to defaults every time she leaves the
page and comes back, so there is no stale-settings state for a record to outlive.

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

⚠ **The one case that needed his word was Basics plus a typed outfit, and HE HAS
ANSWERED IT AGAINST MY RECOMMENDATION AND AGAINST TODAY'S BEHAVIOUR** (§10 ruling
3, verbatim: *"if you selected basics and typed they are wearing an outfit then
it bypasses basics with a notification to the user"*).

My recommendation was that **Basics still wins** and the modal says so on the
spot, on the ground that a path which silently is not the path she picked is
worse. **His ruling is that the OUTFIT wins and she is told.** Read against his
other three, it is consistent rather than a coin flip: the modal is a settings
panel and the prompt is where she speaks, so the thing she typed outranks the
thing she picked — everywhere, not just here. My version made this one case an
exception to that, which is the weaker design.

⚠ **It is a REVERSAL OF SHIPPED BEHAVIOUR and the build owns it, not this
document.** Today `bornWardrobeLine` refuses a named outfit on the Basics path
outright — *"a brief that also names a red apron has asked for the other path"* —
with `sheetNotice` explaining the refusal. Under his ruling that ask instead
runs as Wardrobe-with-that-outfit and the notice becomes a notification of what
happened rather than of what was refused. **The reversal ships with the modal
build and not before**, and the sentence comes through `sheetNotice`'s existing
owner rather than a second author (law 4).

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
- ⚠ **Open axis → NOT IN THE MODAL AT ALL. It stays in the prompt.** This read
  *"a field with EXAMPLES, never a gallery"* until his ruling (§10 ruling 1),
  and his answer is stronger than mine in the direction this section was already
  arguing: **the modal is closed-vocabulary BY CONSTRUCTION, so every row in it
  is picturable and the dishonest case cannot be built.** A field in a settings
  panel was the compromise; removing the compromise removes the class.
  (Examples are still suggestions and a gallery is still a vocabulary — that
  sentence governs anywhere a picker is drawn, it simply no longer has a v1
  subject.)

⚠ **And this predicts which future axes can ever be modal in the reference's
sense.** "Style" — the axis he names next, alongside lighting and backgrounds —
is only picturable if it is closed. If styles are a curated list, the
reference's grammar fits perfectly and the modal takes them. **If they are open
prose, they do not enter the modal at all** — under his ruling they stay in the
prompt beside the outfit. **That is a product decision that should be made
knowing it decides the UI**, and per fable-1545 §1.5 it is RESERVED: whoever
opens the styles build brings *closed-curated versus open-prose* to him before
building rather than answering it by default.

---

## 8. What this report decides: nothing

No control is drawn, no route is added, no schema changes, no flag exists yet.
The settings it names are already stored; the two questions it raises (§4's
Basics-versus-outfit, §7's open-or-closed styles) are his. **It exists so that
the first build starts from a shape somebody argued with, which is the 1503 §2
form.**

⚠ **And it worked in the only way that matters: both questions went to him and
he answered one of them by changing the design out from under it** (§10). The
Basics-versus-outfit question is closed — the outfit wins, with a notification —
and the styles question is reserved for the build. **A report that decides
nothing is not a report that changes nothing.**

---

## 9. Open questions for the countersign — ALL FIVE ARE NOW ANSWERED

⚠ **Kept as asked, with each answer beside it.** Four were ruled at the
countersign (fable-1545 §1) and **three of those were then overtaken by the
founder within the hour** (§10) — which is the whole reason the questions stay
on the page rather than being tidied away into their answers.

1. **Is v1 = Path + Outfit the right scope?** Recommendation: yes — both are
   named in his question, both already exist as columns, and neither adds a
   prompt axis, so v1 costs no court.
   → **Ruled yes (fable-1545), then CUT TO PATH ALONE by him** (§10 ruling 1).
2. **The conflict rule (§4)**: default / override / record. Recommendation: as
   written. The one case for HIM is Basics-plus-typed-outfit.
   → **Ruled as written, and he ANSWERED the reserved case the other way**
   (§10 ruling 3): the outfit bypasses Basics with a notification. The `record`
   half survives only within a visit, because the modal is ephemeral (ruling 4).
3. **Does the modal replace the two `PathToggle` sites or sit beside them?**
   Recommendation: **beside, and the toggle stays.** The lobby's toggle is one
   tap on the surface where the roll is bought; burying it one tap deeper to be
   tidy would make the commonest choice more expensive. The modal is where the
   SECOND and later settings live, and Path appears in both — one owner, two
   surfaces, exactly as `PathToggle`'s own docblock already argues.
   → ⚠ **OVERRIDDEN by him** (§10 ruling 2): *"path is selected inside the modal
   as a setting not outside of it."* The on-surface pills retire into the modal
   when it ships. My tap-cost argument stands as an argument and loses to a
   product decision about what Basics IS — an advanced selection, reached
   through settings, with Wardrobe the default — which is a shape my version
   would have contradicted from the lobby.
4. **§7's rule — closed axes get pictures, open axes get fields.** Is it
   accepted as the modal's grammar? Recommendation: yes, and it should be
   written into the build's own docblock, because the temptation is a gallery.
   → **RULED as the modal's law rather than an observation** (fable-1545 §1.4),
   and its second clause is superseded by ruling 1: an open axis gets no field
   in the modal either. **The modal is closed-vocabulary by construction.**
5. **Does the styles question (§7's last paragraph) go to him now or with the
   build?** Recommendation: **with the build.** It is not blocking v1, and his
   desk is empty — but it is the question this report exists to surface, so it
   should not be answered by whoever builds styles first.
   → **Ruled: with the build, and RESERVED** (fable-1545 §1.5) — brought to him
   before the styles build starts, citing §7. He has since named styles,
   lighting and backgrounds as the candidate axes (§10), so the question now has
   three subjects rather than one.

---

## 10. The founder's rulings, verbatim (2026-08-24, relayed fable-1546)

> *"1) you dont type prompts in the modal you only set the settings. you type
> prompts where it exists today. 2) path is selected inside the modal as a
> setting not outside of it. BUt if you selected basics and typed they are
> wearing an outfit then it bypasses basics with a notification to the user. The
> modal holds nothing except settings for the roll such as cast style, maybe
> lighting, maybe backgrounds, - its reset to default everytime you leave the
> page and come baxk or whatever"*

Four rulings, each amending a section above:

1. **SELECTIONS ONLY.** No text field in the modal. Outfits are typed in the
   prompt box, where they are typed today. → §1, §3, §7's second clause.
2. **PATH LIVES INSIDE THE MODAL.** The on-surface `PathToggle` pills retire
   into it when it ships; one owner remains the rule. Wardrobe stays the
   default and Basics is reached through settings. → §9.3, overridden.
3. **PROMPT BEATS SETTINGS, WITH A NOTIFICATION, UNIFORMLY** — including a typed
   outfit bypassing a selected Basics. ⚠ **This REVERSES shipped behaviour**
   (`bornWardrobeLine` refuses a named outfit on Basics today) and the reversal
   ships with the modal build, not before, with the sentence coming through
   `sheetNotice`'s existing owner. → §4.
4. **EPHEMERAL.** The modal resets to defaults on every page leave and return.
   No persistence, no stale-settings class, and the `record` half of §4's rule
   lives only within a visit. → §4.

**v1 is therefore: the modal, with Path as its first setting, the prompt box
unchanged, and bypass-with-notification wired.** His named candidates for later
axes are cast style, lighting and backgrounds — each still dark → measured →
opened per §5, and each admitted to the modal only if §7 says it is picturable.

### 10a. A fifth ruling, the next hour (relayed fable-1547)

> *"wardrbe should just be the default setting called default inside the modal
> anyway."*

**The path setting's customer-facing vocabulary is `Default` / `Basics`, not
`Wardrobe` / `Basics`.** The ordinary way a cast is born needs no name of its
own; Basics is the deliberate departure, which is the same shape as ruling 2 —
Basics is an advanced selection — said in copy rather than in placement.

**It is COPY and nothing else.** `shared/castingPaths.ts`, the `casting_rolls.path`
column, `CASTING_TWO_PATHS_SCOPE` and every internal name stay exactly as they
are: this is the customer's ontology (working law 8), and renaming an enum to
match a label is how the two stop being able to disagree on purpose.

⚠ **It creates a sweep the build owns and nobody else**: every surface that says
*"Wardrobe"* TO A CUSTOMER inherits the rename — the sheet's own path line, the
pills for as long as they exist, and `sheetNotice`'s copy. **Swept at the modal
build's own sitting, not before**, because a half-renamed vocabulary across two
sittings is worse than either name consistently.
