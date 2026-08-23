/**
 * THE SECOND SPELLING OF A CLOSED LIST — working law 4's finder.
 *
 * A vocabulary declared once in `shared/` and then WRITTEN OUT AGAIN somewhere
 * else is the shape law 4 exists about, and this repository has now paid for it
 * twice in one family:
 *
 *   - `ViewTabs.tsx` hand-wrote the comp-card six under the same name as the
 *     shared constant and drew the customer's tab strip from its copy. The two
 *     had already drifted in ORDER (triage §29d, fixed `f0fe2f6e`).
 *   - **The commit that fixed that then created a THIRD copy**:
 *     `COMP_CARD_VIEW_ORDER` already held exactly the order being pinned, and
 *     each of the two constants was pinned to its own literal by its own test
 *     — so a deliberate reorder would have reddened one, been "fixed", and
 *     shipped a download numbered differently from the tabs, green all the way
 *     (triage §30, ruled fable-1511).
 *
 * That second incident is why this instrument is tracked rather than
 * disposable: **the finding window for this class is the moment of repair**,
 * and a sweep that lives on one shift's disk cannot be there for the next one.
 *
 * # What it does — TWO readings, reported separately and never pooled
 *
 * Reads every exported string-literal `as const` array in `shared/` (>= 2
 * members), then every literal array in `client/src`, `server/`, `shared/` and
 * `drizzle/`, and reports:
 *
 *   1. **HITS** — a literal whose member SET EQUALS a declared vocabulary, with
 *      whether the copying file names the constant at all and whether the two
 *      ORDERS agree. A copy that has not drifted YET.
 *   2. **NEAR MISSES** — a literal exactly ONE member away from a declared
 *      vocabulary, in either direction, with which member is EXTRA here or
 *      MISSING here. A copy that has drifted ALREADY.
 *
 * The second reading is the more consequential one and it is the reason this
 * file grew: reading (1) can only ever catch a copy before it costs anything,
 * while reading (2) is looking at a list that no longer agrees with the
 * vocabulary it was taken from. The two counts are printed apart, and a row is
 * in exactly one of them by construction — an exact match has a symmetric
 * difference of zero and can never be a near miss.
 *
 * # Its bias, stated as a condition rather than asserted
 *
 * It biases toward NOISE — the OPPOSITE of `sweep-uncalled-exports`, and
 * deliberately, because nothing here licenses a deletion and every row is read
 * by a person. A coincidental pair of short strings is a hit, and a hand read
 * throws it out. **That bias holds only while `VOCAB_ROOTS` and `SCAN_ROOTS`
 * below are the whole of the two populations**; a vocabulary declared outside
 * `VOCAB_ROOTS` cannot be copied in this reading, and a copy living outside
 * `SCAN_ROOTS` cannot be seen. `client/` is IN, unlike the uncalled-export
 * sweep, because a copy on the client is the incident this exists for.
 *
 * # The near-miss BAND is a stated scope, and the bands outside it are
 * # MEASURED and NOT READ
 *
 * `NEAR_MISS_MAX_DIFFERENCE` is 1: exactly one member apart. That is a chosen
 * band and not a natural boundary, so here is the whole distribution as it was
 * measured on the tree at `d11f7c27` (triage §31), with the production count in
 * brackets:
 *
 *   symmetric difference == 1     69 [27]   ← READ, and reported below
 *   symmetric difference <= 2    142 [67]   ← measured, NOT read
 *   jaccard >= 0.5               153 [53]   ← measured, NOT read
 *   any strict SUBSET            194 [61]   ← measured, NOT read
 *   any overlap at all           581        ← measured, NOT read
 *
 * Widening the band is a one-constant change and the cost is a table nobody
 * finishes reading. The bands are written down so that widening it is a
 * decision with a number attached rather than a discovery.
 *
 * # What it CANNOT see, named
 *
 *   - a copy assembled rather than written (`[...A, "x"]`, `Object.keys(M)`)
 *   - a copy whose members are not all string literals on one bracket pair
 *   - a list two or more members away from its vocabulary — see the band above
 *   - a drift in a vocabulary declared outside `VOCAB_ROOTS`, or a copy living
 *     outside `SCAN_ROOTS`
 *
 * A clean run is a floor, never a proof.
 *
 * # Declaring a copy deliberate
 *
 * Some copies are correct: a distinct ordering for a distinct purpose is not a
 * mirror. Put `deliberate-vocabulary-copy` in a comment within
 * `MARKER_WINDOW_LINES` above the literal (or on its own line), with the reason
 * beside it. The exemption lives AT THE SITE and never in a list here — a list
 * of exempt call sites in this file would be the very thing being swept for.
 *
 * **ONE marker serves BOTH readings, and the consequence is stated rather than
 * left to be discovered** (ruled fable-1513 §2): a marker silences its literal
 * as a HIT and as a NEAR MISS. So a site that is a deliberate NARROWING of
 * vocabulary A and an accidental exact copy of vocabulary B would go quiet
 * about both on one note. No such row exists on the tree today. **If one ever
 * does, the marker gains an optional qualifier THEN** —
 * `deliberate-vocabulary-copy: GENDER_VALUES` — scoping the silence to the
 * named vocabulary. It is not built now on purpose: a qualifier grammar nobody
 * has needed is a second vocabulary, which is the thing this file is about.
 *
 * Usage:
 *   npx tsx scripts/sweep-handwritten-vocabularies.mts
 *   npx tsx scripts/sweep-handwritten-vocabularies.mts --controls
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

/** Where a closed vocabulary is DECLARED. */
const VOCAB_ROOTS = ["shared"] as const;
/** Where a copy of one might be WRITTEN. */
const SCAN_ROOTS = ["client/src", "server", "shared", "drizzle"] as const;
/** How far above a literal a `deliberate-vocabulary-copy` note may sit. */
const MARKER_WINDOW_LINES = 8;
const MARKER = "deliberate-vocabulary-copy";
/**
 * How many members apart a literal may be from a vocabulary and still be
 * reported as a NEAR MISS. One, and the docblock's band table is why — every
 * looser band is measured there and deliberately not read.
 */
