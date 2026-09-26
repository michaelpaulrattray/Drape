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
#
# ⚠ AND WHERE MONEY IS *PRICED* WAS MISSING FROM BOTH HALVES UNTIL 2026-09-26
# (#1359, the Warden money audit's W5-A). Neither reading covered the modules
# that declare what a customer is CHARGED: a change to `rollCandidate: 20`, to
# `CASTING_V2_ROLL_PRICE_CREDITS`, or to the Sign decomposition merged on the
# gate like a CSS tweak. It is the same defect the symbol half was created to
# fix, one step over — that half was added for where money is DECIDED, and
# where it is SET was never added.
#
# ROAD: never covered. `git log -S "castingCreditCosts" -- .github/` returns
# nothing on any branch, at any time.
#
# ⚠ WHY IT HAD NEVER BITTEN, AND WHY THAT IS THE ARGUMENT FOR FIXING IT. Every
# commit that ever touched a price module was caught INCIDENTALLY — a new price
# ships beside the refund machinery that spends it, so the symbol half fires for
# an unrelated reason. A pure repricing has never happened in this repository.
# Zero instances is luck rather than design, the same shape as the bug-report
# exception whose live population at the fix was zero rows all time.
#
# MEASURED BEFORE AND AFTER, over the 60 newest merge commits on `main`, the
# same standard #958 set:
#
#     paths + symbols, before this widening     9 of 60
#     paths + symbols, after it                 9 of 60
#
# NOTHING NEW IS LABELLED. The widening costs no reviewer attention at all and
# closes a hole whose first instance would have been a repricing.
#
# ⚠ NAMED FILES, NEVER DIRECTORIES. #958 measured `paths + whole casting dirs`
# at 17 of 60 and rejected it as too noisy to be read; that judgement stands.
#
# ⚠ THE CLIENT HALF IS A DELIBERATE DECISION, NOT AN OVERSIGHT CORRECTED. The
# symbol reading is scoped `-- server shared` and STAYS so: widening it to
# `client/` would match every client file mentioning a primitive as a substring,
# which is precisely the noisy alternative above. What is added instead is two
# client files BY NAME. `constants.ts` holds a deliberate second copy of
# `CREDIT_COSTS` — CLAUDE.md keeps it in the Atlas price list *because* of
# working law 4 — and `castingPrices.ts`'s `servedCost` decides whether a
# surface shows the server's number or that copy. The armed cast button and the
# pre-flight affordability gate both read the copy, so editing it alone changes
# the price a customer is QUOTED before they spend. Being quoted a wrong number
# is a money defect, and it could be shipped with nothing reading the diff as
# money.
#
# ⚠ TWO NUMBER-DECLARING MODULES ARE DELIBERATELY *NOT* HERE, named so the
# exclusion is a decision on the record rather than a gap (the Atlas's price
# collector emits every number keyed by its declaring constant and does not try
# to define "price", so its list is wider than this one):
#
#   server/castingV2/carriedGeometry.ts  `CARRIED_GEOMETRY_COST_NOTE_ABOVE = 10`
#     is a LOG THRESHOLD — `if (slots.length > it) log.info(…)`. Nobody is
#     charged it.
#   server/db/discrepancyQueries.ts      `OPERATION_COST_SQL` READS costs the
#     ledger already recorded, for the moderator reconciliation. It sets none.
#
# `server/moneySurfaceClassifier.test.ts` DERIVES the price-module population
# from the Atlas rather than restating it, with those two exclusions by name, so
# a price module added tomorrow reddens instead of arriving invisible.
MONEY_PATHS='^server/routes/(billing|credits|auth|emailAuth|googleAuth|emailVerification)|^server/db/(billing|credits)\.ts$|^server/stripe/|^server/_core/(sdk|cookies|trpc|env)\.ts$|^server/security/|^server/casting/atomicCredits\.ts$|^server/casting/(castingCreditCosts|packagePricing)\.ts$|^server/casting/evidence/evidenceCandidateContract\.ts$|^server/wardrobe/creditCosts\.ts$|^server/castingV2/castViewPackage\.ts$|^client/src/features/casting/(constants|castingPrices)\.ts$|^shared/const\.ts$|^drizzle/'

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
