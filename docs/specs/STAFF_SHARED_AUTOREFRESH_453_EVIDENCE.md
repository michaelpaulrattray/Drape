# The AUTO toggle is one switch — evidence (#453)

**His words, Crew reply #104, 2026-09-02 12:24:32Z, verbatim and entire:**

> *"Why are the refresh controls acting as individual toggles per admin page? it should work the same way it works for moderator pages if i toggle it on its on for all pages not just 1."*

Driven on `team/453-shared-autorefresh` at `f70367b6`, against a control server
running `main` at `14c437c6`, on 2026-09-02.

---

## 1 · ⚠ HIS PREMISE IS RIGHT AND HIS EXPLANATION IS NOT — and the difference decides the fix

Read at the code before a line was written (law 7c). **Seven staff surfaces
carried the toggle and every one of them held its own `useState`:**

| surface | line on `main` | initial |
|---|---|---|
| `AdminOverview` | `:53` | `useState(true)` — **ON** |
| `AdminAuditLogs` | `:24` | `useState(false)` |
| `AdminUserManagement` | `:67` | `useState(false)` |
| `AdminChangeRequests` | `:55` | `useState(false)` |
| `AdminInviteCodes` | `:82` | `useState(false)` |
| `AdminBugReports` | `:114` | `useState(false)` |
| `ModeratorDashboard` | `:34` | `useState(false)` |

`grep -rn "autoRefresh" client/src` returned those seven owners and **no shared
preference anywhere in the client**.

⚠ **So the moderator pages he cites as correct were never doing what he thinks
they do.** `/moderator` is **one route** (`App.tsx:127`) whose tabs live inside a
single component; its toggle simply never unmounts. Admin is **eight routes**
(`App.tsx:106-126`) and wouter unmounts a page on navigation. **That is the
entire difference he was looking at, and neither side had a mechanism.**

**Why this mattered to the fix rather than being a footnote:** copying the
moderator page would have been copying nothing. The answer is to give both sides
the thing neither had.

## 2 · ⚠ THE FIRST NEGATIVE CONTROL WAS WORTHLESS AND SAID SO ONLY BY LUCK

The first drive clicked the switch **OFF on Overview** and then walked the panel.
Branch and `main` returned **identical readings at all ten steps** — because once
the shared value is `false` it agrees with every other page's own
`useState(false)` at every step, and the last step returned to Overview after the
value had been set back ON, where `main`'s own `useState(true)` agrees again.

**A control whose fixtures all share a property with the subject cannot fail.**
The re-drive below is built so each step's two trees must DISAGREE, and each
discriminating step is labelled.

## 3 · The drive — 7 steps, 5 of them discriminating

Same browser, same admin session, `localStorage` cleared before each tree.
`sharedWouldSay` is what a single shared switch must report; it was written
before the run.

| step | shared must say | BRANCH | main | differ |
|---|---|---|---|---|
| 1. Overview, nothing clicked | true | **true** | true | — |
| 2. Users, still untouched **[DISCRIMINATOR]** | true | **true** | `false` | ✅ |
| 3. Bug reports, still untouched **[DISCRIMINATOR]** | true | **true** | `false` | ✅ |
| 4. Moderator, still untouched **[DISCRIMINATOR]** | true | **true** | `false` | ✅ |
| 5. Moderator, after one click OFF | false | **false** | `true` | ✅ |
| 6. Overview again **[DISCRIMINATOR]** | false | **false** | `true` | ✅ |
| 7. Overview after a full browser reload **[DISCRIMINATOR]** | false | **false** | `true` | ✅ |

**Branch correct on 7 of 7. `main` wrong on 6 of 7. All 5 discriminators differ.**

Read at `aria-pressed` on `button.dp-staffbar__auto`, cross-read against the
track's `--on` class and against the stored value — **a switch that paints one
state and reports another is invisible to a single reading**.

Step 7 is the reload, which is not literally in his sentence and is what makes
the shared default costless: he sets it once, ever.

## 4 · The frames — `output/453-frames/`, both themes

The argument in one picture is **`/admin/users` with nothing clicked**:

| frame | shows |
|---|---|
| `wide-users-untouched-BRANCH-dark.png` | AUTO **on**, carried from the landing page |
| `wide-users-untouched-main-dark.png` | AUTO **off**, one navigation later |
| `wide-users-untouched-BRANCH-light.png` | same, light |
| `wide-users-untouched-main-light.png` | same, light |

Plus tight crops of the cluster (`users-untouched-*`, `overview-BRANCH-*`).
**Looked at, not merely captured** (law 6, law 9): the knob sits right with the
track filled on the branch and left with the track empty on `main`, in both
themes, and the tab strip in frame names the page.

## 5 · The arms, and the sabotages that earn them