const NEAR_MISS_MAX_DIFFERENCE = 1;

// ---------------------------------------------------------------------------
// the reading, as pure functions — so the controls can drive the same code the
// real run does, on content they author
// ---------------------------------------------------------------------------

type Vocabulary = {
  name: string;
  file: string;
  line: number;
  members: readonly string[];
};

type Copy = {
  file: string;
  line: number;
  vocabulary: Vocabulary;
  found: readonly string[];
  namesIt: boolean;
  sameOrder: boolean;
};

/** A literal one member away from a vocabulary — a list that HAS drifted. */
type NearMiss = {
  file: string;
  line: number;
  vocabulary: Vocabulary;
  found: readonly string[];
  namesIt: boolean;
  /** Declared by the vocabulary and absent here. */
  missingHere: readonly string[];
  /** Written here and absent from the vocabulary. */
  extraHere: readonly string[];
};

const setKey = (members: readonly string[]): string => [...members].sort().join("|#|");

/** Members of a `["a", "b"]` literal body, or null if it is not all string literals. */
const literalMembers = (body: string): string[] | null => {
  const trimmed = body.trim();
  if (trimmed.length === 0) return null;
  const parts = trimmed.split(",").map((p) => p.trim()).filter((p) => p.length > 0);
  const out: string[] = [];
  for (const part of parts) {
    const m = /^(["'])([^"']*)\1$/.exec(part);
    if (!m) return null;
    out.push(m[2]);
  }
  return out.length > 0 ? out : null;
};

const lineOf = (source: string, index: number): number =>
  source.slice(0, index).split("\n").length;

/** Exported string-literal `as const` arrays in one file's source. */
function declaredVocabularies(source: string, file: string): Vocabulary[] {
  const out: Vocabulary[] = [];
  const re = /export\s+const\s+([A-Za-z0-9_]+)(?::[^=]+)?\s*=\s*\[([^\]]*)\]\s*as\s+const/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const members = literalMembers(m[2]);
    if (!members || members.length < 2) continue;
    out.push({ name: m[1], file, line: lineOf(source, m.index), members });
  }
  return out;
}

/**
 * Every string-literal array (>= 2 members) in a file, with the line it starts
 * on. ONE walker, because both readings and the marker window ask the same
 * question of the same source and three copies of that question is the shape
 * this whole instrument exists to find.
 */
function literalArrays(source: string): Array<{ line: number; members: string[] }> {
  const out: Array<{ line: number; members: string[] }> = [];
  const re = /\[([^\][{}()]*)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const members = literalMembers(m[1]);
    if (!members || members.length < 2) continue;
    out.push({ line: lineOf(source, m.index), members });
  }
  return out;
}

