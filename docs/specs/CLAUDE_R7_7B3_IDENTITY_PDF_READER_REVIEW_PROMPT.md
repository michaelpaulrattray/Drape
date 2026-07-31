# R7-7B3 identity-PDF reader authority — read-only review

Review only the staged R7-7B3 identity-PDF authority slice at baseline `0d3adb5`.

Return exactly one verdict:

- `APPROVE — safe to commit R7-7B3 identity-PDF authority locally`
- `REQUEST CHANGES` with a concrete reachable blocker

This review can authorize only a local commit. It cannot authorize push, deploy,
Railway variables, snapshot-read enablement, migration, convergence, production
contact, pin work, Wardrobe adoption, or any later R7 work.

Do not edit, stage, commit, push, deploy, run a database, change environment
variables, or contact storage/provider services. Read the full staged diff and
the surrounding production code; do not trust the tests or this prompt's claims.

## Intended staged scope

Exactly these five files:

1. `server/casting/snapshotPdfImages.ts` (new)
2. `server/casting/snapshotPdfImages.test.ts` (new)
3. `server/routes/generation/castingExport.ts`
4. `server/batchB-status-readmodel.test.ts`
5. `server/r7-snapshot-selection-contract.test.ts`

The intentional two-line sender/reply-to change in
`server/routes/emailVerification.ts` must remain unstaged and untouched.
`.agents/`, `.codex/`, `CLAUDE.local.md`, brand documents, the R7 plan, and all
`CLAUDE_*` review prompts must remain unstaged.

## Product contract

This closes the explicit R7-7B plan gap where `generation.generatePdf` accepted
client-submitted image data as the authority for an official Cast identity PDF.

- R6 users keep the existing behavior exactly: their client-prepared `images`
  object is passed to the PDF generator unchanged.
- Snapshot-enabled users cannot choose the PDF's Cast images. The server resolves
  the current effective snapshot once, uses the package's exact selected views,
  fetches those immutable asset URLs itself, and ignores the input `images`.
- Snapshot-enabled PDFs use the immutable identity snapshot's prompt, technical
  schema, and preferences, not mutable legacy identity documents.
- The slice is free/read-only: no credits, Gemini, R2 writes/deletes, DB writes,
  schema, migration, client, or pin behavior.
- `R7_SNAPSHOT_READ_SCOPE` remains off/unset; this commit alone changes no live
  account.

## Required verification

Challenge every point against reachable production code:

1. `generatePdf` captures `captureSnapshotReadMode(ctx.user.id)` exactly once at
   mutation entry. Read mode is never accepted from Zod/client input.
2. R6 mode retains the prior owner check, lifecycle/export-eligibility law,
   PDF preferences, master prompt fallback, and exact client `images` object.
   No snapshot resolver or image resolver runs in R6 mode.
3. Snapshot mode uses `resolveEffectiveCastStateForRead({ userId, modelId })`.
   Foreign/missing subjects remain non-leaking NOT_FOUND; corrupt/headless state
   refuses through the existing typed fail-closed reader, with no bootstrap or
   convergence fallback.
4. Snapshot mode requires `effective.status === "current"` before image
   preparation and never invents a package for a headless Cast.
5. Snapshot identity authority comes from
   `effective.identity.masterPrompt`, `.technicalSchema`, and `.preferences`.
   Mutable `models` identity fields cannot replace those values.
6. Snapshot image authority comes only from `effective.selectedViews`.
   A forged `input.images` value is ignored and cannot enter
   `generatePremiumIdentityPdf`.
7. All six canonical angles map through the shared `VIEW_TO_PDF_KEY` contract.
   There is no hand-written second angle map.
8. The selected view URL is server-owned snapshot state. The helper nevertheless
   revalidates each URL with `validateProxyUrl` before network access.
9. Fetch uses `redirect: "error"` so an allowlisted asset URL cannot redirect to
   an untrusted/internal origin.
