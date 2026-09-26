# shellcheck shell=sh
#
# WHEN A DIFF IS BIG ENOUGH TO EARN A LOOK — ONE DECLARATION, TWO READERS (#1194).
#
# Sourced by `.github/workflows/review.yml`, whose triage labels the PR
# `needs-fable` past the line, and read by `scripts/pr-merge-in-order.mts`, which
# asks the same question itself.
#
# ⚠ IT EXISTS BECAUSE THE SIZE OBLIGATION HAD EXACTLY ONE READER, AND AN ABSENCE
# WAS READING AS A DECISION.
#
# Measured on PR #1191, 2026-09-24: it was opened as a draft at 23:34:51Z and
# marked ready at 23:35:10Z, and **no `Fable Review` run was created for either
# event** — read at the Actions API over the whole repository for that window,
# one run came back and it was `deploy-verify` on a push to main. Main had moved
# at 23:24Z, so the PR was born DIRTY, and a CONFLICTING PR gets no
# `pull_request` workflow run for any event (#566).
#
# `gate.yml` came back on its own the moment a merge of main was pushed, because
# it also triggers on `synchronize`. Triage did not: its triggers cannot fire
# again on a PR that is already open and already ready, so #1191's triage was not
# delayed — **it was permanently gone**, on a 288-line diff that triage's own
# rule would have flagged.
#
# What was NOT harmed, read at the code before it was claimed: the money rule and
# the reviewer-workflow rule have a SECOND reader in `pr-merge-in-order.mts`
# ("a label someone removed cannot un-owe a money diff"), so a money/auth PR that
# loses its triage is still held. **The size obligation had only the workflow.**
# A large ordinary diff that lost its triage was announced to nobody — no label,
# no comment — and the merge tool reported `review=declined`, which is the same
# word it uses for a diff that genuinely earned no look. An absence reading as a
# decision is the shape this queue keeps paying for (#566's absent check, #219's
# green-is-not-a-pass).
#
# So the rule is declared once here and both readers ask it. Neither may declare
# its own — `server/moneySurfaceClassifier.test.ts` holds them to these bytes,
# the way it already holds both halves of the money rule.

# ── THE LINE ─────────────────────────────────────────────────────────────────
#
# Fifty changed lines of code. It is the figure triage has used since #1065 and
# it is quoted rather than re-chosen here: this file's job is to stop it being
# typed twice, not to move it.
REVIEW_SIZE_LINE='50'

# ── WHAT DOES NOT COUNT AS CODE ──────────────────────────────────────────────
#
# Docs, images, the mailbox and generated output. A `.json` is excluded because
# the two generated Atlas maps are JSON and every commit that touches a scanned
# path carries them — counting those would put nearly every diff past the line,
# which is the same as having no line at all.
#
# ⚠ It is an EXCLUSION rather than an allowlist of code extensions, and that
# direction is deliberate: a new source extension (a `.mts` when the repo had
# none, a `.tsx`) must count as code on the day it arrives, not on the day
# somebody remembers to add it. The failure direction of an allowlist here is
# silence — a diff full of a new extension reading as zero lines.
REVIEW_NON_CODE='\.(md|txt|png|jpg|jpeg|webp|json)$|^docs/|^\.agents/|^output/'
