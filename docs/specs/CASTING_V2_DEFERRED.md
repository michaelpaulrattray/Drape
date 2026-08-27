# Casting V2 — deferred, by decision

> **Status: live.** A standing register of parked-by-decision items (#69 stamping sweep, 2026-08-28).


Things ruled out *for now* with a reason and a shape, rather than dropped. The
distinction matters: an item here has been thought about and parked, so a later
session can pick it up without re-deriving the argument, and nobody mistakes it
for an oversight.

Two lists, because they answer different questions. **Someday** is work we
intend to do. **Future clarification** is a class of brief the system currently
handles by guessing, where the eventual answer is to ask.

---

## Someday

### Tab-side live interpretation
*Founder decision, 2026-08-01, deciding item 5's shape.*

The brief echo ships on the sheet only. The casting tab has nothing interpreted
to echo — a brief is not read until a roll is dispatched — so a sentence there
would mean interpreting as the user types: a call per pause, a wait before the
button they came to press, and a paraphrase rewriting itself under the cursor.
That last one is the specific AI-product tell we are avoiding.

If it is ever built it is a different feature with a different flow —
**interpret → confirm → roll** — and it wants deciding on its own terms, not as
a side effect of the echo. The founder's words: keep the tab clean.

---

## Future clarification — the one-question disambiguation

*Founder ruling, 2026-08-01, on item 13's edge case.*

Some briefs are genuinely ambiguous, and the right answer is neither a guess nor
a keyword rule. It is **one question, asked once, before spending.** That
mechanism does not exist yet. Until it does, these are the cases we know we
handle by guessing, so the guess is at least a recorded one.

**Design constraint when it is built:** one question, never a form, and never
before a brief that is not ambiguous. A clarifying step that fires on ordinary
briefs is worse than the guess it replaces.

| Brief shape | What happens now | Why a keyword rule is the wrong fix |
|---|---|---|
| `comic book hero, square jaw` | Cast as a photoreal man with a strong jaw. | "Comic" is in the style-refusal vocabulary, but the interpreter reads the whole phrase and decides — correctly, on this evidence — that the user wants a real person who looks heroic, not an illustration. A keyword rule would refuse a castable brief. The founder accepted this reading as defensible; the ambiguity is real, and asking is the only honest resolution. Pinned by `styleRefusal.test.ts`, which records it as the one miss in twelve. |

Related: `docs/specs/CASTING_V2_CRAFT_PORT_AUDIT.md` records craft items ruled
out with reasons, which is the same discipline applied to the prompt layer.
