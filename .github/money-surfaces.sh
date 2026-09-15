# shellcheck shell=sh
#
# WHAT THIS REPOSITORY CALLS A MONEY/AUTH DIFF — ONE DECLARATION, TWO READERS.
#
# Sourced by `.github/workflows/gate.yml` (which labels the PR `founder-review`)
# and by `.github/workflows/review.yml` (whose triage uses the same answer to
# decide that the reviewer reads CLAUDE.md IN FULL rather than the charter, and
# to force a review the size heuristic would otherwise decline).
#
# ⚠ IT LIVES HERE BECAUSE IT HAD TWO COPIES AND THEY DRIFTED (#958, 2026-09-15).
# The two workflows carried byte-identical `PATTERNS` / `MONEY` strings, and
# when the gate's was widened the reviewer's was not — working law 4 exactly,
# and the same shape `.githooks/atlas-paths` was carved out for. NEITHER
# WORKFLOW MAY DECLARE ITS OWN; `server/moneySurfaceClassifier.test.ts` holds
# both to sourcing this file and reddens if either grows a local copy.
#
# ── 1 · PATHS — where money is STORED and where it is BOUGHT ─────────────────
#
# Surfaces where a bot's approval is never enough (CLAUDE.md: billing, credits,
# auth and session code are production-critical).
#
# ⚠ `server/casting/atomicCredits.ts` is on this list BY NAME and is not left to
# the symbol reading below. It is the charge/refund primitive every other caller
# goes through, so a change to its ceiling, its transaction shape or its "a
# refund that did not record is never reported as you-weren't-charged" law is as
# money-path as a change gets while touching no call line at all.
MONEY_PATHS='^server/routes/(billing|credits|auth|emailAuth|googleAuth|emailVerification)|^server/db/(billing|credits)\.ts$|^server/stripe/|^server/_core/(sdk|cookies|trpc|env)\.ts$|^server/security/|^server/casting/atomicCredits\.ts$|^shared/const\.ts$|^drizzle/'

# ── 2 · SYMBOLS — where money is DECIDED ────────────────────────────────────
#
# A diff that adds or removes a line naming the credit API moves money wherever
# it lives. 27 of the 32 modules under `server/`+`shared/` that reference these
# are outside the path list, including every casting refund adjudicator — and a
# file-path list is precisely the second list working law 4 warns about, so this
# half cannot drift when a module moves.
#
# Measured over the 60 newest merged PRs, before this file existed:
#
#     paths alone (what shipped for months)     4 of 60
#     paths + symbols (what runs now)           9 of 60
#     paths + whole casting dirs (rejected)    17 of 60
#
# The four the paths caught are three auth PRs and one Stripe one. NOT ONE
# credit-refund fix was among them. The five the symbols add — #924 #874 #872
# #871 #866 — each change how many credits a customer gets back, and all five
# shipped with no label and no deep reading.
#
# ⚠ WHAT IT DOES NOT CLAIM. It matches any added or removed line MENTIONING a
# primitive, including a docblock and including a substring: #866's only
# symbol-bearing line is a comment and #924's is the fixture string
# `cr_addCredits`. It is a VISIBILITY signal under the founder's own ruling on
# this label ("visibility, not a block"), never a proof that money moved. A
# word-boundary version was measured and rejected — it drops #924, a real credit
# change-request PR.
MONEY_SYMBOLS='recordRefund|addCredits|deductCredits|withAtomicCredits|refundReferenceFor'
