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
 * # What it does
 *
 * Reads every exported string-literal `as const` array in `shared/` (>= 2
 * members), then every literal array in `client/src`, `server/`, `shared/` and
 * `drizzle/`, and reports each literal whose member SET equals a declared
 * vocabulary — with whether the copying file names the constant at all, and
 * whether the two ORDERS agree.
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
 * # What it CANNOT see, named
 *
 *   - a copy assembled rather than written (`[...A, "x"]`, `Object.keys(M)`)
 *   - a copy whose members are not all string literals on one bracket pair
 *   - a SUBSET or SUPERSET of a vocabulary — set equality is the match, so a
 *     list that has already drifted in MEMBERSHIP falls silent here. That is
 *     not hypothetical: `ControlPanel.tsx:455` offers a gender the shared
 *     `GENDER_VALUES` does not contain, and this sweep does not report it
 *     (triage §30).
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
 * The lines every string-literal array (>= 2 members) starts on — the things a
 * marker could possibly be talking about.
 */
function literalArrayLines(source: string): Set<number> {
  const lines = new Set<number>();
  const re = /\[([^\][{}()]*)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const found = literalMembers(m[1]);
    if (found && found.length >= 2) lines.add(lineOf(source, m.index));
  }
  return lines;
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
  const literalLines = literalArrayLines(source);
  const re = /\[([^\][{}()]*)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const found = literalMembers(m[1]);
    if (!found || found.length < 2) continue;
    const matches = byMemberSet.get(setKey(found));
    if (!matches) continue;
    const line = lineOf(source, m.index);
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

type Reading = { vocabs: Vocabulary[]; scanned: number; copies: Copy[] };

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
  for (const file of files) {
    copies.push(...findCopies(readFileSync(file, "utf8"), rel(file), byMemberSet));
  }
  return { vocabs, scanned: files.length, copies };
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
 * The NEGATIVE control is REAL: `server/db/inkAddCandidates.ts`'s
 * `fallbackOrder` is a deliberate third ordering of the canonical six, carries
 * the marker, and must not be reported. Delete its marker line and this arm
 * reddens.
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
    "a SUBSET is not a hit — set equality is the match, and that limit is real",
  ]);

  // NEGATIVE, against the real tree
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

const { vocabs, scanned, copies } = readTree();

console.log(
  `DECLARED  ${vocabs.length} string-literal \`as const\` vocabularies under ` +
    `${VOCAB_ROOTS.join(", ")} (>= 2 members)`,
);
console.log(`SCANNED   ${scanned} files under ${SCAN_ROOTS.join(", ")}`);
console.log(`HITS      ${copies.length} literal arrays whose member SET equals a declared vocabulary`);
console.log(
  `          ${copies.filter((c) => !isTest(c.file)).length} in production files, ` +
    `${copies.filter((c) => !isTest(c.file) && !c.namesIt).length} of those never naming the constant\n`,
);

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

console.log(
  `\nA clean run is a FLOOR. Set equality is the match, so a list that has ` +
    `already drifted in\nmembership is invisible here — see the docblock's ` +
    `named limits before believing a silence.`,
);

process.exit(0);
