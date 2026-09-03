# The presence score SAM 3 already returns, read — #475

**foreman-193, 2026-09-03.** Card: **#475** (`founder-ordered`), cut from his
question on the N3 rung: ***"are we using the best possible models for this?"***

**26 fal region reads, ~$0.13 of house money. No credits, no renders, no
database, no customer row, and no product code changed.** This is a
measurement, as #475 §4/§5 bound it: no second segmenter, no verifier pass, no
VLM confirmation, no model swap.

---

## The answer in one line

**The signal is real, it is already paid for, and on both words the product
actually asks it separates a real feature from a lookalike — including the word
where the pixel count gets the answer exactly backwards.**

---

## 1 · What was measured

`falRegionReader.ts:540` sends `include_scores: true` on every region call — and
the handler reads `json.masks` and nothing else. #475 asked what we are throwing
away. Driven on the cells three previous sittings had **already certified by eye
at native resolution** and measured through the real reader (#246 for `tusks`,
`_shift106` for `hair`, `_shift113` for `eyebrows`), so nothing here is called
absent or present on this shift's own judgement.

**SAM 3 answers the flag.** The response carries the score twice:

```
scores[0]           : number = 0.8442173600196838
metadata[0].score   : number = 0.8442173600196838
metadata[0].box     : null          <- null on the response dumped
boxes               : null          <- null on the response dumped
```

## 2 · The numbers

Feature scores only. On a bilateral word the reader also spends a call finding
her midline (`face`); that score is about her face, not the feature, and is
never pooled below.

| arm | eye | word | **score(s)** | px | band |
|---|---|---|---|---|---|
| TU-ONI-K-3 | absent | `tusks` | **0.8442** | 7,455 | 17%–23% (the horns) |
| TU-ONI-K-0 | absent | `tusks` | **0.8737** | 6,664 | 16%–23% (the horns) |
| TU-ONI-C-0 *(POSITIVE)* | present | `tusks` | **0.8723** | 2,123 | 35%–38% (the mouth) |
| TU-BLANK *(NEGATIVE)* | absent | `tusks` | — | 0 | — |
| HA-ANG-C-2 | absent | `hair` | **0.8597** | 101,097 | 5%–53% |
| HA-ANG-C-0 | absent | `hair` | **0.6079** | 25,962 | 12%–28% |
| HA-LAM-K-2 *(POSITIVE)* | present | `hair` | **0.9490** | 106,160 | 9%–50% |
| HA-BLANK *(NEGATIVE)* | absent | `hair` | — | 0 | — |
| BR-ANG-C-2 | absent | `eyebrows` | **0.5021, 0.5256** | 6,694 | 26%–29% |
| BR-ANG-C-0 | absent | `eyebrows` | **0.5311** | 4,001 | 23%–27% |
| BR-ANG-K-0 | absent | `eyebrows` | — *(reader returned empty)* | 0 | — |
| BR-LAM-K-2 *(POSITIVE)* | present | `eyebrows` | **0.8936, 0.8821** | 3,878 | 29%–32% |
| BR-53 *(POSITIVE)* | present | `eyebrows` | **0.8330, 0.8424** | 6,084 | 26%–29% |
| BR-BLANK *(NEGATIVE)* | absent | `eyebrows` | — | 0 | — |

**Controls held on all three words**, asserted rather than eyeballed: flat grey
came back empty every time (so the code path can say *nothing is there*), and
every positive fired (so a null is evidence rather than silence).

## 3 · Does it separate?

A floor exists on a word only if **every** real feature outscores **every**
substitution. An absent cell the reader already returns empty for needs no floor
and is excluded.

| word | weakest REAL | strongest SUBSTITUTION | verdict |
|---|---|---|---|
| `eyebrows` | **0.8330** | **0.5311** | ✅ **SEPARATES** — margin **0.302** |
| `hair` | **0.9490** | **0.8597** | ✅ **SEPARATES** — margin **0.089** |
| `tusks` | 0.8723 | 0.8737 | ❌ **does not separate** — inverted by 0.0014 |

### ⚠ And the word that fails is the one word of the three the product never asks

Derived at the catalogue rather than remembered — `catalogueSlots()` yields
**twelve** questions:

```
derived:below-head, ear, earring, eyebrows, eyes, facial hair,
glasses, hair, horns, lips, nose, nose stud
```

**`tusks` is not among them and is asked nowhere in the product.** It entered
this record as #232's creature-court fixture, and #475's own §1 says as much:
*"an ordinary customer ask, unlike `tusks`, which this gate never asks."*
**Both words the product does ask separate.**

