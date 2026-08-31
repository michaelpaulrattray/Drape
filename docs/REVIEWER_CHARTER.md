# THE REVIEWER'S CHARTER — distilled project law for PR reviews

> **DERIVED SUMMARY, NEVER A SECOND AUTHORITY** (#161, founder-approved
> 2026-08-27). This file is the review-sized reading of `CLAUDE.md` for the
> Gatekeeper's ordinary reviews. **On any conflict, CLAUDE.md wins** — every
> section below names the CLAUDE.md section it distils; open that section
> whenever the charter's compression hides something the diff needs.
> Money/auth-labelled PRs do not read this file at all: their reviews read
> CLAUDE.md in full, because that is where the deep context has paid.
> The drift guard (`server/reviewerCharter.test.ts`) derives the invariant
> and law headings below from CLAUDE.md itself and reddens when CLAUDE.md
> gains or renames one this charter lacks.

## What Drape is (CLAUDE.md header, "Project context")

AI fashion studio: cast AI models (image generation), digitize garments, run
virtual try-on, iterate on an infinite canvas. **Commercial product heading
for public launch — billing, credits, and auth code are production-critical;
treat changes there conservatively.** Design taste: restrained, editorial,
monochrome; less is more.

## The fidelity law (CLAUDE.md "The fidelity law", verbatim)

Never take the path of least resistance on quality. When a capability
exists as a dedicated, proven tool — a segmentation model instead of
hand-drawn shapes, a matting model instead of a binary outline, a real
library instead of an approximation — use the dedicated one, even when
the approximation is nearer to hand. The convenient substitute silently
caps the ceiling of everything built on top of it.

Shortcuts are permitted only when **declared**: scaffolding-first is
legitimate engineering, but the report must say "this is scaffolding,
the real source lands next," and the real source must be on the board.
A lesser path taken *silently* — shipped as if it were the real thing —
is the violation. When you notice a diff approximating where a dedicated
tool exists, name the tradeoff; a declared shortcut passes, a silent one
is a finding.

## Working laws (CLAUDE.md "Working laws" — rules verbatim, histories cut)

1. **Reports are claims; artifacts are facts.** Never assert what a file,
   image, log, or database row contains from memory or from another report —
   open the artifact itself, at the resolution the claim needs.
2. **Verify the instrument before believing its finding.** A new metric,
   reader, or checker gets a negative control and a positive control before
   its verdicts count for anything. A green suite proves nothing if the
   checker cannot fail.
3. **A backstop needs a test the model cannot rescue.** If the only test of
   a guard runs through an LLM that usually behaves, the guard is untested.
   Drive it directly.
4. **Derive, never mirror.** A second list shadowing a source of truth
   always drifts from it. Build derived views, not parallel copies.
5. **Assert at the wire.** Contracts about what gets sent are proven on the
   outgoing request, not on a constant near it.
6. **Render before shipping anything visual.** No visual change ships
   without being looked at in the running app first.
7. **Fix the class, not the instance.** A bug found once is a pattern until
   proven unique. Before declaring any defect fixed: name its class, sweep
   the rest of the feature — and any code sharing the shape — for siblings,
   and fix or explicitly file every one found. The sweep is part of the fix.
   The same law pointed at rulings: **when a ruling closes a path, the sweep
   asks what was bolted to it** — asked at the closing commit, not later. A
   control that stops being reachable leaves no failing test and no error,
   only a green suite and a document that still describes it. (Three real
   controls have died this way; full record in CLAUDE.md law 7.)
7b. **Never guess — test or confirm before stating.** Every factual claim
   about the product cites a driven artifact, or the check runs in the same
   turn, or the claim says "unverified" and is then verified. This binds
   review findings too: a finding asserting what the product does is a claim
   — cite the line, or drive it.
8. **This is a visual studio, not a maths class.** The user's ontology
   governs design: edits are scoped and named the way a stylist,
   photographer, or casting director thinks. Pixel deltas, masks, and
   metrics are the implementation and verification layer — they serve the
   stylist's promise and never frame the product.
9. **The founder's eyes are king — always.** A model's reading of an image
   is never the final word on what a frame shows. A reader's output is a
   pointer to look, not a fact to file; frames go in front of eyes.

## Review priorities (from `review.yml`'s own prompt — the job, in order)

1. **Correctness bugs** — concrete inputs/state that produce wrong output, a
   crash, or lost money (credits charged without delivery, refunds that
   cannot fire).
2. **Enforcement-invariant violations** (the nine below): owner scoping
   missing from the SQL statement itself, userId taken from input instead of
   ctx.user.id, missing `.strict()` on new input schemas, bare selects or
   spread rows crossing the serialization boundary, a new public endpoint or
   session-mint site outside the enumerated lists.
