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
 * # What it does — THREE readings, reported separately and never pooled
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
 *   3. **DECLARATION PAIRS** — two exported `as const` vocabularies, in two
 *      different modules, whose member sets are EQUAL or one member apart.
 *      Not a literal against a declaration: two SPELLINGS of one closed list.
 *
 * The second reading is the more consequential one of the first two and it is
 * why this file grew once: reading (1) can only ever catch a copy before it
 * costs anything, while reading (2) is looking at a list that no longer agrees
 * with the vocabulary it was taken from. The counts are printed apart, and a
 * row is in exactly one reading by construction — an exact match has a
 * symmetric difference of zero and can never be a near miss, and a pair of
 * DECLARATIONS is not a literal.
 *
 * # Why reading (3) exists, and why it is not just a wider (1)
 *
 * Readings (1) and (2) declare their vocabularies from `VOCAB_ROOTS` — which is
 * `shared/` — so a vocabulary spelled twice OUTSIDE `shared/` was invisible to
 * every reading this repository had. Measured on the tree at `d8ace581`
 * (triage §32): **ten production declaration pairs with equal member sets, and
 * SEVEN of them had neither side in `shared/`.** Four of the seven are one file
 * pair — `evidenceCandidateContract.ts` against `drizzle/schema.ts`, three of
 * them under the SAME NAME — in a file that IMPORTS six shared vocabularies by
 * name six lines above. That is the `ViewTabs` shape, which this program has
 * already paid for twice.
 *
 * A declaration pair is a stronger row than a literal match and the population
 * is smaller: 17 production rows against the 194 that widening `VOCAB_ROOTS`
 * for readings (1) and (2) would print (see the band table below).
 *
 * # The LOCAL-DECLARATION POINTER — a row is a candidate, never a verdict
 *
 * A near miss can be attributed to the WRONG vocabulary whenever a same-worded
 * one is declared outside `VOCAB_ROOTS`, and the row then points at a fold that
 * would be actively wrong to make (triage §31c: ten literals reported as one
 * short of `shared/`'s `INK_SIDES` that are really narrowings of
 * `INK_ANATOMY_SIDES`, declared in their own file and checked there by the
 * compiler).
 *
 * So a row in reading (1) or (2) prints, beside its attribution, any vocabulary
 * declared in the literal's OWN FILE that is AT LEAST AS CLOSE to it. It does
 * not SUPPRESS the row, and the refusal to suppress is measured rather than
 * cautious: a suppression rule fires on 15 of the 27 production near-miss rows,
 * and three of those fifteen are rows worth keeping — `MINT_TIER_SLOTS`, whose
 * narrowing is what a tier IS; `modelAvailability.ts:11`, where the literal IS
 * the local declaration; and **this instrument's own real-tree NEGATIVE
 * CONTROL**, which suppression would have made pass for a second reason and so
 * stop testing the marker.
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
 * The same band governs reading (3), and it is the same 1 for a REASON rather
 * than for symmetry (ruled fable-1515 §1): a literal is often a legitimate
 * NARROWING of a vocabulary, while two DECLARED closed lists two members apart
 * are usually just two different lists. Measured on the same tree: 10 production
 * declaration pairs at difference 0, 7 more at difference 1 — READ — and every
 * looser band is deliberately not read here either.
 *
 * # WIDENING `VOCAB_ROOTS` IS THE OBVIOUS REPAIR AND IT IS THE WRONG ONE
 *
 * Declaring vocabularies from every scan root — rather than adding reading (3)
 * — was measured before it was refused, raw populations both sides, read the
 * same way (triage §32):
 *
 *                        shared/ only    all production
 *     HITS  (production)         18                96
 *     NEAR  (production)         27                98
 *
 * That is a floor turned into an inventor: nearly every extra row is a literal
 * matched against some module's private list, which is a narrowing the compiler
 * is already checking. Reading (3) buys the finding that widening was wanted for
 * — a vocabulary spelled twice outside `shared/` — for 17 rows instead of 194.
 *
 * # What it CANNOT see, named
 *
 *   - a copy assembled rather than written (`[...A, "x"]`, `Object.keys(M)`)
 *   - a copy whose members are not all string literals on one bracket pair
 *   - a list two or more members away from its vocabulary — see the band above
 *   - a copy living outside `SCAN_ROOTS`
 *   - in readings (1) and (2) ONLY, a drift in a vocabulary declared outside
 *     `VOCAB_ROOTS`. Reading (3) covers the declaration-to-declaration case of
 *     this, and the pointer above covers the mis-attribution it causes; a
 *     LITERAL copying a vocabulary declared outside `shared/` is still unread.
 *   - a vocabulary that is not `export`ed, in any reading
 *   - in reading (3) ONLY, a declaration in a `*.test.ts` file: the pair
 *     population is production declarations, so a fixture vocabulary equal to a
 *     real one is not a pair. Readings (1) and (2) still SEE test files and
 *     label their rows `test`.
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
 * **ONE marker serves ALL THREE readings, and the consequence is stated rather
 * than left to be discovered** (ruled fable-1513 §2, extended fable-1515 §2): a
 * marker silences its literal as a HIT and as a NEAR MISS, and a marker at a
 * DECLARATION silences every pair that declaration is in. So a site that is a
 * deliberate NARROWING of vocabulary A and an accidental exact copy of
 * vocabulary B would go quiet about both on one note. No such row exists on the
 * tree today. **If one ever does, the marker gains an optional qualifier THEN**
 * —
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

