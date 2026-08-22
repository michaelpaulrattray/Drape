/**
 * THE UN-WIRING DIFFER — was this control WIRED AND LOST, or never wired at all?
 *
 * ⚠ THIS EXISTS BECAUSE CLAUDE.md SAID IT COULD NOT. Verbatim, until
 * 2026-08-22: *"An import-graph reading that only asks 'does anything call
 * this' cannot tell a control that was never wired from one that was UN-wired,
 * and only the second kind has a commit that can be found and read."*
 *
 * The missing ingredient was never cleverness. It was TIME. Read the import
 * graph at TWO trees — one in a `git worktree` — and the two kinds separate:
 * a symbol that had production importers then and has none now was UN-WIRED,
 * and `git log -S` names the commit in one command.
 *
 *   npx tsx scripts/diff-importer-count-across-time.mts <old-tree> <new-tree>
 *   npx tsx scripts/diff-importer-count-across-time.mts <old> <new> --controls february
 *
 *   git worktree add --detach C:/tmp/old <commit>     # then remove it after
 *
 * # WHO SHOULD RUN IT, AND WHEN
 *
 * The retirement program's own missing tool (ruled fable-1349 §3). The Atlas
 * answers *"does anything call this"*; this answers *"did something STOP"*.
 * **No retirement sitting closes without running it over its own window.**
 *
 * # WHY IT COUNTS IMPORTERS RATHER THAN READING THE UNCALLED-EXPORT SWEEP
 *
 * The first version of this diffed `sweep-uncalled-exports-disposable.mts`'s
 * flagged set across two trees, and it CANNOT SEE THE TYPE SPECIMEN. That
 * parent excludes any symbol its own declaring module still references —
 * deliberately, and correctly for its own question. `isSensitiveAction`, the
 * gate dropped by the `3cb0cdee` file split, is consulted twice inside
 * `adminSecurity.ts` for severity labelling. Measured at the two trees:
 *
 *   isSensitiveAction @ 1d193bf0   prodImporters=1 (server/routers.ts)  selfUses=2
 *   isSensitiveAction @ 9a96480a   prodImporters=0                      selfUses=2
 *
 * ⚠ **THAT READING WAS RIGHT AND THE SENTENCE UNDER IT WAS WRONG — CORRECTED
 * 2026-08-23, and it is this file's own bias (3) firing on its own flagship
 * control.** The importer was never read. `server/routers.ts` mentioned
 * `isSensitiveAction` EXACTLY ONCE, on its import line, from the commit that
 * created it (`8d6531ba`, 2026-02-06) to the commit that dropped it — and
 * `git log -S "isSensitiveAction("` changes count at the declaration and never
 * again, so no file outside `adminSecurity.ts` ever called it. **It was a dead
 * import, and `3cb0cdee` removing it was correct.** The sensitive-action gate
 * is a control that was WRITTEN AND NEVER WIRED, which is the gentlest road,
 * and the record calling it a refactor casualty was the wrong road told
 * confidently — the exact failure that paragraph of CLAUDE.md exists to name.
 * The other three deaths on that list were read the same way and all three
 * hold: `getRecentTopupCredits` (`server/routes/billing.ts:170-172`),
 * `recordGlobalFailedLogin` (`oauth.ts`, both failed-login exits) and
 * `captureRefusedRender` (`await captureRefusedRender({`) were each genuinely
 * invoked. **A dead import is not an importer, and the reader now says so** —
 * see `lib/importerCountDiff.mts`.
 *
 * What survives unchanged is WHY this counts importers rather than reading the
 * parent sweep: the self-use count never moves for a self-consulted symbol, so
 * `selfUses` is a LABEL on the finding rather than a filter over it, and
 * `self-consulted` findings are exactly the ones the parent can never produce.
 *
 * # THE BOUNDARY THE SABOTAGE MAPPED (opus-993 §7)
 *
 * The manufactured control refuted its own first form, which is worth more than
 * the pass. Deleting the single production call site of `verifyIdentityEdit`
 * did NOT show up in the parent's reading list, because a `typeof
 * verifyIdentityEdit` type annotation survived two lines away and the parent
 * drops any symbol production still MENTIONS. **A type annotation governs
 * nothing at runtime.** Counting importers has no such filter.
 *
 *   PARTIAL sabotage  (call site gone, `typeof` survives)  importer count 1 -> 0  FOUND
 *   COMPLETE sabotage (every production mention gone)                             FOUND
 *   clean tree                                                                    not found
 *
 * # THREE NAMED WAYS TO BE WRONG — two toward silence, one toward noise
 *
 * **(1) TOWARD SILENCE — an unreachable call site that still exists.** Sitting
 * after an early return, or behind a flag that is never on. `recordInkFormDemand`
 * is exactly that shape and CLAUDE.md records it. Computed dynamic specifiers
 * are not resolved either.
 *
 * ⚠ **NAMESPACE IMPORTS WERE ON THAT LIST UNTIL 2026-08-23, AND THAT LINE WAS
 * COSTING THE INSTRUMENT ITS BEST SUBJECT.** `import * as db from "../db"` is
 * the house style of this product's whole database layer, so the reading it
 * excluded was not an edge case: measured against the real tree the hour it
 * was fixed, **33 server exports were production-wired and counted zero** —
 * `isAccountLocked`, `recordFailedLogin` and `resetFailedLogins`, which are
 * the ACCOUNT LOCKOUT that both login routes call and that invariant 9's own
 * sentence names, plus 28 board operations reached through one `ops.` alias.
 * A symbol already counted at zero can never be seen to FALL to zero, so this
 * differ would have reported silence on the day the lockout died. The hop is
 * resolved now (`lib/importerCountDiff.mts`, seven arms in
 * `server/unwiringDiffer.test.ts`) and it is deliberately narrow: a RELATIVE
 * binding, and the member must be declared in that module or one it re-exports
 * from, ONE hop. A barrel of barrels still reads as no importer — pinned by
 * its own arm rather than left to be assumed, and it is the safe direction:
 * this reader may produce a finding that turns out alive, never a silence
 * about something that died.
 *
 * **(2) TOWARD SILENCE — born AND un-wired inside one window, invisible.** A
 * symbol absent from the `before` tree is skipped, because it cannot have lost
 * importers it never had. This is demonstrated rather than asserted, on this
 * instrument's own two control specimens: tiling the history on 2026-08-22, the
 * window `3dad2280 → a08fb0cd` (2026-02-02 → 02-08) reported **ZERO** — and
 * BOTH February deaths happened on 2026-02-07, inside it. `isSensitiveAction`
 * and `getRecentTopupCredits` were simply absent from the bootstrap commit.
 * (Only ONE of those two turned out to be a death — see the correction above.
 * The gap this paragraph demonstrates is untouched by that: a symbol absent
 * from the `before` tree is skipped whatever its road turns out to be.)
 * **Finer tiles shrink this gap and never close it, so every zero is only as
 * trustworthy as its window is narrow.**
 *
 * **(3) TOWARD NOISE — a DEAD importer still counts as an importer.** This is
 * the file's one bias in the opposite direction, so it is stated apart. The
 * reading is ONE HOP: it asks who imports the symbol, not whether that importer
 * is itself reachable. Worked example, 2026-08-22: `isIpBlocked` appeared to
 * lose a live importer, `server/security/rateLimit.ts` — but that importer was
 * the wrapper `checkIpBlocked`, whose only consumer was a test, under a docblock
 * reading *"This should be called early in request processing."* The chain
 * looked wired at each link and was dead as a whole, and CLAUDE.md's
 * *"Road: never wired"* verdict survived the accusation. **Read the importer
 * before believing the finding.**
 *
 * So: **a clean run is a floor and not coverage, and a finding is a question.**
 *
 * And the reading is only as wide as its window. Run against a `before` tree
 * from inside the current campaign, most of this product did not exist to be
 * un-wired: window B on 2026-08-22 held 703 exports against HEAD's 2,478.
 * A seven-DECIDED result over such a window is not a clean bill of health.
 *
 * # WHAT IT HAS ACTUALLY FOUND
 *
 * Its first full pass over the product's history (2026-08-22, nine tiles,
 * `3dad2280` → `68765827`) produced 15 findings and ONE ACCIDENT: the
 * site-wide login-attack detector, live on the request path from `8830fc95`
 * (2026-02-05) and killed by `b1f5187d` (2026-04-03), the commit that removed
 * the Manus OAuth platform — *"All 64 auth tests passing."* CLAUDE.md had that
 * control filed as a road that was never wired; it is a path-three death, and
 * the file now says so.
 *
 * # CONTROLS
 *
 * The arms that need no worktree are `server/unwiringDiffer.test.ts`, driven
 * against manufactured trees — including the type specimen's own shape, a
 * symbol that loses its importer while keeping its self-uses.
 *
 * The arm that needs two real trees rides `--controls february`, and it is the
 * one that proves the instrument on the class it was built for. Given the
 * February window it must rediscover BOTH deaths CLAUDE.md records from that
 * morning, and must NOT report a symbol that kept its importers:
 *
 *   git worktree add --detach C:/tmp/feb-before 1d193bf0   # 2026-02-06 09:10
 *   git worktree add --detach C:/tmp/feb-after  9a96480a   # 2026-02-07 20:59
 *
 *   PASS  positive  a credit-velocity cap          getRecentTopupCredits -> 41a765ea, the topup removal
 *                   (it SURVIVED the split, moving into server/routes/billing.ts, and died a morning
 *                    later — and its call site was READ before it was believed: billing.ts:170-172)
 *   PASS  negative  a symbol that kept its importers    logAdminAction: 1 -> 4 importers
 *   PASS  negative  ⚠ A DEAD IMPORT REMOVED IS NOT A DEATH — isSensitiveAction must NOT be reported
 *
 * A positive control made of REAL specimens with commits that can be read,
 * rather than a fixture that models what its author expected.
 *
 * ⚠ **The last line CHANGED SIDES on 2026-08-23.** `isSensitiveAction` was this
 * file's first positive control, and it was never an un-wiring: `routers.ts`
 * mentioned it once, on its import line, for its whole life. A reader that
 * stays silent about it is the correct reader, so the specimen is worth more
 * as the negative than it ever was as the positive. **A control that swaps
 * sign on evidence is the record working; a control kept because it once
 * passed is how a wrong road survives six months.**
 *
 * # ONE WRITING NOTE, because it cost two silent wrong answers
 *
 * This file and its module are written with an editor rather than a shell
 * heredoc. A heredoc collapses a doubled backslash, so `\\b` inside a RegExp
 * *string* becomes a literal BACKSPACE character — no warning, invisible in a
 * diff, and a declaration scan that silently matches nothing. `String.raw` and
 * a non-transforming writer are the fix; vigilance is not.
 */
