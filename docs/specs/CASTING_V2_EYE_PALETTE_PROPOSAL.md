# Eye colour: diagnosis and a plausibility-safe proposal

**Status:** APPROVED and shipped 2026-08-01, both levers. Heritage-draw option declined by ruling (§6).
**Date:** 2026-08-01
**Owner:** executor, at founder request ("diagnose before tuning")

---

## 1. The diagnosis, measured before tuning

The founder's observation: eye colour reads brown-dominant on open sheets.

Two hypotheses were named. The instruction was to tell them apart before
touching anything:

1. assignment is varied but the **renders** read brown → strengthen D1's iris
   prose for the mid colours;
2. assignment is itself **brown-heavy** → twelve heritage palettes compounding.

**Measured offline across 3,200 candidates (400 open sheets × 8):**

| eye colour | share |
|---|---|
| dark brown | 26.0% |
| brown | 20.5% |
| near-black | 16.6% |
| blue | 9.4% |
| hazel | 7.0% |
| amber | 6.4% |
| green | 5.6% |
| grey | 4.1% |
| honey brown | 2.4% |
| pale blue | 1.4% |
| green-grey | 0.5% |

**Brown family: 65.5%.** Heritage is evenly spread across the twelve palettes
(8–9% each), so this is not a heritage-selection artefact.

**Verdict: hypothesis 2.** Assignment is brown-heavy. The renders are not the
primary cause, and strengthening iris prose alone would not move the number.

Worth stating plainly, because it is the tension in this whole document:
**65.5% is roughly globally accurate.** Most humans have brown eyes. The
problem is not realism, it is legibility — on a sheet of eight, 65.5% means
five brown-eyed candidates, and eye colour stops separating anybody.

## 2. Why it compounds

Eight of the twelve palettes are 70–95% brown-family by construction, because
that is what those populations look like:

| palette | brown-family share |
|---|---|
| East Asian | 100% |
| Polynesian | 100% |
| West African | 100% |
| South Asian | 92% |
| Middle Eastern | 88% |
| Afro-Caribbean | 84% |
| Mediterranean | 78% |
| Latino | 70% |
| Western European | 46% |
| Slavic | 34% |
| British Isles | 30% |
| Nordic | 8% |

An open sheet draws heritage evenly, so it draws mostly from the top half of
that table. Nothing is wrong with any single palette; the sheet average is the
emergent result.

## 3. The proposal — two levers, deliberately different

The founder's framing was "a plausibility-safe bump to light/mid colours per
palette". The honest reading is that **one lever does not fit all twelve**,
because "light" is not plausible everywhere. So:

### Lever A — where light colours are genuinely present, bump them modestly

Only the four European palettes. These already carry blue/green/grey at real
rates; the proposal nudges them up by 4–8 points each, taken from `brown` and
`dark brown` rather than from the other light colours.

| palette | change |
|---|---|
| British Isles | brown 20→16, dark brown 10→8; green 16→18, grey 10→12, hazel 12→14 |
| Western European | brown 24→20, dark brown 16→13; blue 20→22, green 12→14, grey 8→11 |
| Slavic | brown 22→18, dark brown 12→10; grey 16→18, green 14→16, hazel 10→12 |
| Nordic | unchanged — already 8% brown-family |

### Lever B — where light colours are NOT plausible, shift *within* brown

This is the lever the founder named as the right first move, and it is the one
that does most of the work, because it applies to the eight palettes that
dominate the average.

Amber, honey brown and mid brown read visibly different from near-black at
tile scale; near-black and dark brown do not read differently from each other.
So the shift is from the two darkest values toward the lighter browns, with no
non-brown colour introduced anywhere it does not belong.

