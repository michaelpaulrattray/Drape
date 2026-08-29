# The casting hero — evidence pack (#234)

**Shift:** foreman-100, 2026-08-29. **Order:** the founder's own, verbatim on
#234 — *"before we hit the ui-redesign please re-design our hero on the casting
page. read casting-hero.md. I have some really cool casts on my account user-1
you could use as the images. dont use boring ones. the current hero image on
the right side in casting studio is boring and needs this re-design"*.

**Spec:** `docs/specs/Casting-ui-ux-design/casting-hero.md` (his handoff).
**Frames:** `output/hero-234/` — 16 screenshots, two accounts × two themes ×
four widths, plus `checks.json`, the driver's own record of what it SAW.
**Driver:** `scripts/_shift100-drive-hero-disposable.mts` — **124 checks, 0
failing**, against the running app on a remote database.

---

## 1. What changed, in one paragraph

The right half of the casting hero was a split-face pair of brand art
(`HeroMotion`, 2026-08-05): one composition, four looks, no connection to
anything the customer owns. It is now a **deck of real signed Casts from this
account**, newest first, each shown beside **the real sentence that cast
them** — read off `casting_rolls.briefText`, not written for the page. An
account that has signed nobody gets a curated deck of six creature and sci-fi
casts from the founder's own account, and the block's eyebrow says
**EXAMPLE CASTS** rather than claiming an empty roster has performers.

---

## 2. His §7 definition of done, each box DRIVEN

| Box | Result | What was measured |
|---|---|---|
| Deck visible without scrolling at 1440×900, both peeks in frame | PASS | cards at `793,118 242×288` / `930,100 260×325` / `1084,118 242×288` — all inside the 1440×900 viewport, no scroll |
| Seed chips one line each at every width from a 344px column up | PASS | 24px per chip at 1920/1440/1024/700, both themes, all four chips |
| Brief text always matches the centre card | PASS | driven through four rotations on the example deck (six different briefs): `Feline humanoid → Android → Orc warrior → Cyber-goth`, each with its own words; and unit-guarded in `heroDeck.test.ts` |
| Rotation pauses on hover; peeks clickable; centre opens the cast room | PASS | held on one card 5.2s under the pointer; a peek click centres that card; the centre card navigated to `/casting/cast/KI-AHYN-73DD-7HFM-7F2V` |
| Deck reflows without a media query — 700 / 1024 / 1440 / 1920 | PASS | copy+deck `602+512` at 1920 and 1440, `486+396` at 1024, stacked at 700. **The stylesheet contains no media query for the deck** except the `prefers-reduced-motion` block |
| Columns wrap to stacked below ~700px with no overflow | PASS | at 700 the deck's top (429) equals the copy's bottom (429); hero overflow 0px, document overflow 0px at every width |
| `min-height: 60px` on the brief; no vertical jump between rotations | PASS | computed `min-height: 60px`; drawn 60px on the short briefs and 65–86px where the text is longer, so the block never shrinks under the deck |
| No hex literals; token-guard passes | PASS | `token-guard.test.ts` 13 tests green; every value in the new CSS is a token |
| Both themes: peeks still read as cards in dark, not holes | PASS (eye) | `output/hero-234/*-dark-*.png` — the peeks keep a `--border` hairline and a `--media` ground at 34%; looked at, both themes, four widths |

**One measurement he should have rather than not have:** at 1440 each peek is
clipped by about 10–15px at the column's edge (left peek starts at x=793, the
deck column at x=803; the right peek ends at 1326 against the column's 1315).
That is a consequence of his own numbers — `±62%` translate at the specified
widths — and it reads as the fan continuing past the frame, which is what his
§2 sketch draws. It is stated rather than silently corrected: if he wants the
peeks fully inside the column, the translate is the one number to move.

---

## 3. The deck's content — chosen by eye, not by row order

His instruction was *"dont use boring ones"*, so every candidate frame was
looked at (law 9, law 6) before anything was cut.

**Live deck (any account, his included):** the account's own signed Casts,
newest first, capped at 7. On his production account that is three — `Kade —
tail court` (the cyborg with the tail), `Jericho`, `Shina` — each with its real
brief and a counted frame total (6 each, counted over `model_assets` rows with
a `storageUrl`, never a declared package size).

**Curated deck (an account that has signed nobody):** six frames from his own
rolls, contact-sheeted and picked by eye from twenty candidates across ten
rolls — hive-skull being, oni-cyber being, feline humanoid, android, orc
warrior, cyber-goth. Every one is a real render this product produced, cut to
4:5 from the delivered candidate, and **every brief under them is the real
`briefText` of the roll that produced it**, unedited.

They carry TYPE names rather than invented people, because an unsigned
candidate has no name and inventing one would be the only fiction on the
surface. They carry `Example` where a signed Cast carries its frame count, and
they open nothing — an example is not anybody's property, and a card that looks
clickable and goes nowhere is the dead control §O forbids (driven: clicking the
example centre leaves the URL unchanged).

---

## 4. Copy audit — every user-visible string