/**
 * A vocabulary as DECLARED, carrying whether its own site is marked deliberate.
 * Readings (1) and (2) ask the marker question at the COPY site; reading (3)
 * has no copy site to ask at, so a declaration carries the answer.
 */
type Declaration = Vocabulary & { deliberate: boolean };

/**
 * A vocabulary declared in the same FILE as a row's literal and at least as
 * close to it as the vocabulary the row is attributed to — the thing the reader
 * needs in order to judge whether the attribution is the honest one.
 */
type LocalPointer = { name: string; line: number; difference: number };

type Copy = {
  file: string;
  line: number;
  vocabulary: Vocabulary;
  found: readonly string[];
  namesIt: boolean;
  sameOrder: boolean;
  localPointers: readonly LocalPointer[];
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
  localPointers: readonly LocalPointer[];
};

/** Two DECLARED vocabularies that are two spellings of one closed list. */
type DeclarationPair = {
  a: Declaration;
  b: Declaration;
  /** Declared by `a` and absent from `b`. */
  missingInB: readonly string[];
  /** Declared by `b` and absent from `a`. */
  extraInB: readonly string[];
  sameOrder: boolean;
};

const setKey = (members: readonly string[]): string => [...members].sort().join("|#|");

/** How many members two lists disagree on, counted in both directions. */
const difference = (left: readonly string[], right: readonly string[]): number => {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return (
    left.filter((x) => !rightSet.has(x)).length + right.filter((x) => !leftSet.has(x)).length
  );
};

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

/**
 * Every exported vocabulary declared in one file's source, each carrying
 * whether a `deliberate-vocabulary-copy` note governs its own site.
 */
function declarations(source: string, file: string): Declaration[] {
  const literalLines = literalArrayLines(source);
  return declaredVocabularies(source, file).map((v) => ({
    ...v,
    deliberate: isDeclaredDeliberate(source, v.line, literalLines),
  }));
}

/**
 * Vocabularies declared in the literal's OWN FILE that are at least as close to
 * it as the vocabulary the row is attributed to.
 *
 * "At least as close", not "strictly closer", and that is the whole point:
 * §31c's ten rows are EXACTLY as close to their file's own `INK_ANATOMY_SIDES`
 * as they are to `shared/`'s `INK_SIDES`, so a strictly-closer test prints
 * nothing on the specimen this exists for.
 *
 * The attributed vocabulary itself is never a pointer, and neither is a
 * declaration sitting on the literal's own line — there the literal IS the
 * declaration, and pointing a row at itself is noise.
 */
function localDeclarationPointers(
  localDeclarations: readonly Declaration[],
  attributed: Vocabulary,
  found: readonly string[],
  line: number,
): LocalPointer[] {
  const attributedDifference = difference(found, attributed.members);
  const out: LocalPointer[] = [];
  for (const local of localDeclarations) {
    if (local.line === line) continue;
    if (local.file === attributed.file && local.line === attributed.line) continue;
    const d = difference(found, local.members);
    if (d > attributedDifference) continue;
    out.push({ name: local.name, line: local.line, difference: d });
  }
  return out;
}