| palette | change |
|---|---|
| East Asian | near-black 40→32, dark brown 38→34; brown 18→24, honey brown 4→10 |
| Polynesian | dark brown 40→34, near-black 30→24; brown 24→30, amber 6→12 |
| West African | dark brown 36→31, near-black 34→28; brown 20→26, amber 10→15 |
| South Asian | dark brown 34→30, near-black 30→24; brown 20→24, amber 8→12, honey brown 8→10 |
| Middle Eastern | dark brown 32→28, near-black 22→18; brown 20→22, amber 12→16, honey brown 4→10, hazel 10→6 |
| Afro-Caribbean | dark brown 34→29, near-black 28→23; brown 22→26, amber 10→14, hazel 6→8 |
| Mediterranean | dark brown 30→26, brown 24→22; amber 10→14, hazel 14→16 (honey brown held at 10) |
| Latino | dark brown 28→24; brown 24→22, honey brown 14→17, amber 10→13 |

### Projected effect, and what actually happened

Deliberately a small move: the goal is legibility, not a different-looking
species. Measured after shipping, on the same 3,200-candidate tally:

| measure | before | projected | actual |
|---|---|---|---|
| brown family | 65.5% | ~60% | **61.4%** |
| the two darkest (near-black + dark brown) | 42.6% | ~34% | **35.7%** |
| amber + honey brown | 8.8% | "roughly double" | **12.5%** |

The first two land. **The third was an overclaim** — 8.8% to 12.5% is a 42%
increase, not a doubling. The projection was written by eye rather than
computed, and the honest number is the one in the table. It is still the change
that matters most at tile scale, and whether 12.5% is enough is a judgement the
graded sheet answers better than arithmetic does.

## 4. What this does NOT do, deliberately

- **No palette gains a colour it did not already have.** No blue eyes appear in
  the East Asian, West African or Polynesian palettes. Plausibility is the
  constraint the whole proposal is built inside.
- **Nordic is untouched.** It is already 8% brown-family; bumping it further
  would be tuning toward a stereotype rather than away from one.
- **The D1 iris render prose is unchanged.** The diagnosis says assignment is
  the cause. If the founder wants the mid colours rendered harder as well, that
  is a separate change with its own verification, and it should be measured on
  images rather than on weights.

## 5. Verification — done, and what it took

The offline tally re-ran and is in the table above. The graded sheet answered
the other half: do the renders track the assignment?

**The first open-brief sheet could not answer it.** Amber plus honey is 12.5%
of the population, so a sheet of eight expects about one tile — and this one
drew none. A verification that cannot observe the thing it is verifying is not
a pass, it is a null result, and reporting it as a pass would have been the
broken-instrument mistake this program has already made twice.

**The second sheet was targeted** at a palette where those colours are common
("a Middle Eastern street casting, mid 20s" — amber 16, honey 10). It drew
honey brown, amber, near-black, dark brown, brown, brown, dark brown and hazel,
and every one rendered as itself:

- **amber** renders visibly golden, not generic brown;
- **honey brown** renders warm and light, clearly apart from dark brown;
- **hazel** renders green-gold;
- the three dark values still read as one another at tile scale, which is
  exactly why Lever B shifts weight away from them rather than trying to
  describe them apart.

**Conclusion: renders track assignment. No D1 prose change is needed.** The
follow-up the founder pre-authorised — strengthening the iris prose for amber
and honey — is not required, and should not be done speculatively.

### Arithmetic correction made at ship time

Two rows in the table above did not balance as first written, and the numbers
here now match what shipped. Slavic was 2 short (hazel 10→12 absorbs it) and
Mediterranean was 2 over (honey brown holds at 10 rather than rising to 12).
The weighted picker normalises by total, so neither would have failed loudly —
it would simply have shifted the intended proportions slightly. Every row is
now verified to sum to 100 by a script rather than by reading.

## 6. Founder ruling — the heritage draw is not a lever

The proposal treated "brown-dominant" as a legibility problem and fixed it
inside plausibility. A second, larger option was named but not proposed:
weighting the open-sheet HERITAGE draw so fewer candidates come from
brown-dominant populations. It would move the number much further and faster.

**Declined, and recorded as a ruling (founder, 2026-08-01):**

> The even open-sheet heritage draw is an identity commitment, not a tuning
> surface. Sheet demographics never become a lever in service of a downstream
> aesthetic.

This binds beyond eye colour. Any future taste problem whose easiest fix is
"cast fewer of X" is out of bounds by this ruling, and the correct move is the
one taken here: fix the axis that is actually failing, inside plausibility.
