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
 *   - a symbol imported ONLY by one of the six root-level `.ts` files —
 *     `seed.ts`, `drizzle.config.ts`, `vite.config.ts`, `vitest.config.ts`,
 *     `vitest.integration.config.ts`, `vitest.setup.ts`. They are files, not a
 *     directory, so no consumer ROOT covers them. Measured once (2026-08-24):
 *     zero of the eighteen `shared/` findings had a consumer among them.
 *   - a symbol referenced inside its own declaring module by something that is
 *     ITSELF test-only. The self-reference discriminator below excludes any
 *     symbol its own module uses again, which is right for its origin case and
 *     means a whole inert vocabulary can show only its leaf. `INK_CUT_ROUTES`
 *     is the worked example: excluded because `isInkCutRoute` — a finding —
 *     names it.
 *
 * ⚠ THE SENTENCE THAT STOOD HERE ASSERTED THE BIAS INSTEAD OF STATING ITS
 * CONDITION, AND THE CONDITION HAD NEVER BEEN TRUE (opus-1157 §2b, corrected
 * 2026-08-24). It read: *"Every one of those biases toward SILENCE, so the list
 * it prints is a floor."* That holds ONLY while every root holding production
 * code is in `consumerRoots` — and `drizzle/` was in neither spelling of that
 * list. The moment `shared/` entered the scan, the promise broke in the one
 * direction a reading list must never break: `WARDROBE_LINE_MAX_LENGTH` was
 * printed as consumed by nothing but a test while living at
 * `drizzle/schema.ts:2076`. **A false finding here becomes a documented
 * inert-control claim, and this repository writes those into a file it acts
 * from.** So, conditionally and not as an article of faith: given
 * `CONSUMER_ROOTS` covers every root holding production code, each limit above
 * biases toward SILENCE and the list is a floor. The negative control below
 * is what keeps the condition true rather than merely stated.
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
import {
  buildClassifier,
  CONSUMER_ROOTS,
  REPO_ROOT,
  runMentionControls,
  withoutComments,
} from "./lib/productionMention.mts";
import {
  buildReexportMap,
  creditedDeclarations,
  reachableModules,
  resolveSpecifier,
} from "./lib/moduleResolution.mts";

const repoRoot = resolve(import.meta.dirname, "..");

/**
 * Where exports are LOOKED FOR.
 *
 * ⚠ `shared/` WAS ABSENT HERE UNTIL 2026-08-24 AND IS THE HALF OF THE REPO THIS
 * SCAN WAS MOST NEEDED IN (opus-1157 §2, ruled fable-1508 §1). `shared/` was a
 * CONSUMER root from the start and never a SCAN root, so a symbol DECLARED
 * there could not appear in any reading this instrument ever produced — and
 * `shared/` is precisely where a closed vocabulary lives when two sides that
 * cannot import each other both need it, which is this product's house style
 * for exactly the derivations most worth checking. The specimen is not
 * hypothetical: `openReferenceIntents` (`shared/referenceIntents.ts:162`) was
 * carried as a shift's hand-found lesson — *a derivation with no consumer looks
 * exactly like a derivation* — while the instrument built for that class was
 * looking at a different directory. Adding it: 479 → 513 files, 3,554 → 3,792
 * exports, 18 findings that no reading had ever carried.
 *
 * `client/` is DELIBERATELY ABSENT and that is a scope, not an oversight
 * (endorsed by name, fable-1508 §1). A test-only export in `client/` is a
 * weaker claim — there is no request path for it to be off — and the volume
 * would bury the readable list. It is worth its own reading; this is not it.
 */
const scanRoots = ["server", "shared"];
/**
 * Where importers are looked for — wider than the scan, on purpose.
 *
 * One list, owned by `productionMention.mts`, because it was spelled here AND
 * there and both spellings were missing `drizzle`. See `CONSUMER_ROOTS`.
 */
