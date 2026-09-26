# shellcheck shell=sh
#
# WHAT THIS REPOSITORY CALLS A CUSTOMER-VISIBLE DIFF — ONE DECLARATION, TWO
# READERS (#1328).
#
# Sourced by `.github/workflows/review.yml`, whose triage labels such a PR
# `needs-fable` and names the obligation as *the relay's eye on the rendered
# frames, both themes*; and read by `scripts/pr-merge-in-order.mts`, which asks
# the same question itself so a PR that never got a triage run is still
# reported as owing a look rather than as having been declined one.
#
# ⚠ THIS FILE REPLACED THE SIZE RULE, AND THE FOUNDER REMOVED THAT RULE RATHER
# THAN RAISING IT.
#
# It was `.github/review-size.sh` (#1194) and declared `REVIEW_SIZE_LINE='50'`
# and `REVIEW_NON_CODE`. Asked on 2026-09-26 (terminal) *"why must ever PR have
# a review a fable review on PR's seems like a waste of credits doesnt it?"*,
# told the rule and that day's tally — 22 seat PRs reviewed, 0 code defects
# found, 2 prose claims corrected, 22 of 22 instruments red under the relay's
# hand — the founder said *"i think opus 5 is comfrotable on more than 250 lines
# of code dont you?"* and, on the recommendation to remove the size trigger
# outright rather than raise it:
#
#     **"drop it"**
#
# So a diff's LINE COUNT no longer decides whether a hand review is owed. What
# decides it now: money/auth (`.github/money-surfaces.sh`, HELD), a change to
# the review's own rules (HELD), a `needs-fable` label added by hand, and this —
# anything a customer sees.
#
# ⚠ WHY THIS LIMB AND NOT NOTHING. Every other reason a review is owed is a
# thing a machine could in principle check. Working law 6 is not: *no visual
# change ships without being looked at in the running app first*, and law 9 puts
# the founder's eye above any reader's prose. A gate cannot look at a frame. So
# the one obligation that survives the size rule's removal is the one that was
# never mechanical — and this pattern exists to say WHICH diffs carry it.
#
# ⚠ AND IT IS A PROXY, WHICH IT SAYS OUT LOUD RATHER THAN IMPLYING. A path is
# not a promise that a customer will notice the change; it is the only signal a
# workflow has. A `client/src/` diff that moves no pixel earns a look it did not
# need, and a server-side copy change a customer reads earns none. The first
# costs a reading; the second is the failure direction, and it is the same one
# the size rule had — which is why `needs-fable` by hand stays the escalation
# road for anyone who can see further than the path (#1194).

# ── WHERE A CUSTOMER'S EYES LAND ─────────────────────────────────────────────
#
# The client bundle, all of it — components, pages, stores, hooks and the design
# tokens in `client/src/foundation/tokens.css` and `client/src/styles/`. It is a
# PREFIX rather than a list of extensions, deliberately: a `.css` token change
# and a `.tsx` component change
# are both things he would see, and a new file type must count on the day it
# arrives rather than on the day somebody remembers it. That is the same
# direction `money-surfaces.sh` chose and the opposite of the exclusion list the
# retired size rule needed.
#
# ⚠ NEITHER READER MAY DECLARE ITS OWN, and the two suites that hold them to
# this are named rather than guessed at: `server/reviewTriageTriggers.test.ts`
# reads the workflow's and the tool's bytes for a local assignment or a typed
# pattern, and `server/prMergeOrder.test.ts` drives the tool's reader against
# these exact bytes. (`.github/review-size.sh` said
# `server/moneySurfaceClassifier.test.ts` held it. That suite carried no arm for
# the size rule at any point — read at a grep for `REVIEW_SIZE` over it before
# this was written; a prose claim corrected here rather than repeated.)
CUSTOMER_SURFACE_PATHS='^client/src/'

# ── WHAT IS INSIDE THAT PREFIX AND STILL NOT A SURFACE ───────────────────────
#
# Two things, both named in his ruling: the client's own test files, and the
# staff panels under `client/src/features/admin/` — the Desk at `/admin/crew`
# and the admin surfaces, which he reads as the operator rather than sees as the
# customer.
#
# ⚠ IT IS `\.test\.ts$` AND NOT `\.test\.tsx?$`, AND THAT IS THE CONSERVATIVE
# DIRECTION ON PURPOSE. Measured at this tree: all 104 test files under
# `client/src/` are `.test.ts` and not one is `.test.tsx`. An EXEMPTION that is
# too wide fails SILENTLY — a real surface reading as exempt and earning no look
# — while one that is too narrow fails LOUDLY, as a review owed on a file that
# did not need one. So the exemption matches what the tree has; a `.test.tsx`
# arriving one day costs one unnecessary reading and a one-word edit here.
#
# ⚠ TWO THINGS ARE NOT EXEMPT THAT A READER MIGHT EXPECT TO BE, AND BOTH ARE HIS
# LIST RATHER THAN AN OMISSION — the ruling names `client/src/features/admin/`
# and nothing else.
#
#   - `client/src/features/moderator/` — the moderator panel.
#   - **The admin PAGES**, which is the one worth knowing: the page components
#     that mount those panels live in `client/src/pages/`, not in the feature
#     directory. Read at `git ls-files`: `AdminCrew.tsx` (the Desk itself),
#     `AdminAuditLogs.tsx`, `AdminBugReports.tsx`, `AdminChangeRequests.tsx`,
#     `AdminFoundation.tsx` and more.
#
# Each therefore earns a look it may not need. That is the LOUD direction — one
# extra reading — and widening the exemption to cover it would be the silent one,
# so it stays as he wrote it until he says otherwise.
CUSTOMER_SURFACE_EXEMPT='\.test\.ts$|^client/src/features/admin/'