/**
 * The lines every string-literal array (>= 2 members) starts on — the things a
 * marker could possibly be talking about.
 */
function literalArrayLines(source: string): Set<number> {
  return new Set(literalArrays(source).map((l) => l.line));
}

/**
 * True when a `deliberate-vocabulary-copy` note governs the literal at `line`.
 *
 * A marker governs the NEXT literal after it and no other. The first shape of
 * this was "any marker within the window above", and its own control caught it:
 * two literals a line apart were BOTH silenced by one marker, so a note about
 * one copy would have quietly excused every copy beneath it — an exemption that
 * grows on its own is worse than no exemption at all.
 */
function isDeclaredDeliberate(source: string, line: number, literalLines: Set<number>): boolean {
  const lines = source.split("\n");
  const from = Math.max(1, line - MARKER_WINDOW_LINES);
  for (let marker = line - 1; marker >= from; marker -= 1) {
    if (literalLines.has(marker)) return false; // a nearer literal owns anything above it
    if ((lines[marker - 1] ?? "").includes(MARKER)) return true;
  }
  return false;
}

/** Every literal array in `source` whose member SET equals a declared vocabulary. */
function findCopies(
  source: string,
  file: string,
  byMemberSet: ReadonlyMap<string, readonly Vocabulary[]>,
): Copy[] {
  const out: Copy[] = [];
  const literals = literalArrays(source);
  const literalLines = new Set(literals.map((l) => l.line));
  for (const { line, members: found } of literals) {
    const matches = byMemberSet.get(setKey(found));
    if (!matches) continue;
    if (isDeclaredDeliberate(source, line, literalLines)) continue;
    for (const vocabulary of matches) {
      // a declaration is not a copy of itself
      if (vocabulary.file === file && vocabulary.line === line) continue;
      out.push({
        file,
        line,
        vocabulary,
        found,
        namesIt: new RegExp(`\\b${vocabulary.name}\\b`).test(source),
        sameOrder: found.join("|") === vocabulary.members.join("|"),
      });
    }
  }
  return out;
}

/**
 * Every literal array in `source` that is exactly `NEAR_MISS_MAX_DIFFERENCE`
 * members away from a declared vocabulary — the list that has ALREADY drifted.
 *
 * An exact match is not a near miss: its symmetric difference is zero, so the
 * two readings are disjoint by construction rather than by a filter. The same
 * `deliberate-vocabulary-copy` marker silences a site here too, with the
 * consequence stated in this file's docblock.
 */
function findNearMisses(
  source: string,
  file: string,
  vocabs: readonly Vocabulary[],
): NearMiss[] {
  const out: NearMiss[] = [];
  const literals = literalArrays(source);
  const literalLines = new Set(literals.map((l) => l.line));
  const declaredSets = vocabs.map((vocabulary) => ({
    vocabulary,
    set: new Set(vocabulary.members),
  }));
  for (const { line, members: found } of literals) {
    const here = new Set(found);
    let deliberate: boolean | null = null;
    for (const { vocabulary, set: declared } of declaredSets) {
      // a declaration is not a drift from itself
      if (vocabulary.file === file && vocabulary.line === line) continue;
      const missingHere = vocabulary.members.filter((x) => !here.has(x));
      const extraHere = found.filter((x) => !declared.has(x));
      const difference = missingHere.length + extraHere.length;
      if (difference === 0) continue; // an exact HIT, reported by the other reading
      if (difference > NEAR_MISS_MAX_DIFFERENCE) continue;
      // no "must share N members" guard: at this band it could never fire. Two
      // lists with nothing in common are at least four members apart, since a
      // literal needs two members to be collected and a vocabulary needs two to
      // be declared. A filter that has never filtered is not shipped here.
      deliberate ??= isDeclaredDeliberate(source, line, literalLines);
      if (deliberate) break;
      out.push({
        file,
        line,
        vocabulary,
        found,
        namesIt: new RegExp(`\\b${vocabulary.name}\\b`).test(source),
        missingHere,
        extraHere,
      });
    }
  }
  return out;
}

function indexByMemberSet(vocabs: readonly Vocabulary[]): Map<string, Vocabulary[]> {
  const byKey = new Map<string, Vocabulary[]>();
  for (const v of vocabs) byKey.set(setKey(v.members), [...(byKey.get(setKey(v.members)) ?? []), v]);
  return byKey;
}

