# The unused-exports purge, slice 5 — the five held rows (the manifest, #108)

> **Status: EXECUTED 2026-09-26** (seat3-20260926-171737, builder seat), on the
> founder's word of 2026-09-26 (terminal), verbatim and entire: **_"108)clear
> them"_** — said of a card whose only remainder was the five rows slice 4 HELD,
> and whose own `**Waiting on:**` line offered him *clear the held five* or
> *close as done with the keeps recorded*.
>
> **What "clear" turned out to mean, read at the code: one row goes and four are
> keeps that no word of his lifts, because each is held by ANOTHER ruling of his
> or by a live control.** The five are not one population — slice 4 filed them
> under one word (`HOLD`) for three different reasons, and only one of the three
> is a reason a shift could ever act on.

## The five, re-read at the code before anything moved (#909, law 7c)

Population read on this tree, clean worktree, `pnpm janitor:knip` (compact, so
its headline counts FILES): **unused exports 71 files / 116 symbols**, of which
the five below are the rows slice 4 left. ⚠ **That is 18 files above the
2026-09-24 reading of 53, and types are 2 → 13 — two days of seat-PR merges, and
the next Janitor patrol's finding rather than this slice's** (its clock fires
2026-09-27). Nothing is proposed from it here; the row is appended to
`docs/JANITOR_KNIP.md` so run 10 has the measurement.
The other client rows on today's reading (`SINCE_VISIBLE`, `LAST_SEEN_KEY`,
`readLastSeen`) are drift from the 19–26 Sep merges and are the Janitor patrol's
next run, not this slice's — a card's remainder is the rows it held, not whatever
the instrument reads the day someone returns to it.

| row | slice 4's stated reason | read at the code today | act |
|---|---|---|---|
| `client/src/features/billing/LowBalanceWarning.tsx: LowBalanceBanner` | its only consumer is a knip unused FILE (`billing/index.ts`) | **the consumer is a barrel line in a file NOTHING imports** — not a component, not a lobby orphan, and no behaviour anywhere reads it. `git log -S "LowBalanceBanner"` names its one real consumer and the commit that took it: `client/src/pages/Dashboard.tsx`, deleted in **`98931f66`** (2026-04-04, *"Removed the legacy /dashboard page"*) — a page retired on purpose, which is this instrument's own definition of litter (`docs/JANITOR_KNIP.md`). | **DELETED** |
| `client/src/features/operations/castDeletionSync.ts: publishCastDeleted` | its only consumer is a knip unused FILE (the lobby lane keeps those) | its consumer **CALLS it in a component body** — `client/src/features/lobby/DeleteCastDialog.tsx:64`. Clearing the row means editing a Segment 00 lobby orphan, which is his own word: *"NOTHING IS DELETED. Segment 00's orphaned components STAY."* | **KEEP** |
| `shared/exportViews.ts: filenameWithActualImageExtension` | its only consumer is a knip unused FILE (`export/useExportPack.ts`) | its consumer calls it at **three** sites (`:129`, `:140`, `:210`), it is self-used at `shared/exportViews.ts:84`, and that consumer file is itself read by a LIVE guard at five places — `server/modelLifecycleGuard.test.ts:45,176,193,242,260`. Dropping the export reds `tsc`; deleting the file reds that guard. | **KEEP** |
| `client/src/features/profile/ProfileVisual.tsx: ProfileCover` | a recorded keep; a shift does not overrule one | the keep is still recorded, with its reasoning written out: `server/profileVisualDefaults.test.ts:85` asserts the literal `"export function ProfileCover"`, and its docblock states the stance — the banner UPLOAD went in section 03, the cover DEFAULT is still generated and proven by the arm above it, *"so the day a surface wants a cover it is there."* | **KEEP** |
| `client/src/features/casting/evidence/PrivateEvidenceImage.tsx: PrivateEvidenceImage` | the R7 evidence family is PARKED by his word (#6) | unchanged, and it is the strongest of the four: `PROGRAM.md` lists the R7 family under *"Explicitly parked (do NOT work these; they are not forgotten, they are ruled)"*, and `server/r7-evidence-delivery-contract.test.ts:48` names this component as the contract's placeholder surface. `usePrivateEvidenceImage`, in the same file, is live (`useInkAddWorkflow.ts:14`). | **KEEP** |

## The act — one row, and its zero-caller proof quoted

**Reader and its control, stated because a proof of ABSENCE is only as good as
the reader's ability to find a presence (law 2).** A repo-wide bare-name grep
over `client/ server/ shared/ scripts/ drizzle/` including tests — not a resolver
— because every import shape, JSX use, re-export and `import()` member access
mentions the name, so a bare name cannot be missed by a shape the way a resolver
can. **Positive control, same reader, same tree:** `showLowBalanceToast`, the
sibling export in the same file, returns **three** live consumers
(`features/casting/hooks/useCastingGeneration.ts:4`,
`features/studio/takeover/CastingTakeover.tsx:22`, `pages/DrapeStudio.tsx:23`).
**Then the subject:** `LowBalanceBanner` returns **two** mentions in the whole
tree — its own declaration and the `billing/index.ts` re-export line — and
**zero** after this diff.

Removed, in this order:

1. `client/src/features/billing/index.ts` — the `LowBalanceBanner` name off the
   re-export list. **The file stays and every other line in it stays**: it is on
   knip's *unused files* list, that population is not this card's, and nothing
   here deletes a file.
2. `client/src/features/billing/LowBalanceWarning.tsx` — `export function
   LowBalanceBanner` (87 lines), then the **in-file fixpoint** slice 4's ceiling
   prescribes: `interface LowBalanceWarningProps` (its only reader was the
   banner's own `Omit<…>`), and the four imports the banner alone held —
   `useState`, `useEffect` from react and `AlertTriangle`, `X`, `Coins` from
   lucide-react. `toast` stays; `LOW_BALANCE_THRESHOLD` and
   `showLowBalanceToast` stay and are untouched.

**What a customer loses: nothing.** The low-balance warning the product delivers
today is the TOAST, live at the three call sites above; the banner form has had
no surface since 2026-04-04. Recorded as an observation and deliberately NOT
carded: whether the product wants a persistent low-balance surface again is a
product question, not a Janitor finding (the anti-boredom rule).

**Not done, and named rather than done quietly:** the file keeps its `.tsx`
extension while holding no JSX. A rename would touch its three importers and
pull a repo-wide rename sweep behind it, for no reader's benefit.

## The keeps, recorded so the next reading does not re-ask

`docs/JANITOR_KNIP.md` now states the **client/shared unused-exports floor** the
way it already states the duplicates floor of 1: four rows, each with the ruling
or control that holds it, and the sentence that a reading at that floor is
correct rather than unfinished. That is the mechanism this card closes on — a
floor nobody re-reads costs a session every time somebody returns to the card,
which is what happened on 2026-09-17 (two quiet shifts woken by this card in one
afternoon) and is why the relay unordered it.

**`docs/JANITOR_LOG.md` is deliberately NOT appended to.** `scripts/patrol-clocks.mts`
reads each seat's last run out of the newest `## Run` heading in its own log, so a
builder seat writing one there would tell the clock the Janitor patrolled today and
push its next run a full period out. This slice is a card's last slice, not a
patrol; its records are this manifest and the table row in `docs/JANITOR_KNIP.md`.

## Expected next nightly

Unused exports **71 → 70 files, 116 → 115 symbols** (the one row, whose file
carried only it), files 19, duplicates 2, types 13 — this slice touches nothing
but the one symbol and the one barrel line. A reading that moves anything else is
the 19–26 Sep drift named above, not this diff.
