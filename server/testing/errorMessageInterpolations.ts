/**
 * A CUSTOMER'S SENTENCE INTERPOLATED INTO AN ERROR MESSAGE — the derived
 * population behind `server/errorMessageInterpolation.test.ts` (#1406).
 *
 * # What this closes, and it is a hole rather than a defect
 *
 * `shared/errorEventScrub.ts` refuses an error report carrying a field NAMED
 * `masterPrompt`, `brief`, `prompt` and the rest of `REFUSING_KEYS`. It works
 * because those are field names — our own code's labels — so their presence is
 * always our wiring and never a coincidence of English. Its own docblock says
 * what it therefore cannot see:
 *
 *     throw new Error(`the author refused: ${brief}`)
 *
 * Her sentence is inside the message, with no field name anywhere near it, and
 * it travels. The message is capped at 1,000 characters, **and a cap is a bound
 * rather than a proof** — a sentence fits easily.
 *
 * ⚠ **NOBODY HAS DONE THIS.** Measured over the whole tree the day this was
 * written: **733 template literals in an error or log context across 1,872
 * files, and ZERO of them name a refusing key.** This is the hole closed before
 * it is used, and the negative control is the reading that says so.
 *
 * # THE ASYMMETRY THIS LIVES OR DIES ON — it reads EXPRESSIONS, never strings
 *
 * ⚠ Getting this backwards would own a real word and refuse legitimate code,
 * which is the failure the scrub's own design notes warn about twice and which
 * the `shave`→`shape` typo gate committed for real against the founder's own
 * ask. So the unit of judgement is an **interpolated expression's NAMES**,
 * matched **exactly** and case-insensitively:
 *
 *   `` `prompt author failed` ``        prose — passes, and must
 *   `` `${briefCompiler.name} died` ``  `briefCompiler` ≠ `brief` — passes
 *   `` `refused: ${brief}` ``           the leak
 *   `` `refused: ${cast.masterPrompt}` `` the leak, through a property
 *   `` `refused: ${row["prompt"]}` ``   the leak, through an element access
 *
 * A substring test would fail every one of the first two. That is why this
 * reader parses with TypeScript's own parser rather than matching text: the
 * distinction between *a word in prose* and *an identifier in an expression*
 * is a syntactic one, and a dedicated parser is the tool that already knows it
 * (the fidelity law — the convenient substitute caps the ceiling of everything
 * built on it).
 *
 * # WHERE IT LOOKS — a rule, not a list of three names
 *
 * The card named `new Error(...)`, `TRPCError({ message })` and `log.*`. Read
 * at the tree, those three are a LIST where a rule exists: `TRPCError` is
 * constructed with `new` like every other one, and this repository throws
 * **36 distinct error constructors** — `MaskError` (43 templates),
 * `ReferenceLibraryShapeError` (17), `ProviderError` (8), a
 * `…CoverageError` per feature flag. A guard naming only `Error` and
 * `TRPCError` would have covered 343 of the 516 error-context templates and
 * been silent on the rest, which is the second-list shape working law 4 is
 * about. So the rule is **any constructor whose name ends in `Error`**, plus
 * any `log.*` / `logger.*` call.
 *
 * # TWO SHAPES, AND THE SECOND IS BEYOND THE CARD'S LITERAL TEXT
 *
 * 1. **An interpolation** — `` new Error(`refused: ${brief}`) ``. The card's.
 * 2. **A bare argument** — `new Error(brief)`. Not an interpolation, and
 *    STRICTLY WORSE: it hands over the whole value rather than one span. A
 *    guard refusing `${brief}` while allowing `brief` would be indefensible.
 *    Measured before it was added: **764 non-literal arguments to an error
 *    constructor in this tree and zero of them name a refusing key**, so it
 *    costs nothing today and is named on the PR rather than folded in quietly.
 *
 * # ITS FLOOR, STATED RATHER THAN LEFT TO BE DISCOVERED
 *
 * ⚠ **This is SYNTACTIC, so a value laundered through a helper is invisible to
 * it.** `throw new Error(describe(cast))`, where `describe` returns the brief,
 * names nothing on the list at the throw site and passes. Closing that wants
 * type information and a call graph, which is a different instrument. **A
 * clean run here is a floor, not coverage** — the projection and the key scan
 * in `shared/errorEventScrub.ts` are what stand behind it, and the cap bounds
 * what fits either way.
 */