// ---------------------------------------------------------------------------
// the tree
// ---------------------------------------------------------------------------

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git" || entry === "dist") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mts)$/.test(entry)) out.push(full);
  }
  return out;
};

const rel = (file: string): string => path.relative(ROOT, file).split(path.sep).join("/");
const isTest = (file: string): boolean => /\.test\.(ts|tsx|mts)$/.test(file);

type Reading = {
  vocabs: Vocabulary[];
  scanned: number;
  copies: Copy[];
  nearMisses: NearMiss[];
};

function readTree(): Reading {
  const vocabs: Vocabulary[] = [];
  for (const root of VOCAB_ROOTS) {
    for (const file of walk(path.join(ROOT, root))) {
      vocabs.push(...declaredVocabularies(readFileSync(file, "utf8"), rel(file)));
    }
  }
  if (vocabs.length === 0) {
    throw new Error(
      `REFUSED: no vocabularies found under ${VOCAB_ROOTS.join(", ")}. An empty ` +
        `population reports a clean sweep and means nothing — see working law 2.`,
    );
  }
  const byMemberSet = indexByMemberSet(vocabs);

  const files: string[] = [];
  for (const root of SCAN_ROOTS) files.push(...walk(path.join(ROOT, root)));

  const copies: Copy[] = [];
  const nearMisses: NearMiss[] = [];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    copies.push(...findCopies(source, rel(file), byMemberSet));
    nearMisses.push(...findNearMisses(source, rel(file), vocabs));
  }
  return { vocabs, scanned: files.length, copies, nearMisses };
}

// ---------------------------------------------------------------------------
// controls — working law 2: this instrument's verdicts count for nothing until
// it is shown able to FIND and able to STAY QUIET, and both are driven
// ---------------------------------------------------------------------------

/**
 * The POSITIVE control is synthetic on purpose. The real specimen that bought
 * this instrument — `COMP_CARD_VIEW_ORDER` against `PACKAGE_SLOTS` — is
 * REPAIRED by the same commit that promotes it, so a control anchored on it
 * would have been born already unable to fire. A planted fixture cannot be
 * fixed out from under the control.
 *
 * The NEGATIVE controls are REAL, one per reading, because a marker that worked
 * for HITS and not for NEAR MISSES would pass every synthetic arm above:
 *
 *   - `server/db/inkAddCandidates.ts`'s `fallbackOrder` — a deliberate third
 *     ordering of the canonical six, marked, must not be reported as a HIT
 *   - `shared/inkReleasedPlacements.ts`'s `sidesForInkPlacement` — the perSide
 *     HALF of `INK_SIDES`, marked, must not be reported as a NEAR MISS
 *
 * Delete either marker line and its arm reddens; each has a second arm proving
 * the site is quiet because it is MARKED rather than because it is absent.
 *
 * ⚠ **A NEGATIVE arm passes for free when the finder is blind, and that is not
 * a flaw in these arms — it is the shape of every absence-only assertion.**
 * Driven rather than reasoned about: setting `NEAR_MISS_MAX_DIFFERENCE` to 0
 * reddens the two POSITIVE near-miss arms and the marker arm, and both near-miss
 * NEGATIVE arms go green on a reading that found nothing at all. It is
 * survivable only because the run REFUSES on ANY failed arm, so a vacuous pass
 * can never stand on its own. Never read a NEGATIVE arm's PASS without the
 * POSITIVE arms beside it.
 */