3. **Flag discipline**: new reachable behavior not governed by its feature
   flag (new code must land dark), or a change that alters unflagged
   behavior as a side effect.
4. **Controls**: any deletion or refactor that could orphan a control (a
   caller of a guard being removed) — name what was bolted to the deleted
   path.
5. **Tests**: a bug fix without its failing-test reproduction, or a class
   fix without its sweep.

Report most-severe first, each with file:line and a one-sentence failure
scenario. If the diff touches billing, credits, auth, or session code, say
so in your first line. If you find nothing, say what you checked and pass it
cleanly — do not invent findings.

## Enforcement invariants (CLAUDE.md "Enforcement invariants" — rules kept, measurement histories cut)

The access grid says *what*; these say *where*. Every defect found in July
2026 was a procedure that "knew" the rule and applied it in the wrong place.

1. **Scope the owner in the statement that reads or writes.** A `SELECT` to
   check ownership followed by a write keyed on id alone is insufficient —
   it leaves a check-then-write race. Pass `ownerId` into the db helper and
   put it in the `WHERE`, or scope through the parent with a join or
   subquery.
2. **Re-anchor child ids to the owned parent in that same statement.**
   Verifying `boardId` does not validate the `itemIds` sent alongside it.
3. **`userId` always comes from `ctx.user.id`** — never from procedure
   input. Applies to record scoping, credit spend, quota, and rate-limit
   keys.
4. **`.strict()` on every input schema**, so unknown fields are rejected
   rather than silently dropped. Required on all new code. The measured
   state is three-valued — `strict` / `open` / `none` — and only `open` is a
   finding (a procedure with no `.input()` at all never receives unparsed
   input). Two standing rules from this invariant's history: **a billing
   input field is removed only after clients have stopped sending it for one
   full deploy, never in the commit that stops sending it** (with `.strict()`
   on, deleting a field an in-flight bundle still sends is a BAD_REQUEST on
   a money surface mid-deploy); and `.strict()` sits INSIDE `.optional()`
   where both exist (`ZodOptional` has no `.strict` in zod 4).
5. **Public endpoints are an enumerated allowlist.** Each is rate-limited,
   `.strict()`-validated, and structurally unable to mutate another user's
   data. Adding one is a deliberate decision, not a default. Counts and
   names live in CLAUDE.md invariant 5: **twelve public tRPC endpoints**,
   the public Express routes, and **six authenticated, user-rate-limited
   Express routes** (`/api/image-proxy`, `/api/evidence/:kind/:entityId`,
   `/api/cast/:castId/sheet`, `/api/ink-design/:designId`,
   `/api/reference/:referenceId`, `/api/crew/eye-frame/:frameName`). A route
   that exists but is not on the list is how the list stops being the list —
   a new route lands ON the list in the same commit, or it is a finding.
6. **Rate limits return a real `TOO_MANY_REQUESTS`**, not a 200 carrying an
   error field the client cannot distinguish from a validation failure.
7. **A control that is not invoked does not exist.** If a diff adds a
   protection, something must call it on the request path, a test must prove
   it *blocks*, and it must refuse — not allow — when a dependency is
   missing or unconfigured.
8. **Read paths return an explicit projection.** Never let a bare `select()`
   or a spread DB row cross the serialization boundary — that is how
   `passwordHash` reached `auth.me` and image URLs reached the moderator
   surface. Sensitive field groups stay out by construction, not by callers
   remembering to omit them.
9. **Every route that mints a session cookie enforces the same gates as
   login.** There are **five mint sites, in three modules** (`emailAuth.ts`
   ×2, `googleAuth.ts` ×2, `emailVerification.ts` ×1 — the enumerated gates
   per site are in CLAUDE.md invariant 9, guarded by
   `server/sessionIssuanceSites.test.ts`). A sixth site, or a mint from a
   module not named there, is a finding regardless of its gates.

## Access grid + the sensitive field groups (CLAUDE.md "Access control")

| Resource | Anonymous | Signed in, unapproved | Signed in, approved | Moderator | Admin |
|---|---|---|---|---|---|
| Models / casts | none | none | read/write/delete own | generation metadata only | same as moderator |
| Boards, items, edges | none | none | read/write/delete own | none | aggregate counts only |
| Wardrobe | none | none | read/write/delete own | none | aggregate counts only |
| Credits / billing | price lists only | none | read own, checkout own | read any transactions | adjust any |
| Registry (minted casts) | none — route deleted | none | none | none | none |
| Audit logs | none | none | none | read any | read any |
| Admin actions | none | none | none | none | write any |

Resources not in the grid default to **owner-only for users, none for
staff**. Unapproved accounts may sign in and redeem an access code, nothing
else — `protectedProcedure` enforces this; the exemptions are enumerated and
pinned by `server/approvalGate.test.ts`.

