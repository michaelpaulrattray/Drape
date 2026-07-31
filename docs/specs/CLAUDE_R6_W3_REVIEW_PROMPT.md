# R6 W3 — final staged-diff review

Act as the sole substantive reviewer for the currently staged R6 W3 diff in `C:\Users\Admin\Drape`.

This is a **read-only review**. Do not edit files, stage, commit, push, deploy, run migrations, or contact production. Do not invoke another advisor. Inspect `AGENTS.md`, the complete staged diff, relevant surrounding code, and the current plan authority at `C:\Users\Admin\.claude\plans\rosy-jingling-gizmo.md`.

Review these W3 areas:

- the Casting Studio Package health surface and its route from mint-integrity blockers;
- server-owned refresh plans, refusals, and exact per-view credit costs;
- stale/failed retry, unpin, and current-identity-compatible restore behavior;
- real refreshed asset ledger IDs returned to the open Studio session;
- identity-iterate `staledAngles` and the quiet sibling-refresh notice;
- the same-tab Canvas/Studio in-flight refresh registry, including overlapping operations and model switching;
- error, loading, empty, failed, pinned, stale, and cross-revision states;
- side and Three-quarter prompt direction, plus mark-location prompt honesty;
- removal of false loading/history tips;
- standalone Studio mint-name prefill consistency;
- D-58's explicit R6/R7 boundary: same-tab UI coordination is not durable, cross-tab, or reload-safe job tracking.

Pay particular attention to authorization/ownership reuse, credit truth, cross-revision restore safety, React/Zustand correctness, cross-session result races, and whether any UI can falsely say a package is healthy or imply an action is free.

Verification already completed:

- `pnpm check` — pass;
- focused W3/regression tests — 80/80 pass;
- production build — pass;
- full unit suite — 2,249 pass / 50 skipped, with one established parallel-load timeout in `pathB-hardening.test.ts`;
- isolated `pathB-hardening.test.ts` rerun — 22/22 pass.

Codex's final self-review found and corrected one model-switch race before staging: refresh/restore results now patch `currentAssets` only when the mutation's model is still the currently open model, and in-flight cleanup/invalidation uses the mutation's actual model ID.

Return findings ordered by severity with file and line references. Explicitly challenge the design or implementation if you disagree. Distinguish blockers from optional R7 improvements. End with exactly one verdict:

- `APPROVE — safe to commit locally`, or
- `REQUEST CHANGES — not safe to commit locally`.
