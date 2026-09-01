# Promotion pass — section 03 (Settings, plans, credits, referrals)

**Run 2026-09-01, per `PROMOTION-PASS.md`, before #365 is called done.** Method
copied from the #262 audit: read the code, count consumers that import a thing
TODAY, promote at two or more, leave at one.

**Section:** `03-settings-billing-credits.md` · **PR:** #370 · **Card:** #365.

---

## 1 · What the section built

| Part | Where | Real consumers today |
|---|---|---|
| `SettingsModal` | `features/settings/SettingsModal.tsx` | 1 — `AccountSurfaces` |
| `AccountSurfaces` + `useAccountSurfaces` | `features/settings/AccountSurfaces.tsx` | **2** — `AppChrome`, `DrapeStudio` |
| `ChangePlanModal` | `features/billing/` | 1 — `AccountSurfaces` |
| `AddCreditsModal` | `features/billing/` | **4** — `AccountSurfaces`, `BoardPage`, `CastingTakeover`, `DrapeStudio` |
| `ReferralBlock` | `features/settings/` | 1 — `BillingSection` |
| Six section components | `features/settings/sections/` | 1 each — `SettingsModal` |
| `parts.tsx` — `SettingsGroup`, `SettingsRow`, `StubControl`, `StubNote`, `SettingsToggle`, `Bar` | `features/settings/parts.tsx` | **6** — every section |
| `planMath.ts` | `features/settings/` | **3** — both purchase modals, `BillingSection` |
| `planLadder.ts` | `features/settings/` | **2** — both purchase modals |
| `settings.css` | `features/settings/` | 3 files import it |

---

## 2 · ⚠ ONE COLLISION, AND IT WAS REAL — fixed inside PR #370

**`.dp-segmented` already existed in `foundation.css`** with a real consumer
(`SurfaceBar`, used by `/admin/foundation`). Section 03's first draft declared a
near-identical `.dp-plan__segments` / `.dp-plan__segment` beside it — same
pill-in-well grammar, same `--fillStrong` track, same `--surface` active
segment. **This is the popover story exactly**, and the pass caught it one
commit before it shipped.

**Rule 6 applied: the one with real customers wins.** The duplicate block is
deleted; the interval control uses `.dp-segmented`. The single thing the loser
had that the winner lacked — a segment able to carry a child, for the
`2 MONTHS FREE` badge — is folded into the foundation's rule
(`display: inline-flex; gap: 6px`), with its reason beside it. The sheet's own
segments hold text alone and are unaffected.

It is deliberately **not** wrapped in `SurfaceBar`: that component is a whole
page header (eyebrow, title, meta, right slot) and this is one control inside a
modal. Move the part, not the page it came from.

**No other collision.** Greps run before this was written: `Popover` /
`useAnchoredPanel` (the top-up's dropdown is a plain in-flow list under its
button, not an anchored panel — it does not compete), `Field` / `Input` /
`Button` / `Progress` (all IMPORTED from the foundation rather than
re-implemented — that is why the first draft's fields drew no box: `Input` is
the foundation's bare input and must sit inside `Field`), `ModalScrim` (used,
not copied), `Icon` / `P` (used, not inlined).

---

## 3 · What is proposed for promotion

⚠ **Nothing moves in PR #370.** The pass's own rule is *written output first,
then ONE PR, no behaviour change* — *"the thing you should see afterwards is
nothing at all"* — so this section lists candidates and the move is its own
change.

### 3a · `parts.tsx` — the row grammar. **Six consumers. RECOMMENDED.**

`SettingsGroup`, `SettingsRow`, `StubControl`, `StubNote`, `SettingsToggle` and
`Bar` are imported by all six sections. They clear his bar of two real consumers
several times over.

**But the honest reading is that all six consumers are inside ONE feature**, and
his rule was written about parts appearing on multiple SURFACES. Two of the six
are the stronger candidates and two are the weaker:

- **`StubControl` + `StubNote` — promote.** These are not a settings idiom; they
  are the mechanical half of his placeholder law (out of the tab order,
  `aria-disabled`, says why). Every future section that stubs anything wants
  exactly this, and a second implementation of a stub is how a stub loses half
  its treatment — which is the defect the section-03 guard's sabotage found in
  its own first draft. **Rename on the way in:** `StubControl` → `Stub`,
  `StubNote` → `StubLabel`.
- **`SettingsRow` + `SettingsGroup` — promote, renamed `LeaderRow` and
  `SettingsGroup` → `RowGroup`.** The leader/hairline grammar is the brief's own
  words for a shape that any settings-like surface will want. Its `--rule`
  divider and its `flex: 1` spacer discipline (never `margin: auto`) are worth
  having in one place.
- **`SettingsToggle` — HOLD.** It is inert by construction today because nothing
  persists a preference. Promoting an inert control invites the next page to use
  it and inherit the inertness silently. It moves when there is a store behind
  it.
- **`Bar` — HOLD.** `foundation/primitives.tsx` already exports `Progress`, and
  the two are not yet reconciled: `Progress` takes a value and owns its colour,
  `Bar` takes a ratio and a token name because the usage section ranks by a
  greyscale ramp. **This is a collision in waiting and it should be resolved
  before either moves** — reconciling them is a rewrite, and the pass says a
  promotion that needs a rewrite is not ready. Logged here rather than done.

### 3b · `planMath.ts` / `planLadder.ts` — **HOLD, and say why.**

Three and two consumers, so they clear the count. They stay because
`foundation/` is a look-and-behaviour kit, not a place for product arithmetic:
`promotion-guard.test.ts` already bans the foundation from importing `features/`
precisely so it cannot grow domain knowledge. Plan prices are domain. If a
second feature ever needs the burn rate, `features/billing/` is the address.

### 3c · Everything else — **stays at one.** 

The six sections, `SettingsModal`, `ReferralBlock` and `ChangePlanModal` each
have exactly one importer, which is what §4 of the pass describes.
`AddCreditsModal` has four and `AccountSurfaces` two, and both stay for the same
reason as 3b: they are billing surfaces, not shared parts. `AccountSurfaces`
existing at all is the anti-duplication answer — before it, four files each kept
their own booleans and their own modal mounts.

---

## 4 · One naming accident worth fixing first

`settings.css` uses the `dp-set__` prefix for classes several of which are not
settings-specific (`dp-set__spacer`, `dp-set__linkbtn`, `dp-set__stubnote`).
**If the parts above are promoted, those three classes are renamed with them**
(`dp-spacer`, `dp-linkbtn`, `dp-stublabel`) rather than carrying settings'
vocabulary into the shared kit — the pass's naming rule, and the same mistake
`.dpc-signm` → `.dpc-modal` corrected inside casting.

---

## 5 · Verdict

**One collision found and fixed in the section's own PR** (rule 5 says check
before adding; it was checked after, which is the finding). **Four parts
proposed for promotion in a follow-up PR, two held with reasons, one collision
logged for resolution before it can move.**

That follow-up is not this shift's to merge unasked: it is a behaviour-neutral
move across the foundation boundary, and the pass says it is its own PR.