### ⚠ The strongest result is on the word where pixel count is INVERTED

`eyebrows` is the cell that closed the pixel-floor idea hardest: the **absent**
read (6,714 px) beat **both** present arms (3,878 and 6,084), so the two
populations were not overlapping but the wrong way round. **The score puts them
back in order and does it with a 0.30 gap** — real brows at 0.83–0.89, brows
painted onto a bare ridge at 0.50–0.53.

## 4 · A bilateral word carries a score PER SIDE

Not something the card anticipated, and it is free too. `region()` routes a
bilateral word through a midline cut and asks **`eyebrow`** (singular) of each
half with `keep: "all"`, so each side returns its own score:

| arm | calls production makes | scores |
|---|---|---|
| BR-LAM-K-2 (real brows) | `face` + `eyebrow` + `eyebrow` | 0.9085 + **0.8936** + **0.8821** |
| BR-ANG-C-2 (bare ridge) | `face` + `eyebrow` + `eyebrow` | 0.8104 + **0.5021** + **0.5256** |
| BR-ANG-C-0 (bare ridge) | `face` + `eyebrow` + `eyebrow` | 0.8990 + *(empty)* + **0.5311** |

The two sides agree closely within every cell (0.8936/0.8821; 0.5021/0.5256),
which is a second, independent reading of the same claim on the same frame at no
extra cost — **the panel's per-side questions each already have their own
presence signal.**

## 5 · What this does NOT say

- **No repair is cut, and none is recommended as settled.** The floor value, and
  whether a floor is the right shape at all, is N3's design decision and the
  founder's. This buys the input that decision was missing.
- **The population is small and is stated rather than dressed up**: one present
  cell on `tusks` and on `hair`, two on `eyebrows`. `hair`'s 0.089 margin rests
  on one cell each side and is **not** a calibration.
- **It does not say the score is trustworthy on unmeasured words.** Nine of the
  twelve catalogue questions are untouched here.
- **It does not retire the placement reading.** The band check
  (`_shift104-where-disposable.mts`) catches `tusks`, which the score does not —
  the two instruments fail on different cells, which is an argument for keeping
  both rather than for replacing one.

## 6 · Law-7 sweep — the class

**The class: a signal the engine already returns, bought and never read.**

- `include_scores` appears **exactly once** in the whole tree (grep over
  `server/` and `client/`) — `falRegionReader.ts:540`. One instance of the
  explicit form.
- The two sibling fal calls in the same module request no extra signal and read
  what they ask for: `subject()` (BiRefNet matting) reads the mask URL,
  `point()` (moondream) reads `json.points`.
- SAM 3's `boxes` and `metadata[].box` were **null** on the response dumped, so
  nothing is being discarded there. *(Dumped on one call of the fourteen, not
  all — stated as measured.)*

## 7 · How the reading was kept honest — and the correction it caught

**Two passes, and the first one was wrong in a way worth recording.**

Pass 1 rebuilt the request and checked its own masks against the filed record.
`tusks` and `hair` matched **to the pixel** (7,455 / 6,664 / 2,123, and six
decimals of coverage) — and both `eyebrows` cells did not: 6,714 filed against
11,852, 4,001 against 14,793. **The reconstruction check is the only reason that
was noticed**, and opening `region()` gave the reason: `eyebrows` is bilateral,
so production never asks *"eyebrows"* of the frame at all. Pass 1 had measured a
call the product does not make on that word.

**Pass 2 reconstructs nothing.** It taps `globalThis.fetch` read-only and calls
the real `reader.region(...)` exactly as `faceScan` and the departure gate do,
reading the scores out of the responses production itself received. Every cell
then matched its filed measurement — **14 of 14** — because it is the same call.

*A rebuilt input is a claim* (`reconstruction-needs-an-independent-record`), and
the filed pixel counts were the independent record that made the claim
falsifiable. It was falsified, and the instrument was replaced rather than the
number explained away.

## 8 · Artifacts

| | |
|---|---|
| pass 2 (the record) | `output/_475-presence/report-live.md` |
| pass 1 (superseded — kept for §7) | `output/_475-presence/report.md` |
| the raw response shape | `output/_475-presence/first-response-shape.txt` |
| drivers | `scripts/_475-presence-scores-live-disposable.mts`, `scripts/_475-presence-scores-disposable.mts` |
| the cells' provenance | #246, `DEPARTURE_GATE_SUBSTITUTION_2026-08-30.md`, `output/_shift106/`, `output/_shift113/` |