import { importerCount, readTree, unwiredBetween } from "./lib/importerCountDiff.mts";

const [oldTree, newTree] = process.argv.slice(2);
const controlSet = process.argv.includes("--controls")
  ? process.argv[process.argv.indexOf("--controls") + 1]
  : "none";

if (!oldTree || !newTree) {
  console.error("usage: diff-importer-count-across-time.mts <old-tree> <new-tree> [--controls february]");
  process.exit(2);
}

const before = readTree(oldTree);
const after = readTree(newTree);
const findings = unwiredBetween(before, after);
const selfConsulted = findings.filter((f) => f.kind === "self-consulted");
const fullyDark = findings.filter((f) => f.kind === "fully-dark");

/* ---- CONTROLS FIRST. A verdict printed before these pass is not a reading. ---- */
const failures: string[] = [];
const check = (label: string, ok: boolean, detail: string) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(50)} ${detail}`);
  if (!ok) failures.push(label);
};
const found = (name: string) => findings.some((f) => f.name === name);

console.log("CONTROLS");
check(
  "sanity    both trees read",
  before.decl.size > 100 && after.decl.size > 100,
  `${before.files} files / ${before.decl.size} exports  ->  ${after.files} files / ${after.decl.size} exports`,
);
check(
  "sanity    the two trees are DIFFERENT trees",
  before.decl.size !== after.decl.size || before.files !== after.files,
  `${after.decl.size - before.decl.size} exports, ${after.files - before.files} files`,
);
if (controlSet === "february") {
  check(
    "negative  REAL: a dead import removed is NOT a death",
    !found("isSensitiveAction"),
    "routers.ts mentioned it once, on its import line, for its whole life (2026-08-23)",
  );
  check(
    "positive  REAL: a credit-velocity cap (41a765ea)",
    found("getRecentTopupCredits"),
    "the sibling death the same morning",
  );
  check(
    "negative  a symbol that kept its importers is NOT found",
    !found("logAdminAction"),
    `logAdminAction: ${importerCount(before, "logAdminAction")} -> ${importerCount(after, "logAdminAction")} importers`,
  );
} else if (controlSet !== "none") {
  check(`sanity    --controls names a known set`, false, `unknown control set "${controlSet}"`);
}

if (failures.length > 0) {
  console.log(`\nREFUSING TO REPORT — ${failures.length} control(s) failed.`);
  process.exit(1);
}

console.log(`\nUN-WIRED IN THIS WINDOW — production importers fell to zero (${findings.length})`);
console.log(`\n  STILL SELF-CONSULTED (${selfConsulted.length}) — the uncalled-export sweep cannot see these`);
for (const finding of selfConsulted) {
  console.log(`    ${finding.name.padEnd(34)} ${finding.declaredAt}  (selfUses ${finding.selfUses})`);
  for (const lost of finding.lostImporters) console.log(`      lost importer: ${lost}`);
}
console.log(`\n  FULLY DARK (${fullyDark.length}) — the uncalled-export sweep flags these too`);
for (const finding of fullyDark) {
  console.log(`    ${finding.name.padEnd(34)} ${finding.declaredAt}`);
  for (const lost of finding.lostImporters) console.log(`      lost importer: ${lost}`);
}
console.log(
  `\nEach finding is a QUESTION, not a defect: run \`git log -S <name>\` and read the commit.` +
    `\nDECIDED — the commit closed the path on purpose. ACCIDENT — it was aimed at something else.` +
    `\nOnly the second kind is the class this instrument exists for.`,
);

/* The last top-level statement ends the process (scriptExitDiscipline). */
process.exit(0);
