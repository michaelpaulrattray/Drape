# Promotion pass — section 02

**Per `docs/specs/Casting-ui-ux-design/drape-redesign/PROMOTION-PASS.md`, run
before the section is called done. Written first; nothing moved.**

His own candidate for this section, verbatim on #270: *"the icon button, if a
second surface already has one"* — which he frames as *"a consumer count to
take, not an assumption to act on."* It was taken. The answer is below and it is
not the one the candidate expected.

---

## 1. What section 02 built, and who imports each thing TODAY

| part | where | consumers today |
|---|---|---|
| `SearchStub` | `foundation/ChromeStubs.tsx` | **1** — `Topbar.tsx` |
| `TopbarDivider` | `foundation/Topbar.tsx` | **1** — `AppLobby.tsx` |
| `AccountChip` | `foundation/Topbar.tsx` (module-private, not exported) | **1** — `Topbar` itself |
| `RailWorkspace` | `foundation/Rail.tsx` | **1** — `AppShell.tsx` |
| `FeedbackForm` + `FEEDBACK_PANEL_STYLE` | `features/lobby/FeedbackForm.tsx` | **2** — `LobbyUtilityMenu`, `ReportBugButton` |
| `ReportBugButton` | `features/lobby/ReportBugButton.tsx` | **1** — `AppLobby.tsx` |
| CSS: `.dp-search*`, `.dp-topbar__{context,centre,right}`, `.dp-accountchip`, `.dp-invite`, `.dp-memberstack*` | `foundation/foundation.css` | shell chrome; already in the shared sheet |

## 2. What moves

**Nothing.** Four of the six parts are already in `foundation/` because they are
the shell's own chrome — the pass promotes things INTO the foundation, and these
were born there. The two that are not are at one consumer each, except one.

## 3. The one at two, and why it still stays

`FeedbackForm` has two real consumers and would qualify on the count alone. It
stays in `features/lobby/`, on the pass's own rule 4-and-a-half — *"Not a
refactor. If a promotion needs the component rewritten to be general, it is not
ready — leave it and log it."*

**Measured rather than asserted**: `client/src/foundation/` imports **neither
`trpc` nor `sonner` anywhere** — grep over every `.ts`/`.tsx` in that directory
returns nothing. It is a presentation layer. `FeedbackForm` owns a tRPC mutation
(`bugReports.submit`), two toasts and a 10-character floor; moving it in would
put the first product mutation into the design foundation, and generalising it
first is the refactor the pass forbids.

It is also already shared at the right level: **both consumers are in the same
feature directory**, which is what the extraction was for. It moved out of
`LobbyUtilityMenu` in this section precisely so the bug button and the feedback
row could not drift apart.

**Logged**: if a third surface outside `features/lobby/` ever needs it, the
promotion is a presentational `FeedbackForm` in the foundation plus a lobby-owned
wrapper holding the mutation — a rewrite, and a card of its own.

## 4. THE COLLISION — and his candidate is the loser

Grepped the foundation before proposing anything, as rule 5 requires. **There are
THREE ways to draw an icon button in this codebase and section 02 used the
third:**

| implementation | consumers today |
|---|---|
| `foundation/primitives.tsx` → `IconButton` | **1** — `pages/CastingFoundation.tsx`, which is the foundation's own SPECIMEN page |
| `components/design-system/Button.tsx` → `IconButton` (a second, unrelated declaration of the same name) | **0** outside its own module |
| the raw class — `<button className="dp-iconbtn">` | **6** — `Topbar`, `Rail`, `ChromeStubs`, `LobbyUtilityMenu`, `ReportBugButton`, `FeedbackForm` |

**Rule 6 — *"when two implementations collide, the one with real customers
wins"* — points at the RAW CLASS, not at the primitive.** `foundation`'s
`IconButton` has exactly one importer and it is the specimen page that exists to
display primitives; that is a demonstration, not a customer. Its API is also
thinner than the call sites need: it sets `title` and `aria-label` from one
`label` prop, while five of the six live sites want `aria-haspopup`,
`aria-expanded`, a `ref` for `usePopover`, and a `title` that differs from the
accessible name.

⚠ **AND THE SECOND `IconButton` IS THE 00b-POPOVER SHAPE AGAIN.** Two
declarations of one name in one client tree, in two kits, is how three popover
implementations happened — the thing #262 was written to stop. It is named here
so the next author meets it as a known collision rather than a discovery.

**Nothing is moved on this finding.** Rule: *written card first, then the move* —
and #262's own six promotions are still waiting on his word, so a shift folding
three icon-button implementations together tonight would be starting the move he
has not authorised. **Carded.**

## 5. Naming accidents

None found. Every part this section added is named for what it is on any page
(`SearchStub`, `TopbarDivider`, `RailWorkspace`), and nothing carries a section
02 word into the shared kit.

## 6. Output

- **Moves: none.**
- **Stays: everything**, with the reasons above.
- **Collisions found: one**, three-way, on the icon button; the raw `dp-iconbtn`
  class wins on real customers and his primitive loses. Carded, not acted on.
- **The thing you should see afterwards is nothing at all** — and there is
  nothing, because nothing moved.
