# R7-7C5 — private evidence delivery execution plan

**Status:** implementation plan for review. It authorizes no schema change,
bucket creation, variable change, upload, scope enablement, or production
operation by itself.

**Authority:** D-65, D-68, the deployed R7-7C evidence boundary, the R7-5
exact-key cleanup contract, and the access-control invariants in `CLAUDE.md`.

## 1. Product result and hard boundary

R7-7C5 installs the production delivery adapter selected by the founder:

- reference plates and evidence crops live in a separate private R2 bucket;
- an owner sees them only through a same-origin authenticated Drape endpoint;
- images render through ordinary in-product image surfaces with no extra
  prompt, download ceremony, or manual refresh;
- no permanent public URL, presigned URL, raw storage key, bucket name, or
  provider response crosses the client boundary;
- cleanup records the owning storage backend per object and deletes through
  that backend;
- the feature flag remains off throughout migration, adapter deployment, and
  bucket configuration.

This slice does not add a new product-facing surface, call Gemini, create
candidates, charge credits, accept tattoo evidence, change snapshots, write
`model_assets`, or start R7-7D. It may add the shared evidence-image delivery
component required to make existing and future surfaces render private images
without degraded UX. A later founder-only ceremony is the first operation
allowed to upload or serve real evidence.

## 2. Founder privacy ruling

Customer-uploaded reference images may contain real likenesses. Drape chooses
the strongest posture:

1. a dedicated private evidence bucket;
2. no public development URL and no permanent unauthenticated URL;
3. no presigned object URL in API results;
4. an authenticated owner-scoped Drape delivery endpoint;
5. exact-key cleanup routed to the same private bucket;
6. evidence objects never share the public generated-image bucket.

The current `R2_BUCKET` remains the permanent-public product-image bucket.
Making that bucket private would break persisted customer image URLs, so it is
not reused or reconfigured.

Privacy is not permission to degrade the product. The private boundary must be
transparent in Studio/Canvas/Wardrobe: ordinary image elements, stable aspect
ratios/placeholders, conditional browser caching, and no repeated full object
download when immutable content is unchanged.

## 3. Explicit cleanup authority — migration `0012`

Add `storageBackend` to `storage_cleanup_items` as a non-null closed value:

- `public_r2` — default for every pre-0012 row and every existing product
  image/object writer;
- `private_evidence_r2` — reference plates, crops, and future reviewed
  evidence/candidate objects only.

The default makes old rows and old manifest inserts migration-compatible.
Runtime manifest construction becomes explicit:

```text
{ storageKey, storageBackend }
```

No worker infers a bucket from a prefix, URL, batch kind, caller, or current
environment. `storageKey` is an object identifier; `storageBackend` is the
durable deletion authority.

Migration order is migration first, runtime second. Old runtime plus the new
column remains compatible because the default is `public_r2`. An
adapter-capable runtime performs a startup schema assertion and refuses to
boot unless `storage_cleanup_items.storageBackend` exists with the expected
closed values. This makes new-runtime/old-schema skew an enforced refusal,
not merely an unsupported posture. Independently, any manifest write against
an old schema would fail inside the enclosing deletion transaction rather
than partially deleting database state. Migration `0012` is forward-only and
does not move or rewrite any existing object.

## 4. Manifest construction

`buildStorageCleanupManifest` and `createStorageCleanupManifestIn` accept
explicit objects rather than an untyped key list. Every current caller is
updated:

- existing Cast assets, generation outputs, Wardrobe outputs, Canvas outputs,
  profile images, attachments, and account-owned public objects use
  `public_r2`;
- every `casting_evidence_ingestions`, `model_reference_plates`, and
  `model_evidence_crops` key uses `private_evidence_r2`;
- discard and stale-ingestion recovery create one private-evidence cleanup
  item;
- model/account deletion may create one mixed batch whose individual items
  retain their own backend.

Deduplication within a batch is by `(storageBackend, storageKey)`, not key
alone. The existing `uq_storage_cleanup_items_batch_key` index becomes
`UNIQUE(batchId, storageBackend, storageKey)`. It deliberately remains
batch-scoped: the same backend/key may appear in a later cleanup batch when a
pending evidence discard is followed by model or account deletion. Identical
key text in two different buckets remains two independently owned objects.
Every new-runtime manifest insert names `storageBackend` explicitly; the
database default exists only for old-runtime/new-schema compatibility and a
source guard forbids new code from relying on it.

