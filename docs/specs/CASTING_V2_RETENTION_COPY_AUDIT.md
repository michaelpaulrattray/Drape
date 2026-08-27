# Retention confession — copy audit

> **Status: dated record.** A measurement/evidence/court document from the date it states — it records what was true then; individual verdicts may since have been superseded. Current law: CLAUDE.md, the capability atlas, `DECISION_LOG.md` (#69 stamping sweep, 2026-08-28).


**Date:** 2026-08-01 · **Surfaces:** 3 · **Strings:** 9
**Classification:** every string is **INVENTED**. No prototype covers retention;
the design handoff has no expiry surface at all. Nothing here is prototype-
verified and nothing is adapted, so the whole set carries the higher bar: it
must be justified against capability truth line by line rather than against a
reference.

---

## The rule being confessed

`CASTING_SESSION_IDLE_MS = 7 * 24h`. `expiresAt` is set to now + 7 days and
**reset every time the session is touched** (`server/db/castingV2.ts:195`). So
it is **idle time, not age** — a sheet returned to weekly never expires.

Every string below was checked against that, because the obvious wrong version
("sheets are deleted after a week") describes a rule the product does not have.

---

## Surface 1 — the unsigned-sheet card

| String | Class | Justification |
|---|---|---|
| `Rolled today` | invented | States the last activity that resets the clock. Chosen over "Created" because creation is not what retention measures. |
| `Rolled yesterday` | invented | Same, at one day. |
| `Rolled N days ago` | invented | Same, plural only where N ≥ 2 — pinned by test. |
| `Expires today` | invented | Replaces the age line inside the final 2 days. |
| `Expires tomorrow` | invented | Same, at 24–48h. |
| `Expired` | invented | Defensive only; an expired session is normally gone from the projection before this can render. |

**Deviation from the brief, deliberate.** The ruling said *"expires in N days"*.
At N = 0 and N = 1 that is "in 0 days" / "in 1 days" — worse English than the
words people use, in a register whose whole brief is restraint. Rendered as
today/tomorrow instead; a test asserts `1 days` can never appear.

**Tone check.** No colour, no icon, no countdown, no exclamation. The expiry
line sits at slightly higher opacity than the age line and that is the entire
visual difference. Expiry should never be a surprise; nobody should feel chased.

---

## Surface 2 — the sheet itself

| String | Class | Justification |
|---|---|---|
| `This sheet expires today — keep what's worth holding.` | invented | Names the deadline and the one action available. |
| `This sheet expires tomorrow — keep what's worth holding.` | invented | Same, at 24–48h. |

**CAPABILITY CORRECTION — the important one in this audit.** The ruling's draft
read *"keep or sign what's worth holding"*. **Sign does not exist.** There is no
`sign` procedure in `castingV2Router` and no Sign affordance in the sheet; it
lands in M7, and the kept tray's own comment describes it as "where Sign will
sit". Shipping that sentence would promise a capability the product does not
have — precisely what the honest-capability law forbids.

Shipped as **"keep what's worth holding"**. A test asserts the notice never
matches `/sign/i`, so the words get added the day the button does and not a day
earlier.

**Window.** Shown inside 2 days rather than the ruling's "within a day". The
brief's own example sentence says *tomorrow*, which is the 24–48h case — so
the wider window is what makes that sentence reachable at all.

---

## Surface 3 — the empty state

| String | Class | Justification |
|---|---|---|
| `Unsigned sheets are cleared after 7 quiet days.` | invented | States the rule. |

**Narrowing from the brief, deliberate.** The ruling said the empty state
*"says what happened"*. It cannot: an expired session is gone from the
projection, so a page with no sheets is identical whether one expired or none
was ever cast. Saying "your sheet expired" to someone who never made one would
be inventing a history to fill a silence.

Stating the rule is true in both cases. A test asserts the string contains no
"your" / "we deleted" claim, and that "quiet" survives — because "cleared after
7 days" would describe a rule the product does not have.

---

## Correction to the brief's premise

The ruling stated that *"zero user-facing copy exists"*. One line did:
`SectionHead aside="Unsigned sheets clear after 7 quiet days."` on the lobby
(`CastingV2.tsx`), shipped earlier. It only renders when at least one sheet
exists, which is why it reads as absent in exactly the case a user would want
it — and it left the empty state saying nothing at all.

That line is unchanged and the new empty state deliberately mirrors its wording,
so the two cannot drift into describing different rules.

---

## What was NOT built

- **No countdown, timer or live tick.** The lines recompute on ordinary
  renders. A retention notice that animates is alarm theatre.
- **No dismissal.** Nothing to dismiss — it is one quiet line, not a banner.
- **No email or notification.** Out of scope, and a different consent question.
- **No server change.** `lastActivityAt` and `expiresAt` were already
  projected on both surfaces.
