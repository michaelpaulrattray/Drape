# Fable review prompt — R7-5A Cast deletion audit and writer inventory

Review the currently staged R7-5A diff read-only against:

- `docs/specs/CASTING_SYSTEM_R7_5_FINAL_DELETION_EXECUTION_PLAN.md`, especially §3, §4.4–4.6, R7-5A, and verification items 9/20/21/30–32;
- D-64 in `docs/specs/DECISION_LOG.md`; and
- the current production writers and schema at baseline `bb0eb67`.

Do not edit, stage, commit, run a database audit, contact production, or call storage. Inspect the full staged diff and surrounding code. Challenge the executor's classification rather than trusting the tests.

The staged set must be exactly:

1. `docs/specs/CASTING_MODEL_ID_WRITER_INVENTORY.md`
2. `scripts/audit-cast-deletion.ts`
3. `server/casting/deletionAudit.ts`
4. `server/r7-cast-deletion-audit.test.ts`

Verify all of the following.

## A. Read-only and target safety

1. The script cannot choose an ambient `DATABASE_URL`; database URL, app id, and current R2 public origin are explicit arguments.
2. A production app id refuses by default and only runs with the explicit `--allow-production-read-only` flag.
3. Every issued SQL statement passes one read-only assertion and the connection has multiple statements disabled by default.
4. The script runs inside `START TRANSACTION READ ONLY` and always rolls back/closes.
5. No insert/update/delete/schema DDL, storage import, `storageDelete`, production mutation, or hidden write helper is reachable.
6. The default report contains counts/model ids/status only—not names, prompts, technical schemas, preferences, URLs, storage keys, identity documents, error prose, or receipt results. `--include-origin-hosts` may reveal origin strings only, never paths/keys/full URLs.
7. Pre-0009 compatibility is real: the script detects whether `models.deletedAt` exists and still reports legacy `archived` rows correctly before migration 0009.

## B. Exact-owned storage law

8. A valid explicit storage key is preferred over URL derivation.
9. URL derivation accepts only an exact normalized origin match with the explicitly supplied current public origin.
10. External hosts, wrong R2 buckets, legacy Manus/CDN origins, malformed URLs, encoded/literal dot segments, encoded separators, backslashes, empty paths, and unsafe keys cannot become owned deletion authority.
11. Recursive JSON inspection finds nested HTTP(S) evidence without treating ordinary prose or base64 reference images as URLs.
12. The audit only classifies evidence. No output from it is itself authorization to delete an object; the later cleanup manifest still needs reviewed server-owned proof.

## C. Dependency coverage and mismatch truth

13. Per-model reporting covers lifecycle status, assets/explicit and missing keys, generation attempts, parent operations, direct/JSON/URL Canvas links, matching versions, incident edges, board thumbnails, Wardrobe sessions/looks and URL counts, bug reports, temporary reference-image presence/sharing, and origin classifications.
14. Recognized JSON Cast provenance is limited to `cast_root`, `cast_view`, and `library_cast` with a positive model id.
15. Direct-vs-JSON mismatches, JSON-only legacy links, URL-only links, and cross-owner references are distinguished honestly.
16. Cross-owner detection includes current Canvas items, historical versions, thumbnails, Wardrobe rows, generation attempts, operation receipts, and bug reports—not merely the visible current node.
17. A mismatch/cross-owner finding produces a non-zero attention exit without changing anything.
18. The optional `--model-id` report still compares a temporary reference against all models, rather than only the selected row.

## D. Complete durable-writer inventory

19. The inventory accounts for every schema model link:
    - `model_assets.modelId`
    - `generations.modelId`
    - `generation_operations.modelId`
    - `board_items.sourceModelId` plus JSON provenance
    - `wardrobe_sessions.modelId`
    - `wardrobe_looks.modelId`
    - `bug_reports.modelId`
20. Re-scan all production `INSERT`/`UPDATE` helpers and route inputs; report any missing writer or any writer classified safe without sufficient evidence.
21. In particular, verify the seven staged **FENCE REQUIRED** findings are real:
    - reusable `updateModel` / `models.update` race;
    - `wardrobe.sessions.create`;
    - `wardrobe.looks.save` plus session consistency;
    - legacy `boards.addItem` / `boards.addItems`;
    - generic `boardOps.createNode` accepting untyped Cast provenance;
    - `bugReports.submit` optional pointer; and
    - existing-model `generation_operations` claim inserted before lock acquisition.
22. Check whether any additional Board helper, recovery/adjudication path, generation child writer, model asset writer, Wardrobe updater, admin/moderator writer, account deletion path, or in-memory lookalike has been omitted or misclassified.
23. Existing-model paths called safe under a model lock genuinely hold `model:<id>` through the durable write; new-subject paths use an exact server-created id and cannot be rebound.
24. The inventory does not turn R7-5A into implementation: no writer is changed yet, and every unsafe writer is a binding R7-5C completion item.

## E. Tests and scope

25. Tests behaviorally prove production refusal, SQL rejection, exact-origin/key classification, nested URL extraction, recognized provenance, staged audit structure, schema-column completeness, and all seven fence findings.
26. Challenge source-string assertions for false confidence; require a correction if a reachable mutation, leak, missed writer, unsafe origin, or incomplete dependency remains despite green tests.
27. Run `pnpm check`, the focused test, and `git diff --cached --check` independently if useful. Do not run the audit against any database.
28. Confirm exactly four intended files are staged and all `.agents/`, `.codex/`, `CLAUDE.local.md`, brand files, and `docs/specs/CLAUDE_*` prompts remain unstaged.

Return exactly one verdict:

- `APPROVE — safe to commit R7-5A locally`
- or `REQUEST CHANGES` with concrete reachable blockers, file/line evidence, consequence, and the smallest sound correction.

List non-blocking observations separately. This approval is for a local commit only. It does not authorize running the audit against production, migration 0009, deletion code, R2 cleanup, push, deploy, or feature enablement.