10. Only successful `image/*` responses are considered. Declared size over
    20 MiB refuses before reading; streaming reads enforce the same 20 MiB cap
    even without a trustworthy Content-Length.
11. Actual magic bytes, not a MIME header, must identify JPEG, PNG, WEBP, or GIF.
    Unsupported/empty/spoofed image bodies refuse; the emitted data URL uses the
    verified byte format.
12. Fetch failures, stream failures, invalid URLs, HTTP failures, invalid bodies,
    and over-size bodies become `SnapshotPdfImageError` with one static message.
    URLs, storage keys, provider text, credentials, and raw errors cannot leak.
13. The route maps only that typed helper error to a static
    PRECONDITION_FAILED message including truthful `No credits were used`.
    Unexpected programming errors are not falsely relabeled.
14. PDF export eligibility is unchanged and still independently requires minted
    lifecycle truth plus a valid agency id. Snapshot reading does not weaken it.
15. A coherent effective state is resolved before fetching. A concurrent head
    advance cannot mix two package selections because the selected rows and
    immutable URLs are already captured; deletion/asset unavailability fails
    closed during fetch.
16. `snapshotPdfImages.ts` imports/calls no DB writer, operation gate, credits,
    Gemini/provider generator, storage SDK, logger, or mutation authority.
17. The helper has exactly one runtime caller:
    `server/routes/generation/castingExport.ts`. The contract test pins this and
    does not weaken the existing snapshot-transition/read caller guards.
18. No public response contains asset URLs, storage keys, snapshot rows, identity
    schema, or prompt text. The route still returns only the generated base64 PDF,
    filename, and success.
19. Behavioral tests call the real `appRouter` generatePdf procedure and prove:
    R6 preserves client images; snapshot mode ignores forged client images and
    uses immutable snapshot documents; preparation failure stops PDF generation.
20. Helper tests prove allowlist-before-fetch, redirect refusal configuration,
    canonical mapping, actual-byte validation, declared/stream/body refusal, and
    static no-leak errors.
21. No disposable-DB run is required by this bounded slice: it adds no DB query
    or write law; `resolveEffectiveCastStateForRead` and its closure/ownership
    behavior were already real-MySQL-gated in R7-7B1/B2/B3. Confirm the new tests
    do not fake a new database guarantee.
22. Scope is exactly the five intended files. No schema, migration, billing,
    storage mutation, client, Wardrobe, pinning, operation receipt, deletion, or
    snapshot transition code moved.

## Challenge these likely holes explicitly

- Could a crafted client `images` payload still reach the snapshot PDF through
  another property, fallback, or error path?
- Could a legacy R2/Manus/CDN image with misleading metadata still work when its
  actual bytes are a supported PDF format?
- Could a response with no Content-Length exhaust memory before the limit is
  enforced?
- Could redirects, DNS/URL parsing, an unsupported format, or an upstream error
  disclose private data in tRPC/log output?
- Could a selected failure marker, cross-model asset, duplicate angle/asset, or
  empty URL reach this helper? Confirm the effective-state resolver already
  refuses those closure violations, and that the helper still fails on null URL.
- Could snapshot mode fall back to mutable R6 documents or newest-filled ledger
  images when snapshot truth is missing?
- Could the change accidentally make R6 depend on server-side public-image
  fetching or change its current export behavior?
- Is it honest that this slice performs server-side HTTP reads but no storage
  API call or database write, and that it cannot spend credits?

## Recorded local evidence (verify independently where safe)

- `pnpm check` — clean.
- Focused suites:
  - `server/casting/snapshotPdfImages.test.ts`
  - `server/batchB-status-readmodel.test.ts`
  - `server/r7-snapshot-selection-contract.test.ts`
  - `server/exportViews.test.ts`
  - `server/modelLifecycleGuard.test.ts`
  - result: 79/79 passed.
- Full unit suite: 2,606 passed / 159 environment-gated skipped / 0 failed.
- `pnpm build` — passed.
- `git diff --check` — clean.

Keep non-blocking observations separate from the verdict.
