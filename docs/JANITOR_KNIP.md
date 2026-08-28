# Janitor instrument: knip (dead files, exports, dependencies)

`pnpm janitor:knip` — the Janitor's cheap first-pass reader for dead code
(issue #34). It runs [knip](https://knip.dev) over the whole tree with the
config in `knip.json` and prints a compact list. **It has NO deletion
authority.** The Atlas's retirement views (`docs/architecture/`) and the
un-wiring differ (`scripts/diff-importer-count-across-time.mts`) keep that;
a knip row is a pointer to open the file, never a verdict to remove it.

**The nightly** (`.github/workflows/knip.yml`, Warden patrol #1, 2026-08-26):
the same command runs on main every night at 15:00 UTC (01:00 AEST) and by
hand with `gh workflow run knip.yml`. It is a reading, not a gate — the job
reddens only when knip could not run (any exit but its own 0/1), and
otherwise writes the per-category counts to the run summary and the compact
list as a 30-day artifact (`knip-reading-<run id>`). The Janitor patrol reads
the newest summary against the table below and appends a row; nothing in the
nightly deletes, and nothing in it decides.

## What knip reads (and the Atlas could not, until 2026-08-23)

Entries: `server/_core/index.ts`, `client/src/main.tsx`, every hand-run
`scripts/**/*.{ts,mts}` (except the two `lib/` directories, which are
libraries and whose exports ARE judged), `seed.ts`, `vitest.setup.ts`, and —
through knip's vitest plugin — every `*.test.ts`. Dynamic `await import()`
and barrel re-exports are followed.

Controls taken 2026-08-26 on the committed config (working law 2):

- **Negative** — five modules reached only by dynamic import or a barrel
  (`server/routes/emailAuth.ts`, `googleAuth.ts`, `server/db/ipBlocking.ts`,
  `server/db/index.ts`, `server/security/loginAttackAlert.ts`) are absent
  from the unused-files list. These are the exact modules the Atlas once
  read as having zero callers (CLAUDE.md, "Architecture Atlas").
- **Positive** — a planted `server/_knipPlantDead.ts` and a planted
  `KNIP_PLANT_EXPORT` in `server/castingV2/thumbnails.ts` were both
  reported; removed, the counts returned to the pre-plant reading exactly.

## Ceilings (stated, not silent)

- An export used ONLY by a test file counts as used — tests are entries.
  The uncalled-export sweep, not knip, sees that class.
- `scripts/**/*-disposable.*` are ignored entirely: they are litter by
  definition (issue #8) and would drown the reading.
- The `drizzle` plugin is off (`"drizzle": false`) because it loads
  `drizzle.config.ts`, which throws without `DATABASE_URL`; the config's own
  imports are not judged.
- `railway.cmd`, `netstat`, `taskkill.exe` are OS/CLI binaries the scripts
  shell out to, allowlisted in `ignoreBinaries`.
- `client/src/components/ui/*` are shadcn primitives added as a set; 40 of
  them are unused and they hold the 21 unused `@radix-ui/*` dependencies.
  They are reported on purpose — a vendored library is still code.
- **A `scripts/lib/` module whose only importer is a `*-disposable.*` reads
  as unused** (`scripts/lib/sabotage.mts`, imported only by
  `prove-sabotage-survives-death-disposable.mts`) — a consequence of the
  disposable ignore above, found Janitor run 1. Such a row is a KEEP; grep
  `scripts/` including disposables before believing a `lib/` file is dead.

## Readings (the Janitor appends one line per run; findings become cards)

| date | files | deps | devDeps | exports | types | duplicates | note |
|---|---|---|---|---|---|---|---|
| 2026-08-26 | 51 | 34 | 7 | 174 | 115 | 18 | first reading at `1ccc7e21`; `server/db/billing.ts: addTopupCredits` — the path-three death CLAUDE.md records — is in the export list, so the instrument and the differ agree on a known specimen. `add` and `pnpm` in devDependencies since the initial bootstrap (`3dad2280`) look like a mistyped `pnpm add`. |
| 2026-08-26 | 51 | 34 | 7 | 173 | 115 | 18 | Janitor run 1 at `c6273d0a` (07:40): identical to the first reading bar one export (174 → 173). Filed as cards #105 (shadcn set + deps), #106 (11 files, three readers agree), #107 (devDeps + `semgrep` binary), #108 (exports/types/duplicates via the differ). Ceiling: `scripts/lib/sabotage.mts` is a false positive (importer is a disposable). Full list `output/janitor-knip-20260826.txt`. |
| 2026-08-29 | 50 | 1 | — | 178 | 117 | 19 | Janitor run 2 at `66c405a8`, **compact reporter, so these are FILE counts** (see the warning below). The nightly the day before (`33128922917`, CI) read 51 / 1 / 180 / 117 / 18 on the same instrument. Two real deltas: `conceptUpload.ts` gained a duplicate export (`CONCEPT_REVIEW_READING` aliases `CONCEPT_READING_LABEL`, landed `e45e5611` for #196/#197) — duplicate 19, and #108's first slice; and `scripts/lib/sabotage.mts` reads unused in CI but not locally, because the local tree holds an untracked importer a clean checkout does not. Full lists `output/janitor-knip-20260829-compact.txt` (compact) and `output/janitor-knip-20260829.txt` (default). |

⚠ **THE COLUMNS ABOVE ARE NOT ALL THE SAME KIND OF NUMBER, AND ONE ROW MIXED
TWO REPORTERS.** Measured Janitor run 2: `pnpm janitor:knip` passes
`--reporter compact`, which prints **one line per FILE**, so its `(178)` is
*178 files holding unused exports*. knip's DEFAULT reporter prints one line per
**symbol**, and on the same tree, the same minute, it reads **443 unused exports
and 250 unused types** — with `files` (50) and `duplicates` (19) identical
either way and `dependencies` reading **34** rather than `1`, because the
compact form groups them all under `package.json`.

Run 1's row took `files`, `deps`, `devDeps` and `duplicates` from the default
reporter and `exports` and `types` from the compact one. So *"173 unused
exports, 115 unused types"* — the headline of card **#108** — are FILE counts,
and the export population is 2.6× what the card says. **Nothing grew; the
instrument was read two ways.** From the 2026-08-29 row on, every row states its
reporter, and a row that does not is a compact row by default.

The nightly runs `pnpm janitor:knip`, so **the whole historical series is
compact** and is comparable to itself. A default-reporter reading is a different
series and is labelled as one.

⚠ **AND A LOCAL READING IS NOT THE NIGHTLY.** The workflow's header says the
nightly and a hand reading "cannot disagree" because it is the same command.
They disagreed by one row on 2026-08-29: untracked scratch in the working tree
changes the import graph knip walks, and a clean checkout has none of it. **The
nightly is the authority**; a local run is for a delta you are about to cause.