function runControls(): boolean {
  const results: Array<[boolean, string]> = [];

  const FIXTURE_VOCAB = `
export const FIXTURE_SLOTS = ["alpha", "beta", "gamma"] as const;
`;
  const vocabs = declaredVocabularies(FIXTURE_VOCAB, "shared/_fixture.ts");
  results.push([
    vocabs.length === 1 && vocabs[0].name === "FIXTURE_SLOTS" && vocabs[0].members.length === 3,
    "a shared `as const` string vocabulary is collected",
  ]);
  const index = indexByMemberSet(vocabs);

  const PLANTED = `
const copied = ["alpha", "beta", "gamma"];
`;
  const found = findCopies(PLANTED, "client/src/_fixture.tsx", index);
  results.push([
    found.length === 1 && !found[0].namesIt && found[0].sameOrder,
    "POSITIVE — a planted copy of a vocabulary is FOUND",
  ]);

  const REORDERED = `
const copied = ["gamma", "alpha", "beta"];
`;
  const reordered = findCopies(REORDERED, "client/src/_fixture.tsx", index);
  results.push([
    reordered.length === 1 && !reordered[0].sameOrder,
    "POSITIVE — a copy whose ORDER differs is found AND reported as differing",
  ]);

  const MARKED = `
// ${MARKER}: the fixture's own reason
const copied = ["alpha", "beta", "gamma"];
const alsoCopied = ["alpha", "beta", "gamma"];
`;
  const marked = findCopies(MARKED, "client/src/_fixture.tsx", index);
  results.push([
    marked.length === 1,
    "the marker silences the literal it governs and NOT the next one down",
  ]);

  const SUBSET = `
const copied = ["alpha", "beta"];
`;
  results.push([
    findCopies(SUBSET, "client/src/_fixture.tsx", index).length === 0,
    "a SUBSET is not a HIT — set equality is what reading (1) matches on",
  ]);

  // --- reading (2), the near misses ------------------------------------------
  // Synthetic for the same reason reading (1)'s positive is: the specimens that
  // bought this reading are dispositioned in triage §31 and some will be
  // repaired, and a control anchored on a row that can be fixed is a control
  // that quietly stops firing.

  const shortByOne = findNearMisses(SUBSET, "client/src/_fixture.tsx", vocabs);
  results.push([
    shortByOne.length === 1 &&
      shortByOne[0].missingHere.join() === "gamma" &&
      shortByOne[0].extraHere.length === 0,
    "POSITIVE — a literal ONE MEMBER SHORT is found, and named as MISSING here",
  ]);

  const LONG_BY_ONE = `
const copied = ["alpha", "beta", "gamma", "delta"];
`;
  const longByOne = findNearMisses(LONG_BY_ONE, "client/src/_fixture.tsx", vocabs);
  results.push([
    longByOne.length === 1 &&
      longByOne[0].extraHere.join() === "delta" &&
      longByOne[0].missingHere.length === 0,
    "POSITIVE — a literal ONE MEMBER LONG is found, and named as EXTRA here",
  ]);

  results.push([
    findNearMisses(PLANTED, "client/src/_fixture.tsx", vocabs).length === 0,
    "an EXACT copy is NOT a near miss — the two readings are disjoint, not filtered",
  ]);

  const TWO_APART = `
const copied = ["alpha", "delta", "epsilon"];
`;
  results.push([
    findNearMisses(TWO_APART, "client/src/_fixture.tsx", vocabs).length === 0,
    `TWO members apart is NOT reported — the band is ${NEAR_MISS_MAX_DIFFERENCE}, ` +
      `and the unread bands are in the docblock`,
  ]);

  const MARKED_NEAR_MISS = `
// ${MARKER}: the fixture's own reason
const copied = ["alpha", "beta"];
const alsoCopied = ["alpha", "beta"];
`;
  const markedNearMiss = findNearMisses(MARKED_NEAR_MISS, "client/src/_fixture.tsx", vocabs);
  results.push([
    markedNearMiss.length === 1,
    "ONE marker serves BOTH readings — it silences the near miss it governs, and " +
      "NOT the next one down",
  ]);

  // NEGATIVE, against the real tree — one per reading, because a marker that
  // worked for hits and not for near misses would pass every arm above
  const reading = readTree();
  const NEGATIVE_FILE = "server/db/inkAddCandidates.ts";
  const negative = reading.copies.filter((c) => c.file === NEGATIVE_FILE);
  results.push([
    negative.length === 0,
    `NEGATIVE — ${NEGATIVE_FILE}'s deliberate fallback ordering is NOT reported`,
  ]);
  results.push([
    readFileSync(path.join(ROOT, NEGATIVE_FILE), "utf8").includes(MARKER),
    `NEGATIVE — and it is quiet because it is MARKED, not because it is absent`,
  ]);

  const NEAR_MISS_NEGATIVE_FILE = "shared/inkReleasedPlacements.ts";
  results.push([
    reading.nearMisses.filter((n) => n.file === NEAR_MISS_NEGATIVE_FILE).length === 0,
    `NEGATIVE — ${NEAR_MISS_NEGATIVE_FILE}'s marked perSide narrowing of INK_SIDES ` +
      `is NOT reported as a near miss`,
  ]);
  results.push([
    readFileSync(path.join(ROOT, NEAR_MISS_NEGATIVE_FILE), "utf8").includes(MARKER),
    `NEGATIVE — and IT is quiet because it is MARKED, not because it is absent`,
  ]);

  let ok = true;
  for (const [passed, label] of results) {
    console.log(`  ${passed ? "PASS" : "FAIL"}  ${label}`);
    if (!passed) ok = false;
  }
  return ok;
}

