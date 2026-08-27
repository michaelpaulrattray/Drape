# The signed flow, walked from outside the founder's account

> **Status: dated record.** A measurement/evidence/court document from the date it states — it records what was true then; individual verdicts may since have been superseded. Current law: CLAUDE.md, the capability atlas, `DECISION_LOG.md` (#69 stamping sweep, 2026-08-28).


*Driven 2026-08-15 as the standing outsider, approved in fable-568 §2.
**450 dev credits and five house generations**, on the dev database; production
untouched. Shots: `output/outsider-sign/`.*

---

## Why this one was worth buying

Signing is the product's most loaded ceremony — the moment a candidate becomes a
Cast, more expensive than everything else put together — and it had never been
walked by anyone but the founder, on his own account, inside every flag.

## What the walk found: it works, and it says what it costs

```
KEEP        the sheet's dock offers Sign only once something is kept, and says
            so where the button would be: "Keep the one you want, then sign them"
CEREMONY    "Sign them to your roster · Locks this face and builds five canonical
            views. Nothing else on the sheet changes." — a name field, and
            ~450 credits, before any money moves
CONFIRM     "Sign to your roster"
THE LEDGER  4,650 → 4,200. Exactly 450, once.
THE WAIT    the room opens immediately and says whose it is — "horned fixture.
            Cast from a sheet on 15 August" — and the package finishes in 130s
ROSTER      "1 cast member", with her card
```

**No findings.** The ceremony is priced, named, reversible up to the confirm
("Not yet"), and the wait is narrated rather than hung.

## Three instrument corrections, and one of them nearly became a defect report

1. **Looked for Sign before the keep had landed** and reported "no sign button"
   — a fact about when I looked.
2. **Clicked the dock's Sign button THROUGH the open viewer** with a synthetic
   click, then measured the ceremony sitting behind the viewer (`dpc-signm` z60
   against `dpc-viewer` z70) and `elementFromPoint` returning the viewer's
   stage. It reads exactly like the chip-menu-under-the-scrim defect from
   earlier tonight — **and it is not one**: a real user cannot press a button
   behind a scrim, so the state measured is one nobody can reach. **A finding
   from an unreachable state is not a finding.**
3. **Read the roster seconds after signing** and got "0 cast members · No one
   signed yet" — while the wire already had her (`castId KI-…`, status ready).
   A count of zero is what that page says before it knows; the check now waits
   for a non-zero count rather than for the words "cast member", which the
   EMPTY state also says.

## The limits

- **One sign, one account, one cast.** The refund path, a failed package and a
  second sign on the same sheet are unwalked.
- **The face was a fixture clone**, not a rolled cast, so nothing here says
  anything about how a real roll's candidate signs.
- **Dev only.** Production has never been walked from outside and should not be.
