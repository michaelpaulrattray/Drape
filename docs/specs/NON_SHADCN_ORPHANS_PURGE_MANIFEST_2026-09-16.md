# The non-shadcn orphans purge — the manifest the deletion commit carries (#106)

> **Status: executed 2026-09-16** (Janitor session for #106, foreman-20260916-2214,
> on the founder's word of 16 Sep: *"105-108 clear them"*). One PR: this manifest,
> 9 file deletions, 1 dependency removal (3 lock entries), two test edits, one
> generator marker, three disposition sentences, one docblock.

**The finding** (Janitor patrol #1, 2026-08-26, knip at `c6273d0a`): eleven files
outside `components/ui/` with no importer on three readers. Two were excluded by
the card's own body (`features/casting/index.ts` goes with the legacy studio at
N8, #29; `scripts/lib/sabotage.mts` is a knip ceiling, not dead), and #105's
session added a rider: `ui/dropdown-menu.tsx` and its package were held there
because their one importer is this card's `Navigation.tsx`.

**A KEEP is a CITATION, never a judgement of value.** Three readers, no shared
resolver, none with deletion authority alone (`docs/JANITOR_LOG.md`'s standing
rule), read at `73318e2c` the hour before the branch:

1. **The Atlas** — `docs/architecture/drape-architecture.json`, 3957 edges
   including the re-export and dynamic-import shapes: **0 inbound** on every row.
2. **An import grep over every tracked file** — the `@/`-aliased, sibling and
   parent-relative forms, over `client`, `server`, `shared`, `scripts`, tests
   included; every hit read to tell a same-named module apart (the
   `features/casting/components/` copies, `db/wardrobe`, the CLIENT wardrobe
   barrel, test-guard directory roots).
3. **The history read** — `git log -S` on each row's import string over the
   whole repository: did anything ever import this, and if it stopped, which
   commit. **This is the un-wiring differ's question, and on one row it had
   the answer the differ exists to find** — see HELD.

## The population moved between the card and the act — the real figure first (#909)

| | card (26 Aug) | today (16 Sep) | why |
|---|---|---|---|
| rows | 11 | 11 + 2 | the #105 rider added `dropdown-menu.tsx` and `@radix-ui/react-dropdown-menu` |
| excluded by the card | 2 | 2 | `features/casting/index.ts` (retirement rule), `scripts/lib/sabotage.mts` (KEEP) |
| **deleted here** | | **9 files, 1 dep** | |
| **held** | | **1** | `useReferralClaim.ts` — a dead feature, not litter (below) |

## DELETE — 9 files, each with its history read

Every row had **0 importers** on all three readers. **None is a control**: every
un-wiring below was a page, layout or dashboard being deleted on purpose, and
the two `components/` duplicates were superseded by the `features/casting/`
copies that the live legacy studio imports.

| file | last importer, and when it went |
|---|---|
| `client/src/components/HairColorWheel.tsx` | the `components/` copy left behind by the 2026-02-19 dead-code cleanup (`d1e6d6e4`); the live one is `features/casting/components/HairColorWheel.tsx` (613 differing lines — an older draft, not a byte copy). `CASTING_V2_ARCHITECTURE_PLAN.md:393` rules it **delete (now)** |
| `client/src/components/TriBlendSelector.tsx` | same road (`d1e6d6e4`), same plan row; the design docs that name `TriBlendSelector` mean the `features/casting/` one |
| `client/src/components/Navigation.tsx` | its ONE importer ever was `components/AppLayout.tsx`, deleted as dead by the 2026-03-24 housekeeping (`faa28312`). Atlas lifecycle `delete` since the Atlas existed; the redesign README's row 10 (*"Retire the legacy nav"*) names it. Two population tests carried it as an enumerated ORPHANED exception; both entries go in this commit |
| `client/src/components/ui/dropdown-menu.tsx` | imported by `Navigation.tsx` alone (the rolled-back Mango dashboard `5751b83c` → `14b382dd` and the showcase page `447d6b52` before that) — the #105 rider |
| `client/src/features/admin/index.ts` | **never imported** by any file in the history — the admin pages import the feature files directly; the `features/admin"` hits are the staff guards' directory roots |
| `client/src/features/home/index.ts` | its one importer left with the 2026-04-03 homepage redesign (`790dd42c`); `Home.tsx` imports the four components directly |
| `client/src/hooks/useMobile.tsx` | `DashboardLayout.tsx` (deleted `c7622927`, 2026-04-04), then `ui/sidebar.tsx` (deleted by #105, `ed7b0032`, yesterday) |
| `server/wardrobe/index.ts` | **never imported** — the wardrobe router and db import the service modules by name; the `wardrobe/index` hits are `wardrobe-vto.test.ts` importing the CLIENT wardrobe barrel |
| `shared/types.ts` | **never imported** since the bootstrap (`3dad2280`), by path or by the `@shared/` alias. Three `cleanup-dispositions.yaml` KEEP rows (`BadRequestError`, `UnauthorizedError`, `NotFoundError`) cited it in their `why` prose as a second road to `shared/_core/errors.ts`; the sentences are amended here, the verdicts do not move |

## DELETE — 1 dependency, 3 lock entries

`@radix-ui/react-dropdown-menu` (`package.json`, one line), by editing the file
and `pnpm install --lockfile-only` — never `pnpm remove` in the worktree, whose
`node_modules` is a junction to the main tree's. The lock lost exactly
`@radix-ui/react-dropdown-menu@2.1.16`, `@radix-ui/react-menu@2.1.16` and
`@radix-ui/react-roving-focus@1.1.11` (each twice: the package and its resolved
key), **100 lines, nothing added, nothing re-keyed.** The remaining six
`@radix-ui/*` packages all have importers.

## HELD — `client/src/features/referral/useReferralClaim.ts`, and it is the reason the road is read

**Not litter: a path-three death of a live feature.** The history read answers
"did something STOP importing it, and when" with a commit: `98931f66`,
2026-04-04, *"Removed the legacy /dashboard page"*, deleted `pages/Dashboard.tsx`
— the hook's only importer ever. The hook is the client half of the referral
link: it captures `?ref=CODE` on landing, stores it, and calls `referral.claim`
after login. **The product still hands out that link**: `referral.getMyCode`
builds `${origin}?ref=${code}` and `settings/ReferralBlock.tsx` shows it under a
**Copy** button. Since April nothing on the client reads `?ref=` — a friend who
opens a shared link gets nothing, and only the hand-typed *Redeem a referral
code* road works.

Deleting the hook would make the defect invisible; the file is the repair. It
leaves #106 and goes to **#1010** (`bug`, `founder-review` — it is
money-adjacent: restoring the road turns referral rewards back on for link
claims). The same class as the login-attack detector and the credit-velocity
caps in CLAUDE.md's list, found the same way.

## What rides with the deletions

- `client/src/components/accountMenuPopulation.test.ts` — the `ALLOWED` entry
  for `Navigation.tsx` is deleted. Its other-direction arm (*"an enumerated
  account menu is gone"*) was written to go red on exactly this, and did.
- `client/src/components/signOutWording.test.ts` — the positive arm loses the
  deleted surface; the two live ones (`UserCard`, `StudioSlimHeader`) remain.
- `scripts/generate-architecture.mts` — the `Navigation.tsx` lifecycle marker
  goes with the file (the `sidebar.tsx` one went with #105 the same way).
- `docs/specs/cleanup-dispositions.yaml` — three `why` sentences, tense only.
- `client/src/features/admin/UserBadges.tsx` — its docblock named the admin
  barrel in the present tense.
- The Atlas: modules 992 → 983, edges 3957 → 3918, findings 275 → 275; **no
  kept module lost its last inbound edge** (read at the regenerated json
  before the commit).

## What a future reading needs from this

- Expected next nightly: unused files **29 → 20** (the nine here; `useReferralClaim.ts`
  and `features/casting/index.ts` still read as unused, and are — one is #1010's,
  one is #29's), and the `@radix-ui/react-dropdown-menu` deps line gone. A
  reading that does not show that drop is the finding.
- `client/src/hooks/` now holds `useComposition.ts` and `usePersistFn.ts`, both
  imported. `client/src/features/referral/` holds `RedeemCodeModal.tsx` (live)
  and the held hook.
- The bundle-size effect is nil by construction: an unimported module never
  entered the build. The win is the install, the map and one product bug found.
