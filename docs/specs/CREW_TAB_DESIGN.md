# THE CREW TAB — the Desk moves into the product (issue #41)

> **Status: built.** Design-time record — the feature shipped (/admin/crew is live, CREW_TAB_SCOPE=all since 2026-08-25); the code and CLAUDE.md govern current behaviour (#69 stamping sweep, 2026-08-28).


Designed by the Foreman's Fable seat, 2026-08-25 (shift 3), against issue #41
(founder, verbatim: the Desk artifact belongs to his Claude account; he swaps
to the co-founder's account within the week, so shifts could not update the
briefing while he is swapped — *"build the Crew tab as a real admin-panel page
in Drape before the swap"*). Deadline-shaped. Per PROGRAM.md's routing, Fable
designs the store and page; Opus executes to this spec; the executing shift
verifies at the artifacts.

## §0 What it is, in one paragraph

A page at `/admin/crew` that shows the founder the same things the Desk
artifact shows him today — the program banner and ladder, the cards that need
his word (with a reply box on each), the build pipeline, open problems, and
the journal thread — rendered from a store the night shifts write, with his
replies written back where the shifts will actually read them. After it is
live, WHICH Claude account anyone is logged into stops mattering: the
briefing and the steering wheel live in the product he already opens.

## §1 The store — two halves split by WHO WRITES, one page merges them

The Desk today is one JSON blob that both sides edit, and that shape is
exactly what breaks under the account swap. The Crew tab splits the store by
writer:

- **The briefing half** — everything the SHIFTS say (program, ladder,
  pipeline, needs-you cards, problems, shift journal) — is a JSON file in the
  repository, shipped to production by the same deploy-rite push every shift
  already makes. Git is its audit trail and its merge discipline; the WIP cap
  (one shift at a time) is its lock.
- **The reply half** — everything the FOUNDER says — is a database table
  written only through an `adminProcedure` mutation from the page itself,
  with his existing session. No new auth surface of any kind.

Why not one DB blob the shifts write directly: a shift writing production
rows outside deployed code is exactly the class of direct production change
CLAUDE.local.md reserves for the founder, and a new write credential for
shifts is a new attack surface on an admin store. Why not one repo file both
write: the founder would need a terminal, which is the problem this issue
exists to end. The split gives each writer the road it already owns.

**Acknowledgement is honest by construction.** The briefing JSON carries
`acknowledgedReplyIds`; the page marks a reply "seen by the crew" only when a
DEPLOYED briefing edition names its id. No timestamp theatre — a reply is
seen when the team's own next push proves it was read.

## §2 The briefing half — `server/crew/crew-briefing.json`

### Files

- `server/crew/crew-briefing.json` — the state itself. Tracked, deployed.
- `server/crew/crewBriefing.ts` — the zod schema, a lazy cached parse, and
  the degraded-state fallback (below).

### Schema (zod, `.strict()` at every level)

```ts
{
  edition: number,            // monotonically increasing; a shift bumps it once
  updatedAt: string,          // ISO datetime
  shift: string,              // e.g. "foreman-3" — who wrote this edition
  program: {
    mission: string,          // one sentence, product terms
    focus: {
      state: "confirmed" | "proposed" | "none",
      title: string,          // e.g. "The creative register (#16)"
      quote: string | null,   // the founder's verbatim word that set it
      quotedAt: string | null,
    },
    milestone: {
      title: string,
      steps: { title: string; state: "done" | "in-progress" | "waiting" | "blocked" }[],
    } | null,
    ladder: { key: string; title: string; state: "done" | "current" | "queued" | "parked" }[],
    // #74 (founder UX feedback, 2026-08-25): at-a-glance chips. A chip is a
    // CLAIM, so `source` names the reading it was taken from — a receipt, a
    // commit, a row. Max 6, so the strip stays a glance.
    chips: { label: string; tone: "good" | "warn" | "neutral"; source: string | null }[],
  },
  // #75 (founder ask, 2026-08-25): judgements waiting on his EYE. Frames live
  // in the bucket under crew-eye/<uuid>.<ext>; the DEPLOYED briefing is the
  // serving allowlist — /api/crew/eye-frame (the sixth authenticated Express
  // route) refuses any key no edition names. His verdict is a reply on the
  // item's id, exactly like a card.
  eyeItems: {
    id: string,               // stable slug; replies point at it
    title: string,
    question: string,         // what he is JUDGING — leads the item
    state: "open" | "answered" | "done",
    filedAt: string,
    issueNumber: number | null,
    frames: { key: string; caption: string; arm: string | null }[],  // 1..24
  }[],
  needsYou: {
    id: string,               // stable slug, e.g. "rebaseline-countersign"
    title: string,
    productImpact: string,    // LEADS the card — his standing order
    workedExample: string | null,
    options: { key: string; label: string; consequence: string }[],  // may be []
    recommendation: string | null,   // stated first when options exist
    state: "open" | "answered" | "done",
    filedAt: string,
    issueNumber: number | null,
  }[],
  pipeline: {
    id: string,
    title: string,
    status: "building" | "in-review" | "waiting-founder" | "merged" | "blocked",
    prNumber: number | null,
    note: string | null,
  }[],
  problems: {
    id: string,
    title: string,
    detail: string,
    severity: "info" | "warning" | "urgent",
    state: "open" | "resolved",
  }[],
  journal: {                  // SHIFT entries only; his notes arrive as replies
    at: string,
    shift: string,
    text: string,             // plain English, product terms — Desk tone rules
  }[],                        // capped at 40; older history lives in git
  acknowledgedReplyIds: number[],
}
```

### Parse discipline — the briefing may NEVER take production down

The prod boot-guard incident (2026-07-31, crash-loop) is the law here: the
briefing is a page, not a dependency. `crewBriefing.ts` does NOT parse at
import. It parses lazily on the first `crew.getState` call and caches; on a
parse failure it returns a degraded state — empty sections plus one synthetic
`problems` entry saying plainly "this edition of the briefing failed to
load; the journal in git history is the fallback" — and logs. In practice a
malformed file cannot reach production anyway (the vitest arm parses the real
file; esbuild refuses broken JSON; both run before any deploy), but the
runtime posture is degrade-and-say-so, never crash.

### How a shift writes it

At shift close (replacing the Desk-artifact update step once live): read the
founder's new replies first (§3's read script — merge, never overwrite, the
same law the artifact had), then edit the JSON — bump `edition`, refresh
`updatedAt`/`shift`, update pipeline/milestone states truthfully, append the
journal entry, add or close needs-you cards, extend `acknowledgedReplyIds`
with every reply id the shift has read — run the suite arm (or
`pnpm check` + the crew test file), and push through the deploy rite. The
briefing edit is a doc/record-class change and rides main by rite exactly as
mailbox-visible doc pushes do today.

## §3 The reply half — `crew_replies` (migration 0054)

### Table (house column style — follow `drizzle/schema.ts` conventions)

```
crew_replies
  id            int autoincrement PK
  cardId        varchar(64) NULL      -- briefing needs-you card id; NULL = journal note
  body          text NOT NULL         -- his words, verbatim, never truncated by us
  authorUserId  int NOT NULL          -- ctx.user.id, never from input (invariant 3)
  createdAt     datetime NOT NULL default now
```

- **A reply is never refused for pointing at a rotated card.** `cardId` is
  validated for shape (≤64 chars) and nothing else; a reply whose card has
  left the briefing renders in the journal thread instead of vanishing. His
  words are the steering wheel — the product never walls them.
- **No purge path, deliberately.** Replies are rulings; the table is the
  permanent record and stays small (it is one person typing).
- **The table IS the audit record** for this surface — no separate audit row
  in v1. The one writer is an admin-gated mutation that stamps author and
  time; an audit row would be a second copy of the same fact (working law 4).
- Migration `drizzle/0054_crew_replies.sql`; dev takes `pnpm db:push`;
  **production takes it by the ceremony script**
  (`scripts/ceremony-crew-replies.mts`, founder-run — house pattern), and the
  table must exist before the flag flips (flip precondition, not boot guard).

### How shifts read it

`scripts/crew-read-replies.mts` — tracked, read-only, one SELECT. Runs over
the established production read path (the railway CLI DB connection used by
the face-scan cost model reads, foreman-2). Prints every reply newer than the
last acknowledged id: id, createdAt, cardId (with the card's title when the
current briefing still holds it), and the body verbatim. A shift runs it at
shift start (step 1 of the standing orders, replacing the artifact read once
live) and at shift close before writing the briefing.

**The journal stays his control panel.** The standing-orders rule moves with
the surface: a cardless reply saying "pause the nights" / "stop" → the shift
creates `.agents/STOP`, acknowledges in its own journal entry, and exits;
"resume the nights" → delete `.agents/STOP` and confirm; "skip tonight" →
confirm and exit the shift. He should never need a terminal to steer.

## §4 The API — `crew` router, two procedures, both admin

New tRPC namespace `crew` (`server/routes/crew.ts`, merged in
`server/routers.ts` beside the existing feature routers — NOT inside the
admin flat-merge, which is a compatibility shape for legacy client calls).

- `crew.getState` — `adminProcedure`, no input. Returns an EXPLICIT
  projection (invariant 8): the parsed briefing, plus every reply as
  `{ id, cardId, body, createdAt, author }` where `author` is the display
  name resolved server-side (never the raw user row), plus nothing else.
  Answers `NOT_FOUND` when the caller is outside `CREW_TAB_SCOPE` (the ink
  precedent: a dark door does not explain itself).
- `crew.reply` — `adminProcedure`, input
  `z.object({ cardId: z.string().max(64).nullable(), body: z.string().trim().min(1).max(4000) }).strict()`
  (invariant 4). Inserts with `authorUserId: ctx.user.id` (invariant 3).
  Answers `NOT_FOUND` outside the scope. Returns the inserted reply in the
  same projection shape.

No public surface, no rate-limit exemption question — the whole namespace is
behind `adminProcedure`, which is the strongest gate the product has.

## §5 The flag — `CREW_TAB_SCOPE`

- `server/crew/crewTabScope.ts` exports
  `CREW_TAB_SCOPE_ENV = "CREW_TAB_SCOPE"` (the exported `*_ENV` constant
  pattern, so `server/claudeMdFlagEnumeration.test.ts` counts it from the day
  it exists) and the house grammar: `off`/absent, `all`, or `users:<ids>`,
  parsed in the `castingV2Scope.ts` shape.
- **No boot-time environment validation** — the tab has no dependency that
  could strand a paid path (no engine, no worker, no bytes). Its one flip
  precondition is the `crew_replies` table by ceremony, named here and in the
  CLAUDE.md entry, per the house pattern for table-backed flags.
- `scripts/lib/productionFlagPositions.mts` gains the row in the SAME commit,
  expected `off`. When the founder flips it (his hand, by the established
  variable procedure), the row moves in the recording commit as usual.
- The CLAUDE.md feature-gated entry rides the same commit (the enumeration
  arm reddens otherwise — by design).
- Both procedures consult the scope per-call; the client shows the Crew tab
  in the admin nav only when `crew.getState` succeeds (query with
  `retry: false`, nav renders on success). Flag off = the surface does not
  exist anywhere a user can see — dark, per the standing grant.

## §6 The page — `/admin/crew`

Route in `App.tsx` beside the other admin routes; page component
`client/src/pages/AdminCrew.tsx`; feature components under
`client/src/features/admin/components/crew/`. shadcn primitives, monochrome
tokens, both themes, no new dependencies. Single column, restrained,
editorial — this is a briefing, not a dashboard; no charts, no KPI tiles.

Order on the page (his reading order, mirroring the Desk):

⚠ **THE LIST BELOW IS THE ORIGINAL SIX AND IS NO LONGER THE PAGE. THE LIVING
ORDER IS `client/src/pages/AdminCrew.tsx`'s OWN DOCBLOCK, which a guard arm
pins against the JSX beside it** (`section08-guard.test.ts`). It is kept here
because it is the order he first agreed to and the reasoning below it is still
the reasoning; what follows is what has happened to it since.

**As of #437 (2026-09-02) the page reads: the program → working now → next up →
background work → needs you → for your eyes → what is not done → already dealt
with → problems → general.** Five sections below did not exist when this list
was written — WORKING NOW (#272), BACKGROUND WORK (#277), NEXT UP (#290),
ALREADY DEALT WITH (#292) and GENERAL (#293, which replaced the journal named
in item 1) — and the founder has since moved two of them: **THE PROGRAM to the
top whole** (*"yes the easier fix"*, over a split that would have lifted only
the mission line) and **NEXT UP up under WORKING NOW** (*"moving the next up
card in the crew tab under working now"*).

⚠ **This correction exists because `AdminCrew.tsx:2` names this document as the
page's design spec**, so an agent planning against §6 was planning against an
order missing half the sections. Found by the reviewer on PR #444, in a sweep
whose own grep had already matched this line — see that PR for why it was
missed, which is the more useful half.

1. **Program banner** — the at-a-glance chips (#74, each citing its reading);
   mission line; focus with its state and his verbatim confirming quote; the
   current milestone's steps with their states under a progress bar DERIVED
   from those states (never a second number); the ladder as a rung bar plus
   the compact list (done / current / queued / parked). The pipeline section
   splits in-flight from "Recently landed" (derived from `merged`), and the
   journal folds past its 8 newest merged items (#74 item 7).
2. **Needs you** — the open cards, product impact first, worked example,
   options with the recommendation stated first, a reply thread under each
   (his replies for this cardId, each marked "seen by the crew" when
   acknowledged), and a reply box (textarea + one send button wired to
   `crew.reply`, optimistic append). Answered/done cards collapse into a
   short "recently answered" list.
2b. **For your eyes** (#75) — the eye gallery, between Needs You and the
   pipeline. Each open item: the question he is judging first, then the
   frames with plain-English captions and arm labels, then his reply box
   (verdict = a reply on the item id, same honesty rule). Renders nothing
   when no items exist; closed items collapse to an "Already judged" list.
   Uploading a frame: `scripts/crew-upload-eye-frame.mts`, then name the
   printed key in the item. Frames outlive their items in the bucket —
   declared scaffolding; the Janitor sweeps keys no edition references.
3. **Pipeline** — one row per item: title, status, PR number when it has one.
4. **Problems** — severity-ordered, plain sentences.
5. **Journal** — the merged timeline: briefing journal entries and his
   cardless replies, interleaved by time, newest first. His entries visually
   distinct (they are rulings). The reply box at the top of this section is
   the "journal note" writer (`cardId: null`).

Copy rules: every user-visible string is invented-for-capability-truth (this
surface has no prototype to quote); the UI contract's evidence pack applies —
side-by-side screenshots both themes plus the copy audit, posted before the
founder gate. No dead controls: everything rendered works the day it renders.

## §7 The shift procedure changes WHEN the tab goes live — not before

Until the founder has the ceremony run, the flag flipped, and has SEEN the
page, the Desk artifact + terminal relay remain the briefing channel; this
design changes nothing about a shift's duties the day it merges (the code is
dark). The completion card carries the switch-over: once he says the Crew tab
is his briefing, `.agents/foreman/prompt.md` steps 1.4 and 3.2 are rewritten
(same shift, quoting him) to read replies via `scripts/crew-read-replies.mts`
and write the briefing JSON via the rite, and the Desk artifact becomes a
read-only mirror until he retires it. The artifact is never deleted by a
shift.

## §8 The founder's batch (goes on the completion card, all at once)

1. Run `scripts/ceremony-crew-replies.mts` against production (the
   `MYSQL_PUBLIC_URL` ceremony — his, per the local law).
2. Flip `CREW_TAB_SCOPE` — recommendation: straight to `all`, because the
   surface is already behind `adminProcedure` and the grid's admin column;
   the flag exists to keep it dark until his eyes pass it, not to narrow an
   admin page per-user. (`users:<founder,cofounder>` is the cautious option
   if he prefers.)
3. Make the co-founder's account an admin (role grant in the panel) — the
   page is only as shared as the role.
4. Test-drive list: open `/admin/crew` on both themes; reply to a card; see
   the reply appear; next shift's briefing push should mark it seen.

## §9 Proof — the arms that must exist (each able to fail)

1. **Briefing parse arm** — the real `crew-briefing.json` parses against the
   real schema; negative control: a malformed fixture refuses; the degraded
   state carries the honest problem entry instead of throwing.
2. **Access arms** — flag off → both procedures `NOT_FOUND`; flag on +
   non-admin → `FORBIDDEN` (through the real router, approvalGate style);
   flag on + admin → state returned.
3. **Strictness arm** — an undeclared input field on `crew.reply` REJECTS,
   parsed through the real router (the `publicInputStrictness.test.ts`
   method, not a token grep).
4. **Invariant-3 arm** — the insert's `authorUserId` comes from the session,
   never from input (drive with a forged field; the strict schema refuses it,
   and the row write takes ctx's id).
5. **Projection arm** — the reply projection carries exactly
   `{id, cardId, body, createdAt, author}`; a new sensitive column added to
   the users join cannot leak by construction (explicit select only).
6. **Acknowledgement arm** — a reply id present in `acknowledgedReplyIds`
   renders acknowledged; one absent does not (pure function, unit-tested).
7. **Flag enumeration** — `CREW_TAB_SCOPE` joins `claudeMdFlagEnumeration`
   automatically via its `*_ENV` constant; the CLAUDE.md entry must ride the
   same commit or CI reddens (that is the guard working, not a chore).
8. **Atlas** — `pnpm architecture:generate` in the same change (new route
   namespace, new table, new flag); `architecture:check` and
   `capability:check` green. The capability atlas is casting-scoped and needs
   no entry for an admin surface — verified by running the check, not
   assumed.

## §10 What v1 deliberately does not do

- No writes from the client to the briefing half — the page never edits the
  program, pipeline, or journal-as-briefing; those are the shifts' words.
- No notification fan-out (no email/Slack on reply) — he opens the product
  daily; v2 candidate if he asks.
- No Desk-artifact automation — the artifact retires by his word, manually.
- No markdown rendering in v1 — replies and journal render as plain text
  with line breaks (a renderer is a surface for another day; honest and
  small beats rich).
- No history UI for old briefing editions — git holds them; the page shows
  the current edition and says its number.

## §11 Opus execution brief (files + done-conditions)

Build order, one PR, branch `team/41-crew-tab`, separate worktree:

1. `drizzle/schema.ts` + `drizzle/0054_crew_replies.sql` (generate via
   `pnpm db:push` flow against dev; commit the migration).
2. `server/crew/crewTabScope.ts` (flag), `server/crew/crewBriefing.ts`
   (schema + lazy parse + degraded state), `server/crew/crew-briefing.json`
   (first real edition — seeded from PROGRAM.md's actual current state, not
   lorem), `server/db/crewReplies.ts` (insert + select, explicit columns),
   `server/routes/crew.ts` (the two procedures), wire in `server/routers.ts`.
3. `scripts/crew-read-replies.mts`, `scripts/ceremony-crew-replies.mts`
   (clone the nearest existing ceremony script's shape).
4. Client: route, `AdminCrew.tsx`, `features/admin/components/crew/*`,
   nav gating in `AdminHeader.tsx`.
5. Tests per §9; `scripts/lib/productionFlagPositions.mts` row; CLAUDE.md
   flag entry (short-and-factual house style for the undocumented-flags
   section); `pnpm architecture:generate`.
6. Done when: `pnpm check` exit 0; full `pnpm test` green;
   `architecture:check` + `capability:check` OK; the page drives locally with
   the flag on (screenshots both themes, evidence pack per the UI contract);
   PR opens through the gate with the placeholder/scaffolding declarations
   §6 requires (none expected — everything rendered is live).

The executing shift verifies every done-condition at the artifacts before the
PR opens — an Opus result is a claim like any other.
