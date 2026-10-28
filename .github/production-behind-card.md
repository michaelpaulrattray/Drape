**Filed by `.github/workflows/production-currency.yml`** — the reader `deploy-verify` never had (#2748).

**A change was merged and it is not live.** The commit at the top of `main` is not the commit production is serving, and nothing Railway has said about it explains that. Whatever landed since the live build is finished, reviewed and in front of nobody.

**Nothing here needs code written.** It needs a deploy, or an answer about why one is not happening.

## Why no other alarm fired

`deploy-verify` sees this correctly and in about two minutes, and its verdict is a red run in the Actions tab that nothing and nobody reads. Every other alarm the team owns keys on work **in flight** — the shift stall window fires on an open row, the close-stamp verifies an entry that exists — and **a merged, green, failed-to-ship commit is in flight to nobody**. Nobody skipped a step: a builder seat correctly does not poll the gate and has gone by the time its card merges, the relay merges and moves on, and the pull request's own checks were green because this job runs on the push to `main` *after* the merge.

## What to read, in this order

1. **`/api/health`'s `build` field on production, again.** It is the fact, and a retry may already have fixed this. Railway's own record can lie in both directions: on 2026-10-28 the deployment for `709536f4` carried `failure` as its newest status while production was serving that very commit.
2. **The build log for this commit's deployment in the Railway dashboard.** That is the only place the cause is printed. The specimen this card comes from was Railway's own build daemon — `failed to list workers … use of closed network connection` — which appeared on the third attempt and on neither of the first two.
3. **Whether anything has shipped at all since.** If `main` has moved again, the newer commit's own run answers for it and this card may already be stale.

## What this card is NOT

**It does not claim a cause, and it cannot.** It is the observation — that production is not serving the top of `main` — which is the one thing no reader the team owns was able to say.

**It does not ask for a retry to be automated.** That was considered and refused on the card: of the six build attempts that morning, five failed on a provider daemon, and a retry loop would have hammered it and still told nobody. The thing that was missing was *knowing*, not *retrying*.

**One card, ever, while this is true.** The dedupe is the `production-behind` label on an open card; a long outage adds a line to this one rather than filing a second row.

## Closing it

Close it when production is serving the top of `main` again, **with what it turned out to be** — a provider build failure, a healthcheck refusal, a push Railway never picked up, or something else. That sentence is the only thing that will tell the next reader whether the window is right.
