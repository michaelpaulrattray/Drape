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
# ⚠ AND WHERE A REFUND IS *DECIDED BY A BRANCH* WAS MISSING FROM BOTH HALVES
# UNTIL 2026-09-30 (#1622). The symbol half below matches a diff that adds or
# removes a LINE naming a primitive. It cannot see a diff that changes the
# CONTROL FLOW deciding whether an existing refund line is ever REACHED — the
# third position in the sentence above, after where money is DECIDED and where
# it is SET.
#
# THE LIVE INSTANCE, not a hypothetical. PR #1621 rewrites the branch above
# `await (dependencies.refund ?? recordRefund)(…)` in `packageOrchestrator.ts`
# — it is its own card's stated money surface (#1612: *"Money surface (refund
# paths): every PR held for the relay's hand verdict"*) — and NEITHER HALF
# FIRED. The import at `packageOrchestrator.ts:89` and the call at :595 both
# stand still, so `git diff -G` sees nothing; and the path half named
# `castViewPackage.ts`, where a view's PRICE is declared, and not this file,
# where its refund is DECIDED. Its triage comment read *"An ordinary diff"* and
# told the shift it could merge on the gate alone.
#
# ⚠ WHAT WAS MEASURED, AND WHAT THE MEASUREMENT REFUSED. The obvious repair —
# add every module that reaches a credit primitive to the path half — was
# measured over the 60 newest merged PRs on `main`, the standard #958 and #1359
# both met:
#
#     paths + symbols (the baseline)                      11 of 60
#     + packageOrchestrator.ts by name (what shipped)     13 of 60
#     + the 19 Atlas importers of atomicCredits.ts        17 of 60
#     + all 31 modules naming any credit primitive        17 of 60
#
# ⚠ BOTH BULK OPTIONS LAND ON 17 of 60 — THE EXACT RATE #958 MEASURED FOR
# `paths + whole casting dirs` AND REJECTED AS TOO NOISY TO BE READ. That
# judgement stands, so the bulk widening is DECLINED here rather than quietly
# skipped. Narrowing 31 → 19 on the principled reading (*where a refund is
# decided*) buys nothing: both cost the same six PRs, because this repository's
# casting work concentrates in the same few hot service files. Two of those six
# move no credit at all — #1572 is a copy fix (*"a refusal calls a person a
# cast"*) and #1400 is an image-sizing change.
#
# ⚠ AND A CLEVERER READING WAS DRIVEN AND FAILED BOTH CONTROLS — recorded so
# the next shift does not re-try it. `git diff -W` (function context) piped
# through the primitive list asks *"did this diff change a line inside a
# function that reaches a refund?"*, which is this defect's own sentence made
# mechanical. Git's `xfuncname` heuristic does not support it on TypeScript: it
# stayed SILENT on the specimen above and FIRED on both known false positives.
#
# So ONE FILE IS ADDED BY NAME, on exactly the argument `atomicCredits.ts` is on
# this list — it is the module that decides whether the refund primitive is
# called at all for a signed view. ⚠ THE OTHER 18 ADJUDICATORS ARE A STATED
# REMAINDER, NOT A CLOSED HOLE: `server/moneySurfaceClassifier.test.ts` derives
# them from the Atlas's import graph and reddens when a NEW module starts
# reaching the primitive, so the remainder cannot grow invisibly.
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
#
# ⚠ AND WHERE A BALANCE IS WRITTEN *DIRECTLY*, WITH NO PRIMITIVE IN SIGHT, WAS
# MISSING FROM BOTH HALVES UNTIL 2026-10-01 (#1662). It is the fourth position
# in the sentence above — after where money is DECIDED, where it is SET, and
# where a refund is DECIDED BY A BRANCH.
#
# `server/db/admin.ts` holds `adjustUserCredits`: the "adjust any" cell of
# CLAUDE.md's capability grid, and the one write in the product that moves a
# customer's credits on a staff decision. It writes `credits.balance` and
# `creditsPurchased` through drizzle `.set()` and inserts the ledger row itself
# (`admin.ts:374`, `:382`, `:387`), so it names NONE of the symbols below —
# `grep -E "$MONEY_SYMBOLS" server/db/admin.ts` returns nothing, at HEAD and on
# every branch. And the path half named `^server/db/(billing|credits)\.ts$`, two
# files either side of it. So a diff that changed how much an adjustment grants,
# or removed its below-zero refusal (`admin.ts:368`), or changed which counter
# it feeds, merged on the gate alone with nothing reading it as money.
#
# ROAD: never covered. Like the price modules above, it had never bitten because
# every diff that touched it rode in on a neighbour — #1604's own PR triages as
# money only because it ALSO touches `server/db/credits.ts` and `drizzle/`.
#
# ⚠ THE LAW-7 SWEEP FOUND ONE SIBLING AND IT SHIPS IN THE SAME COMMIT, because
# the class is the fix and the instance is not. Read at the tree with comments
# stripped — every non-comment `.update`/`.insert`/`.delete` of the `credits` or
# `creditTransactions` tables under `server/` and `shared/` — there are FOUR
# writers and exactly two were off this list:
#
#   server/db/credits.ts           already here
#   server/db/billing.ts           already here
#   server/db/admin.ts             ADDED — adjustUserCredits
#   server/db/accountDeletion.ts   ADDED — deletes the customer's whole ledger
#     and their credits row (`:628`, `:634`) inside the GDPR deletion. Its route
#     (`server/routes/auth.ts`) is on this list; the module holding the
#     statements was not, which is this card's own argument one file over. A
#     mis-scoped `where` here destroys another customer's ledger.
#
#   server/db/connection.ts is NOT a writer and is the measured false positive a
#     naive text reader produces: its only hits are a docblock EXAMPLE at
#     `:74`–`:75`. It is the negative control of the derived guard below.
#
# MEASURED BEFORE AND AFTER, the standard #958, #1359 and #1622 all met — and on
# TWO windows, because the 60 newest merged PRs now span barely two days under
# the builder seats and a two-day window is a thin basis for a judgement:
#
#     60 newest PRs merged to main (#1657…#1516), before   9 of 60
#                                                  after   9 of 60
#     200 newest (#1657…#1254),                    before  31 of 200
#                                                  after   31 of 200
#
# NOTHING NEW IS LABELLED, on either window: no PR in the newest 200 touches
# either file at all. The widening costs no reviewer attention and closes a hole
# whose first instance would have been an admin credit adjustment. The rejected
# bulk options of #958 and #1622 both land at 17 of 60; this moves nothing, so
# that judgement is untouched.
#
# ⚠ ONE HONEST LIMIT OF THAT MEASUREMENT, stated rather than left to be found:
# the earlier figures' population could NOT be reproduced here. Four definitions
# were driven against #1622's recorded 11-of-60-before / 13-of-60-after and none
# matched (PRs merged to main: 5/6; first-parent commits: 4/5; first-parent
# commits whose subject ends `(#N)`: 8/9). So the numbers above are NOT
# continuous with #958's, #1359's or #1622's and must not be read as a trend.
# What they ARE is a before/after on ONE stated population with the reader's own
# positive and negative controls green — which is what the decision needs, and
# the delta is zero on both windows either way. Defining that population once,
# in code, so the next widening can compare, is its own card.
#
# ⚠ AND WHERE A YEAR'S PRICE IS *SET* WAS MISSING FROM BOTH HALVES UNTIL
# 2026-10-02 (#1711). It is the fifth position in the sentence above, and it is
# the PRICE half of #1359 one unit of currency over: that repair added where
# CREDITS are priced and never asked where CASH is.
#
# `shared/annualBilling.ts` is the one declaration of `ANNUAL_RATE` and of
# `annualPriceInCents` — what a customer pays for a YEAR, for every plan. Both
# sides import it and neither declares its own, which its own docblock requires
# (*"two copies of the number that decides what a year costs is working law 4's
# exact shape"*). So moving that one number reprices every annual subscription
# in the product, and `grep -E "$MONEY_SYMBOLS"` matches NOTHING in such a diff,
# because changing a price touches no credit primitive.
#
# FOUND BY DRIVING IT, not by reading: PR #1710 changed this module and nothing
# else, the gate applied no `founder-review` and triage applied no `needs-fable`,
# and the shift had to put the hold on by hand. Its two nearest siblings — the
# display scale and the casting price table — were both already covered.
#
# ROAD: never covered. `git log -S "annualBilling" -- .github/` returns nothing
# on any branch, at any time. Like the price modules and `admin.ts` above it had
# never bitten because every earlier diff touching it rode in on a covered
# neighbour; #1710 is the first that did not.
#
# ⚠ THE LAW-7 SWEEP, AND THE READER THAT PRODUCED IT IS NAMED BECAUSE A HAND
# GREP FOR "price" IS NOT THE MEASUREMENT. The class is *a module that sets what
# a customer is charged, outside the list*, and the credit half already has a
# DERIVED guard (the Atlas price collector, below). The cash half cannot have
# the same one — the Atlas's collector reads CREDIT numbers and a rate of `0.83`
# is not one. So a name-shaped reader was written and run over `server/`,
# `shared/`, `client/src/` and `drizzle/`: every non-test module declaring a
# `const` whose NAME carries RATE / CENTS / PRICE / AMOUNT / DOLLAR / USD / FEE.
#
#     modules it returned                                     25
#     of those, declaring cash a customer is billed on          1   annualBilling.ts
#     already covered                                           3
#     rate LIMITS, not billing rates                           11
#
# ⚠ ELEVEN OF TWENTY-FIVE ARE RATE LIMITS, WHICH IS WHY THAT READER IS NOT
# SHIPPED AS A SECOND DERIVED POPULATION. In this tree `RATE` is overwhelmingly
# a rate-limit word (`IMAGE_PROXY_RATE_LIMIT`, `INVITE_RATE`, `BUG_RATE_LIMIT`,
# `ALARM_FAILURE_RATE`, `SUCCESS_RATE_THRESHOLD`…), so its output has to be read
# by hand and a guard built on it would be noise a shift learns to ignore —
# #958's own rejected-at-17-of-60 judgement, in a different costume. It is
# recorded here as the sweep's reader so the next shift can re-run it rather than
# re-invent it, and `server/moneySurfaceClassifier.test.ts` carries the NAMED arm
# for this file instead.
#
# THREE THINGS IT RETURNED THAT ARE DELIBERATELY NOT ADDED, each read at its
# declaration so the exclusion is a decision on the record:
#
#   server/providers/{falImages,falQueue,openrouterImages}.ts  the measured
#     `*_USD_PER_IMAGE` constants are HOUSE cost — what a render costs US. No
#     customer is billed them, and CLAUDE.md's spend threshold governs them.
#   client/src/pages/CastingV2.tsx  `ROLL_PRICE_FALLBACK = 0` is a safe ABSENCE,
#     not a price: zero cannot misquote upward, and that file's own comment
#     argues a hand-written fallback should not be a number at all.
#   client/src/features/settings/planMath.ts  DERIVES from this module and is
#     already held to importing rather than re-declaring (`annualBilling.test.ts`
#     — it carried its own `ANNUAL_RATE` once, which is why that guard exists).
#     Covering the authority covers it; adding the deriver would be the
#     17-of-60 widening again.
#
# ⚠ ONE FINDING OF AN ADJACENT CLASS IS FILED RATHER THAN FOLDED IN, with its
# reading: `shared/changeRequestApproval.ts` and `server/routes/admin/changeRequests.ts`
# are both off this list, and between them they decide whether a staff
# `add_credits` / `refund_credits` request may be APPROVED at all — the route
# that authorises the write #1662 added `server/db/admin.ts` for. That is a money
# CONTROL rather than a price, which is #1622's and #1627's family and not this
# card's, so it gets its own card with its own before/after rather than a quiet
# widening here.
#
# ⚠ AND WHERE A STAFF MONEY ACTION IS *AUTHORISED* WAS MISSING FROM BOTH HALVES
# UNTIL 2026-10-02 (#1719) — the card the paragraph above filed. It is the sixth
# position in the sentence: after where money is DECIDED, where it is SET, where
# a refund is DECIDED BY A BRANCH, where a balance is WRITTEN DIRECTLY, and where
# a year's price is SET.
#
# An admin can hand a customer credits or refund them, and that request must be
# APPROVED before the credits move. #1662 added the module that WRITES
# (`server/db/admin.ts`, `adjustUserCredits`). The road that authorises that
# write — the route, the two gates it asks, the dispatch map that decides the
# approval executes at all, and the mapping that decides what the executor is
# handed — was in nobody's population.
#
# THE SIX, each with the defect a diff to it could ship unread:
#
#   shared/changeRequestApproval.ts          `CHANGE_REQUEST_APPROVAL_REQUIREMENTS`
#     makes `CREDIT_AMOUNT` the requirement for `add_credits` and
#     `refund_credits` (:76, :77). Remove either line and a staff member may
#     approve a credit grant or a refund with NO AMOUNT recorded on the request.
#   server/routes/admin/changeRequests.ts    the route that authorises: it asks
#     both blockers (:133, :155) before the compare-and-swap, and runs the
#     executor in the same mutation.
#   server/lib/adminActions/approvalStateBlocker.ts  the SECOND gate, #991 —
#     `add_credits: [HAS_BALANCE]`, `refund_credits: [HAS_BALANCE]` (:102, :103).
#   server/lib/adminActions/approvalExecution.ts  decides what the executor is
#     HANDED: `if (request.creditAmount) params.creditAmount = …` (:26). A
#     fallback added there grants an amount nobody requested.
#   server/lib/adminActions/changeRequestActions.ts  decides whether the credit
#     primitive is CALLED AT ALL on the staff road — `cr_addCredits` /
#     `cr_refundCredits` (:111, :160) and the `adjustUserCredits` deduction
#     (:313). This is `packageOrchestrator.ts`'s entry above, one road over: the
#     symbol half fires on a diff that adds or removes a line naming `addCredits`
#     and is blind to a change in the branch ABOVE it, which is #1622's class.
#   shared/changeRequestLabels.ts            `CHANGE_REQUEST_ACTION_BY_TYPE`
#     (:82) is THE dispatch map and also the definition of "sensitive" — read at
#     `changeRequests.ts:85` and `:229`. Drop `add_credits` from it and approving
#     records a review and executes nothing; re-point it and a grant runs the
#     refund executor. ⚠ THE COST IS STATED: this file also carries the panel's
#     display LABELS, so a copy edit in it will now be labelled money. That is
#     accepted rather than unnoticed — the dispatch map is the sharper risk and
#     the file is the ONE declaration of it.
#
# ROAD: never covered. `git log -S "changeRequestApproval" -- .github/` and
# `git log -S "adminActions" -- .github/` both return nothing on any branch, at
# any time.
#
# ⚠ THE LAW-7 SWEEP, AND THE READER THAT PRODUCED ITS POPULATION IS NAMED,
# because a hand grep for "approval" is not the measurement. The class is *a
# module that authorises a staff money action, or decides what it moves, outside
# the list*. TWO readers were run, in this order:
#
#   1. the WIDE one, hand-read — every non-test module under `server/` and
#      `shared/` NAMING a money-moving change-request type (`add_credits`,
#      `refund_credits`, `stripe_refund`). It returned TWELVE, which is why it is
#      not shipped as a derived population: six of the twelve are audit-action
#      NAMES, event-catalogue prose and a read query, and a guard built on it
#      would be noise a shift learns to ignore (#958's rejected-at-17-of-60
#      judgement in a different costume).
#   2. the NARROW one, which IS shipped as the derived drift guard in
#      `server/moneySurfaceClassifier.test.ts` — a module declaring a map KEYED
#      BY one of those types (`/^\s*(add_credits|refund_credits|stripe_refund)\s*:/`
#      over comment-stripped source), i.e. a DECISION TABLE rather than a
#      mention. It returns FOUR across all three roots, and three of the four are
#      on the list above.
#
# SIX THINGS THE WIDE READER RETURNED THAT ARE DELIBERATELY NOT ADDED, each read
# at its declaration so the exclusion is a decision on the record:
#
#   server/routes/moderator.ts  the CREATION road, not the authorisation road. A
#     moderator RAISES a request (and `:311` already refuses one with no amount);
#     the admin's approval is what authorises. Adding it would put the whole
#     moderator surface — the product's second-busiest router, 14 commits — on
#     this list for a refusal that moves no money by itself.
#   client/src/features/admin/ChangeRequestConstants.tsx  the NARROW reader's one
#     measured false positive, and it is the negative control of the derived guard
#     below: it keys by type to choose an ICON, a COLOUR and the modal's copy, and
#     it DERIVES `SENSITIVE_TYPES` from the shared map rather than declaring one
#     (working law 4, already closed by #800). It authorises nothing.
#   server/stripe/webhooks.ts  already covered by `^server/stripe/`.
#   server/db/adminOverviewQueries.ts  reads audit rows for the alerts feed.
#   shared/auditActions.ts, shared/auditActionCategories.ts  audit action NAMES.
#   shared/productEventCatalogue.ts  a comment naming the two refund roads.
#
# MEASURED BEFORE AND AFTER, the standard #958, #1359, #1622, #1662 and #1711 all
# met, on the TWO windows #1662 established — and with the reader VERIFIED IN
# BOTH DIRECTIONS first (law 2): run with the pre-#1711 bytes of this file it
# reports 7 of the 20 newest PRs labelled and PR #1710 absent, which is #1711's
# own recorded finding; run with HEAD's it reports 8, and the one that moved is
# exactly `#1710 path: shared/annualBilling.ts`.
#
#     60 newest PRs merged to main (#1724…#1599), before   21 of 60
#                                                  after   21 of 60
#     200 newest (#1724…#1326),                    before  46 of 200
#                                                  after   47 of 200
#
# ⚠ THE 60-PR WINDOW MOVES NOTHING, SO #958's AND #1622's REJECTED-AT-17-OF-60
# JUDGEMENT IS UNTOUCHED. The 200-PR window gains EXACTLY ONE PR, and it is the
# argument for the whole entry rather than a cost: **PR #1388, "fix(admin): the
# two staff money inputs are closed (#1360)"**, which closed `.strict()` on the
# admin change-request and user inputs and **merged carrying no labels at all**.
# A PR whose own title says *staff money inputs* was not read as money.
#
# ⚠ AND THE FIVE MODULES BEYOND THE CARD'S TWO COST NOTHING ON EITHER WINDOW —
# measured, not assumed: the four options (the card's two; + the two gates and
# the dispatch map; + the executors; + the whole `server/lib/adminActions/`
# directory and `moderator.ts`) all land on 21 of 60 and 47 of 200. The directory
# form is still declined on this file's own rule — NAMED FILES, NEVER DIRECTORIES
# — and `moderator.ts` on the reason above, not on its price.
#
# ⚠ ONE HONEST LIMIT, THE SAME ONE #1662 RECORDED AND IT IS NOW TWICE PAID.
# #1662's own figures could not be reproduced here either: its window is
# #1657…#1516 and the same query at the same ceiling returns #1657…#1530, so its
# 9-of-60 and this reading's 11-of-60 at that ceiling are NOT the same
# population. The numbers above are a before/after on ONE stated population with
# the reader's own positive and negative controls green, which is what the
# decision needs — they are not a trend, and must not be read as one. Defining
# that population once in code is still its own card (#1662's recommendation,
# unbuilt).
# ⚠ AND WHERE A TOP-UP'S PRICE IS SET ARRIVED WITH THE ROAD IT PRICES — 2026-10-02
# (#1606), ON THE LIST IN THE COMMIT THAT CREATED IT. It is the seventh position
# in the sentence above, and it is #1711's CASH half and #1359's CREDIT half in
# one module: `shared/creditTopups.ts` declares what a bought credit pack COSTS
# (1200¢ / 1100¢ / 1000¢ a unit) and how many credits it GRANTS (25,000 a unit).
#
# ⚠ THIS ENTRY IS NOT A REPAIR AND THAT IS THE ONLY INTERESTING THING ABOUT IT.
# Every widening above was written after a diff had already merged unread — the
# price modules, `admin.ts`, `annualBilling.ts`, the approval road. This file is
# born on the list, which is the standing rule the public-endpoint list in
# CLAUDE.md states for its own fifth route: *a route that exists but is not on
# the list is how the list stops being the list.*
#
# THE DEFECT A DIFF TO IT COULD OTHERWISE SHIP UNREAD: move `centsPerUnit` and
# every top-up is repriced; move the band floors and a customer pays the wrong
# rate at the boundary; move `TOPUP_UNIT_LEDGER_CREDITS` and a paid pack grants
# the wrong number of credits — and `grep -E "$MONEY_SYMBOLS"` matches NOTHING in
# such a diff, because the grant goes through `addTopupCredits`, which lives two
# modules away in `server/db/billing.ts` and does not appear here.
#
# ROAD: n/a — never uncovered. `git log -S "creditTopups" --all` returns exactly
# the two commits of #1606, and nothing in `.github/` at any time.
#
# MEASURED BEFORE AND AFTER: the delta is ZERO BY CONSTRUCTION on every window,
# and it is stated that way rather than dressed as a measurement. The module did
# not exist before this card, so no merged PR can have touched it; the two
# commits that do are this PR's own, which already triages as money four other
# ways (`^server/stripe/`, `^server/routes/billing`, `^shared/creditDisplay` via
# nothing — the first two suffice). The windows the entries above measure cannot
# move, and running them to print an unchanged number would be ceremony rather
# than evidence.
#
# ⚠ THE LAW-7 SWEEP, with its reader named: the class is *a module that sets what
# a customer is charged, outside the list*, and the derived half of it is already
# in `server/moneySurfaceClassifier.test.ts` — the Atlas's own price-collector
# population, which is what reddened on this commit and asked for this line. It
# names no other missing module at HEAD.
#
# ⚠ AND THE CASH-SIDE NAME READER WOULD NOT HAVE FOUND THIS MODULE, which is
# worth more than the entry it is attached to. A `const`-name reader of #1711's
# shape (names carrying RATE / CENTS / PRICE / AMOUNT / DOLLAR / USD / FEE) was
# run over `server/`, `shared/`, `client/src/` and `drizzle/` on 2026-10-02 and
# returns twelve modules, this one NOT among them: the cents live on a FIELD
# inside `TOPUP_BRACKETS` (`centsPerUnit`), and the constants are named
# `TOPUP_UNIT_*` and `TOPUP_MAX_UNITS`. ⚠ The figures are NOT comparable with
# #1711's twenty-five — that reading is not reproduced here and must not be read
# as a trend — but the direction is a reading rather than a belief: the two
# halves cover different things, the CREDIT collector is what caught this
# module, and a module pricing in cents alone with no price-shaped const name
# would be in neither population. That hole is not closed here and is not
# pretended to be.
#
MONEY_PATHS='^server/routes/(billing|credits|auth|emailAuth|googleAuth|emailVerification)|^server/routes/admin/changeRequests\.ts$|^server/db/(billing|credits|admin|accountDeletion)\.ts$|^server/stripe/|^server/_core/(sdk|cookies|trpc|env)\.ts$|^server/security/|^server/lib/adminActions/(approvalExecution|approvalStateBlocker|changeRequestActions)\.ts$|^server/casting/atomicCredits\.ts$|^server/casting/(castingCreditCosts|packagePricing)\.ts$|^server/casting/evidence/evidenceCandidateContract\.ts$|^server/wardrobe/creditCosts\.ts$|^server/castingV2/(castViewPackage|packageOrchestrator)\.ts$|^client/src/features/casting/(constants|castingPrices)\.ts$|^shared/(const|creditDisplay|annualBilling|creditTopups|planCreditSlider|changeRequestApproval|changeRequestLabels)\.ts$|^drizzle/'

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