const consumerRoots = [...CONSUMER_ROOTS];

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
  Read once, keep the text. The re-export graph below needs every consumer
  file's source, and this loop already had them all open — reading the tree a
  second time would be a second answer to "which files are there".

  ⚠ AND IT IS THE CODE, NOT THE PROSE — found while fixing #274, by this file's
  own docblock breaking this file's own reading. A sentence added above
  describing the bug being fixed contained an EXAMPLE namespace import, and
  `scripts/` is a consumer root, so the sweep read its own explanation as a
  live import and excluded a real module: `pairSlots` — genuinely named by
  nobody — silently left the list.

  Measured at the tree before the repair, so this is main's defect and not
  mine: **11 named-import statements across 10 files live inside comments**
  (`logger.ts`, `outsider.mts`, `importerCountDiff.mts`, `motion.ts`,
  `sweep-shadowed-exports-disposable.mts` ×2 …), and each one credits a symbol
  with an importer that is a paragraph. That is the SILENCE direction — a
  symbol whose only consumer is a docblock reads as live and never reaches the
  reading list.

  `withoutComments` is the house answer and this file already trusted it for
  the intersection below; the import scan simply never called it. It preserves
  line count, so nothing downstream shifts.
*/
const consumerSource = new Map<string, string>();
for (const file of consumerFiles) consumerSource.set(file, withoutComments(readFileSync(file, "utf8")));

/* Which modules re-export from which — how a barrel import finds its declaration. */
const reexports = buildReexportMap(consumerSource, repoRoot);

