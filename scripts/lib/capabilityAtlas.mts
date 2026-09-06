/**
 * THE STUDIO CAPABILITY CENSUS — the library. (Founder order 2026-08-21,
 * fable-1315 §3; built by the reviewer seat on a branch, fable-1316.)
 *
 * # What it answers
 *
 * *"Does the studio already do this, and where?"* — as a LOOKUP rather than a
 * memory. One week's evidence for why that needed an instrument: a second
 * removal road nearly built beside the one that exists (opus-967); the sign-view
 * ink carry wired and inert for weeks (opus-956); an auto-discovery analyzer
 * "sized" while it was already on the roadmap (§5c); a refusal sentence recorded
 * CLOSED that no ask could reach (`inkRemovalNotYet`). Every one was a code read
 * standing in for a drive.
 *
 * # Two halves, joined
 *
 *   STATIC  — what the source DECLARES: every service refusal id (`refusal("…")`),
 *             every interpreter refusal reason, every `CANNOT_SAY_COPY` member
 *             and whether it is free, every scope flag, every subject card; and
 *             for each id, the test files that name it (a refusal nobody tests is
 *             a finding). Deterministic, no network, runs inside `pnpm test`.
 *
 *   DRIVEN  — what the product DOES: the corpus in `capability-atlas-corpus.mts`
 *             put through the REAL entrance, `refineCandidate`, with the claim
 *             door shut (`admit: () => false`). Real interpreter, real routing,
 *             every pre-claim door, and nothing charged — reaching the claim
 *             throws `busy`, which the census reads as WOULD-RENDER. Text calls
 *             on OpenRouter only; cents per run; never inside `pnpm test`.
 *
 * The join is the point: a declared refusal that no corpus row reaches is
 * `unreached` — exactly the `inkRemovalNotYet` class — and a corpus row whose
 * observed route differs from what its author believed is `belief-mismatch`.
 *
 * # Why the harness is the production caller's shape, and nothing more
 *
 * opus-967 §2: a `mode: "edit"` copied from a sibling script switched off the
 * very lane under audit, and every removal read as broken. This driver passes
 * exactly what the tRPC route passes — user, request id, candidate, sentence,
 * and a scope when the row has one — and records every interpreter call the
 * service makes so the route is evidence, not inference.
 *
 * # What it never does
 *
 * Never spends credits (the ledger is read at both ends and must not move),
 * never renders, never writes a row the product would not write for a free
 * refusal (the service's own `casting.refusal` audit seam runs as it would for
 * any customer), and never runs the driven half unless asked by flag — so
 * invoking the generator to LOOK at it cannot spend (memory law:
 * spending-script-never-inspected).
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CORPUS, UNREACHABLE_DOORS, KNOWN_DEBTS, type CorpusRow, type CorpusState } from "../capability-atlas-corpus.mts";
import { ROADS, LAWS, type Road } from "../capability-atlas-roads.mts";
import { CANNOT_SAY_COPY, cannotSaySentence, type CannotSayReason } from "../../server/castingV2/cannotSayCopy";
import { CONCEPT_DESCRIBE_COPY } from "../../server/castingV2/conceptDescribeCopy";
import { ROLL_REFUSAL_COPY } from "../../server/castingV2/briefRefusalCopy";
import { FREE_SUBJECT_KEYS } from "../../server/castingV2/subjectCards";
import { refusalTagOf } from "../../server/castingV2/refusalTag";

export const CAPABILITY_SCHEMA_VERSION = "1.0.0";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const CAPABILITY_OUT_DIR = path.join(repoRoot, "docs", "architecture");
export const CAPABILITY_JSON = path.join(CAPABILITY_OUT_DIR, "capability-atlas.json");
export const CAPABILITY_MD = path.join(CAPABILITY_OUT_DIR, "capability-atlas.md");

/* ═══════════════════════════════════════════════════════════ static half */

export type DeclaredId = {
  id: string;
  /** Where the id comes from. */
  kind: "service-refusal" | "interpreter-refusal" | "cannot-say" | "concept-refusal" | "roll-refusal";
  /** For a `cannot-say` member: whether the sentence is free or after a refund. */
  charge?: "free" | "refunded";
  /** Test files that name the id as a quoted literal. */
  pinnedBy: string[];
  /**
   * WHERE THE DOOR LIVES — file:line of every raise site, extracted from
   * source at generate time (the founder's double-check-against-the-codebase
   * order, fable-1357): a map entry that cannot cite its line is a story.
   */
  sites: string[];
};

export type StaticAtlas = {
  declared: DeclaredId[];
  flags: string[];
  subjects: string[];
  corpus: Array<Pick<CorpusRow, "id" | "ask" | "scope" | "subject" | "verb" | "state" | "expect" | "why">>;
  /** The roads map — hand-written prose, machine-validated citations. */
  roads: readonly Road[];
  laws: ReadonlyArray<{ law: string; where: string }>;
  findings: Finding[];
};

export type Finding = {
  id: string;
  severity: "info" | "warn" | "error";
  kind:
    | "unpinned-refusal"          // an id no test file names
    | "unreached"                 // an id no corpus row expects, and no reason on file
    | "documented-unreachable"    // an id UNREACHABLE_DOORS carries a reason for
    | "coverage-contradiction"    // an id both documented-unreachable AND expected by a row
    | "duplicate-door-id"         // two declared sources claiming one id — see #192
    | "stale-unreachable-doc"     // a drive PRODUCED an id documented as unreachable
    | "road-cites-unknown-door"   // the roads map names a door the source does not declare
    | "belief-mismatch"           // observed ≠ expect
    | "route-changed"             // observed ≠ the committed observation
    | "drive-error"               // the service threw something that was not a refusal
    | "not-driven"                // a corpus row whose state the fixture cannot supply
    | "ledger-moved";             // the fixture's balance changed — the census spent
  subject: string;
  message: string;
};

const SOURCE_DIR = path.join(repoRoot, "server", "castingV2");

export const listFiles = (dir: string, match: (name: string) => boolean): string[] => {
  const out: string[] = [];
  const walk = (at: string) => {
    for (const entry of fs.readdirSync(at, { withFileTypes: true })) {
      const full = path.join(at, entry.name);
      if (entry.isDirectory()) { if (entry.name !== "node_modules") walk(full); }
      else if (match(entry.name)) out.push(full);
    }
  };
  walk(dir);
  /*
    SORT ON THE SEPARATOR-NEUTRAL FORM, NOT THE PLATFORM PATH. `out` holds
    absolute paths, and sorting those compares the separator byte: `\` (0x5C)
    and `/` (0x2F) sit on opposite sides of the uppercase letters, so sibling
    directories like `casting/` and `castingV2/` flip order between Windows
    and Linux. That flip reached the committed census (`pinnedBy` order for
    the `empty` door) and made one commit read fresh on Windows and stale on
    ubuntu CI — issue #37's class, found by the gate's first proof run.
  */
  const neutral = (p: string) => p.split(path.sep).join("/");
  return out.sort((a, b) => (neutral(a) < neutral(b) ? -1 : neutral(a) > neutral(b) ? 1 : 0));
};

const rel = (file: string): string => path.relative(repoRoot, file).split(path.sep).join("/");

/**
 * Reads a source file as CODE LINES ONLY.
 *
 * ⚠ **#206 — THE COMMENT GUARD WAS ON THE CITATION READER AND NOT ON THE
 * POPULATION READERS, AND THAT ASYMMETRY CAN INVENT A DOOR.** `raiseSites()`
 * has skipped comment lines since the day two docblocks were found cited as
 * raise sites. The two readers below did not, so a docblock that QUOTES the
 * shape — which is what a docblock explaining this very mechanism must do —
 * declares a door.
 *
 * Not hypothetical: it fired the hour #206 was worked. `briefRefusalCopy.ts`'s
 * header explains the population by writing `refusal("id"` in prose, and the
 * generator declared a door named **`id`** and raised `unmapped:id` at ERROR
 * severity — refusing the rite over a sentence in a comment. The instrument
 * reading its own documentation as product.
 *
 * The asymmetry was also the worse-shaped half: a phantom in the POPULATION is
 * a door on the map that does not exist, while a phantom citation only points
 * at the wrong line of a door that does. Measured when this landed: filtering
 * removes exactly the phantom and no real door (`_shift206_population.json`).
 */