/** Every literal array in `source` whose member SET equals a declared vocabulary. */
function findCopies(
  source: string,
  file: string,
  byMemberSet: ReadonlyMap<string, readonly Vocabulary[]>,
  localDeclarations: readonly Declaration[],
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
        localPointers: localDeclarationPointers(localDeclarations, vocabulary, found, line),
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
  localDeclarations: readonly Declaration[],
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
      const apart = missingHere.length + extraHere.length;
      if (apart === 0) continue; // an exact HIT, reported by the other reading
      if (apart > NEAR_MISS_MAX_DIFFERENCE) continue;
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
        localPointers: localDeclarationPointers(localDeclarations, vocabulary, found, line),
      });
    }
  }
  return out;
}

/**
 * Reading (3) — every pair of DECLARED vocabularies within the band.
 *
 * Ordered and de-duplicated by construction: each unordered pair is considered
 * once, so a pair is never printed twice with its sides swapped. A declaration
 * is never paired with itself, and a `deliberate-vocabulary-copy` note on
 * EITHER side silences the pair — the marker's claim is about the copy, and in
 * a pair either side may be the one carrying the note.
 */
function findDeclarationPairs(decls: readonly Declaration[]): DeclarationPair[] {
  const out: DeclarationPair[] = [];
  for (let i = 0; i < decls.length; i += 1) {
    for (let j = i + 1; j < decls.length; j += 1) {
      const a = decls[i];
      const b = decls[j];
      if (a.file === b.file && a.line === b.line) continue;
      if (difference(a.members, b.members) > NEAR_MISS_MAX_DIFFERENCE) continue;
      if (a.deliberate || b.deliberate) continue;
      const aSet = new Set(a.members);
      const bSet = new Set(b.members);
      out.push({
        a,
        b,
        missingInB: a.members.filter((x) => !bSet.has(x)),
        extraInB: b.members.filter((x) => !aSet.has(x)),
        sameOrder: a.members.join("|") === b.members.join("|"),
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
  declaredEverywhere: Declaration[];
  scanned: number;
  copies: Copy[];
  nearMisses: NearMiss[];
  pairs: DeclarationPair[];
};

/**
 * `VOCAB_ROOTS` is a SUBSET of `SCAN_ROOTS`, so the declarations readings (1)
 * and (2) match against are a FILTER of the ones reading (3) pairs — one walk,
 * one collector, one population. Two walks with two collectors is the shape
 * this whole instrument exists to find.
 */
const inVocabRoots = (file: string): boolean =>
  VOCAB_ROOTS.some((root) => file.startsWith(`${root}/`));

function readTree(): Reading {
  const files: string[] = [];
  for (const root of SCAN_ROOTS) files.push(...walk(path.join(ROOT, root)));

  const sources = new Map<string, string>();
  const declaredEverywhere: Declaration[] = [];
  const byFile = new Map<string, Declaration[]>();
  for (const file of files) {
    const name = rel(file);
    const source = readFileSync(file, "utf8");
    sources.set(name, source);
    const here = declarations(source, name);
    byFile.set(name, here);
    declaredEverywhere.push(...here);
  }

  const vocabs = declaredEverywhere.filter((v) => inVocabRoots(v.file));
  if (vocabs.length === 0) {
    throw new Error(
      `REFUSED: no vocabularies found under ${VOCAB_ROOTS.join(", ")}. An empty ` +
        `population reports a clean sweep and means nothing — see working law 2.`,
    );
  }
  if (declaredEverywhere.length === 0) {
    throw new Error(
      `REFUSED: no vocabularies found under ${SCAN_ROOTS.join(", ")}. Reading (3) ` +
        `would report a clean sweep off an empty population — see working law 2.`,
    );
  }
  const byMemberSet = indexByMemberSet(vocabs);

  const copies: Copy[] = [];
  const nearMisses: NearMiss[] = [];
  for (const [name, source] of sources) {
    const localDeclarations = byFile.get(name) ?? [];
    copies.push(...findCopies(source, name, byMemberSet, localDeclarations));
    nearMisses.push(...findNearMisses(source, name, vocabs, localDeclarations));
  }
  return {
    vocabs,
    declaredEverywhere,
    scanned: files.length,
    copies,
    nearMisses,
    pairs: findDeclarationPairs(declaredEverywhere.filter((d) => !isTest(d.file))),
  };
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
  const found = findCopies(PLANTED, "client/src/_fixture.tsx", index, []);
  results.push([
    found.length === 1 && !found[0].namesIt && found[0].sameOrder,
    "POSITIVE — a planted copy of a vocabulary is FOUND",
  ]);

  const REORDERED = `
const copied = ["gamma", "alpha", "beta"];
`;
  const reordered = findCopies(REORDERED, "client/src/_fixture.tsx", index, []);
  results.push([
    reordered.length === 1 && !reordered[0].sameOrder,
    "POSITIVE — a copy whose ORDER differs is found AND reported as differing",
  ]);

  const MARKED = `
// ${MARKER}: the fixture's own reason
const copied = ["alpha", "beta", "gamma"];
const alsoCopied = ["alpha", "beta", "gamma"];
`;
  const marked = findCopies(MARKED, "client/src/_fixture.tsx", index, []);
  results.push([
    marked.length === 1,
    "the marker silences the literal it governs and NOT the next one down",
  ]);

  const SUBSET = `
const copied = ["alpha", "beta"];
`;
  results.push([
    findCopies(SUBSET, "client/src/_fixture.tsx", index, []).length === 0,
    "a SUBSET is not a HIT — set equality is what reading (1) matches on",
  ]);

  // --- reading (2), the near misses ------------------------------------------
  // Synthetic for the same reason reading (1)'s positive is: the specimens that
  // bought this reading are dispositioned in triage §31 and some will be
  // repaired, and a control anchored on a row that can be fixed is a control
  // that quietly stops firing.

  const shortByOne = findNearMisses(SUBSET, "client/src/_fixture.tsx", vocabs, []);
  results.push([
    shortByOne.length === 1 &&
      shortByOne[0].missingHere.join() === "gamma" &&
      shortByOne[0].extraHere.length === 0,
    "POSITIVE — a literal ONE MEMBER SHORT is found, and named as MISSING here",
  ]);

  const LONG_BY_ONE = `
const copied = ["alpha", "beta", "gamma", "delta"];
`;
  const longByOne = findNearMisses(LONG_BY_ONE, "client/src/_fixture.tsx", vocabs, []);
  results.push([
    longByOne.length === 1 &&
      longByOne[0].extraHere.join() === "delta" &&
      longByOne[0].missingHere.length === 0,
    "POSITIVE — a literal ONE MEMBER LONG is found, and named as EXTRA here",
  ]);

  results.push([
    findNearMisses(PLANTED, "client/src/_fixture.tsx", vocabs, []).length === 0,
    "an EXACT copy is NOT a near miss — the two readings are disjoint, not filtered",
  ]);

  const TWO_APART = `
const copied = ["alpha", "delta", "epsilon"];
`;
  results.push([
    findNearMisses(TWO_APART, "client/src/_fixture.tsx", vocabs, []).length === 0,
    `TWO members apart is NOT reported — the band is ${NEAR_MISS_MAX_DIFFERENCE}, ` +
      `and the unread bands are in the docblock`,
  ]);

  const MARKED_NEAR_MISS = `
// ${MARKER}: the fixture's own reason
const copied = ["alpha", "beta"];
const alsoCopied = ["alpha", "beta"];
`;
  const markedNearMiss = findNearMisses(MARKED_NEAR_MISS, "client/src/_fixture.tsx", vocabs, []);
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

  // --- reading (3), the declaration pairs ------------------------------------

  const PAIR_FIXTURE = `
export const FIRST_SPELLING = ["alpha", "beta", "gamma"] as const;
export const SECOND_SPELLING = ["gamma", "alpha", "beta"] as const;
`;
  const pairDecls = declarations(PAIR_FIXTURE, "server/_fixture.ts");
  const pairs = findDeclarationPairs(pairDecls);
  results.push([
    pairs.length === 1 &&
      pairs[0].a.name === "FIRST_SPELLING" &&
      pairs[0].b.name === "SECOND_SPELLING" &&
      !pairs[0].sameOrder &&
      pairs[0].missingInB.length === 0 &&
      pairs[0].extraInB.length === 0,
    "POSITIVE — two DECLARATIONS with equal member sets are reported as a PAIR, " +
      "with the ORDER verdict asserted",
  ]);

  const PAIR_NEAR_FIXTURE = `
export const LONGER_SPELLING = ["alpha", "beta", "gamma"] as const;
export const SHORTER_SPELLING = ["alpha", "beta"] as const;
`;
  const nearPairs = findDeclarationPairs(declarations(PAIR_NEAR_FIXTURE, "server/_fixture.ts"));
  results.push([
    nearPairs.length === 1 &&
      nearPairs[0].missingInB.join() === "gamma" &&
      nearPairs[0].extraInB.length === 0,
    "POSITIVE — two DECLARATIONS one member apart are reported, and the missing " +
      "member is named on the right side",
  ]);

  results.push([
    findDeclarationPairs([pairDecls[0]]).length === 0 &&
      findDeclarationPairs([pairDecls[0], pairDecls[0]]).length === 0,
    "a declaration is never paired with ITSELF — one declaration, and the same " +
      "declaration twice, both report nothing",
  ]);

  const PAIR_TWO_APART = `
export const ONE_LIST = ["alpha", "beta", "gamma"] as const;
export const OTHER_LIST = ["alpha", "delta", "epsilon"] as const;
`;
  results.push([
    findDeclarationPairs(declarations(PAIR_TWO_APART, "server/_fixture.ts")).length === 0,
    `TWO members apart is NOT a declaration pair — the band is ` +
      `${NEAR_MISS_MAX_DIFFERENCE} in reading (3) too`,
  ]);

  const PAIR_MARKED = `
// ${MARKER}: the fixture's own reason
export const MARKED_SPELLING = ["alpha", "beta", "gamma"] as const;
export const PLAIN_SPELLING = ["alpha", "beta", "gamma"] as const;
export const THIRD_SPELLING = ["alpha", "beta", "gamma"] as const;
`;
  const markedPairs = findDeclarationPairs(declarations(PAIR_MARKED, "server/_fixture.ts"));
  results.push([
    markedPairs.length === 1 &&
      markedPairs[0].a.name === "PLAIN_SPELLING" &&
      markedPairs[0].b.name === "THIRD_SPELLING",
    "a marker at a DECLARATION silences every pair that declaration is in, and " +
      "NOT the pair between the two below it",
  ]);

  // NEGATIVE, against the real tree, for reading (3) — and the marker is TRUE of
  // the site rather than convenient: `partial` is what a BATCH is when some of
  // its items succeeded and others failed, and it is meaningless for ONE item.
  const PAIR_NEGATIVE_FILE = "drizzle/schema.ts";
  results.push([
    reading.pairs.filter(
      (p) =>
        [p.a.name, p.b.name].includes("STORAGE_CLEANUP_BATCH_STATUSES") &&
        [p.a.name, p.b.name].includes("STORAGE_CLEANUP_ITEM_STATUSES"),
    ).length === 0,
    `NEGATIVE — ${PAIR_NEGATIVE_FILE}'s marked batch/item status pair is NOT ` +
      `reported as a declaration pair`,
  ]);
  results.push([
    declarations(readFileSync(path.join(ROOT, PAIR_NEGATIVE_FILE), "utf8"), PAIR_NEGATIVE_FILE).some(
      (d) => d.name === "STORAGE_CLEANUP_ITEM_STATUSES" && d.deliberate,
    ),
    `NEGATIVE — and IT is quiet because that declaration is MARKED, not because ` +
      `the pair is absent`,
  ]);

  // --- the local-declaration pointer ----------------------------------------

  const POINTER_POSITIVE = `
export const LOCAL_SPELLING = ["alpha", "beta", "gamma"] as const;
const narrowed = ["alpha", "beta"];
`;
  const pointed = findNearMisses(
    POINTER_POSITIVE,
    "server/_fixture.ts",
    vocabs,
    declarations(POINTER_POSITIVE, "server/_fixture.ts"),
  );
  results.push([
    pointed.length === 1 &&
      pointed[0].localPointers.length === 1 &&
      pointed[0].localPointers[0].name === "LOCAL_SPELLING" &&
      pointed[0].localPointers[0].difference === 1,
    "POINTER — a near miss whose OWN FILE declares an equally close vocabulary " +
      "names it (§31c's ten rows), and the row is still REPORTED",
  ]);

  const POINTER_NEGATIVE = `
export const UNRELATED_SPELLING = ["delta", "epsilon", "zeta"] as const;
const narrowed = ["alpha", "beta"];
`;
  const unpointed = findNearMisses(
    POINTER_NEGATIVE,
    "server/_fixture.ts",
    vocabs,
    declarations(POINTER_NEGATIVE, "server/_fixture.ts"),
  );
  results.push([
    unpointed.length === 1 && unpointed[0].localPointers.length === 0,
    "POINTER — a local declaration FARTHER from the literal than the attributed " +
      "vocabulary is not a pointer",
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

const { vocabs, declaredEverywhere, scanned, copies, nearMisses, pairs } = readTree();

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
    `${nearMisses.filter((n) => !isTest(n.file) && !n.namesIt).length} of those never naming the constant`,
);
const equalPairs = pairs.filter((p) => p.missingInB.length + p.extraInB.length === 0);
console.log(
  `PAIRS     ${pairs.length} pairs of DECLARED vocabularies within ` +
    `${NEAR_MISS_MAX_DIFFERENCE} member of each other`,
);
console.log(
  `          drawn from ${declaredEverywhere.filter((d) => !isTest(d.file)).length} production ` +
    `declarations under ${SCAN_ROOTS.join(", ")}`,
);
console.log(
  `          ${equalPairs.length} with EQUAL member sets, ` +
    `${pairs.length - equalPairs.length} one member apart, ` +
    `${pairs.filter((p) => !inVocabRoots(p.a.file) && !inVocabRoots(p.b.file)).length} with ` +
    `NEITHER side in ${VOCAB_ROOTS.join(", ")} — invisible to readings (1) and (2)\n`,
);

/**
 * The one thing a reader needs in order not to fold a row at the wrong
 * vocabulary. Printed under the row rather than instead of it: the sweep names
 * a candidate and a person decides.
 */
const printLocalPointers = (pointers: readonly LocalPointer[]): void => {
  for (const p of pointers) {
    console.log(
      `      ⚠ this FILE also declares ${p.name} at :${p.line}, ` +
        `${p.difference === 0 ? "an exact match" : `${p.difference} member away`} — ` +
        `check which vocabulary this literal is really typed against`,
    );
  }
};

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
  printLocalPointers(c.localPointers);
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
  printLocalPointers(n.localPointers);
}

console.log(`\n${"─".repeat(78)}`);
console.log("(3) DECLARATION PAIRS — one closed list spelled twice\n");

const pairRank = (p: DeclarationPair): number =>
  (inVocabRoots(p.a.file) || inVocabRoots(p.b.file) ? 2 : 0) +
  (p.missingInB.length + p.extraInB.length === 0 ? 0 : 1);

for (const p of [...pairs].sort(
  (x, y) => pairRank(x) - pairRank(y) || x.a.file.localeCompare(y.a.file) || x.a.line - y.a.line,
)) {
  const apart = p.missingInB.length + p.extraInB.length;
  const flags = [
    apart === 0 ? "EQUAL member sets" : `${apart} member apart`,
    apart === 0 ? (p.sameOrder ? "same order" : "ORDER DIFFERS") : null,
    inVocabRoots(p.a.file) || inVocabRoots(p.b.file)
      ? `one side is in ${VOCAB_ROOTS.join(", ")}`
      : `NEITHER side is in ${VOCAB_ROOTS.join(", ")} — invisible to readings (1) and (2)`,
  ]
    .filter((f): f is string => f !== null)
    .join(" · ");
  console.log(`${p.a.name} (${p.a.file}:${p.a.line})`);
  console.log(`${p.b.name} (${p.b.file}:${p.b.line})  [${flags}]`);
  if (p.a.name === p.b.name) console.log(`      ⚠ SAME NAME in two modules`);
  console.log(`      a: ${p.a.members.join(" · ")}`);
  console.log(`      b: ${p.b.members.join(" · ")}`);
  if (p.missingInB.length > 0) console.log(`      MISSING from b: ${p.missingInB.join(" · ")}`);
  if (p.extraInB.length > 0) console.log(`      EXTRA in b    : ${p.extraInB.join(" · ")}`);
}

console.log(
  `\nA clean run is a FLOOR, in all three readings. Reading (1) matches on set ` +
    `equality,\nreading (2) and reading (3) on a difference of exactly ` +
    `${NEAR_MISS_MAX_DIFFERENCE} member — a list two or\nmore members from its ` +
    `vocabulary is MEASURED and NOT READ here. Reading (3) sees\nonly production ` +
    `declarations, and a LITERAL copying a vocabulary declared outside\n` +
    `${VOCAB_ROOTS.join(", ")} is still unread. See the docblock's band table ` +
    `and named limits before\nbelieving a silence.`,
);

process.exit(0);
