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
 * **The self-use count never moved. The symbol never became uncalled. Only the
 * call site that made it a gate did** — and something kept saying its name for
 * an unrelated reason, which is how a dead control keeps a live reputation.
 * So the reading here is the importer count, and `selfUses` becomes a LABEL on
 * the finding rather than a filter over it: `self-consulted` findings are
 * exactly the ones the parent sweep can never produce.
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
 * # WHAT IT CANNOT SEE, stated rather than discovered later
 *
 * A call site that still EXISTS but has become unreachable — sitting after an
 * early return, or behind a flag that is never on. `recordInkFormDemand` is
 * exactly that shape and CLAUDE.md records it. Namespace imports
 * (`import * as ns`) and computed dynamic specifiers are not resolved. Every
 * bias points the same way, so **a clean run is a floor and not coverage.**
 *
 * And the reading is only as wide as its window. Run against a `before` tree
 * from inside the current campaign, most of this product did not exist to be
 * un-wired: window B on 2026-08-22 held 703 exports against HEAD's 2,478.
 * A seven-DECIDED result over such a window is not a clean bill of health.
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
 *   PASS  positive  the sensitive-action gate      isSensitiveAction    -> 3cb0cdee, the routers.ts split
 *   PASS  positive  a credit-velocity cap          getRecentTopupCredits -> 41a765ea, the topup removal
 *                   (it SURVIVED the split, moving into server/routes/billing.ts, and died a morning later)
 *   PASS  negative  a symbol that kept its importers    logAdminAction: 1 -> 4 importers
 *
 * A positive control made of REAL specimens with commits that can be read,
 * rather than a fixture that models what its author expected.
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
    "positive  REAL: the sensitive-action gate (3cb0cdee)",
    found("isSensitiveAction"),
    "self-consulted at both ends — the uncalled-export sweep can never report it",
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