| String | Where | Class |
|---|---|---|
| `CAST FROM THESE WORDS` | brief eyebrow, live deck | **spec-verified** — his §4, verbatim |
| `EXAMPLE CASTS` | brief eyebrow, curated deck | **spec-verified** — his §5, verbatim |
| `6 frames` / `1 frame` | centre caption meta | **capability-derived** — counted rows, singular handled |
| `Signed` | caption meta when a Cast has no frames yet | **adapted** — states what is true without claiming a number |
| `Building` | caption meta for a provisioning Cast | **adapted** — the roster's own existing word for that state |
| `Example` | caption meta on a curated card | **invented, honest** — the one word that stops an example reading as owned |
| `Hive-skull being`, `Oni-cyber being`, `Feline humanoid`, `Android`, `Orc warrior`, `Cyber-goth` | curated captions | **derived** — each is the subject of its own brief, in his own words |
| the six curated brief quotes | brief block | **real** — `casting_rolls.briefText`, verbatim, unedited |
| `Open <name>` / `Show <name>` | card `aria-label`s | **invented** — screen-reader only |

Nothing else on the hero changed: the eyebrow, the headline, the explainer, the
brief field, its placeholder, the path toggle, the settings gear, the TRY row
and the price line are byte-identical to what shipped before this.

---

## 5. What his spec asks for that is NOT built, and why

**The spec toggle and the locked-traits pill** (§3, §6: *"Prefer controls? Set
the casting spec"*, expanding a full trait panel of age / build / heritage /
hair / texture / colour / eyes / skin / marks / looks, feeding a "3 traits
locked" pill).

That panel does not exist in Casting V2. What exists is the settings gear
(#142), which names what will apply and opens the minimal modal. Shipping a
toggle whose panel is unbuilt would be a control that looks functional and does
nothing — the one thing the placeholder amendment explicitly forbids. **It is
filed rather than faked**, and the gear stays where it is until the trait panel
is a real capability.

---

## 6. Where the numbers came from, and what a change would cost

- The deck's two facts (`frameCount`, `brief`) ride the **roster read this page
  already makes** rather than a second hero-only endpoint — one source of truth
  for the same rows (working law 4). Both are owner-scoped in their own
  statement: the count over this account's models, the brief through a
  candidate re-anchored to `userId` and then a roll re-anchored to it again.
- `compiledBrief` is **not selected anywhere on this path**. What the hero
  shows is the customer's own sentence, back to the customer who typed it.
- No new endpoint, no new table, no migration, no flag, no engine call, no
  segmenter read, nothing charged. The hero spends nothing.

---

## 7. Guards, and the proof they can fail

`client/src/features/castingV2/heroDeck.test.ts` (new, 9 arms) and
`heroBox.test.ts` (**re-pointed, not relaxed** — the 2026-08-05 law that the
art may never dictate the hero box now reads the deck's class names, and gained
an arm the pair never needed: a card states WIDTH only, because
`aspect-ratio` resolves an `auto` axis and a stated height would silently beat
the 4:5).

Eight sabotages, eight reds (`scripts/_shift100-sabotage-disposable.py`,
restores in `finally`):

| sabotage | result |
|---|---|
| a card states its own height (the 2026-08-05 defect in the new geometry) | RED |
| the frame is no longer absolute-filled | RED |
| the column loses its stated minimum height | RED |
| the curated deck claims to be this account's own casts | RED |
| a face is paired with the NEXT cast's words | RED |
| an example card pretends to have a room | RED |
| the frame count becomes a declared number rather than a counted one | RED |
| a short deck repeats one face across the fan | RED |

---

## 8. Two readings the driver produced that no review would have

1. **The first driver run reported the live deck as broken on an account that
   owns four signed Casts.** It waited for `.dpc-deck__card--centre img` — a
   selector BOTH states satisfy — so it photographed the curated fallback while
   the roster was still in flight and read the fallback as the answer. The API
   was returning all four rows correctly the whole time. Waiting on the *state*
   (the eyebrow this account should end on) is what fixed it. *A selector both
   states satisfy is a clock in disguise.*

2. **That same race was a real defect in the product, not only in the
   instrument.** Until it was found, a customer who owns signed Casts saw a fan
   of strangers under the words EXAMPLE CASTS for a second or so on every load,
   and then a swap. The deck now stays **quiet** while the roster's first fetch
   is in flight — the column keeps its size, nothing claims anything, and the
   real deck arrives without a flash.

---

## 9. What is NOT in this pack

**No before/after pair against a rendered prototype.** The casting tab's
prototype is a `.dc.html` that needs its design-tool runtime (`x-import`,
`sc-if`) to render at all, so there is no picture of it to sit beside these.
What the shipped surface was measured against instead is the SPEC's own
numbers — §2's flex bases, §3's chip rule, §4's card geometry, ratio, transform
and dwell — read in the running app, which is a stronger comparison than two
screenshots. The prototype's own casting hero (a two-image split pane) is what
this replaces, and it is what production still serves until this deploys.