Exact-count settlement remains unchanged: each manifest item reaches exactly
one terminal result, and the batch cannot claim success while a private item
is unresolved.

## 5. Private adapter configuration

The production adapter reuses the existing R2 account endpoint but uses a
dedicated least-privilege credential restricted to the private evidence
bucket. It requires distinct server-only variables:

```text
R2_EVIDENCE_BUCKET=<private bucket name>
R2_EVIDENCE_ACCESS_KEY_ID=<private-bucket credential id>
R2_EVIDENCE_SECRET_ACCESS_KEY=<private-bucket credential secret>
```

There is deliberately no `R2_EVIDENCE_PUBLIC_URL`.

Configuration rules:

- any absent/empty evidence bucket or evidence credential means the adapter
  is unconfigured;
- scope off + adapter unconfigured is valid;
- non-off `R7_EVIDENCE_INGEST_SCOPE` requires the cleanup worker and the
  private adapter configuration at boot;
- after the first evidence write, unconfiguring the private adapter is a
  health-alarm condition because delivery, GDPR export, and cleanup all
  correctly fail closed;
- bucket names and keys are never logged or returned;
- the adapter's S3 client and credential are distinct from the public storage
  client.

The adapter implements:

- `putCanonical` — evidence grammar only, fixed `image/webp`, exact returned
  key;
- `readCanonical` — evidence grammar only, bounded to the canonical 10 MiB
  ceiling, fixed WebP content, streamed without a second whole-image buffer,
  and required to emit exactly the database-declared byte count or fail with
  the opaque delivery error;
- `resolveOwnerDelivery` — validates the authenticated owner prefix and
  returns only a same-origin Drape route;
- `deleteExact` — evidence grammar only, private bucket only, returning the
  cleanup worker's closed `{ success, errorCode, retryable }` settlement
  classification rather than an unclassified `void`;
- a read-only bounded listing surface used only by the guarded orphan audit.

## 6. Authenticated owner delivery

Register one plain Express GET before Vite/static fallback:

```text
GET /api/evidence/:kind/:entityId
```

where `kind` is `plate` or `crop` and `entityId` is a UUID.

Request sequence:

1. authenticate with the normal session cookie;
2. refuse suspended/locked users;
3. apply a per-user read limit with a real 429 and `Retry-After`;
4. parse a strict route grammar;
5. select the plate/crop through an owner-scoped database statement that
   re-anchors the child to a live model owned by the same authenticated user;
6. re-parse the stored evidence key and require owner/model/kind/entity
   agreement;
7. fetch through the private adapter with a declared and streamed 10 MiB cap;
8. emit an owner-private ETag as HMAC-SHA256 over authenticated owner ID,
   evidence kind/entity ID, and the database content hash using the
   server-only JWT secret; never expose the raw content hash;
9. honor `If-None-Match` only after authentication and the owner-scoped
   database re-proof, returning 304 without an R2 read when unchanged;
10. otherwise stream `image/webp` with `X-Content-Type-Options: nosniff`,
   `Cache-Control: private, no-cache`, and no attachment filename.

Missing and foreign rows share one 404 response. Provider failures use one
opaque 503 response. Logs contain only authenticated user ID, entity ID, and
closed error class—never key, bucket, URL, provider text, or bytes.

`private, no-cache` permits the owner's browser to retain immutable bytes but
requires authorization revalidation before reuse. It avoids both permanent
unauthenticated exposure and the UX cost of downloading the same plate on
every render. The route is a normal image source; it never opens a dialog,
forces a download, or asks the user to manage credentials.

The limit is sized from the maximum evidence images one product surface can
render, including browser revalidation bursts. Its per-minute capacity is at
least `max(240, 4 × maximum-renderable-evidence-count)` and the capacity test
must be updated before any surface is allowed to exceed that assumption. The
shared evidence image component honors `Retry-After`, retries 429 responses
with bounded exponential backoff and jitter, and preserves the stable
placeholder while retrying. A transient limit may never become a permanent
broken-image icon or require user action. The same bounded,
placeholder-preserving retry contract covers transient 503 responses and
aborted or truncated streams; exhaustion resolves to the intentional product
placeholder and closed retry affordance, never the browser's broken-image
icon.

`resolveOwnerDelivery` returns the route above, so stage/replay/GDPR continue
to derive delivery at read time while persisting only an exact key.

## 7. Cleanup worker routing and rollback

The worker receives the claimed item's explicit backend:

