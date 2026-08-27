# D-110 duplicate-toast pass — evidence

> **Status: dated record.** A measurement/evidence/court document from the date it states — it records what was true then; individual verdicts may since have been superseded. Current law: CLAUDE.md, the capability atlas, `DECISION_LOG.md` (#69 stamping sweep, 2026-08-28).


The second half of D-110: *no toast duplicates an owned notice.* Six removed,
four kept-after-measuring, three kept-by-argument, and one measurement that
reversed a removal I had already made.

Driven against a **real paid roll** (160 credits, verify-bot, 8 of 8 landed) —
the in-place feedback for keep, discard and the echo cannot be seen without real
candidates.

---

## 1. The one that changed my mind

I removed `"Sheet deleted"` on the reasoning that the card leaves the strip in
front of the user. Then I timed it.

**The card takes 7,090 ms to go.**

`openSessions` runs four queries per sheet, so a lobby holding two dozen sheets
refetches about a hundred times against a remote database before anything on
screen changes. Seven seconds of silence after a destructive action is worse
than a redundant pill — the surface does not own that notice yet.

**Restored, with the measurement in the code.** It goes when the removal is
optimistic or the projection is one query, and the allowlist entry says so.

This is the whole reason bar 1 asks for per-toast evidence rather than a
grep-and-delete. The rule was right; my assumption about the surface was wrong,
and only driving it found that out.

The lobby's cast-delete awaits the same `openSessions.invalidate()`, so it was
restored for the same measured reason. `"Renamed"` waits on `roster` instead and
may well be fast — but it was never timed, so it stays until somebody times it.

---

## 2. Removed, with what replaced each

Every row below was driven through real UI, with the toast checked as absent AND
the action's effect confirmed — because a silent screen proves nothing if the
click never landed.

| Was | What the surface does instead | Measured |
|---|---|---|
| `"Kept"` / `"Removed from kept"` | The button itself flips **Keep → Kept**, on the control just pressed | `["Kept","Kept","Keep",…]` → `["Kept","Kept","Kept",…]`, toast `null` |
| `"Discarded"` | The card leaves and **Undo discard** appears in its place | tiles **8 → 7**, undo affordance `false → true`, toast `null` |
| `"<value> — applies to your next roll"` | The echo renders the change **inside the sentence** | `"30s → 50s · next roll"`, toast `null` |
| `"<field> unpinned — applies to your next roll"` | Same span, reading `→ varying · next roll` | same component path |
| `"Change undone"` | The pending span reverts to an ordinary fact | same component path |
| `"Brief edited — your adjustments were cleared"` | The adjustments **fall out of the sentence as you type** | pending spans **→ 0**, toast `null` |

Screenshots: `evidence/post-m7-sweep/tp-01-kept.png`, `tp-02-discarded.png`,
`tp-04-echo-pending-span.png`, `tp-05-brief-edit-clears.png`.

The echo trio is the clearest case in the product. `"30s → 50s · next roll"` and
`"50s — applies to your next roll"` are one sentence said twice, and only one of
them is attached to the fact it describes.

---

## 3. Kept, and why (bar 2 — the failure paths)

Every failure sentence stays. A refused mutation reverts its optimistic paint,
so the user sees that something did not happen and **never why** — that reason
has no in-place home anywhere in the product, and inventing one per mutation
would be a banner apparatus nobody asked for.

Also kept, each for a reason that is not "we always did":

- **`"Discarded — undo is only available on the latest roll"`** — explains an
  ABSENCE. The card leaving says "discarded"; nothing says why no Undo appeared,
  and a missing affordance cannot explain itself.
- **`"Restored — not kept"`** — "restored" is duplicated by the card returning;
  "not kept" is not. The only in-place evidence is a *missing ring*, which looks
  identical to a card that was never kept.
- **`"That roll could not start."`** — fires BEFORE the navigation to the sheet,
  so the sheet's own failure banner never gets the chance.
- **`"Link copied"`** — the clipboard has no surface at all.
- **Deleting a Cast from HER ROOM** (bar 3, the covering/destroying case) — this
  action destroys the page that would have acknowledged it and lands the user on
  a lobby where she is merely absent. An absence is a state you would have to
  audit, not an answer to what you just did. D-110's fallback case, not an
  exception to it.

---

## 4. What the lint caught that the audit missed

`toastOwnership.test.ts` follows the `imageGrammar.test.ts` pattern: every
`toast(` on a casting surface must appear in an allowlist **with the reason it
is not a duplicate**, or CI fails.

It immediately found two `toast.error(…)` sites my hand audit had walked past —
a failed Sign and a failed inline rename in the room — because I had allowlisted
`toast(error.message)` and not `toast.error(error.message)`. It also failed on
its own line-based matcher, because several toasts span lines and
`toast(error instanceof Error` is not enough to tell two failures apart.

Both were found by the lint failing rather than by review, which is the right way
round.

The file has three teeth:

1. **Every toast is allowlisted with a reason** — a new one fails until somebody
   writes down what the user would otherwise not know.
2. **No stale rows** — an entry matching nothing means the toast is gone and the
   row should go with it, so the list cannot decay into a record of the past.
3. **The removals stay removed**, pinned by string — the six above cannot come
   back one convenient re-addition at a time.

---

## 5. Gates

- `pnpm check` clean · `pnpm test` **4057 passed**, 0 failed · Atlas fresh.
- Real roll cast and its sheet deleted afterwards; temp scripts removed; dev
  server killed by tree, one server on 3000 as found.
- Incidental confirmation from the same run: **the lobby rendered 25 unsigned
  sheets**, so the six-cap fix from the earlier sweep is working in the real app.

## 6. Owed, and named rather than left implicit

**`openSessions` is four queries per sheet.** At two dozen sheets that is ~100
round trips per refetch and a seven-second wait after a delete. It is why two
toasts survived this pass, and it is a responsiveness problem in its own right —
not a copy question, so it did not ride inside a copy pass.