**`stores/useStaffAutoRefreshStore.test.ts` — 6 arms, driving the real store.**
The runner is `node`, so there is no `window` unless one is put there; the
hostile-browser case is therefore this runner's default state, and a store that
touched storage unguarded could never have reached a green suite.

⚠ **The arm that earns the rest seeds `"0"` while the default is `true`**, so the
two answers differ: a store that ignored storage would be green on a seed of
`"1"`.

**`section05-guard.test.ts` — 5 new arms, derived from the pages folder.** They
count what the defect WAS (a private copy), not whether a page mentions the
store — a page can import it, ignore it, and keep its `useState`. That page is
exactly his bug and a grep for the store's name calls it fixed. Same shape as
#413's own instrument failure, one card earlier.

**Five sabotages, driven at the real files, restored in a `finally` and verified
at the bytes:**

| sabotage | named arm went red |
|---|---|
| a page keeps a private `useState` copy | ✅ |
| a page hard-codes the switch instead of reading it | ✅ |
| the auto-refresh toast returns to an effect keyed on the value | ✅ |
| the store ignores the stored value | ✅ |
| the `localStorage` read is unguarded | ✅ |

**5/5.** ⚠ **The first run of that driver reported 0/5 and every arm was fine** —
it scraped vitest's `Tests  N failed` line, which is wrapped in ANSI colour, so
`startswith("Tests ")` never matched and every sabotage read as green. Working
law 4: a regex standing in for something the process already states, reporting a
complete result either way. It judges on the exit code now.

## 6 · The regression this fix introduces, and where it was caught

⚠ **Two surfaces announced auto-refresh from `useEffect(…, [autoRefresh])`** —
`AdminAuditLogs:76` and `ModeratorDashboard:165`. That is a report about a
**value**, not about an **act**, and it was harmless only while each page owned
the value and started it `false`. Shared, the value **arrives already true**, so
the effect fires on every mount and tells him *"Auto-refresh enabled"* about
something he did minutes ago on another page.

Both moved to the toggle handler. **The copy and the asymmetry are carried
exactly**: same sentence, and still nothing at all when he turns it off —
changing either is the promotion pass's business, with his eye on the words.

The arm for it is derived rather than aimed at those two by name, and its
positive control is the pre-#453 line from `ModeratorDashboard`, verbatim.

## 7 · The law-7 class sweep

**The class: state backing a control drawn in the SHARED FRAME while owned by a
page.** Not "any duplicated `useState`" — a severity filter differing between
Audit logs and Invite codes is correct.

Swept mechanically: every `useState` name appearing in two or more separate
route components (14 names), and every field of `StaffRefreshControls` (5).

**The population is one and it is fixed.** Of the bar's five fields,
`lastRefresh` and `isRefetching` are per-page **facts**, `onRefresh` and
`onToggleAutoRefresh` are per-page **actions**, and `autoRefresh` was the only
**preference**. Of the 14 duplicated names, all are page data or page-scoped UI
(pagination, filters, modal state, form fields, selection) — none is a panel-wide
preference. Nothing else to fix, and the reason is stated rather than assumed.

## 8 · The one judgement, named for him to overrule

**The shared initial value is ON.** One shared value means one default.
`AdminOverview` was the only surface that ever defaulted ON, and its
`useState(true)` comes from **`a20b611d`, the original scaffolding commit — not a
founder ruling**, despite `useStaffRefresh.ts`'s docblock calling the three
inline copies *"decisions rather than accidents"*.

- **ON** — no page loses a behaviour it has today; his ask is satisfied with zero
  clicks. Five pages that did not poll now do, on an admin-only surface.
- **OFF** — nothing starts polling that did not, but his landing page silently
  stops auto-refreshing.

Either way the switch is remembered the moment he touches it. **One line and one
word from him flips it.**

## 9 · Deliberately out

- **`AdminCrew`** — no cluster at all yet; folding it in is **#415 §3**.
- **`AdminFoundation`** — holds no query, correctly carries no cluster.
- **Poll intervals, refetch lists, toast copy.** Audit logs and the moderator
  dashboard read stats at 60s and lists at 30s. Only the boolean is shared.
- **Cross-TAB sync.** Two admin tabs open at once still hold independent
  in-memory values until a reload. Not asked, not built, stated here rather than
  discovered later.

## 10 · Checks

`pnpm check` exit 0 · **11,151 passed, 0 failed** (was 11,140 on `main`) ·
Atlas regenerated (**997 modules**, 280 procedures, 288 findings, 0 error) ·
`architecture:check` OK · `capability:check` OK (59 doors, 0 error).

⚠ **The token guard read the card number as a colour.** `#453` is a valid
three-digit hex, so `"#453"` in a `describe` title tripped
`token-guard.test.ts` (#211). Fixed by its **own documented workaround** — the
reference lives in a comment — rather than by a carve-out, which would have
stopped the colour guard reading that whole file to spare four characters in a
title.