- `public_r2` calls existing `storageDelete`;
- `private_evidence_r2` calls the private adapter's `deleteExact`.

When the private adapter is unavailable, the claim query skips any batch with
an unresolved private item. It does not increment attempts, falsely succeed,
or try the public bucket. Health reports the pending private work as requiring
attention. Mixed batches wait intact until all required backends are
available; retaining their public objects during that wait is deliberate so
the batch cannot partially settle.

Before any real evidence write, the supported rollback point becomes the
first adapter-capable build, not a pre-adapter image. A pre-adapter runtime
does not understand private cleanup authority and may never be redeployed
after evidence exists. In particular, R2 delete against a nonexistent key can
report success: a pre-adapter worker could target the public bucket, mark the
cleanup item successful, and permanently orphan the real private object.
While the evidence scope remains off and the three evidence tables are empty,
the current pre-adapter rollback remains safe. Once the C5D ceremony writes
the first evidence object, the first adapter-capable C5D build is the rollback
floor.

## 8. Bucket and infrastructure ceremony

Bucket creation/configuration is separate from code review:

1. create a dedicated private R2 bucket with no public development URL or
   custom domain;
2. create and prove a dedicated least-privilege credential restricted to that
   bucket can put/get/delete only as required;
3. set `R2_EVIDENCE_BUCKET`, `R2_EVIDENCE_ACCESS_KEY_ID`, and
   `R2_EVIDENCE_SECRET_ACCESS_KEY` on the app service;
4. deploy the adapter with evidence scope still absent/off;
5. prove capability remains false while scope is off;
6. run a disposable exact-key put/read/delete through the production adapter
   using a syntactically valid evidence key whose user and model components
   are reserved synthetic, nonexistent high-numbered IDs plus a fresh UUID,
   then prove no residue;
7. run the counts-only private-bucket orphan audit;
8. stop.

The test object is infrastructure proof, not customer evidence, and is always
deleted before the ceremony passes.

## 9. Verification slices

### 9.1 C5A — decision and cleanup schema

- D-68 and design corrections;
- migration `0012`;
- explicit backend manifest contract;
- old-runtime/new-schema mixed-version proof;
- adapter-runtime/old-schema boot-refusal proof;
- disposable MySQL tests for mixed public/private batches;
- exact `UNIQUE(batchId, storageBackend, storageKey)` and cross-batch
  duplicate-key proof;
- source guard proving new manifest inserts always name the backend;
- zero production adapter/runtime reachability.

### 9.2 C5B — private adapter

- configuration fail-closed matrix;
- put/read/delete exact-key grammar;
- declared and streamed read bounds;
- database-declared byte-count equality;
- authenticated ETag/304 behavior that performs no private-bucket read;
- owner-bound HMAC ETag that never exposes the raw content hash;
- fixed MIME and opaque errors;
- no public URL or presigned URL;
- private-bucket disposable adapter test with no residue.

### 9.3 C5C — authenticated delivery and worker routing

- real Express authentication tests;
- ordinary image rendering/conditional-cache contract with no extra user
  action;
- foreign/missing indistinguishability;
- suspended/locked and rate-limit behavior;
- capacity proof against the maximum renderable evidence set, plus
  `Retry-After` backoff that preserves the placeholder instead of rendering a
  broken image;
- placeholder-preserving bounded retry for transient 503 and aborted/truncated
  streams;
- owner/model/child anchoring in the durable read;
- public/private delete dispatcher behavior;
- missing-adapter batches remain pending without attempt burn;
- pending-private-work extends `getStorageCleanupHealth` and its single
  warning path, with a behavioral warning test;
- model/account deletion produces correctly classified mixed manifests;
- GDPR delivery remains owner-scoped;
- `/api/evidence/*` is added to `CLAUDE.md`'s enumerated authenticated,
  user-rate-limited Express route list.

### 9.4 C5D — disabled deployment and founder ceremony

- full suite, build, typecheck, migration and disposable proofs;
- cumulative Fable review;
- migration before runtime;
- private bucket and variable configured;
- evidence scope stays off through deploy;
- passive health/worker checks;
- separately authorized `users:1` upload/read/discard ceremony;
- private bucket and database return to zero evidence objects/rows after the
  discard proof.

## 10. Stop boundary

Successful private delivery does not authorize R7-7D. R7-7D still needs a new
plan for tattoo candidate generation, probe/validation, billing,
Accept/Retry/Cancel, copy-on-fork, and canon adoption.