function codeLinesOf(file: string): string {
  return fs.readFileSync(file, "utf8").split("\n").filter((line) => !isCommentLine(line)).join("\n");
}

/** Every `refusal("id"` in the service modules — the door's own name. */
export function declaredServiceRefusals(): string[] {
  const ids = new Set<string>();
  for (const file of listFiles(SOURCE_DIR, (n) => n.endsWith(".ts") && !n.endsWith(".test.ts"))) {
    const text = codeLinesOf(file);
    for (const match of text.matchAll(/\brefusal\(\s*"([a-z][a-z0-9_]*)"/g)) ids.add(match[1]!);
  }
  return [...ids].sort();
}

/**
 * Every reason the interpreter can hand back: `reason: "id"` raise sites, the
 * gate ids, AND the `RefineRefusal` union's own members — a member can be
 * raised through a builder no literal-site grep sees (`wall_unfileable` was:
 * typed, consumed, live, and invisible to the first cut of this function; the
 * roads validator caught its own author citing it, 2026-08-22).
 */
export function declaredInterpreterRefusals(): string[] {
  const ids = new Set<string>();
  const interpreter = path.join(SOURCE_DIR, "refineInterpreter.ts");
  const text = codeLinesOf(interpreter);
  for (const match of text.matchAll(/\breason:\s*"([a-z][a-z0-9_]*)"/g)) ids.add(match[1]!);
  for (const file of listFiles(SOURCE_DIR, (n) => n.endsWith(".ts") && !n.endsWith(".test.ts"))) {
    for (const match of codeLinesOf(file).matchAll(/"(gate_[a-z_]+)"/g)) ids.add(match[1]!);
  }
  const delta = codeLinesOf(path.join(SOURCE_DIR, "refineDelta.ts"));
  for (const match of delta.matchAll(/\|\s*\{\s*reason:\s*"([a-z][a-z0-9_]*)"/g)) ids.add(match[1]!);
  return [...ids].sort();
}

/**
 * THE CONCEPT-UPLOAD ENTRANCE'S DOORS (#192) — the third declared source, and
 * the first one that is not the refine road.
 *
 * ⚠ **THE POPULATION IS THE COPY TABLE'S KEYS, IMPORTED — NEVER A GREP.** That
 * is the whole repair. The two readers above visit files: `refusal("id"`
 * anywhere in `server/castingV2`, and `reason: "id"` in `refineInterpreter.ts`
 * ALONE. A `reason:`-shaped refusal declared in any other module is invisible to
 * both, and `conceptDescribe.ts` is exactly that shape — so three of this
 * entrance's five doors were absent from the map and the fourth
 * (`unreadable`) had its raise sites attributed to the INTERPRETER's
 * identically-named door. `CONCEPT_DESCRIBE_COPY` is
 * `Record<ConceptDescribeRefusal, string>`, so the compiler refuses a member
 * with no sentence and this reader sees the key the same hour — the way
 * `CANNOT_SAY_COPY` is already consumed below.
 *
 * ⚠ **THE IDS ARE ENTRANCE-QUALIFIED, AND THE COVERAGE CONTRACT FORCES IT.**
 * `unreadable` is a door on BOTH entrances. Declared bare, the refine corpus
 * row that expects `unreadable` would put it in `expectedIds`, and this
 * entrance's `UNREACHABLE_DOORS` line for the same string would fire
 * `coverage-contradiction` at error severity — two rows claiming one id, the
 * price reader's class (CLAUDE.md, Atlas section). So they are `concept.<member>`
 * and a uniqueness arm keeps the whole declared list collision-free.
 *
 * ⚠ **WHAT THIS DOES NOT FIX, said out loud**: which tables count as
 * customer-facing refusal vocabularies is still a judgement written down here.
 * "Customer-facing" is semantic; no regex knows it. The other entrances still
 * invisible for the original reason are enumerated on #192 with a verdict each.
 */
/**
 * The one file whose `reason:` raises belong to the concept entrance.
 *
 * ⚠ **NAMED IN ONE PLACE AND CHECKED AT DISK, because a split is the hazard
 * here** (review of #207, finding 1). A rename is caught — `raiseSites` throws.
 * A SPLIT is not, and that is declared rather than implied: move one raise into
 * a new `conceptDescribeSomething.ts` and its sites re-file under the
 * interpreter's `unreadable` with nothing going red, since a door losing sites
 * it never needed to have is invisible to every arm here. This is `routers.ts`'s
 * class (a 4,209-line file split that dropped a control), and the honest
 * mitigation for now is that the constant is one line and this paragraph is
 * beside it. Filed on #206.
 */
const CONCEPT_ENTRANCE_FILE = "conceptDescribe.ts";

/**
 * The one file whose `new BriefRefusal(...)` raises belong to the roll entrance.
 * Named once and checked at disk, with the same declared limit its neighbour
 * carries: a rename throws, a SPLIT does not — move one raise into a new module
 * and that door quietly loses a citation with nothing going red. Filed on #206.
 */
const ROLL_ENTRANCE_FILE = "briefCompiler.ts";

export function declaredConceptRefusals(): string[] {
  return Object.keys(CONCEPT_DESCRIBE_COPY).sort().map((id) => `concept.${id}`);
}

/**
 * THE ROLL ENTRANCE'S WALLS (#206) — the fourth declared source, and the second
 * entrance on the map.
 *
 * ⚠ **A FOURTH RAISE SHAPE NOTHING GREPPED.** `briefCompiler.ts` refuses with
 * `throw new BriefRefusal("id", MESSAGE)`. None of the three readers above
 * visits that shape, so all five of this entrance's doors were absent from the
 * declared set — measured at the artifact before the repair, including
 * `likeness` and `not_a_being`, the two subject walls the Prompt Author ruling
 * explicitly KEEPS. The map showed one half of one founder boundary: its twin
 * `concept.no_being` arrived on the map with #192 while the roll road's own
 * `not_a_being` stayed invisible.
 *
 * The population is `ROLL_REFUSAL_COPY`'s keys, IMPORTED — never a grep, for
 * the reason the concept reader states above.
 *
 * ⚠ **QUALIFIED `roll.*` THOUGH NOTHING COLLIDES TODAY, AND THE REASON IS AN
 * AMBIGUITY RATHER THAN A COLLISION.** `castingIntent.ts` carries
 * `reason: "unsupported_cohort"` — the INTERPRETER's internal verdict that feeds
 * the customer-facing wall. `raiseSites` collects bare `reason:` shapes from
 * every file in the tree, so declaring these bare would auto-attach the internal
 * outcome's line to the customer's door: exactly the conflation #206 made in
 * prose, shipped into the artifact. Qualified, the door cites the line that
 * SPEAKS to the customer and the internal verdict stays what it is.
 */
export function declaredRollRefusals(): string[] {
  return Object.keys(ROLL_REFUSAL_COPY).sort().map((id) => `roll.${id}`);
}

/** The scope flags, read off their own `_SCOPE_ENV` constants. */
export function declaredFlags(): string[] {
  const text = fs.readFileSync(path.join(SOURCE_DIR, "castingV2Scope.ts"), "utf8");
  const ids = new Set<string>();
  /* `[A-Z0-9_]` — the first cut read `[A-Z_]` and silently dropped
     CASTING_V2_SCOPE, the parent of every other flag, on its digit. */
  for (const match of text.matchAll(/_SCOPE_ENV\s*=\s*"(CASTING_[A-Z0-9_]+_SCOPE)"/g)) ids.add(match[1]!);
  return [...ids].sort();
}

/**
 * The directory the doors are DECLARED in. A test pins one only if it reaches
 * here — see `reachesDoors` and `pinningTests` below.
 */
const DOOR_MODULE_DIR = "server/castingV2";

/**
 * Resolve a RELATIVE import specifier against the importing file, to a
 * repo-relative path with `.` and `..` collapsed.
 *
 * A bare specifier (a package) and one climbing above the repo root both return
 * null: neither is a path in this tree, and neither may resolve to one.
 */
function resolveSpecifier(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) return null;
  const parts = fromFile.split("/").slice(0, -1);
  for (const part of specifier.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (parts.length === 0) return null;
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join("/");
}

/**
 * Does this test file REACH the module the doors are declared in — by living
 * there, or by importing from there?
 *
 * Kept beside `pinningTests` because it is that function's whole correction,
 * and separate from it because the arms drive it directly: a rule that can only
 * be exercised through a full atlas build is a rule nobody sabotages.
 *
 * ⚠ **THE IMPORT ARM RESOLVES THE SPECIFIER; IT DOES NOT SEARCH IT FOR A TOKEN
 * (PR #615 review, finding 1).** The first shape asked whether the specifier
 * merely CONTAINED `castingV2`, which credited `./db/castingV2Segments` and
 * `../routes/castingV2` — files outside the door module whose NAMES carry the
 * word. That is a substring standing in for a fact the path already states,
 * which is the very class this function exists to fix, re-opened one level
 * down: name a crew helper `castingV2Report.mts` and any stranger importing it
 * may pin every door it happens to quote.
 *
 * ⚠ **TIGHTENING IT COSTS NOTHING, AND THAT WAS MEASURED RATHER THAN ASSUMED.**
 * The review suggested declaring the looseness instead, on the ground that it
 * was load-bearing for `server/segmentsOnFaceEndpoint.test.ts` (which imports
 * `./db/castingV2Segments`). Read at the artifact: that file holds **no pins at
 * all** — it never quotes a door id — so nothing rests on the substring. The
 * exact rule keeps every real pin and the atlas is byte-identical.
 */
export function reachesDoors(relPath: string, text: string): boolean {
  if (relPath.startsWith(`${DOOR_MODULE_DIR}/`)) return true;
  /*
    ⚠ A DYNAMIC IMPORT COUNTS, AND THIS REPOSITORY HAS ALREADY PAID ONCE FOR
    ASSUMING OTHERWISE (PR #615 review, round 2). A static-`from`-only reader is
    exactly the Architecture Atlas's blind spot at `d614320f`, where 65 modules
    read as having no caller — both login routes among them, reached only by
    `await import(…)` — and "no caller" is the reading that says safe to remove.
    Here the direction is the safe one rather than the dangerous one, but it is
    still wrong: **13 test suites outside `server/castingV2/` reach the module
    ONLY dynamically**, so the day one of them adds a real pin the census would
    refuse to credit it and keep `unpinned-refusal` firing on a door that has an
    arm. None quotes a door id today, which is why the regenerated atlas does
    not move.

    `vi.mock("…")` is covered by the same alternation, because mocking a module
    is naming it as the subject just as plainly as importing it.
  */
  const specifiers = [
    ...text.matchAll(/\bfrom\s+["']([^"']+)["']/g),
    ...text.matchAll(/\b(?:import|require|vi\.mock|vi\.doMock)\s*\(\s*["']([^"']+)["']/g),
  ];
  for (const match of specifiers) {
    const resolved = resolveSpecifier(relPath, match[1]!);
    if (resolved && resolved.startsWith(`${DOOR_MODULE_DIR}/`)) return true;
  }
  return false;
}

/**
 * THE PIN RULE AND WHY IT IS WHAT IT IS — the record for `reachesDoors` above
 * and `pinCandidates` below, which apply it.
 *
 * A pin is a test proving a refusal door can shut, and a refusal with no pin is
 * a door nobody has proven can shut.
 *
 * ⚠ **A FILE THAT MERELY SPELLS A DOOR ID IS NOT A PIN — #545 / #614.** Until
 * 2026-09-07 the only question asked was whether the quoted literal appeared
 * ANYWHERE in ANY test under `server/`, so a fixture name, a temp-file name or
 * an unrelated state enum equal to a door id counted as proof that the door can
 * shut. Three specimens, none deliberate, each found by a different PR's review:
 * `server/nextUpEscalation.test.ts` naming temp files `"empty"` and
 * `"unreadable"` pinned THREE casting doors (#545); `server/prMergeOrder.test.ts`
 * gave `concept.unreadable` a 23rd pin with a receipt state (#614, renamed at
 * source); and `server/deployWatchDecision.test.ts` sits on that list today for
 * a `{ kind: "unreadable" }` deploy verdict.
 *
 * **It disables an arm in the reassuring direction** — working law 2 pointed at
 * the census itself. Delete a door's real arms and `unpinned-refusal` still
 * cannot fire, because a stranger's fixture holds the count above zero.
 *
 * **THE RULE: A PIN MUST REACH THE DOOR'S MODULE.** Structural, by where the
 * file lives and what it imports, never by name — the self-exclusion below is
 * the same shape, and this is it one step wider. It is deliberately NOT a list
 * of excluded filenames: a second list of names is what working law 4 exists to
 * spoil, and it would rot on the first rename.
 *
 * ⚠ **MEASURED BEFORE IT WAS WRITTEN, BECAUSE THE OBVIOUS REPAIRS ARE WORSE
 * THAN THE DEFECT.** At the tree of 2026-09-07: 59 doors, 194 pin entries.
 * Requiring a casting IMPORT alone dropped **156 of 194 and emptied 27 doors** —
 * fixing a false pin by deleting the census. A LOCATION-only filter drops 6 and
 * empties none, but it drops a REAL pin (`server/db/referenceReadDemand.test.ts`
 * drives `unreadable` through the reference reader and imports the door's own
 * codes) while KEEPING a false one inside `server/casting/`. **Reach keeps that
 * real pin and drops exactly the four false ones**: `deployWatchDecision.test.ts`
 * (a deploy verdict), `benchKit.test.ts` (a refusal literal the bench harness
 * constructs, which cannot fail if the door stops shutting), and
 * `casting/geminiMigration.test.ts` (the label in an `["empty", ""]` row, in the
 * LEGACY pipeline, not this door). **194 → 190 pins, and no door loses its
 * last one: unpinned stays at 1.**
 *
 * ⚠ **ITS LIMIT IS DECLARED, AND IT FAILS TOWARD THE WARNING.** The reach test
 * is textual, so a suite outside `server/castingV2` reaching a door only through
 * a barrel would lose its pin. That direction is the safe one: the door reads
 * UNPINNED and `unpinned-refusal` fires, asking for an arm that already exists —
 * loud and wrong beats quiet and wrong, and quiet-and-wrong is the bug here.
 */
/**
 * Which of the tree's test files may pin a door at all — the two structural
 * exclusions, applied to `[relative path, source]` pairs.
 *
 * Separate from `pinningTests` so the arms can drive the REFUSAL below: a
 * backstop whose only road runs through a real filesystem scan is a backstop
 * nobody can prove blocks (working law 3).
 */
export function pinCandidates(
  entries: ReadonlyArray<readonly [string, string]>,
): Array<readonly [string, string]> {
  /*
    THE CENSUS'S OWN TEST IS NOT A PIN. Its positive control has to NAME an
    unpinned id, and the first run of this scan counted that mention as the pin
    and declared the door proven — the instrument publishing its own control
    into the corpus it searches (memory: specimen-joins-the-vocabulary, fourth
    instance). Excluded structurally, by what the file imports, not by name.
  */
  const kept = entries
    .filter(([, text]) => !text.includes("lib/capabilityAtlas.mts"))
    .filter(([file, text]) => reachesDoors(file, text));
  /*
    REFUSE RATHER THAN RETURN A SHORT LIST (the Atlas collector rule, CLAUDE.md).
    If the reach test matches nothing, every door reads as unpinned and the
    census reports a catastrophe that is really a broken resolver.
  */
  if (kept.length === 0) {
    throw new Error(
      `pinCandidates: no test file reaches ${DOOR_MODULE_DIR}. That is a broken resolver, ` +
      "not a product with no arms — refusing rather than reporting every door unpinned.",
    );
  }
  return kept;
}

/**
 * Which test files name an id — as a QUOTED literal, so `busy` in prose does not
 * count as a pin, and only among the files `pinCandidates` allows.
 *
 * A refusal with no pin is a door nobody has proven can shut. The reach rule
 * that decides who may pin, and the measurements behind it, are documented on
 * `pinCandidates` and `reachesDoors` above.
 */
export function pinningTests(ids: string[]): Map<string, string[]> {
  const tests = listFiles(path.join(repoRoot, "server"), (n) => n.endsWith(".test.ts"));
  const texts = pinCandidates(
    tests.map((file) => [rel(file), fs.readFileSync(file, "utf8")] as const),
  );
  const out = new Map<string, string[]>();
  for (const id of ids) {
    const quoted = [`"${id}"`, `'${id}'`, `\`${id}\``];
    out.set(id, texts.filter(([, text]) => quoted.some((q) => text.includes(q))).map(([file]) => file));
  }
  return out;
}

/**
 * FILE:LINE of every raise site per id — the map's citations, mechanically
 * extracted so every door can be double-checked against the codebase without
 * trusting this file (founder order, fable-1357 / "double check your work
 * against the codebase").
 *
 * ⚠ **A COMMENT IS NOT A RAISE SITE, and the map cited two of them.** These
 * are LINE REGEXES over source — the shape-match class CLAUDE.md's Atlas
 * section names — so a docblock quoting `reason: "x"` while EXPLAINING a door
 * became a citation for it, indistinguishable in the artifact from the line
 * that actually throws. Measured at the tree the hour it was fixed: **2 of 160
 * sites** — `refusal("removal_absent", ...)` inside `refusalTag.ts`'s own
 * docblock, there since that docblock was written and never noticed, and a
 * `conceptDescribe.ts` docblock added the same day. Neither door loses its
 * LAST site, so the repair orphans nothing; it only stops a citation pointing
 * at prose when it claims to point at the throw.
 *
 * ⚠ **ITS LIMIT IS DECLARED RATHER THAN IMPLIED**: this skips a line whose
 * first non-space character OPENS a comment, which is every docblock body and
 * every whole-line `//`. A trailing comment on a line of code still counts —
 * and should, the code is there — and an id inside a string literal always
 * did. A real tokenizer is not bought for two lines.
 */
function isCommentLine(line: string): boolean {
  return /^\s*(\*|\/\/|\/\*)/.test(line);
}

export function raiseSites(): Map<string, string[]> {
  const sites = new Map<string, string[]>();
  const add = (id: string, site: string) => sites.set(id, [...(sites.get(id) ?? []), site]);
  /*
    #192 — A SITE INSIDE THE CONCEPT ENTRANCE BELONGS TO THE CONCEPT ENTRANCE.
    `unreadable` is a door on two roads, and before this every raise site in
    `conceptDescribe.ts` was filed under the INTERPRETER's door of that name —
    a citation pointing at the right line and naming the wrong door, which is
    worse than an absent one. The qualification is DERIVED from the copy table's
    keys, not from a list of names typed here.
  */
  const conceptMembers = new Set(Object.keys(CONCEPT_DESCRIBE_COPY));
  const conceptFile = path.join(SOURCE_DIR, CONCEPT_ENTRANCE_FILE);
  /*
    ⚠ AND IT REFUSES RATHER THAN QUALIFYING NOTHING (review of #207, finding 1).
    The qualification keys on ONE path. If that file is renamed, every site in
    it silently re-files under the interpreter's door — the exact defect this
    repair exists to remove, returning behind a green suite, because a scan that
    matches nothing looks identical to a scan with nothing to match. The repo's
    own rule for collectors that can come up empty: throw.
  */
  if (!fs.existsSync(conceptFile)) {
    throw new Error(
      `capability atlas: the concept entrance's file ${CONCEPT_ENTRANCE_FILE} is not on disk — `
      + "its raise sites would silently re-file under the interpreter's identically-named doors. "
      + "Point CONCEPT_ENTRANCE_FILE at the file that raises them.",
    );
  }
  for (const file of listFiles(SOURCE_DIR, (n) => n.endsWith(".ts") && !n.endsWith(".test.ts"))) {
    const inConcept = file === conceptFile;
    const qualify = (id: string) => (inConcept && conceptMembers.has(id) ? `concept.${id}` : id);
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, at) => {
      if (isCommentLine(line)) return;
      for (const match of line.matchAll(/\brefusal\(\s*"([a-z][a-z0-9_]*)"/g)) add(qualify(match[1]!), `${rel(file)}:${at + 1}`);
      for (const match of line.matchAll(/\breason:\s*"([a-z][a-z0-9_]*)"/g)) add(qualify(match[1]!), `${rel(file)}:${at + 1}`);
      for (const match of line.matchAll(/"(gate_[a-z_]+)"/g)) add(match[1]!, `${rel(file)}:${at + 1}`);
    });
  }
  /*
    THE COPY TABLE'S KEY LINES ARE SITES TOO, and for this entrance they are not
    a nicety: two of its five reasons are chosen by a ternary
    (`? "not_about_the_person" : …`), which no `reason:`-shaped regex sees. The
    `CANNOT_SAY_COPY` block below is the same pattern for the same reason.
  */
  /*
    #206 — THE ROLL ENTRANCE'S RAISE SITES, AND THIS ONE CANNOT BE READ LINE BY
    LINE.

    ⚠ **THE SHAPE IS BOTH SINGLE- AND MULTI-LINE, and a line-wise regex would
    have found sites for three members and ZERO for the other two while looking
    identical in the artifact.** `throw new BriefRefusal("reader_outage", MSG);`
    is one line; `unsupported_cohort`'s two sites put `new BriefRefusal(` and
    the id on different lines. Sites-empty is not an error anywhere in this
    file, so the half-blind version would have shipped green — the collector
    class CLAUDE.md's Atlas section names. So the match is over WHOLE TEXT and
    the citation is the line the ID lands on.

    A docblock quoting the raise is still not a site: the id's own line is
    tested with the same `isCommentLine` guard the line-wise readers use, which
    covers both the single-line and the wrapped shape (a wrapped raise inside a
    docblock has `*` on both lines).
  */
  const rollMembers = new Set(Object.keys(ROLL_REFUSAL_COPY));
  const rollFile = path.join(SOURCE_DIR, ROLL_ENTRANCE_FILE);
  /* Same refusal as the concept entrance's, for the same reason: qualification
     keys on ONE path, and a scan that matches nothing looks exactly like a scan
     with nothing to match. */
  if (!fs.existsSync(rollFile)) {
    throw new Error(
      `capability atlas: the roll entrance's file ${ROLL_ENTRANCE_FILE} is not on disk — `
      + "its five walls would silently lose every citation they have. "
      + "Point ROLL_ENTRANCE_FILE at the file that raises them.",
    );
  }
  const rollText = fs.readFileSync(rollFile, "utf8");
  const rollLines = rollText.split("\n");
  for (const match of rollText.matchAll(/new\s+BriefRefusal\(\s*"([a-z][a-z0-9_]*)"/g)) {
    const id = match[1]!;
    if (!rollMembers.has(id)) continue;
    /* The line the id is on — which is what gets cited, so it is what is
       tested for comment-hood. */
    const at = rollText.slice(0, match.index! + match[0].length).split("\n").length;
    if (isCommentLine(rollLines[at - 1] ?? "")) continue;
    add(`roll.${id}`, `${rel(rollFile)}:${at}`);
  }
  /* The copy table's key lines are sites too — the concept entrance's pattern,
     and here it is what gives `uninterpretable` a citation for its SENTENCE as
     well as its two throws. */
  const rollCopyFile = path.join(SOURCE_DIR, "briefRefusalCopy.ts");
  const rollCopyLines = fs.readFileSync(rollCopyFile, "utf8").split("\n");
  for (const id of rollMembers) {
    rollCopyLines.forEach((line, at) => {
      if (new RegExp(`^\\s{2}${id}:`).test(line)) add(`roll.${id}`, `${rel(rollCopyFile)}:${at + 1}`);
    });
  }
  const conceptCopyFile = path.join(SOURCE_DIR, "conceptDescribeCopy.ts");
  const conceptCopyLines = fs.readFileSync(conceptCopyFile, "utf8").split("\n");
  for (const id of conceptMembers) {
    conceptCopyLines.forEach((line, at) => {
      if (new RegExp(`^\\s{2}${id}:`).test(line)) add(`concept.${id}`, `${rel(conceptCopyFile)}:${at + 1}`);
    });
  }
  /* union members declared in the refusal type: the type line is the site. */
  const deltaFile = path.join(SOURCE_DIR, "refineDelta.ts");
  fs.readFileSync(deltaFile, "utf8").split("\n").forEach((line, at) => {
    if (isCommentLine(line)) return;
    for (const match of line.matchAll(/\|\s*\{\s*reason:\s*"([a-z][a-z0-9_]*)"/g)) add(match[1]!, `${rel(deltaFile)}:${at + 1}`);
  });
  /* cannot-say members: the line their key opens on in the copy table. */
  const copyFile = path.join(SOURCE_DIR, "cannotSayCopy.ts");
  const copyLines = fs.readFileSync(copyFile, "utf8").split("\n");
  for (const id of Object.keys(CANNOT_SAY_COPY)) {
    copyLines.forEach((line, at) => {
      if (new RegExp(`^\\s{2}${id}:\\s*\\{`).test(line)) add(id, `${rel(copyFile)}:${at + 1}`);
    });
  }
  return sites;
}

/**
 * #192 — TWO DECLARED SOURCES MAY NOT CLAIM ONE ID.
 *
 * This exists because one pair silently did, for as long as the concept
 * entrance has been live. `unreadable` is a door on the refine road AND on the
 * concept upload, and the map carried ONE row for it wearing the interpreter's
 * label and the concept entrance's citations. **Nothing went red**, and nothing
 * could: every downstream check — pins, coverage, roads — reads by id, so a
 * collision reads as one well-covered door instead of two half-covered ones.
 *
 * The entrance-qualification that fixed it is a naming convention, and a
 * convention with no arm is a habit. It refuses at generate time, so the deploy
 * rite carries it; it is a separate function so its arm can DRIVE it with a
 * colliding list rather than assert a property of a tree that happens to be
 * clean today (working law 2 — a checker that cannot fail is not a checker).
 */
export function duplicateDoorFindings(declared: readonly DeclaredId[]): Finding[] {
  const findings: Finding[] = [];
  const seen = new Map<string, DeclaredId>();
  for (const entry of declared) {
    const prior = seen.get(entry.id);
    if (prior) {
      findings.push({
        id: `duplicate:${entry.id}`, severity: "error", kind: "duplicate-door-id", subject: entry.id,
        message: `"${entry.id}" is declared by two sources (${prior.kind} and ${entry.kind}) — one map row would carry both doors' pins and citations; qualify one of them`,
      });
    } else seen.set(entry.id, entry);
  }
  return findings;
}

export function buildStaticAtlas(corpus: readonly CorpusRow[] = CORPUS): StaticAtlas {
  const service = declaredServiceRefusals();
  const interpreter = declaredInterpreterRefusals().filter((id) => !service.includes(id));
  const cannot = Object.keys(CANNOT_SAY_COPY).sort() as CannotSayReason[];
  const concept = declaredConceptRefusals();
  const roll = declaredRollRefusals();
  /*
    #192 — PINS ARE SEARCHED ON THE BARE MEMBER NAME AND ATTACHED TO THE
    QUALIFIED ENTRY. `pinningTests` looks for a QUOTED literal, and a test
    quotes what the product returns (`"no_being"`), never the atlas's own
    `concept.no_being`. Searching the qualified id would have found nothing and
    reported five doors as proven by no test — a finding manufactured entirely
    by this file's naming choice.
  */
  const conceptBare = concept.map((id) => id.slice("concept.".length));
  const rollBare = roll.map((id) => id.slice("roll.".length));
  const pins = pinningTests([...service, ...interpreter, ...cannot, ...conceptBare, ...rollBare]);
  const sites = raiseSites();
  const declared: DeclaredId[] = [
    ...service.map((id) => ({ id, kind: "service-refusal" as const, pinnedBy: pins.get(id) ?? [], sites: sites.get(id) ?? [] })),
    ...interpreter.map((id) => ({ id, kind: "interpreter-refusal" as const, pinnedBy: pins.get(id) ?? [], sites: sites.get(id) ?? [] })),
    ...cannot.map((id) => ({
      id, kind: "cannot-say" as const, charge: CANNOT_SAY_COPY[id].charge, pinnedBy: pins.get(id) ?? [], sites: sites.get(id) ?? [],
    })),
    ...concept.map((id) => ({
      id,
      kind: "concept-refusal" as const,
      pinnedBy: pins.get(id.slice("concept.".length)) ?? [],
      sites: sites.get(id) ?? [],
    })),
    /* #206 — pins on the BARE name for the reason stated above the concept
       entry: a test quotes what the product returns (`"likeness"`), never the
       atlas's own `roll.likeness`. */
    ...roll.map((id) => ({
      id,
      kind: "roll-refusal" as const,
      pinnedBy: pins.get(id.slice("roll.".length)) ?? [],
      sites: sites.get(id) ?? [],
    })),
  ].sort((a, b) => a.id.localeCompare(b.id));

  const findings: Finding[] = [...duplicateDoorFindings(declared)];
  for (const entry of declared) {
    if (entry.pinnedBy.length === 0) {
      findings.push({
        id: `unpinned:${entry.id}`, severity: "warn", kind: "unpinned-refusal", subject: entry.id,
        message: `${entry.kind} "${entry.id}" is named by no test file — a door nobody has proven can shut`,
      });
    }
  }
  /*
    THE COVERAGE CONTRACT (founder order, fable-1357 §2b): every declared door
    is REACHED by a row, DOCUMENTED unreachable with a reason, or an alarm.
    The documentation itself cannot lie quietly: a door both documented and
    expected is a contradiction; a documented door a drive produces is stale
    documentation — both are error-severity, checked here and in drivenFindings.
  */
  const documented = new Map(UNREACHABLE_DOORS.map((d) => [d.id, d]));
  const expectedIds = new Set(corpus.map((row) => outcomeId(row.expect)).filter((x): x is string => x !== null));
  /* Reaching the claim IS reaching `busy` — every would-render row ends at the
     admit door; with the census's shut claim that is the door that answers. */
  if (corpus.some((row) => row.expect === "would-render")) expectedIds.add("busy");
  for (const [id, doc] of documented) {
    if (expectedIds.has(id)) {
      findings.push({
        id: `contradiction:${id}`, severity: "error", kind: "coverage-contradiction", subject: id,
        message: `"${id}" is documented UNREACHABLE and expected by a corpus row — one of the two is wrong`,
      });
    }
  }
  const knownDebts = new Set(KNOWN_DEBTS);
  for (const entry of declared) {
    if (expectedIds.has(entry.id)) {
      /* A debt that got reached must leave the list — shrink-only, enforced. */
      if (knownDebts.has(entry.id)) {
        findings.push({
          id: `stale-debt:${entry.id}`, severity: "error", kind: "coverage-contradiction", subject: entry.id,
          message: `"${entry.id}" is on KNOWN_DEBTS and a corpus row now expects it — delete its debt line; the list only shrinks`,
        });
      }
      continue;
    }
    const doc = documented.get(entry.id);
    if (doc) {
      if (knownDebts.has(entry.id)) {
        findings.push({
          id: `stale-debt:${entry.id}`, severity: "error", kind: "coverage-contradiction", subject: entry.id,
          message: `"${entry.id}" is on KNOWN_DEBTS and is documented — delete its debt line; the list only shrinks`,
        });
      }
      findings.push({
        id: `documented:${entry.id}`, severity: "info", kind: "documented-unreachable", subject: entry.id,
        /*
          ⚠ #206 — THIS SENTENCE USED TO READ "unreachable by design", AND OF
          SOME OF THESE DOORS THAT IS SIMPLY FALSE. `likeness` and
          `not_a_being` are hit in production whenever a customer types a
          famous name or asks for a car; `concept.no_being` is hit whenever an
          upload holds no subject. What every entry in `UNREACHABLE_DOORS`
          actually records — read at its own rows, whose `becomesReachable`
          prose is written in corpus-row terms without exception — is that no
          CORPUS ROW reaches it. The constant keeps its name (renaming it
          ripples into the finding `kind`, the schema and both renderers for no
          gain), and the founder-facing sentence stops claiming more than the
          list knows.
        */
        message: `no corpus row reaches it: ${doc.reason} — a row could reach it via: ${doc.becomesReachable}`,
      });
    } else if (knownDebts.has(entry.id)) {
      findings.push({
        id: `unreached:${entry.id}`, severity: "warn", kind: "unreached", subject: entry.id,
        message: `KNOWN DEBT: no corpus row expects "${entry.id}" — the map's named remainder (founder law: this list only shrinks)`,
      });
    } else {
      /*
        THE FOUNDER LAW'S TEETH (fable-1359): a NEW door with no row, no
        documentation and no debt line is an ERROR — the rite runs this check
        on every push, so a casting change cannot ship without its map entry
        in the same commit.
      */
      findings.push({
        id: `unmapped:${entry.id}`, severity: "error", kind: "unreached", subject: entry.id,
        message: `"${entry.id}" is a door the map does not know — add its corpus row, its UNREACHABLE_DOORS reason, or (founder-visible) its KNOWN_DEBTS line in this same commit`,
      });
    }
  }
  /*
    THE ROADS MAP'S OWN VALIDATION (fable-1357 / "double check your work
    against the codebase"): a road citing a door the source does not declare,
    a flag that does not exist, or an entrance file that is not on disk is an
    ERROR — the map is refused rather than allowed to tell a story.
  */
  const declaredIds = new Set(declared.map((d) => d.id));
  const flagSet = new Set(declaredFlags());
  for (const road of ROADS) {
    for (const door of road.doors) {
      if (!declaredIds.has(door)) {
        findings.push({
          id: `road-door:${road.id}:${door}`, severity: "error", kind: "road-cites-unknown-door", subject: door,
          message: `road "${road.id}" cites door "${door}", which the source does not declare`,
        });
      }
    }
    for (const flag of road.flags) {
      if (!flagSet.has(flag)) {
        findings.push({
          id: `road-flag:${road.id}:${flag}`, severity: "error", kind: "road-cites-unknown-door", subject: flag,
          message: `road "${road.id}" cites flag "${flag}", which the source does not declare`,
        });
      }
    }
    for (const entrance of road.entrances) {
      if (!fs.existsSync(path.join(repoRoot, entrance))) {
        findings.push({
          id: `road-entrance:${road.id}:${entrance}`, severity: "error", kind: "road-cites-unknown-door", subject: entrance,
          message: `road "${road.id}" names entrance "${entrance}", which is not on disk`,
        });
      }
    }
  }

  return {
    declared,
    flags: declaredFlags(),
    subjects: [...FREE_SUBJECT_KEYS].sort(),
    corpus: corpus.map(({ id, ask, scope, subject, verb, state, expect, why }) => ({ id, ask, scope, subject, verb, state, expect, why })),
    roads: ROADS,
    laws: LAWS,
    findings: findings.sort((a, b) => a.id.localeCompare(b.id)),
  };
}

/** `refused:x` / `free:x` → `x`; `would-render` etc. → null. */
export const outcomeId = (outcome: string): string | null => {
  const match = /^(?:refused|free):([a-zA-Z_]+)$/.exec(outcome);
  return match ? match[1]! : null;
};

/* ═══════════════════════════════════════════════════════════ driven half */

export type InterpreterCall = { mode: string; answer: string };

export type Observation = {
  id: string;
  /** The census's outcome vocabulary. */
  observed: string;
  /** The facet the door named, when it named one. */
  facet: string | null;
  /** The sentence the customer would have read, for free answers and questions. */
  said: string | null;
  /** Every interpreter call the service made, in order — the route's evidence. */
  calls: InterpreterCall[];
  /** Wall-clock for the drive, so a slow door is a number. */
  ms: number;
};

export type DrivenAtlas = {
  profile: { name: string; flags: Record<string, string>; fixture: string };
  observations: Observation[];
  /** Rows whose state the fixture could not supply — listed, never hidden. */
  notDriven: Array<{ id: string; state: CorpusState }>;
  ledger: { before: number; after: number };
};

export type CapabilityAtlas = {
  schemaVersion: string;
  static: StaticAtlas;
  driven: DrivenAtlas | null;
  findings: Finding[];
};

/**
 * Which `CANNOT_SAY_COPY` member wrote this sentence — matched by rendering every
 * member with the row's own context and comparing. A sentence no member renders
 * is `free:unmatched`, which is itself worth reading: it means the product said
 * something the table does not own.
 */
/**
 * EVERY SET OF WORDS A CAST CAN BE SPOKEN ABOUT (§5e).
 *
 * These sentences stopped being constants on 2026-08-22 — the refine surface
 * called every Cast "her" and now says what the Cast's own schema says. So the
 * matcher tries all three, exactly as it already tries both money states and
 * three nouns: the census reads a sentence off a fixture whose sex it does not
 * carry, and a matcher that only knew one set would file the other two as
 * `unmatched` — the product saying something the table does not own, which is
 * a real finding and would here be an artifact of the reader.
 */
const PRONOUN_SETS = [
  { subject: "she", object: "her", possessive: "her", plural: false },
  { subject: "he", object: "him", possessive: "his", plural: false },
  { subject: "they", object: "them", possessive: "their", plural: true },
] as const;

export function reasonOfNote(note: string, context: { facet: string | null; scopeNoun: string | null }): string {
  const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
  const wanted = normalize(note);
  for (const reason of Object.keys(CANNOT_SAY_COPY) as CannotSayReason[]) {
    for (const words of [null, "it", "that"]) {
      for (const moneySafe of [true, false]) {
        for (const pronouns of PRONOUN_SETS) {
          let rendered: string;
          try {
            rendered = cannotSaySentence(reason, {
              words, facet: context.facet, scopeNoun: context.scopeNoun, moneySafe, pronouns,
            });
          } catch {
            continue;
          }
          if (normalize(rendered) === wanted) return reason;
        }
      }
    }
  }
  /*
    Second pass: LONGEST COMMON RUN against each member rendered generically.
    Members open with variable place-phrases ("That's his upper chest tattoo —
    he has it, and …"), so a prefix test misses sentences that are unmistakably
    the member's — measured on `inkNotKept` and the scoped `noInkToChange`,
    drive-5 of the full-map pass. 45 shared characters of prose is this table's
    voice; no two members share a run that long.
  */
  const longestCommonRun = (a: string, b: string): number => {
    let best = 0;
    const prev = new Array<number>(b.length + 1).fill(0);
    for (let i = 1; i <= a.length; i += 1) {
      let diagonal = 0;
      for (let j = 1; j <= b.length; j += 1) {
        const up = prev[j]!;
        prev[j] = a[i - 1] === b[j - 1] ? diagonal + 1 : 0;
        if (prev[j]! > best) best = prev[j]!;
        diagonal = up;
      }
    }
    return best;
  };
  let bestReason = "unmatched";
  let bestRun = 44;
  for (const reason of Object.keys(CANNOT_SAY_COPY) as CannotSayReason[]) {
    for (const pronouns of PRONOUN_SETS) {
      for (const scopeNoun of [context.scopeNoun, null, "the upper chest", "an upper arm"]) {
        try {
          const rendered = normalize(cannotSaySentence(reason, {
            words: null, facet: context.facet, scopeNoun, moneySafe: true, pronouns,
          }));
          const run = longestCommonRun(rendered, wanted);
          if (run > bestRun) { bestRun = run; bestReason = reason; }
        } catch { /* a member that needs a noun it was not given */ }
      }
    }
  }
  return bestReason;
}

type RefineModule = typeof import("../../server/castingV2/refineService");
type InterpreterModule = typeof import("../../server/castingV2/refineInterpreter");

/** Drive one row through the real entrance with the claim door shut. */
export async function driveRow(input: {
  row: CorpusRow;
  userId: number;
  candidatePublicId: string;
  refine: RefineModule["refineCandidate"];
  interpret: InterpreterModule["interpretRefinement"];
}): Promise<Observation> {
  const calls: InterpreterCall[] = [];
  const interpret = (async (request: Parameters<InterpreterModule["interpretRefinement"]>[0]) => {
    const answer = await input.interpret(request);
    const shape = request as Record<string, unknown>;
    calls.push({
      mode: typeof shape.mode === "string" ? shape.mode : "(default)",
      answer: answer.ok
        /* The WHOLE delta, not a slice: the ink gate classifies the model's
           filed item, not her sentence, so the item is the evidence. */
        ? ("delta" in answer ? `served ${JSON.stringify((answer as { delta: unknown }).delta).slice(0, 600)}` : `ok:${(answer as { intent?: string }).intent ?? "?"}`)
        : `refused:${(answer as { refusal: { reason: string } }).refusal.reason}`,
    });
    return answer;
  }) as InterpreterModule["interpretRefinement"];

  const started = Date.now();
  const scopeNoun = input.row.scope ? input.row.scope.replace(/^ink:/, "").replace("@", " ") : null;
  try {
    const result = await input.refine({ interpret, admit: () => false }, {
      userId: input.userId,
      clientRequestId: randomUUID(),
      candidatePublicId: input.candidatePublicId,
      instruction: input.row.ask,
      ...(input.row.scope ? { scope: input.row.scope } : {}),
    });
    const ms = Date.now() - started;
    if (result.reask) {
      return { id: input.row.id, observed: `asked:${result.reask.kind}`, facet: null, said: result.reask.question, calls, ms };
    }
    if ((result as { offer?: unknown }).offer) {
      return { id: input.row.id, observed: "offered", facet: null, said: null, calls, ms };
    }
    if (result.note) {
      /* The NAVIGATE answers are the removal road's own copy, not the
         cannot-say table's — a display label so the table reads as what
         happened. If the product's sentence drifts, the observed string
         drifts with it and the route-change finding says so. */
      if (/^That takes (it back to the original|off ["'“])/.test(result.note)) {
        return { id: input.row.id, observed: "free:navigate", facet: null, said: result.note, calls, ms };
      }
      const reason = reasonOfNote(result.note, { facet: input.row.subject === "guard" ? null : input.row.subject, scopeNoun });
      return { id: input.row.id, observed: `free:${reason}`, facet: null, said: result.note, calls, ms };
    }
    return { id: input.row.id, observed: `returned:${result.kind ?? "unknown"}`, facet: null, said: null, calls, ms };
  } catch (error) {
    const ms = Date.now() - started;
    const tag = refusalTagOf(error);
    if (tag) {
      const message = error instanceof Error ? error.message : null;
      if (tag.reason === "busy") return { id: input.row.id, observed: "would-render", facet: null, said: null, calls, ms };
      return { id: input.row.id, observed: `refused:${tag.reason}`, facet: tag.facet, said: message, calls, ms };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { id: input.row.id, observed: `error:${message.slice(0, 120)}`, facet: null, said: null, calls, ms };
  }
}

/** Findings that only exist once a drive has happened. */
export function drivenFindings(input: {
  staticAtlas: StaticAtlas;
  driven: DrivenAtlas;
  corpus: readonly CorpusRow[];
  committed?: CapabilityAtlas | null;
}): Finding[] {
  const findings: Finding[] = [];
  const byId = new Map(input.corpus.map((row) => [row.id, row]));
  const reached = new Set<string>();
  for (const obs of input.driven.observations) {
    const row = byId.get(obs.id)!;
    const id = outcomeId(obs.observed);
    if (id) reached.add(id);
    if (obs.observed.startsWith("error:")) {
      findings.push({ id: `drive-error:${obs.id}`, severity: "error", kind: "drive-error", subject: obs.id, message: `"${row.ask}" → ${obs.observed}` });
    } else if (obs.observed !== row.expect) {
      findings.push({
        id: `belief:${obs.id}`, severity: "warn", kind: "belief-mismatch", subject: obs.id,
        message: `"${row.ask}" — believed ${row.expect}, observed ${obs.observed}`,
      });
    }
    const prior = input.committed?.driven?.observations.find((o) => o.id === obs.id);
    if (prior && prior.observed !== obs.observed) {
      findings.push({
        id: `changed:${obs.id}`, severity: "error", kind: "route-changed", subject: obs.id,
        message: `"${row.ask}" — committed ${prior.observed}, now ${obs.observed}`,
      });
    }
  }
  for (const entry of input.staticAtlas.declared) {
    const expected = input.corpus.some((row) => outcomeId(row.expect) === entry.id);
    if (expected && !reached.has(entry.id)) {
      findings.push({
        id: `unreached-driven:${entry.id}`, severity: "warn", kind: "unreached", subject: entry.id,
        message: `a corpus row expects "${entry.id}" and the drive never produced it — the door may be unreachable`,
      });
    }
  }
  for (const nd of input.driven.notDriven) {
    findings.push({ id: `not-driven:${nd.id}`, severity: "info", kind: "not-driven", subject: nd.id, message: `needs state "${nd.state}", which this fixture cannot supply` });
  }
  /* Documentation that a drive falsifies is stale, loudly (fable-1357 §2b). */
  const documented = new Set(UNREACHABLE_DOORS.map((d) => d.id));
  for (const obs of input.driven.observations) {
    const id = outcomeId(obs.observed);
    if (id && documented.has(id)) {
      findings.push({
        id: `stale-doc:${obs.id}`, severity: "error", kind: "stale-unreachable-doc", subject: id,
        message: `"${id}" is documented UNREACHABLE and the drive just produced it on "${obs.id}" — the documentation is stale`,
      });
    }
  }
  if (input.driven.ledger.before !== input.driven.ledger.after) {
    findings.push({
      id: "ledger-moved", severity: "error", kind: "ledger-moved", subject: "fixture",
      message: `the fixture's ledger moved ${input.driven.ledger.before} → ${input.driven.ledger.after}: the census SPENT, which it must never do`,
    });
  }
  return findings.sort((a, b) => a.id.localeCompare(b.id));
}

/* ═══════════════════════════════════════════════════════════ the page */

export function renderCapabilityPage(atlas: CapabilityAtlas): string {
  const lines: string[] = [];
  lines.push("# What the studio can do today — the Capability Census");
  lines.push("");
  lines.push("Derived, never typed. Regenerate with `pnpm capability:generate --drive`; check with `pnpm capability:check`.");
  lines.push("A row's **observed** column is what the real refine entrance did with that sentence, claim door shut (nothing charged).");
  lines.push("");
  const d = atlas.driven;
  if (d) {
    lines.push(`Profile **${d.profile.name}** on fixture \`${d.profile.fixture}\`; flags: ${Object.entries(d.profile.flags).map(([k, v]) => `\`${k}=${v}\``).join(", ")}.`);
    lines.push("");
  } else {
    lines.push("_No drive recorded — static half only._");
    lines.push("");
  }
  /* ── the roads: how the studio works, every citation derived ── */
  lines.push("## How the studio works — the roads");
  lines.push("");
  lines.push("Prose is reviewed; every DOOR, FLAG and ENTRANCE below is validated against the source at generate time, and each door's sites/pins/reach are extracted, not written.");
  lines.push("");
  const byId = new Map(atlas.static.declared.map((d) => [d.id, d]));
  const reachers = (door: string) => atlas.static.corpus.filter((row) => outcomeId(row.expect) === door).map((row) => row.id);
  for (const road of atlas.static.roads) {
    lines.push(`### ${road.title}`);
    lines.push("");
    lines.push(road.summary);
    lines.push("");
    lines.push(`_Entrances:_ ${road.entrances.map((e) => `\`${e}\``).join(" · ")}  ·  _Flags:_ ${road.flags.map((f) => `\`${f}\``).join(" · ") || "—"}`);
    lines.push("");
    if (road.doors.length > 0) {
      lines.push("| door | kind | charge | where it lives | pinned | reached by |");
      lines.push("|---|---|---|---|---|---|");
      for (const door of road.doors) {
        const d = byId.get(door);
        const sites = (d?.sites ?? []).slice(0, 2).join("<br>") + ((d?.sites.length ?? 0) > 2 ? `<br>(+${(d!.sites.length) - 2})` : "");
        lines.push(`| \`${door}\` | ${d?.kind ?? "?"} | ${d?.charge ?? ""} | ${sites || "—"} | ${d ? (d.pinnedBy.length > 0 ? `${d.pinnedBy.length} test(s)` : "**none**") : "?"} | ${reachers(door).join(", ") || "_documented-unreachable or gap — see findings_"} |`);
      }
      lines.push("");
    }
    if (road.doorsNote) { lines.push(`> ${road.doorsNote}`); lines.push(""); }
    for (const note of road.notes) lines.push(`- ${note}`);
    lines.push("");
  }
  lines.push("## The laws that hold on every road");
  lines.push("");
  for (const law of atlas.static.laws) lines.push(`- **${law.law}** _(${law.where})_`);
  lines.push("");
  lines.push("## The asks");
  lines.push("");
  lines.push("| id | ask | state | believed | observed | what the customer reads |");
  lines.push("|---|---|---|---|---|---|");
  const obs = new Map((d?.observations ?? []).map((o) => [o.id, o]));
  const notDriven = new Set((d?.notDriven ?? []).map((n) => n.id));
  for (const row of atlas.static.corpus) {
    const o = obs.get(row.id);
    const observed = o ? (o.observed === row.expect ? o.observed : `**${o.observed}**`) : (notDriven.has(row.id) ? "_not driven_" : "_—_");
    const said = o?.said ? o.said.replace(/\|/g, "\\|").slice(0, 140) : "";
    const ask = row.scope ? `${row.ask} _(scope ${row.scope})_` : row.ask;
    lines.push(`| ${row.id} | ${ask.replace(/\|/g, "\\|")} | ${row.state} | ${row.expect} | ${observed} | ${said} |`);
  }
  lines.push("");
  lines.push("## Every door the source declares");
  lines.push("");
  lines.push("| id | kind | charge | pinned by |");
  lines.push("|---|---|---|---|");
  for (const entry of atlas.static.declared) {
    lines.push(`| ${entry.id} | ${entry.kind} | ${entry.charge ?? ""} | ${entry.pinnedBy.length ? entry.pinnedBy.map((f) => f.replace("server/castingV2/", "")).join(", ") : "**none**"} |`);
  }
  lines.push("");
  lines.push(`## Flags (${atlas.static.flags.length})`);
  lines.push("");
  lines.push(atlas.static.flags.map((f) => `\`${f}\``).join(" · "));
  lines.push("");
  lines.push(`## Findings (${atlas.findings.length})`);
  lines.push("");
  if (atlas.findings.length === 0) lines.push("_none_");
  for (const f of atlas.findings) lines.push(`- **${f.severity}** \`${f.kind}\` ${f.subject} — ${f.message}`);
  lines.push("");
  return `${lines.join("\n")}\n`;
}

/* ═══════════════════════════════════════════════════════════ io */

export function readCommittedAtlas(): CapabilityAtlas | null {
  if (!fs.existsSync(CAPABILITY_JSON)) return null;
  return JSON.parse(fs.readFileSync(CAPABILITY_JSON, "utf8")) as CapabilityAtlas;
}

/**
 * A line ending is a fact about the checkout, never about what the generator
 * produced — the generator writes LF and a Windows checkout hands it back with
 * CRLF (fable-1366 §3c, which cost one false "stale" verdict already). Named
 * and exported rather than inlined at each bite site, because that ruling's
 * whole content was that an inline copy beside one comparison is the defect
 * shape. `check-architecture.mts` keeps its own `LF_ONLY` on purpose: it is a
 * named function in its own module, and importing the capability library into
 * the architecture checker would couple two maps that share nothing else.
 */
export const lfOnly = (text: string): string => text.split("\r\n").join("\n");

/**
 * ⚠ IS THE COMMITTED PAGE A FAITHFUL RENDER OF THE COMMITTED CENSUS — and note
 * WHICH census (PR #201's review, finding 1).
 *
 * `writeAtlas` writes the JSON and the page together, so the invariant owed is
 * *the page derives from the committed census*. The obvious spelling —
 * comparing against a render of a FRESHLY COMPUTED atlas — is wrong here and
 * would have refused a page nobody touched: `drivenFindings` emits its
 * `changed:*` (route-changed) rows ONLY when handed a prior census, which
 * `--check` deliberately does not do, while `--drive` does. So a legitimate
 * re-drive after a route moves bakes `changed:*` into the page, and every later
 * check would recompute without them and report "stale or hand-edited" — the
 * exact class of misleading refusal #195 was opened to remove, planted one
 * checker over.
 *
 * The static half is NOT taken from the committed census: it is the one thing
 * a check must recompute, and the line above this call already reports it
 * separately when it drifts.
 */
export function committedPageIsFresh(
  committed: CapabilityAtlas,
  staticAtlas: StaticAtlas,
  pageText: string,
): boolean {
  return lfOnly(pageText) === lfOnly(renderCapabilityPage({ ...committed, static: staticAtlas }));
}

export function writeAtlas(atlas: CapabilityAtlas): void {
  fs.mkdirSync(CAPABILITY_OUT_DIR, { recursive: true });
  fs.writeFileSync(CAPABILITY_JSON, `${JSON.stringify(atlas, null, 2)}\n`);
  fs.writeFileSync(CAPABILITY_MD, renderCapabilityPage(atlas));
}
