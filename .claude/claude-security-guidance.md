# Drape security rules (distilled from CLAUDE.md + the 2026-07 audit)

Authority: the Architecture Atlas at `docs/architecture/drape-architecture.json`
(regenerate with `pnpm architecture:generate`) mechanically tracks public
endpoints, non-strict inputs, and boundary findings. If a diff changes routes,
schemas, ownership, billing, workers, or storage, the Atlas must be regenerated
in the same change.

## Ownership and identity

- `userId` MUST come from `ctx.user.id`, never from procedure input — for
  record scoping, credit spend, quota, and rate-limit keys alike.
- Ownership is enforced IN the statement that reads or writes: `ownerId` in the
  `WHERE`, or scoped through the owned parent via join/subquery. A separate
  ownership SELECT followed by an id-keyed write is a check-then-write race and
  a finding.
- Child ids sent alongside a verified parent (e.g. `itemIds` beside `boardId`)
  must be re-anchored to the owned parent in that same statement.

## Input and output boundaries

- Every new input schema gets `.strict()`. Unknown fields are rejected, not
  dropped. Mandatory on all public/auth/billing schemas.
- Read paths return an explicit projection. A bare `select()` or spread DB row
  crossing the serialization boundary is a finding (this is how `passwordHash`
  once reached `auth.me`).
- `masterPrompt`, `technicalSchema`, and `preferences` are the complete recipe
  for a customer's cast — treat like passwords. They must never appear in any
  response outside the owning account, in any staff projection, or in logs.
- Staff (moderator/admin) surfaces get generation METADATA only — kind,
  timestamp, cost, status, `hasResult`. Never image URLs, prompts, or creative
  content. Admins inherit the whole moderator surface via middleware.

## Public and session surfaces

- Public endpoints are an enumerated allowlist (Atlas `public-endpoint`
  findings). Adding one is a deliberate decision: rate-limited, `.strict()`,
  structurally unable to mutate another user's data.
- Any route that mints a session cookie must enforce the same gates as login
  (approval, suspension). A new issuance site is an enumerated decision.
- Unapproved accounts reach ONLY the onboarding surface (`access.redeem`,
  `access.status`, `auth.me`, `auth.logout`). Widening that set is a finding.

## Money

- Rate limits return real `TOO_MANY_REQUESTS`, never a 200 with an error field.
- Charges precede durable authority (Sign) or follow dispatch (rolls); every
  charge must map to a delivered or refunded unit. No path may charge without a
  ledger row.
- Refunds are typed (`refund:`, `refund:correction:`) — never automatic
  windfalls.

## The house defect class: invoked-but-inert

- A control that is not invoked on the request path does not exist. New
  protections need a call site, a test that proves they BLOCK, and must refuse
  (not allow) when a dependency is missing or unconfigured.
- Backstops need a model-free test: if the only test goes through an LLM
  interpreter, the backstop is untested. (A `\b` in a JS template literal is a
  backspace, not a word boundary — this shipped an inert regex once.)
- Storage keys use `crypto.randomUUID()`; `Math.random()` in storage writers is
  rejected repo-wide. R2 URLs are permanently public by design — never write
  private-class content (evidence, rejected frames) to the public bucket; the
  evidence adapter fails toward privacy when unconfigured.

## Known-inert (do not credit these as mitigations)

Admin allowlist (empty in prod), Slack approval flow (self-approves when
unconfigured), IP blocking (recorded, never checked), audit-log hash chain
(in-memory, resets on deploy).

Purchase velocity limits left this list on 2026-08-19 by **deletion** rather
than by wiring (founder default; CLAUDE.md carries the reasoning). Do not credit
a purchase cap as a mitigation and do not resurrect the helpers — there is no
application-side fraud cap on credit purchases, and the next one starts as a
product design. The same day, the site-wide login-attack alarm left it by the
other door: `server/security/loginAttackAlert.ts` is wired onto the admin and
moderator panels, with an in-memory counter that resets on deploy.
