/**
 * WHERE A STORAGE KEY IS MINTED — the derived population behind
 * `server/storage-key-generation.test.ts` (#1401).
 *
 * # ⚠ WHY THE OLD POPULATION WAS THE DEFECT
 *
 * That guard's population was ONE CALL SYNTAX:
 *
 *     .filter(({ source }) => /\bawait\s+storagePut\(/.test(source))
 *
 * and the assertions below it only ever run over the population. A file writing
 * `return storagePut(...)`, or reaching it through an injected dependency, was
 * not in it at all. **Measured 2026-09-26 at `origin/main`: it saw 8 of the 15
 * files that call `storagePut`.**
 *
 * The specimen is the uncomfortable one. `castingV2/packageOrchestrator.ts` mints
 * a cast's signed views and has been a storage writer since it was written; it
 * entered the guard's sight as a SIDE EFFECT of #1389 needing the key
 * `storagePut` returns, which turned a `return` into an `await`. Nothing about
 * the write moved.
 *
 * # ⚠ THE RULE, AND WHY IT IS NOT "EVERY FILE THAT CALLS storagePut"
 *
 * The card left this open on purpose: several `storagePut` callers take a key a
 * caller already made, so *"does this file call storagePut"* is not the question.
 * The question is *"does this file MINT a key, and does it mint it well"* — and
 * writing a rule for generator-versus-passer looked like inventing a taxonomy.
 *
 * **It is DISSOLVED instead of answered**, the way CLAUDE.md's price-reader
 * lesson dissolves *"what counts as a price"*: **the unit of judgement is the KEY
 * EXPRESSION, not the file.** A key passer contributes no key expression, so it
 * is simply not in the population — no rule is needed, and none is written.
 *
 * Measured, and the dissolution is visible in the answer: `inkReferenceMint.ts`
 * and `referenceAttachService.ts` both call `storagePut` and both drop out,
 * because each calls a key BUILDER (`inkDesignKey`, `referenceAttachmentKey`) —
 * and this population holds both builders. The key is judged where it is made.
 *
 * # HOW AN EXPRESSION IS FOUND — FIVE READERS AND TWO FILTERS
 *
 * A key expression is a template literal reached by any of:
 *
 *   1. it interpolates a `SCREAMING_CASE` constant whose name ends `_PREFIX`;
 *   2. it is bound to a name containing `key` (or `filename`);
 *   3. it is a `key:` property value;
 *   4. it is the first argument of a `storagePut(` call;
 *   5. it is `return`ed directly — a key builder's whole body.
 *
 * and then kept only if it **contains a `/`** and **ends in a filename shape** (a
 * literal extension, an interpolated one, or an interpolation whose name carries
 * `name`/`extension`).
 *
 * ⚠ **BOTH FILTERS WERE MEASURED RATHER THAN ASSUMED, AND EACH ONE CAUGHT THE
 * OTHER'S FALSE POSITIVES.** Without the `/`, reader 5 admitted two PROSE
 * templates that happen to end in `.${identifier}` —
 * `cohortPhotorealHuman.ts`'s *"…not an approximation.${guard}"* and
 * `inkStyleGlossary.ts`'s *"…${style.paint}.${not}"*. Without the filename
 * shape, the population went from 28 expressions to **47 in 37 files** and
 * filled with data URIs, GitHub API URLs, a CSV quoting helper and a port
 * string. Both numbers are from driving this reader over the real tree.
 *
 * # ⚠ THE JUDGEMENT IS NOT THE POPULATION — THAT WOULD BE CIRCULAR
 *
 * The obvious rule is *"a template containing `randomUUID()`"*, and it is the
 * wrong one: asserting randomness over a population DEFINED by randomness proves
 * nothing, and passes forever. So the population above is derived from NAMING —
 * which this codebase does consistently — and randomness is the thing then
 * judged.
 *
 * # WHAT IT IS, HONESTLY: A FLOOR
 *
 * A heuristic's remainder is enumerated, not pretended away. This reader cannot
 * follow a key through a helper it does not recognise, and it reads text rather
 * than a syntax tree. `storage-key-generation.test.ts` asserts a FLOOR on the
 * population size for exactly that reason: a reader that went blind and a tree
 * with nothing to find look identical (working law 2).
 */

/** One place a storage key is built, with which reader found it. */
export type KeyExpression = {
  /** Repo-relative, forward slashes. */
  file: string;
  /** The template literal's source text, backticks included. */
  text: string;
  /** Which reader(s) reached it — for a receipt, never for a decision. */
  by: string;
};

const BACKTICK = String.fromCharCode(96);

/** A template literal, crudely but completely: escapes honoured, no nesting. */
const TEMPLATE_SOURCE = `${BACKTICK}(?:[^${BACKTICK}\\\\]|\\\\.)*${BACKTICK}`;

/**
 * Ends in a filename shape — a literal extension, an interpolated one, or an
 * interpolation whose NAME carries `name`/`extension`.
 *
 * ⚠ The last limb exists for one measured key and is not speculative:
 * `routes/moderatorAttachments.ts` ends its key in `${sanitizedName}`, because
 * the uploaded file brings its own extension. Without it that key — a
 * moderator attachment on the public bucket — is outside the population.
 */
