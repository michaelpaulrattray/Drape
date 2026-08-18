/**
 * THE UNCALLED-EXPORT SWEEP — invariant 7's family, counted rather than guessed.
 *
 * ⚠ ITS ORIGIN SPECIMEN IS GONE, AND THAT IS WHY THE CONTROL MOVED (2026-08-18).
 * `EYE_SHAPE_ENGINE` was the founder-ratified routing row this sweep was built
 * around — and he RETIRED it in person (D-248, fable-848): the row is deleted
 * and `grep` now returns only this file's own prose. So the positive control
 * named a symbol that no longer exists, the run REFUSED, and the refusal was
 * the instrument working: a control that cannot be found is indistinguishable
 * from a sweep that cannot find anything. It is replaced below by a specimen
 * that CANNOT drift — one whose own name declares it test-only — with
 * `catalogueBornWorn` kept beside it as the independent second.
 *
 * Origin (opus-596 §5): `EYE_SHAPE_ENGINE` WAS a founder-ratified per-class
 * routing row whose only importer is its own test, and whose three green tests
 * assert the constant against its own literal. The roadmap already tracks two
 * siblings by hand — `bornWornCatalogue` has NO CALLERS, D-213's record gate has
 * no call site — so the question this answers is whether the family is three or
 * thirty.
 *
 * WHAT IT MEASURES, stated so a null means something: for every named export
 * under the scanned roots, who imports it, split into PRODUCTION importers and
 * TEST importers. A symbol whose only importer is a `*.test.ts` is a claim that
 * nothing on any request path can reach it.
 *
 * WHAT IT CANNOT SEE, stated rather than discovered later:
 *   - `import * as ns from "…"` then `ns.NAME` — namespace imports are counted
 *     as a wildcard consumer of every export in that module, deliberately
 *     conservative (it can HIDE a finding, never invent one).
 *   - dynamic `await import("…")` with a computed specifier.
 *   - a symbol reached only through a re-export barrel it does not name.
 * Every one of those biases toward SILENCE, so the list it prints is a floor.
 *
 * CONTROLS, per working law 2 — printed before any verdict, and the run REFUSES
 * if either fails:
 *   positive  SYSTEM_PROMPT_FOR_TESTS   must be found test-only — hand-verified
 *                                       2026-08-18: declared once in
 *                                       interpreter.ts, imported by two
 *                                       `.test.ts` files and nothing else, and
 *                                       its NAME is the reason it will stay
 *                                       that way
 *   negative  maskedEditingEnabledFor   must NOT be found (7 production callers)
 *
 *   npx tsx scripts/sweep-uncalled-exports-disposable.mts
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { buildClassifier, REPO_ROOT, runMentionControls } from "./lib/productionMention.mts";

const repoRoot = resolve(import.meta.dirname, "..");

/** Where exports are LOOKED FOR. */
const scanRoots = ["server"];
/** Where importers are looked for — wider than the scan, on purpose. */
const consumerRoots = ["server", "client", "shared", "scripts"];

function walk(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|mts)$/.test(full)) out.push(full);
  }
  return out;
}

const isTestFile = (file: string) => /\.(test|integration\.test)\.tsx?$/.test(file);

const scanFiles = scanRoots.flatMap((root) => walk(join(repoRoot, root)));
const consumerFiles = consumerRoots.flatMap((root) => walk(join(repoRoot, root)));

/* Every named export, with the file that declares it. */
type Decl = { name: string; file: string; kind: string };
const declarations: Decl[] = [];
const exportPattern =
  /^export\s+(?:async\s+)?(const|let|function|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/gm;

for (const file of scanFiles) {
  if (isTestFile(file)) continue;
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(exportPattern)) {
    declarations.push({ kind: match[1], name: match[2], file });
  }
}

