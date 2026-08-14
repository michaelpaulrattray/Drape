# The chip's "take this step back" — evidence pack

*Built 2026-08-15 under the UI evidence contract. Every state below was
photographed in the running app, both themes, and every mechanizable law is a
driven assertion rather than review memory: `output/chip-remove/`,
`scripts/drive-chip-remove-disposable.mts`.*

---

## What shipped

A menu on each version chip — the shared `CardMenu`, per D-155's *"remove is
visible on the instruction chips carrying its price"* — with one item:

```
Take this step back
25 credits · a new render without it        ← when it is paid
free · you already have that version        ← when it is not
```

The label carries no number (D-109: the price is never in button text) and the
cost is said before the click, in the quiet line under it.

## The seven driven assertions

```
ok   the column shows the original and her steps
ok   every step chip carries the menu the ruling put there
ok   the price is NOT in the button text (D-109)
ok   the cost IS said before the click, in the quiet line under it
ok   the meta line is present at all
ok   the column never renders empty while the removal runs
ok   the version she is left looking at is the one WITHOUT that step
```

Both themes, all seven.

## What driving it caught — three real defects, none of which review would have

1. **Using the menu closed the whole viewer.** `CardMenu` portals its panel to
   `document.body`, and a React portal still bubbles through the REACT tree — so
   the click arrived at the viewer's dismiss handler with a target that is
   nowhere inside the viewer's own markup. The first real click on the new
   control shut the surface it belongs to. (The viewer's own comment already
   carried this lesson from a panel row; the list needed one more member.)
2. **The price was a promise the product did not always keep.** The meta line
   said *25 credits* and the removal came back *"that takes it back to the
   original — nothing charged"*. A step-back that lands on a version she already
   has is FREE (D-121), and the client can tell which: the surviving chain
   either matches a version in the list or it does not. It is derived now, and
   the free case says so.
3. **The step was taken out of the wrong chain.** The service prunes the
   SELECTED face's chain, and a chip can be clicked while another version is
   selected — so the request named an index in somebody else's chain and the
   door refused *"that step has moved"*. The chip now selects its own version
   first (free, D-121) and takes the step out of the chain she is looking at, so
   **the steps after it survive** — which is the mid-chain shape the court
   measured.

## The copy audit — every string, and all of them INVENTED

There is no prototype for this surface, so nothing is prototype-verified. Each
string and its justification:

| string | class | why it says this |
|---|---|---|
| `Take this step back` | invented | Her own gesture, not the machine's word. "Remove" is what the code does; "take back" is what she is doing, and it matches the box's own line ("Or take something back — 'undo', 'remove the earrings'"). |
| `25 credits · a new render without it` | invented | The price from the server's config, never typed; the second half says WHY it costs, which is D-121's own reasoning (a new combination is a new generation). |
| `free · you already have that version` | invented | The other half of D-121, said in her terms rather than as "selection". |
| `That step has moved since this page was loaded — open the face again and take it off from there. Nothing was charged.` | invented | The stale-click refusal. Names what happened, what to do, and the money — the three parts every refusal in this product carries. |

## The ship blocker, and what it actually was (fable-543 §2)

Fable read the first pack's shots and stopped the unveil: *"a panel floating at
the viewport's far edge, disconnected from its chip… in dark theme it
half-vanishes against the scrim."* Both halves were real and neither was a
colour problem:

```
PLACEMENT   the panel's RIGHT edge is aligned to the trigger's, which is right
            for a card whose dots sit at its top-right and wrong for a chip on
            the far-left rail — it opened leftward, into the gutter
LEGIBILITY  the panel sat at z-index 60 and the viewer's SCRIM is 70, so it was
            painted UNDER the scrim. Not the panel's colour: the stacking
```

Fixed as a **per-usage anchor** (`align="fromTheLeft"`) rather than a smarter
default, and the shared component's other callers are proved untouched rather
than assumed: the sheet card's menu lands at exactly the same offsets before and
after (`dTop 6 · dLeft -152 · dRight 0 · width 178`), measured by
`measure-cardmenu-placement-disposable.mts` on the page it actually lives on.
The chip's went from `dLeft -195` (into the gutter) to `dLeft 0` (under its own
chip).

And the meta line now sits UNDER the label rather than beside it — the label and
price were both flex children of the same row, so "quiet line under it" was
rendering as one line.

## Two things left open, deliberately

- **A pruned version's chip repeats the surviving step's sentence.** A chip
  shows the last instruction of its own list, so after taking back the newest
  step the new version's chip reads the same as the one before it. It is
  truthful and it looks like a duplicate. The fix is a labelling question (what
  a version that is defined by a REMOVAL should call itself) and it belongs to
  the founder's eye, not to mine at 7am.

## What this cost

25 dev credits per driven removal (four runs across the build, all on the dev
sheet), no production credits, no house money beyond the renders themselves.