/*
  A module that is namespace-imported anywhere is EXCLUDED whole — `ns.NAME` is
  a use this scan cannot resolve, and a finding that might be wrong is worse
  than a finding that is missing.

  ⚠ THE EXCLUSION USED TO BE KEYED ON THE MODULE'S BASENAME (#274), which is
  the same mistake as the bare-symbol `uses` map below wearing a different
  hat: `import * as x from "./facePanel"` in the client excluded
  `server/castingV2/facePanel.ts` too, and neither file had ever heard of the
  other. Resolvable specifiers are now held as PATHS.

  ⚠ AND THE BASENAME SET SURVIVES FOR THE UNRESOLVABLE ONES, on purpose. An
  exclusion that disappears produces a NEW finding, and a new finding about a
  live symbol is the one error this sweep must not make; so a specifier the
  resolver cannot place (a package, a generated alias) keeps its old,
  over-generous reading rather than silently dropping its cover.
*/
const namespaceImportedFiles = new Set<string>();
const namespaceImportedNames = new Set<string>();
/** Namespace bindings whose members CAN be read — resolved after `uses` exists. */
const namespaceMembers: Array<{ file: string; alias: string; reached: Set<string> }> = [];
for (const [file, source] of consumerSource) {
  for (const match of source.matchAll(/import\s+\*\s+as\s+[\w$]+\s+from\s+["']([^"']+)["']/g)) {
    const target = resolveSpecifier(file, match[1]!, repoRoot);
    if (!target) {
      namespaceImportedNames.add(match[1]!.replace(/^.*\//, "").replace(/\.(m?ts|tsx|js)$/, ""));
      continue;
    }
    /*
      ⚠ A WHOLESALE EXCLUSION IS THE FALLBACK NOW, NOT THE RULE — and only
      where the member cannot be read. See `namespaceMembers` below.

      It still has to follow the BARREL, because `import * as db from "../db"`
      resolves to `server/db/index.ts`, which declares almost nothing: every
      symbol a `db.` call reaches is re-exported from a sibling. Excluding the
      resolved file alone left `server/db/security.ts` uncovered, and the first
      run of this repair put `isAccountLocked` on the list — the lockout both
      login routes call, which CLAUDE.md names as production-wired.

      That symbol had been covered by ACCIDENT: the old basename key held
      "security" from an unrelated `import * as … from "./security"`, and that
      collision — the very bug being fixed here — was the only thing hiding it.
      Making the key precise removed the cover and exposed the `ns.NAME` blind
      spot underneath, which is why that blind spot is now closed rather than
      papered over.
    */
    const reached = reachableModules(target, reexports);
    /*
      A COMPUTED MEMBER IS UNREADABLE, SO THAT ALIAS KEEPS THE OLD COVER.
      `gemini[key]` can name any export in the reachable surface and no scan
      can say which, so the whole surface stays excluded for that file — the
      conservative answer, unchanged from before this repair.
    */
    const alias = match[0].match(/import\s+\*\s+as\s+([\w$]+)\s/)?.[1];
    if (!alias || new RegExp(String.raw`\b${alias}\s*\[`).test(source)) {
      for (const module of reached) namespaceImportedFiles.add(module);
      continue;
    }
    namespaceMembers.push({ file, alias, reached });
  }
}

/*
  Who names each symbol, and from where — KEYED ON (declaring file, name).

  ⚠ THE KEY WAS THE BARE NAME UNTIL #274, AND IT FAILED TOWARD SILENCE. A
  `Map<name, Use[]>` credits every importer of a name to every declaration of
  that name, so a live twin hid a dead one for as long as it had one consumer
  and the dead one never appeared on this list at all. The specimen:
  `StaffBar.tsx` imports the CLIENT `BRAND_NAME` ("Klieg") through
  `@/foundation`, and that single import was counting as a consumer of the
  legacy server `BRAND_NAME = 'DRAPE'`, which nothing has read for months.

  The key is now `declFile::name`, and which declaration an import credits is
  `creditedDeclarations` — which falls back to ALL of them whenever it cannot
  place the specifier, so an unresolved import can never manufacture a dead
  symbol. See `lib/moduleResolution.mts`.
*/
type Use = { file: string; test: boolean };
const uses = new Map<string, Use[]>();
const declaringFiles = new Map<string, string[]>();
for (const decl of declarations) {
  const list = declaringFiles.get(decl.name) ?? [];
  if (!list.includes(decl.file)) list.push(decl.file);
  declaringFiles.set(decl.name, list);
}
const useKey = (file: string, name: string) => `${resolve(file)}::${name}`;
const wanted = new Set(declarations.map((d) => d.name));

/*
  EVERY declaration of every name, including the roots this sweep does NOT scan.

  `scanRoots` is `server`/`shared`, but `consumerRoots` reaches into `client`
  and `drizzle` — so a name can be declared in a place this sweep reads for
  importers and never reads for declarations. That asymmetry is what let the
  client's `BRAND_NAME` credit the server's: with one in-scope declaration
  there was nothing to disambiguate against. Knowing the OUT-of-scope twin
  exists is what makes "this import is somebody else's" a statement the
  resolver can make. It costs one pass over sources already in memory.
*/
const allDeclaringFiles = new Map<string, string[]>();
for (const [file, source] of consumerSource) {
  if (isTestFile(file)) continue;
  for (const match of source.matchAll(exportPattern)) {
    const list = allDeclaringFiles.get(match[2]) ?? [];
    if (!list.includes(file)) list.push(file);
    allDeclaringFiles.set(match[2], list);
  }
}

/** Record one imported name against whichever declaration(s) the specifier reaches. */
const credit = (from: string, spec: string | undefined, name: string) => {
  const targets = creditedDeclarations({
    fromFile: from,
    /* No literal specifier (a computed `await import(expr)`) is unresolvable,
       which `creditedDeclarations` reads as "credit them all" — the same
       conservative answer this scan gave before it could resolve anything. */
    spec: spec ?? "",
    declaringFiles: declaringFiles.get(name) ?? [],
    allDeclaringFiles: allDeclaringFiles.get(name) ?? [],
    reexports,
    root: repoRoot,
  });
  for (const target of targets) {
    const list = uses.get(useKey(target, name)) ?? [];
    list.push({ file: from, test: isTestFile(from) });
    uses.set(useKey(target, name), list);
  }
};

for (const [file, source] of consumerSource) {
  /*
    Only IMPORT statements count — a local variable of the same name is not a use.

    BOTH forms, because the first version had only the static one and called
    three live workers dead: `server/_core/index.ts` starts the cleanup worker,
    the retention sweep and the recovery sweep through
    `import("…").then(({ startX }) => …)`, which no `from "…"` scan can see.
    A blind spot that flags a running worker as uncalled is worse than no scan.
  */
  /* The specifier is captured in BOTH arms now, because crediting the right
     declaration needs to know where the import pointed. It stays OPTIONAL in
     the second arm: `await import(someExpr)` has no literal to read, and
     requiring one would drop the match entirely — turning a conservative
     "credit everything" into a finding.

     ⚠ AND THE BRACE CLASS EXCLUDES `{`, WHICH IT DID NOT BEFORE (#274). With
     `[^}]*` the match could OPEN at an unrelated brace — an enclosing function
     body — and run to the first `}` in the file, so the captured "names" came
     back as `const { getChangeRequestById` and matched no symbol at all. Every
     `const { x } = await import(…)` inside a function body read as no import,
     which is this sweep's whole house style for lazy server imports:
     `server/routes/admin/changeRequests.ts` alone has six. Excluding `{` makes
     the engine start at the destructuring brace itself, which is the only one
     that can be followed by `= await import(`. */
  const destructuredDynamic =
    /(?:import\(\s*["']([^"']+)["']\s*\)\s*\.then\s*\(\s*(?:async\s*)?\(?\s*\{([^{}]*)\}|\{([^{}]*)\}\s*=\s*await\s+import\s*\(\s*(?:["']([^"']+)["'])?)/g;
  for (const match of source.matchAll(destructuredDynamic)) {
    const spec = match[1] ?? match[4];
    for (const raw of (match[2] ?? match[3] ?? "").split(",")) {
      const name = raw.trim().split(":")[0].trim();
      if (!name || !wanted.has(name)) continue;
      credit(file, spec, name);
    }
  }
  for (const match of source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
    for (const raw of match[1].split(",")) {
      const name = raw.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
      if (!name || !wanted.has(name)) continue;
      credit(file, match[2], name);
    }
  }
}

/*
  ⚠ `ns.NAME` IS READ NOW — the blind spot this file's header has declared
  since it was written, closed because #274's repair walked straight into it.

  The header says namespace imports are "counted as a wildcard consumer of
  every export in that module". That was the only honest thing to do while a
  specifier could not be resolved — but it is also what kept the card's own
  specimen invisible. `server/casting/geminiPrompts.ts` is reached by
  `import * as gemini from "./geminiService"` through a re-export, so the whole
  module was excluded, so the legacy `BRAND_NAME = 'DRAPE'` — declared once,
  re-exported once, read by nothing anywhere — could not appear on a list of
  things nothing reads, no matter how the `uses` map was keyed.

  The resolution is the one `lib/importerCountDiff.mts` already proves out: the
  binding must resolve to a real module, and the member must be declared in
  that module or in one it re-exports from. Exactly the same walk the named
  imports above take, so the two cannot answer differently. An alias whose
  members are reached COMPUTED (`gemini[key]`) keeps the old wholesale
  exclusion — see above — because there the wildcard reading is still the only
  true one.

  This makes the scan strictly better informed, never more aggressive: every
  `alias.NAME` it can read becomes a USE, which can only remove findings; the
  findings it gains are the ones the old wholesale exclusion was hiding.
*/
for (const { file, alias, reached } of namespaceMembers) {
  const source = consumerSource.get(file)!;
  for (const match of source.matchAll(new RegExp(String.raw`\b${alias}\.([A-Za-z_$][\w$]*)`, "g"))) {
    const name = match[1]!;
    if (!wanted.has(name)) continue;
    for (const target of declaringFiles.get(name) ?? []) {
      if (!reached.has(resolve(target))) continue;
      const list = uses.get(useKey(target, name)) ?? [];
      list.push({ file, test: isTestFile(file) });
      uses.set(useKey(target, name), list);
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
  if (namespaceImportedFiles.has(resolve(decl.file)) || namespaceImportedNames.has(moduleName)) continue;
  if ((selfReferences.get(`${decl.file}::${decl.name}`) ?? 0) > 0) continue;

  const seen = (uses.get(useKey(decl.file, decl.name)) ?? []).filter((use) => use.file !== decl.file);
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
/*
  FOURTH way of being consulted, and this one is the specimen that found its own
  gap (opus-1157 §2b, ruled fable-1508 §1): consumed from `drizzle/schema.ts`
  and nowhere else in production.

    WARDROBE_LINE_MAX_LENGTH   shared/castingPaths.ts:83
                             → drizzle/schema.ts:2076, the varchar length of
                               the column that stores a wardrobe line

  It is the arm that keeps `drizzle` in `CONSUMER_ROOTS`. Drop that root and
  this run REFUSES rather than printing a live constant as consumed by nothing
  but a test — which is what the first widened run did, one spot-check before
  it would have been published. A specimen kept as the control that keeps it
  found: nothing else in the repository has this shape, so nothing else would
  have gone red.
*/
const negativeSchemaOnly = flagged("WARDROBE_LINE_MAX_LENGTH");
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
console.log(
  `  negative  WARDROBE_LINE_MAX_LENGTH  ${negativeSchemaOnly ? "FLAGGED  FAIL" : "not flagged      PASS"}`,
);
if (
  !positive
  || !positiveIndependent
  || negativeImported
  || negativeSelfRead
  || negativeDynamic
  || negativeSchemaOnly
) {
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
const tally = { none: 0, other: 0, barrel: 0, dynamic: 0, door: 0 };
const readingList: Array<{ name: string; file: string }> = [];
for (const entry of everyFlagged) {
  const kind = classify(entry.name).kind;
  tally[kind]++;
  /*
    A DOOR IS NOT A CALLER, so it reads. The recon said exactly this by hand
    about five symbols re-exported through a module barrel nobody imports them
    from — "a re-export is a door, not a caller" — and kept every one on the
    list. The bucket stays separate in the print so the reason is visible, and
    it is counted into the list so the instrument and that ruling agree.
  */
  if (kind === "none" || kind === "door") readingList.push(entry);
}

console.log(`\nTHE READING LIST - ${readingList.length} of ${everyFlagged.length} flagged`);
console.log(`  with a production mention  ${everyFlagged.length - readingList.length}`
  + `  (barrel ${tally.barrel} - dynamic ${tally.dynamic} - other ${tally.other})`);
/*
  THE PARTS MUST SUM TO THE WHOLE, or the breakdown is decoration. Added the
  day a fifth bucket (`door`) was introduced and the printed line went on
  reading 34 - 7 - 3 beside a total of 49: a summary that does not add up is
  how a reader is told a smaller number than the instrument found.
*/
const parts = tally.none + tally.other + tally.barrel + tally.dynamic + tally.door;
if (parts !== everyFlagged.length) {
  console.log(`REFUSED — the buckets sum to ${parts} and ${everyFlagged.length} were flagged.`);
  process.exit(1);
}
console.log(`  nothing but a declaration  ${tally.none}`);
console.log(`  a re-export door only      ${tally.door}`);
console.log(`  THE LIST                   ${readingList.length}`);
console.log();
for (const entry of readingList.sort((a, b) => a.file.localeCompare(b.file))) {
  console.log(`  ${entry.name.padEnd(38)} ${show(entry.file)}`);
}

process.exit(0);
