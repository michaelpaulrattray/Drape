# The shadcn primitives purge — the manifest the deletion commit carries (#105)

> **Status: executed 2026-09-16** (Janitor session for #105, foreman-20260916-2037,
> on the founder's word of 16 Sep: *"105-108 clear them"*). One PR: this manifest,
> 40 file deletions, 33 dependency removals, the lockfile diff, one test edit.

**The finding** (Janitor patrol #1, 2026-08-26, knip at `c6273d0a`): the vendored
`client/src/components/ui/*` primitives were added as a SET at the project
bootstrap and most of them were only ever imported by the bootstrap's own demo
page. Forty had no importer; between them they held twenty-one `@radix-ui/*`
dependencies and a tail of satellite packages that existed only to serve them.

**A KEEP is a CITATION, never a judgement of value.** Three readers, no shared
resolver, and none of them with deletion authority on its own (`docs/JANITOR_LOG.md`'s
standing rule):

1. **knip, the nightly** — run `35008863398`, 2026-09-15, tree `4f3c49da` (the
   authority per Janitor run 2: a local reading is contaminated by untracked
   scratch). `main` was two commits past it at execution, both server/docs.
2. **An import grep over every tracked file** — `components/ui/<name>"`, the
   sibling `./<name>"` and `../ui/<name>"` forms — over `client`, `server`,
   `shared`, `scripts`, tests included.
3. **The history read** — `git log -S 'components/ui/<name>"'` over the whole
   repository for every row, which is the un-wiring differ's question asked at
   the string: did anything ever import this, and if it stopped, which commit.

## The population moved between the card and the act — the real figure first (#909)

| | card (26 Aug) | today (16 Sep) | why |
|---|---|---|---|
| files | 40 | **41** | `table.tsx` already deleted in PR #407 (section 06's promotion pass, `5a2e9827`); `skeleton.tsx` and `switch.tsx` un-wired on purpose since (below) |
| deps | 34 | **34** | unchanged |
| **deleted here** | | **40 files, 33 deps** | `dropdown-menu.tsx` + `@radix-ui/react-dropdown-menu` held — see "Held back" |

## DELETE — 40 files, each with its history read

Every row below had **0 importers** on all three readers. The "last importer"
column is the history read; **none of these is a control** — every un-wiring
was a page or dashboard being deleted on purpose, and the primitives that had a
real importer inside the product lost it to a redesign that replaced the
primitive with a house component.

| file | last importer, and when it went |
|---|---|
| `accordion`, `alert`, `aspect-ratio`, `breadcrumb`, `calendar`, `carousel`, `checkbox`, `collapsible`, `command`, `context-menu`, `drawer`, `input-otp`, `label`, `menubar`, `pagination`, `progress`, `radio-group`, `resizable`, `separator`, `sheet`, `slider`, `toggle`, `toggle-group` (23) | `pages/ComponentShowcase.tsx`, the bootstrap's demo page — deleted as dead code 2026-02-07 (`447d6b52`, *"zero imports"*) |
| `tabs` | the showcase page only; its two July hits are `docs/specs` design documents naming the primitive, not imports |
| `avatar`, `sidebar` | the rolled-back Mango dashboard (`5751b83c` → `14b382dd`, 2026-02-02) and the orphaned `DashboardLayout*` files deleted 2026-04-04 (`c7622927`) |
| `scroll-area` | last un-wired by the 2026-03-24 housekeeping (`faa28312`) |
| `skeleton` | eight staff-list importers, all replaced by the house loading state in staff briefs 06 and 09 (`5a2e9827`, `bcde4947`, 2026-09-02); `section09-guard.test.ts` now REFUSES a moderator file importing it |
| `switch` | one importer, retired with section 03 (`75c3a413`, 2026-09-01 — five account modals became three surfaces) |
| `chart` | never imported. Its one mention was `staffPagesLazy.test.ts`'s `STAFF_TREE` allowlist, which this commit removes (the recharts matcher keeps naming its path so a re-vendored wrapper is held to the same tree) |
| `alert-dialog`, `button-group`, `empty`, `field`, `form`, `input-group`, `item`, `kbd`, `navigation-menu`, `spinner` (10) | **never imported by anything in the repository's history** |

Internal edges, all inside the set: `label` ← `field`, `form`; `separator` ←
`button-group`, `field`, `item`, `sidebar`; `sheet` ← `sidebar`; `skeleton` ←
`sidebar`; `toggle` ← `toggle-group`. No kept file imports a deleted one
(`pnpm check` is the proof, run before the commit).

## DELETE — 33 dependencies

Each one's only importers were files in the table above (reader 2, a grep for
the package name over every tracked non-doc file), or nothing at all:

- **`@radix-ui/*`, 20 of the 21**: `react-accordion`, `react-alert-dialog`,
  `react-aspect-ratio`, `react-avatar`, `react-checkbox`, `react-collapsible`,
  `react-context-menu`, `react-label`, `react-menubar`, `react-navigation-menu`,
  `react-progress`, `react-radio-group`, `react-scroll-area`, `react-separator`,
  `react-slider`, `react-switch`, `react-tabs`, `react-toggle`, `react-toggle-group`
  — `react-dropdown-menu` is the one held (below).
- **Satellites of the deleted primitives**: `cmdk` (command), `date-fns` and
  `react-day-picker` (calendar), `embla-carousel-react` (carousel), `input-otp`,
  `react-hook-form` and `@hookform/resolvers` (form), `react-resizable-panels`
  (resizable), `vaul` (drawer).
- **Referenced by nothing**: `next-themes` (the product's theme is
  `client/src/foundation/theme.ts`), `tailwindcss-animate` (the CSS imports
  `tw-animate-css`), `@aws-sdk/s3-request-presigner` (storage is public-URL,
  never presigned — `server/storage.ts`'s own header).
- **Deprecated stubs**: `@types/sharp`, `@types/uuid` — both
  `node_modules/@types/*/package.json` carry `"deprecated": "This is a stub types
  definition. <pkg> provides its own type definitions"`; `sharp 0.35.4` and
  `uuid 13.0.2` both declare `types`.

The lockfile was refreshed with `pnpm install --lockfile-only`: 825 lines out,
one re-keyed entry in (`@aws-sdk/signature-v4-multi-region`, still needed by the
kept `@aws-sdk/client-s3`), no kept dependency moved, the `wouter` patch entry
intact.

## HELD BACK — one primitive and its dependency, for #106

`client/src/components/ui/dropdown-menu.tsx` and `@radix-ui/react-dropdown-menu`.
Its one importer is `client/src/components/Navigation.tsx`, which is **#106's
row** (Atlas lifecycle `delete`; `accountMenuPopulation.test.ts` and
`signOutWording.test.ts` name it in their populations). Deleting a primitive
under an importer that stays breaks the typecheck; deleting the importer is
#106's session, by the founder's *"one Janitor session per card"*. **#106 takes
all three together** — it is written on that card.

## What a future reading needs from this

- `docs/JANITOR_KNIP.md`'s ceiling line for `client/src/components/ui/*` is
  rewritten in this commit: after this PR the directory holds **11 primitives
  with importers** (`badge`, `button`, `card`, `dialog`, `hover-card`, `input`,
  `popover`, `select`, `sonner`, `textarea`, `tooltip`) **plus `dropdown-menu`**,
  which reads as unused until #106 lands and is not a finding.
- `client/src/hooks/useMobile.tsx` loses its only importer (`sidebar.tsx`) here
  and is now a true orphan — **#106's row already**, filed there for exactly this
  reason.
- The bundle-size effect is unmeasured and expected to be nil: an unimported
  module never entered the build. The win is the install and the map, not the
  wire.