const ENDS_IN_A_FILENAME = new RegExp(
  "(?:"
  + "\\.(?:[A-Za-z0-9]{1,5}|\\$\\{[^}]*\\})"
  + "|\\$\\{[^}]*(?:[Nn]ame|[Ee]xtension)[^}]*\\}"
  + ")" + BACKTICK + "$",
);

/** (1) interpolates a `SCREAMING_CASE` constant whose name ends `_PREFIX`. */
const NAMES_A_PREFIX_CONSTANT = /\$\{[A-Z0-9_]*_PREFIX\}/;

/** (2) bound to a name containing `key`, or to `filename`. */
const BOUND_TO_A_KEY_NAME = new RegExp(
  `(?:const|let|var)\\s+(?:\\w*[Kk]ey\\w*|filename|fileName)\\s*(?::[^=]*)?=\\s*(${TEMPLATE_SOURCE})`,
  "g",
);

/** (3) a `key:` property value. */
const A_KEY_PROPERTY = new RegExp(`\\bkey\\s*:\\s*(${TEMPLATE_SOURCE})`, "g");

/** (4) the first argument of a storage write. */
const A_STORAGE_PUT_ARGUMENT = new RegExp(`storagePut\\(\\s*(${TEMPLATE_SOURCE})`, "g");

/** (5) returned directly — a key builder's whole body. */
const RETURNED_DIRECTLY = new RegExp(`return\\s+(${TEMPLATE_SOURCE})\\s*;`, "g");

/** Every template literal in a source, for reader 1. */
const EVERY_TEMPLATE = new RegExp(TEMPLATE_SOURCE, "g");

/**
 * Comments removed, so a rule written in PROSE is never read as a decision.
 *
 * ⚠ **THIS IS THE THIRD THING THE CARD ASKED FOR, AND IT IS NOT HYPOTHETICAL.**
 * The old guard's `not.toContain("Math.random")` is a raw substring test, and
 * two files in the widened population — `hairReferenceCutter.ts` and
 * `keptFaceScan.ts` — contain the string `Math.random` in a COMMENT that says
 * ***"`randomUUID`, never `Math.random`"***. So widening the population without
 * this would have reddened the guard on prose praising the rule it enforces:
 * the negation-contains-the-token class.
 */
export function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/** Does this file reach for `Math.random` in CODE, as opposed to in prose? */
export function usesMathRandom(source: string): boolean {
  return withoutComments(source).includes("Math.random");
}

/**
 * Every key expression in one file's source.
 *
 * Comments are stripped first: a docblock quoting a key template is prose about
 * a key, not a key — and this file's own docblock quotes several.
 */
export function keyExpressionsIn(file: string, rawSource: string): KeyExpression[] {
  const source = withoutComments(rawSource);
  const found: KeyExpression[] = [];

  const add = (text: string, by: string): void => {
    if (!text.includes("/")) return;
    if (!ENDS_IN_A_FILENAME.test(text)) return;
    const already = found.find((hit) => hit.text === text);
    if (already) {
      if (!already.by.includes(by)) already.by += `+${by}`;
      return;
    }
    found.push({ file, text, by });
  };

  for (const match of Array.from(source.matchAll(EVERY_TEMPLATE))) {
    if (NAMES_A_PREFIX_CONSTANT.test(match[0])) add(match[0], "prefix-constant");
  }
  for (const match of Array.from(source.matchAll(BOUND_TO_A_KEY_NAME))) add(match[1], "key-name");
  for (const match of Array.from(source.matchAll(A_KEY_PROPERTY))) add(match[1], "key-property");
  for (const match of Array.from(source.matchAll(A_STORAGE_PUT_ARGUMENT))) add(match[1], "storage-put-arg");
  for (const match of Array.from(source.matchAll(RETURNED_DIRECTLY))) add(match[1], "returned");

  return found;
}

/**
 * Does this key expression carry randomness?
 *
 * Either `randomUUID()` sits in the template, or the template interpolates a
 * bare identifier the same file binds to something calling it.
 *
 * ⚠ **THE SECOND LIMB IS NOT A CONVENIENCE — IT IS FIVE OF THE TEN KEYS THAT
 * LACK AN INLINE CALL.** `routes/wardrobe.ts` (four keys) and
 * `wardrobe/outfitDecomposition.ts` write `const suffix = randomUUID()` a line
 * or two above and then interpolate `${suffix}`. Those keys ARE random, and
 * putting them on an exception list would be filing five correct writers as
 * remainder — which is how an exception list stops being read.
 */
export function carriesRandomness(expression: KeyExpression, rawSource: string): boolean {
  if (expression.text.includes("randomUUID()")) return true;
  const source = withoutComments(rawSource);
  /* `Array.from` because one tsconfig that reads this file targets below ES2015
     and cannot iterate a `matchAll` result directly — the house idiom here. */
  for (const interpolation of Array.from(expression.text.matchAll(/\$\{([^}]*)\}/g))) {
    const name = interpolation[1].trim();
    /* A bare identifier only. `${input.operationId}` is a value from elsewhere
       and this reader cannot follow it — that is what the exception list is for. */
    if (!/^[A-Za-z_$][\w$]*$/.test(name)) continue;
    const binding = new RegExp(
      `(?:const|let|var)\\s+${name}\\s*(?::[^=]*)?=\\s*[^;\\n]*randomUUID\\(\\)`,
    );
    if (binding.test(source)) return true;
  }
  return false;
}