/*
  A module that is namespace-imported anywhere is EXCLUDED whole — `ns.NAME` is
  a use this scan cannot resolve, and a finding that might be wrong is worse
  than a finding that is missing.
*/
const namespaceImported = new Set<string>();
for (const file of consumerFiles) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/import\s+\*\s+as\s+[\w$]+\s+from\s+["']([^"']+)["']/g)) {
    namespaceImported.add(match[1].replace(/^.*\//, "").replace(/\.(m?ts|tsx|js)$/, ""));
  }
}

/* Who names each symbol, and from where. */
type Use = { file: string; test: boolean };
const uses = new Map<string, Use[]>();
const wanted = new Set(declarations.map((d) => d.name));

for (const file of consumerFiles) {
  const source = readFileSync(file, "utf8");
  /*
    Only IMPORT statements count — a local variable of the same name is not a use.

    BOTH forms, because the first version had only the static one and called
    three live workers dead: `server/_core/index.ts` starts the cleanup worker,
    the retention sweep and the recovery sweep through
    `import("…").then(({ startX }) => …)`, which no `from "…"` scan can see.
    A blind spot that flags a running worker as uncalled is worse than no scan.
  */
  const destructuredDynamic =
    /(?:import\(\s*["'][^"']+["']\s*\)\s*\.then\s*\(\s*(?:async\s*)?\(?\s*\{([^}]*)\}|\{([^}]*)\}\s*=\s*await\s+import\s*\()/g;
  for (const match of source.matchAll(destructuredDynamic)) {
    for (const raw of (match[1] ?? match[2] ?? "").split(",")) {
      const name = raw.trim().split(":")[0].trim();
      if (!name || !wanted.has(name)) continue;
      const list = uses.get(name) ?? [];
      list.push({ file, test: isTestFile(file) });
      uses.set(name, list);
    }
  }
  for (const match of source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["'][^"']+["']/g)) {
    for (const raw of match[1].split(",")) {
      const name = raw.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
      if (!name || !wanted.has(name)) continue;
      const list = uses.get(name) ?? [];
      list.push({ file, test: isTestFile(file) });
      uses.set(name, list);
    }
  }
}

/*
  THE DISCRIMINATOR, and the first version of this scan had it wrong.

  "Only a test imports it" flagged 398 symbols and meant almost nothing: a
  helper exported for its own test, and consulted by its own module a line
  below, is ordinary and correct — `MASKED_EDITING_SCOPE` is exactly that.

  The property that matters is narrower and is the origin case's own shape:
  **the symbol is not referenced by any production code ANYWHERE, including the
  file that declares it.** Then it governs nothing at runtime, whatever its
  docblock says it decides. Self-reference inside the declaring module is
  therefore counted, and it is what separates the family from the noise.
*/
const selfReferences = new Map<string, number>();
for (const decl of declarations) {
  const key = `${decl.file}::${decl.name}`;
  if (selfReferences.has(key)) continue;
  const source = readFileSync(decl.file, "utf8");
  const hits = source.match(new RegExp(`\\b${decl.name}\\b`, "g"))?.length ?? 0;
  /* One hit is the declaration itself. */
  selfReferences.set(key, Math.max(0, hits - 1));
}

type Finding = Decl & { testImporters: number };
const findings: Finding[] = [];
const unimported: Decl[] = [];

for (const decl of declarations) {
  /* Types and interfaces are contracts, not call sites — out of scope. */
  if (decl.kind === "type" || decl.kind === "interface") continue;
  const moduleName = decl.file.replace(/^.*[\\/]/, "").replace(/\.(m?ts|tsx)$/, "");
  if (namespaceImported.has(moduleName)) continue;
  if ((selfReferences.get(`${decl.file}::${decl.name}`) ?? 0) > 0) continue;

  const seen = (uses.get(decl.name) ?? []).filter((use) => use.file !== decl.file);
  if (seen.length === 0) {
    unimported.push(decl);
    continue;
  }
  if (seen.every((use) => use.test)) findings.push({ ...decl, testImporters: seen.length });
}

const show = (file: string) => relative(repoRoot, file).replace(/\\/g, "/");

/* ---- CONTROLS FIRST. A verdict printed before these pass is not a reading. ---- */
const flagged = (name: string) =>
  findings.some((f) => f.name === name) || unimported.some((d) => d.name === name);

/* The specimen is named ONCE and printed from the same constant, so the label
   can never claim a control the run did not take (this file printed
   "positive EYE_SHAPE_ENGINE ... PASS" for a run that had tested something
   else entirely, which is the shape of a report that reads green while
   measuring nothing). */
const POSITIVE_SPECIMEN = "SYSTEM_PROMPT_FOR_TESTS";
const positive = flagged(POSITIVE_SPECIMEN);
/*
  TWO negatives, because the two ways of being consulted are different and the
  first version of this scan only had the first one covered:
    maskedEditingEnabledFor  imported by seven production files
    MASKED_EDITING_SCOPE     imported by nobody, read by its OWN module
  A scan that flags either is measuring "exported for a test", not "governs
  nothing".
*/
const negativeImported = flagged("maskedEditingEnabledFor");
const negativeSelfRead = flagged("MASKED_EDITING_SCOPE");
/* Third way of being consulted: destructured off a dynamic import at boot. */
const negativeDynamic = flagged("startStorageCleanupWorker");
/* Second POSITIVE, and an independent one: the roadmap says this has no
   callers (§0, filed by fable-121) and the scan was not told. */
const positiveIndependent = flagged("catalogueBornWorn");

console.log("CONTROLS");
console.log(
  `  positive  ${POSITIVE_SPECIMEN.padEnd(25)} ${positive ? "FOUND            PASS" : "NOT FOUND  FAIL"}`,
);
console.log(
  `  negative  maskedEditingEnabledFor   ${negativeImported ? "FLAGGED  FAIL" : "not flagged      PASS"}`,
);
console.log(
  `  positive  catalogueBornWorn         ${positiveIndependent ? "FOUND            PASS" : "NOT FOUND  FAIL"}`,
);
console.log(
  `  negative  MASKED_EDITING_SCOPE      ${negativeSelfRead ? "FLAGGED  FAIL" : "not flagged      PASS"}`,
);
console.log(
  `  negative  startStorageCleanupWorker ${negativeDynamic ? "FLAGGED  FAIL" : "not flagged      PASS"}`,
);
if (!positive || !positiveIndependent || negativeImported || negativeSelfRead || negativeDynamic) {
  console.log("\nREFUSED — the instrument failed its own controls; no verdict printed.");
  process.exit(1);
}

console.log(`\nscanned   ${scanFiles.filter((f) => !isTestFile(f)).length} production files`
  + ` · ${declarations.length} named exports`);
console.log(`consumers ${consumerFiles.length} files across ${consumerRoots.join(", ")}`);

console.log(`\nTEST-ONLY EXPORTS — imported, but by nothing except a test (${findings.length})`);
for (const finding of findings.sort((a, b) => a.file.localeCompare(b.file))) {
  console.log(`  ${finding.kind.padEnd(8)} ${finding.name.padEnd(38)} ${show(finding.file)}`);
}

console.log(`\nNAMED BY NOBODY — not imported anywhere at all (${unimported.length})`);
for (const decl of unimported.sort((a, b) => a.file.localeCompare(b.file))) {
  console.log(`  ${decl.kind.padEnd(8)} ${decl.name.padEnd(38)} ${show(decl.file)}`);
}

/* -- THE READING LIST: the intersection, computed HERE -----------------------
 *
 * Ordered fable-982, and it exists because the join used to be done in PROSE.
 * Both lists above are FLOORS by this sweep's own three declared biases
 * (namespace imports, dynamic specifiers, barrel re-exports), so neither is a
 * reading list on its own. A recon read the test-only list (111) and the
 * classifier's `none` bucket (also 111) as one set, published 118, and left
 * THIRTEEN symbols with live production callers on it -- among them admin
 * credit adjustment and admin role changes.
 *
 * Two lists of the same LENGTH are not the same LIST. So the sweep asks the
 * classifier itself and prints the intersection, with its own controls first.
 */
const classify = buildClassifier(REPO_ROOT);
console.log("\nINTERSECTION CONTROLS");
if (!runMentionControls(classify, (line) => console.log(line))) {
  console.log("\nREFUSED - the classifier failed its own controls; no reading list printed.");
  process.exit(1);
}

const everyFlagged = [
  ...findings.map((f) => ({ name: f.name, file: f.file })),
  ...unimported.map((d) => ({ name: d.name, file: d.file })),
];
const tally = { none: 0, other: 0, barrel: 0, dynamic: 0 };
const readingList: Array<{ name: string; file: string }> = [];
for (const entry of everyFlagged) {
  const kind = classify(entry.name).kind;
  tally[kind]++;
  if (kind === "none") readingList.push(entry);
}

console.log(`\nTHE READING LIST - ${readingList.length} of ${everyFlagged.length} flagged`);
console.log(`  with a production mention  ${everyFlagged.length - readingList.length}`
  + `  (barrel ${tally.barrel} - dynamic ${tally.dynamic} - other ${tally.other})`);
console.log(`  nothing but a declaration  ${tally.none}   <- THE LIST`);
console.log();
for (const entry of readingList.sort((a, b) => a.file.localeCompare(b.file))) {
  console.log(`  ${entry.name.padEnd(38)} ${show(entry.file)}`);
}

process.exit(0);