import { execFileSync } from "node:child_process";
import { join } from "node:path";

import ts from "typescript";

import { REFUSING_KEYS } from "../../shared/errorEventScrub";
import { readListedSource } from "./listedSource";

/**
 * Where production source lives. Tests are OUT, and deliberately: a test
 * constructs the leak shape on purpose — this module's own positive control
 * does — and a test's error message reaches no customer, no log drain and no
 * error tracker. Including them would make the guard's own fixture redden it.
 */
export const SOURCE_ROOTS = ["server/", "shared/", "client/src/", "scripts/"] as const;

/**
 * Sites this guard may not indict, each with its reason. **It only shrinks**
 * (the card's own bar), which is why it is a typed list rather than a regex:
 * removing a line is a one-word edit and adding one has to be argued for.
 *
 * It is EMPTY, and that is the measurement rather than an aspiration — the
 * tree as it stands has no site to excuse.
 */
export const ALLOWLIST: readonly { file: string; line: number; why: string }[] = [];

/** The population, derived from the scrub's own constant and never re-typed. */
const REFUSING_KEY_SET = new Set(REFUSING_KEYS.map((key) => key.toLowerCase()));

export type LeakSite = {
  /** Repo-relative, forward-slashed. */
  file: string;
  /** 1-indexed, so it is clickable. */
  line: number;
  /** `new Error`, `new TRPCError`, `log.error` — where it would travel from. */
  context: string;
  /** The offending expression's own source text. */
  expression: string;
  /** Which refusing key it names. */
  key: string;
  /** `interpolation` or `argument` — see the header's two shapes. */
  shape: "interpolation" | "argument";
};

export type InterpolationReading = {
  sites: LeakSite[];
  /** How many files were read. A floor: zero means the walk found nothing. */
  files: number;
  /** How many error/log contexts were found. The other floor. */
  contexts: number;
};

/**
 * The names an expression MENTIONS: every identifier, every property name, and
 * every string literal used as a key. `cast.masterPrompt` yields both `cast`
 * and `masterPrompt`; `row["prompt"]` yields `row` and `prompt`.
 *
 * A property name needs no case of its own — `cast.masterPrompt`'s `name` is
 * itself an `Identifier` and `forEachChild` reaches it — which the sabotage
 * driver established rather than the reading; see the note in the body.
 */
function namesMentionedIn(node: ts.Node, skipTemplates = false): string[] {
  const out: string[] = [];
  const walk = (child: ts.Node): void => {
    /* ⚠ THE TWO SHAPES OVERLAP AND THIS IS WHERE THEY ARE SEPARATED. A bare
       argument can CONTAIN a template — `new Error(rows.map((r) =>
       `${r.brief}`).join())` — and the interpolation shape already judges
       every template in an error context, wherever it is nested. Without this
       the one leak is reported twice, which the arm for exactly that case
       caught. Shape 2's job is the value handed over that shape 1 cannot see. */
    if (skipTemplates && ts.isTemplateExpression(child)) return;
    /* ⚠ A PROPERTY NAME NEEDS NO BRANCH OF ITS OWN, AND ONE WAS HERE UNTIL THE
       SABOTAGE PROVED IT COULD NOT CHANGE AN ANSWER. `cast.masterPrompt` is a
       PropertyAccessExpression whose `name` IS an `Identifier`, and
       `forEachChild` visits it — so the line above already yields both `cast`
       and `masterPrompt`. Deleting a `${cast.brief}` branch left every arm
       green, which is how a line that looks load-bearing is found not to be.
       The string-literal branch below is NOT redundant: `row["brief"]` reaches
       its key as a literal and no identifier branch can see it, and its own
       sabotage case reddens. */
    if (ts.isIdentifier(child)) out.push(child.text);
    else if (ts.isStringLiteral(child)) out.push(child.text);
    ts.forEachChild(child, walk);
  };
  walk(node);
  return out;
}

function refusingKeyNamedBy(node: ts.Node, skipTemplates = false): string | null {
  for (const name of namesMentionedIn(node, skipTemplates)) {
    if (REFUSING_KEY_SET.has(name.toLowerCase())) return name;
  }
  return null;
}