Two boundaries that are product commitments, not conveniences:

- **Never expose `masterPrompt`, `technicalSchema` or `preferences` outside
  the owning account.** Together they are the complete recipe for
  reproducing a cast — treat them like a password. A diff adding any of them
  to a staff projection is a severe finding.
- **"Metadata only" for staff**: moderators/admins see that a generation
  happened (kind, timestamp, cost, status, `hasResult`) — never the creative
  content or image URLs (`server/staffImageBoundary.test.ts` guards it).

Generated images sit at permanently public R2 URLs by design (persisted in
DB, never presigned); every storage key uses `crypto.randomUUID()`. Server
code returns storage KEYS to clients, never raw bucket URLs, for customer
uploads (references, ink designs).

## The money/auth path map (what always earns a full-CLAUDE.md review)

The triage's own definition — a diff touching any of these is money/auth:

- `server/routes/billing|credits|auth|emailAuth|googleAuth|emailVerification`
- `server/db/billing.ts`, `server/db/credits.ts`
- `server/stripe/`
- `server/_core/sdk.ts`, `cookies.ts`, `trpc.ts`, `env.ts`
- `server/security/`
- `shared/const.ts`
- `drizzle/` (schema and migrations)

Money-path review instincts that have paid: per-slice billing (a roll is
eight independently refundable units); a charge that does not land must
restore the prior state, not invent a new one; refunds keyed on their own
operation reference so two refund paths cannot collide; recovery fails
CLOSED (no lock → no guess).

## Flag discipline (`docs/architecture/FEATURE_FLAGS.md`, carved out of CLAUDE.md by #330)

- **Grammar**: scope flags are `off`/absent, `all`, or `users:<ids>`; absent
  means off. New capability lands DARK behind its flag; with the flag off
  the governed road must be byte-identical to today's (measured law:
  **context is not additive** — a prompt change leaking to unflagged
  accounts changes every cast in the product).
- **Parent chains fail startup**: a child scope non-off with its parent not
  covering its users refuses boot (`validateEnv()`). A new flag declares its
  parent; a review checks the chain exists and is asserted.
- **Tables before flips**: a flag whose road writes a table names the
  migration as a flip prerequisite; the deploy rite compares
  `information_schema` to `drizzle/schema.ts` and
  `scripts/lib/productionFlagPositions.mts` records where every governed
  variable is meant to stand.
- **A flag that exists and has no entry in `docs/architecture/FEATURE_FLAGS.md`
  is a finding**, and so is an entry with no locator row in CLAUDE.md's flag
  index (`server/claudeMdFlagEnumeration.test.ts` derives both populations
  from the code and from each file's own markup — the
  list-stops-being-the-list class). **The catalogue is the law; the index is
  a locator.** A rule stated in an index row is the finding, not the fix.
- **Capability atlas, same commit**: a capability change (new door/refusal/
  gate, moved copy, routing, flags) ships with its
  `docs/architecture/capability-atlas` entry in the same commit —
  `pnpm capability:check` enforces it.
- **Architecture Atlas**: after changing routes, schemas, DB access,
  ownership rules, billing, workers, queues, providers, storage, flags or
  domain boundaries, `pnpm architecture:generate` runs and the diff is
  reviewed with the change. Generated files are never hand-edited or
  hand-merged.

## Controls that are documented but NOT enforced (do not assume them)

From CLAUDE.md "Currently not enforced": the admin allowlist admits everyone
when empty (and it is empty in production — admin access is role-only);
Slack approval for sensitive admin actions was never wired; IP blocking is
recorded but never checked on a request; the "immutable" audit log's hash
chain is in-memory and resets every deploy. A diff relying on any of these
as a real control is a finding; a diff that would orphan one of the controls
that DO exist is the path-three death class (law 7) — grep along the dying
branch before approving a removal.

## Standing product facts a review should not re-litigate

- Deploys landing mid-roll are a known, accepted collision class — per-slice
  billing + the recovery sweep is the designed answer; do NOT ask for drain
  infrastructure (founder ruling 2026-08-01).
- Unit tests never touch the live database (`vitest.setup.ts` strips
  `DATABASE_URL`); suites needing a DB skip without a disposable
  `TEST_DATABASE_URL`. HTTP suites are `*.integration.test.ts`, excluded
  from `pnpm test`.
- Client state is Zustand per feature; server state is tRPC + TanStack Query
  only. Design tokens in `client/src/styles/tokens.css`; no hardcoded
  colors/spacing.
- The mailbox (`.agents/`), `CLAUDE.local.md`, and `.codex/` are never
  repository content; generated Atlas files are never hand-edited.
