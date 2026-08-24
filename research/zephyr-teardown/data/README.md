# ZEPHYR corpus — what is here and how to reproduce it

Pulled 2026-08-24 from `https://fnf-api-gw.higgsfield.ai/fnf/folders/<id>/items/v2`,
the ZEPHYR project's own folder API. **No authentication is required** — the
project is published to the Higgsfield community and the API serves full job
records to anonymous callers.

Re-fetch with [`../scripts/harvest.mjs`](../scripts/harvest.mjs) (`node harvest.mjs`,
writes `raw/*.json`). It pages at 100 items — the API's maximum — with a 120ms
delay and five retries per page.

## Folder IDs

| Folder | ID | Items |
|---|---|---|
| Root (project) | `5ecc7815-5b04-4e6b-968b-2b5b518c7539` | — |
| Characters | `fd830c2c-3303-4cd0-bd10-53e4d37c2efc` | 54 |
| Production | `284025b8-cf65-4c32-99b2-df06b0c31637` | 275 |
| Iterations | `5d8d20bc-9399-41e0-ae69-f1871ffb0a41` | 18,673 stated / 18,643 served |

## Files

| File | Size | What it is |
|---|---|---|
| `characters.json` | 59K | All 54 reference-image records, verbatim from the API. |
| `production.json` | 1.1M | All 275 keeper shots, verbatim — prompts, params, reference attachments. |
| `production-shotlist.md` | 316K | The 275 shots as readable text, chronological, with author, settings, reference count and full prompt. |
| `characters-manifest.md` | 2.8K | The asset bible as a table — filename, pixel dimensions, bytes. |
| `iteration-prompts.jsonl` | 2.0M | **Derived.** The 18,643 iterations collapsed to 1,608 distinct (model, prompt) pairs with run count, authors, first/last timestamp and key parameters. |

## What is deliberately not committed

The raw `iterations.json` is **68 MB** and is not in the repo. `iteration-prompts.jsonl`
is the lossless-for-analysis digest of it: every distinct prompt survives, only
the per-run duplicates are collapsed into a count. Re-fetch the full file with
the harvest script if you need per-job timestamps or result URLs.

Reference **images** are not committed either. Every job record carries public
CloudFront URLs for its attachments and results; they were readable at the time
of the pull and are fetchable directly.

## Known gaps

- **30 iteration records** were not served (18,673 stated, 18,643 returned).
  Most likely deleted rows. Everything else is complete, not sampled.
- **Only 2.4%** of the 1,075 reference images attached to production shots
  resolve to items inside these three folders. The rest live in individual
  artists' own workspaces and are identified in the job records only by URL.