/**
 * The enclosing error or log call, or `null`.
 *
 * ⚠ **THE WALK DOES NOT STOP AT A FUNCTION BOUNDARY, AND THAT WAS MEASURED
 * RATHER THAN ASSUMED.** An earlier shape stopped at the nearest enclosing
 * function, which loses `` new Error(rows.map((r) => `${r.brief}`).join()) ``
 * — the template sits inside an arrow inside the call. Removing the stop found
 * **8 more contexts** and introduced no false positive, because the walk only
 * climbs ANCESTORS: a template that is a sibling argument of an error is never
 * inside it.
 */
function enclosingContext(node: ts.Node): string | null {
  for (let parent: ts.Node | undefined = node.parent; parent; parent = parent.parent) {
    if (ts.isNewExpression(parent) && ts.isIdentifier(parent.expression)) {
      if (parent.expression.text.endsWith("Error")) return `new ${parent.expression.text}`;
    }
    if (ts.isCallExpression(parent) && ts.isPropertyAccessExpression(parent.expression)) {
      const object = parent.expression.expression;
      if (ts.isIdentifier(object) && /^(log|logger)$/i.test(object.text)) {
        return `log.${parent.expression.name.text}`;
      }
    }
  }
  return null;
}

/** Every leak site in one file. Exported so the arms can drive a fixture. */
export function leaksIn(file: string, source: string): LeakSite[] {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes — `enclosingContext` walks upward and cannot without it. */ true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const sites: LeakSite[] = [];
  const record = (node: ts.Node, context: string, shape: LeakSite["shape"]): void => {
    const key = refusingKeyNamedBy(node, shape === "argument");
    if (key === null) return;
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    sites.push({
      file,
      line: line + 1,
      context,
      expression: node.getText(sourceFile),
      key,
      shape,
    });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isTemplateExpression(node)) {
      const context = enclosingContext(node);
      if (context !== null) {
        for (const span of node.templateSpans) record(span.expression, context, "interpolation");
      }
    }

    /* Shape 2 — a whole value handed to an error constructor. A literal
       argument is skipped here because shape 1 already judged it. */
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
      if (node.expression.text.endsWith("Error")) {
        for (const argument of node.arguments ?? []) {
          if (
            ts.isTemplateExpression(argument) ||
            ts.isStringLiteral(argument) ||
            ts.isNoSubstitutionTemplateLiteral(argument)
          ) {
            continue;
          }
          record(argument, `new ${node.expression.text}`, "argument");
        }
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return sites;
}

function isExcused(site: LeakSite): boolean {
  return ALLOWLIST.some((row) => row.file === site.file && row.line === site.line);
}

/**
 * Walk the tracked production source and report every site.
 *
 * Reads through `readListedSource` because a file a listing named can be gone
 * by the time you read it — this working tree is shared by several sessions
 * and carries hundreds of untracked disposables (#223).
 */
export function errorMessageLeaks(repoRoot: string): InterpolationReading {
  const tracked = execFileSync("git", ["ls-files", "*.ts", "*.tsx"], {
    encoding: "utf8",
    cwd: repoRoot,
    maxBuffer: 32 * 1024 * 1024,
  })
    .split("\n")
    .map((line) => line.trim().replace(/\\/g, "/"))
    .filter((line) => line.length > 0)
    .filter((line) => SOURCE_ROOTS.some((root) => line.startsWith(root)))
    .filter((line) => !/\.test\.tsx?$/.test(line));

  const sites: LeakSite[] = [];
  let files = 0;
  let contexts = 0;

  for (const file of tracked) {
    const source = readListedSource(join(repoRoot, file));
    if (source === null) continue;
    files += 1;
    contexts += countContexts(file, source);
    for (const site of leaksIn(file, source)) {
      if (!isExcused(site)) sites.push(site);
    }
  }

  return { sites, files, contexts };
}

/**
 * How many error/log contexts the walk saw. This is the FLOOR, and it is the
 * reason the reading carries a number at all: a reader that silently stopped
 * parsing would report zero sites, which is byte-identical to a clean tree.
 */
export function countContexts(file: string, source: string): number {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  let found = 0;
  const visit = (node: ts.Node): void => {
    if (ts.isTemplateExpression(node) && enclosingContext(node) !== null) found += 1;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}