// ---------------------------------------------------------------------------

if (process.argv.includes("--controls")) {
  console.log("CONTROLS");
  const ok = runControls();
  console.log(ok ? "\nCONTROLS HELD" : "\nREFUSED — a control failed");
  process.exit(ok ? 0 : 1);
}

const { vocabs, scanned, copies, nearMisses } = readTree();

console.log(
  `DECLARED  ${vocabs.length} string-literal \`as const\` vocabularies under ` +
    `${VOCAB_ROOTS.join(", ")} (>= 2 members)`,
);
console.log(`SCANNED   ${scanned} files under ${SCAN_ROOTS.join(", ")}`);
console.log(`HITS      ${copies.length} literal arrays whose member SET equals a declared vocabulary`);
console.log(
  `          ${copies.filter((c) => !isTest(c.file)).length} in production files, ` +
    `${copies.filter((c) => !isTest(c.file) && !c.namesIt).length} of those never naming the constant`,
);
console.log(
  `NEAR      ${nearMisses.length} literal arrays exactly ` +
    `${NEAR_MISS_MAX_DIFFERENCE} member from a declared vocabulary`,
);
console.log(
  `          ${nearMisses.filter((n) => !isTest(n.file)).length} in production files, ` +
    `${nearMisses.filter((n) => !isTest(n.file) && !n.namesIt).length} of those never naming the constant\n`,
);

console.log("─".repeat(78));
console.log("(1) HITS — a copy that has NOT drifted yet\n");

const rank = (c: Copy): number =>
  (isTest(c.file) ? 4 : 0) + (c.namesIt ? 2 : 0) + (c.sameOrder ? 1 : 0);

for (const c of [...copies].sort(
  (a, b) => rank(a) - rank(b) || a.file.localeCompare(b.file) || a.line - b.line,
)) {
  const flags = [
    isTest(c.file) ? "test" : "PRODUCTION",
    c.namesIt ? "names-the-constant" : "NEVER-NAMES-IT",
    c.sameOrder ? "same order" : "ORDER DIFFERS",
  ].join(" · ");
  console.log(`${c.file}:${c.line}`);
  console.log(`    copies ${c.vocabulary.name} (${c.vocabulary.file}:${c.vocabulary.line})  [${flags}]`);
  if (!c.sameOrder) {
    console.log(`      declared: ${c.vocabulary.members.join(" · ")}`);
    console.log(`      here    : ${c.found.join(" · ")}`);
  }
}

console.log(`\n${"─".repeat(78)}`);
console.log("(2) NEAR MISSES — a copy that HAS drifted, one member apart\n");

const nearRank = (n: NearMiss): number => (isTest(n.file) ? 2 : 0) + (n.namesIt ? 1 : 0);

for (const n of [...nearMisses].sort(
  (a, b) => nearRank(a) - nearRank(b) || a.file.localeCompare(b.file) || a.line - b.line,
)) {
  const flags = [
    isTest(n.file) ? "test" : "PRODUCTION",
    n.namesIt ? "names-the-constant" : "NEVER-NAMES-IT",
  ].join(" · ");
  console.log(`${n.file}:${n.line}`);
  console.log(`    drifts from ${n.vocabulary.name} (${n.vocabulary.file}:${n.vocabulary.line})  [${flags}]`);
  console.log(`      declared: ${n.vocabulary.members.join(" · ")}`);
  console.log(`      here    : ${n.found.join(" · ")}`);
  if (n.missingHere.length > 0) console.log(`      MISSING here: ${n.missingHere.join(" · ")}`);
  if (n.extraHere.length > 0) console.log(`      EXTRA here  : ${n.extraHere.join(" · ")}`);
}

console.log(
  `\nA clean run is a FLOOR, in both readings. Reading (1) matches on set ` +
    `equality and reading (2)\non a difference of exactly ` +
    `${NEAR_MISS_MAX_DIFFERENCE} member — a list two or more members from its ` +
    `vocabulary is\nMEASURED and NOT READ here. See the docblock's band table ` +
    `and named limits before\nbelieving a silence.`,
);

process.exit(0);
