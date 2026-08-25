# Janitor log — the litter ledger

The Janitor seat's record (PROGRAM.md, "THE CLOCKS"; first run ordered by the
founder 2026-08-26, *"do it"*). What lives here and nowhere else:

1. **The litter ledger** — what was on disk that should not have been, what
   was deleted, what could not be, and the count that the next run starts
   from. Deletions inside the repository go by MANIFEST (the shape is
   `docs/specs/CASTING_V2_LITTER_PURGE_MANIFEST.md`): a keep is a citation,
   never a judgement of value; the 7-day rule keeps anything recent.
2. **The dead-code readings** — knip's counts per run are in
   `docs/JANITOR_KNIP.md`'s table; this file records what was DONE with
   them (cards filed, ceilings found, attempted-and-reverted deletions).

Every Janitor run BEGINS by reading this file and ENDS by appending to it.
Findings are deduped against the queue, open and closed. knip, the Atlas
and the un-wiring differ are three readers with no shared resolver, and
none of them has deletion authority on its own.

---

## Run 1 — 2026-08-26 07:35–08:xx AEST (Janitor, patrol #1, card #96)

Inherited: the 294-file untracked litter the planner seat left, the `output/`
remainder (#8), knip's first reading (#34), and four items named on #96.

### A. Litter ledger — outside the repository

| item | found | done |
|---|---|---|
| Orphaned worktree directories `C:\Users\Admin\drape-relay-78`, `drape-relay-79`, `drape-shift-71-eol`, `drape-shift-crew-tab` | all four present (22–23 entries each), none registered in `git worktree list`, no `.env` inside, no process with the path on its command line (`wmic process`) | **deleted**, `rm -rf`, all four in one pass — Windows had let go |
| `drape-shift-73` (held a copied `.env`) | **already absent** | nothing to do; recorded so the `.env` is known gone |
| `output/.tok`, `.tok2`, `.tok3`, `.tok4` — minted session JWTs from drive scripts, 2026-08-08 | present, each starting `eyJ` (a JWT header); untracked, never committed (`git ls-files output` = 0) | **deleted** |
| `.playwright-mcp/` — 12 `console-*.log` + 4 `page-*.yml` | the "key-shaped string" on #96 was two 40+-char base64 blobs in one console log (`EQEAAADf…`, `EgAAAAAA…` — image/graph data, not a credential; no `eyJ…`, `sk-`, `AKIA`, `Bearer` or `app_session_id=` in any log) | **all 16 deleted**; directory empty |
| `.gitignore` | neither directory was ignored; both had 0 tracked files | **PR #104** adds `output/` and `.playwright-mcp/` |

### B. Litter ledger — the `output/` remainder (#8)

`output/_purge/outputdirs.txt` (760 paths): **37 still present at start; 4
deleted; then a single `rm -rf` hung past a 10-minute tool timeout** — the
machine condition #8 records, reproduced. **33 remain.** Untracked, uncited,
nothing at risk. Not retried by hand; run 2 retries ONCE and records the
count. Comment left on #8.

### C. Untracked litter inside the repository (inventory, not deleted)

`git status --porcelain -uall`: `output/` 4162 · `scripts/` 288 (all
`_*-disposable.*`, the class #8's manifest deletes by name) · root: 3
`_slice_*.txt` (2026-08-20, inside the 7-day rule) and 2 `FABLE_R7_*_REVIEW.md`
(July; CITED by `CASTING_V2_ARCHITECTURE_PLAN.md`, `CLEANUP_MILESTONE_TRIAGE.md`,
`CLAUDE_R7_3A_CAST_PROFILE_REVIEW_PROMPT.md` — so a KEEP under the manifest's
own rule, and a candidate for committing rather than deleting). No manifest
was cut this run: the disposable-script class already has one (#8) and the
rest is either kept-by-rule or in flight.

### D. Dead-code reading → cards

knip re-run at `c6273d0a`: **51 files / 34 deps / 7 devDeps / 173 exports /
115 types / 18 duplicates** — identical to the #34 first reading except one
export (174 → 173). Cross-checked before filing: the 11 non-shadcn files were
read at the Atlas (0 inbound edges on all 11; `Navigation.tsx` already
lifecycle `delete`, `features/casting/index.ts` lifecycle `retire`) and by an
independent import grep (every hit was a same-named DIFFERENT module).

- **#105** — 40 unused shadcn primitives + 21 `@radix-ui` deps + satellites.
- **#106** — 11 non-shadcn files, three readers agree; the retire-lifecycle
  barrel excluded (goes with #29).
- **#107** — 7 devDeps (`add`/`pnpm` = a mistyped `pnpm add` from bootstrap)
  + `semgrep` as an unlisted binary → `ignoreBinaries`.
- **#108** — 173 exports / 115 types / 18 duplicates, triaged through the
  differ (never-wired vs UN-wired), duplicates first.

**Ceiling found**: `scripts/lib/sabotage.mts` reads as unused because its
only importer is a `*-disposable.mts`, and disposables are ignored by
design. Recorded in `JANITOR_KNIP.md`; it is a KEEP.

### E. Anti-boredom check
Every act above traces to #96's own list or #8. No instrument built, no
manifest invented. Nothing spent.

**Next run (~2026-08-29)**: retry the #8 remainder once; re-read knip (counts
should not move until #105–#108 land); the `_slice_*.txt` files leave the
7-day window on 2026-08-27 and are uncited — delete then; decide whether the
two `FABLE_R7_*` reviews are committed under `docs/specs/` (they are cited
from there) or left; check whether `drape-shift-35`/`35b` still belong to a
live seat (#89 is merged).
