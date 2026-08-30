import { readFile, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, extname } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * EVERY CLASS THIS STYLESHEET DECLARES IS EMITTED BY SOMETHING.
 *
 * #210, and the class rather than its instance. #198 found ONE broken rule
 * (`.dpc-modal__portrait > img`, a child combinator against a DOM with a
 * wrapper in it) and its law-7 sweep turned up four rules whose class had no
 * emitter at all. Read mechanically over the whole sheet, the real population
 * was TWENTY-TWO classes and thirty-three rules — corpses of surfaces that were
 * genuinely shipped and then moved: `52d3e6c4` took Sign to the dock,
 * `b974e882` rebuilt the delete and rename dialogs, `63f5f554` rebuilt the
 * room. Every one of them had an emitter once (`git log -S`, all of them, not a
 * sample), so none was scaffolding for the unbuilt design north star. They were
 * deleted; this stops the next refactor leaving its own.
 *
 * ⚠ THE TWENTY-SECOND WAS FOUND BY THIS GUARD'S OWN GATE REVIEW, and it is the
 * best argument for the guard existing. `dpc-face__words--absent` was the
 * "bald" row (founder, fable-889); fable-904 took the row out and the emitter
 * went with the ruling, correctly — leaving the rule, and a CSS comment still
 * describing the behaviour in the present tense while the JSX one file over
 * carried the corrected history. The FIRST version of this reader could not see
 * it, because its only remaining mention was prose inside a comment and the
 * source side did not strip comments. A guard with a blind spot toward silence
 * finds twenty-one of twenty-two and reports done.
 *
 * WHY A GUARD AND NOT JUST THE DELETION. Dead CSS is cheap on its own — bytes
 * in one stylesheet. What it is not cheap on is READING: `.dpc-sign__portrait`
 * sat one character from the live `.dpc-modal__portrait` for months, so
 * anybody grepping for the sign portrait's rule found two and had no way to
 * tell which one painted. That is the cost, and it recurs on every rename.
 *
 * WHY THE TOLERATED LIST IS EMPTY. It is a real list with the shrink-only
 * doctrine this repo uses elsewhere (`KNOWN_DEBTS`, `DECLARED_BUT_UNMIGRATED`,
 * `LEGACY_ACCEPT_LITERALS`) — but it starts empty, because all twenty-two were
 * deleted rather than tolerated. A class added to it needs a reason on the
 * line, and a class that stops being dead is an ERROR until its line goes.
 *
 * WHAT THIS GUARD IS NOT. It does not claim a class that IS emitted is
 * REACHED — a component nothing renders still emits its classes. That is the
 * module graph's question and knip's job (#106, #108); this one is only
 * whether anything in the product ever writes the name.
 */

const HERE = fileURLToPath(new URL(".", import.meta.url));
const SHEET = join(HERE, "castingV2.css");
const CLIENT_SRC = fileURLToPath(new URL("../../", import.meta.url));
const SERVER = fileURLToPath(new URL("../../../../server/", import.meta.url));
const SHARED = fileURLToPath(new URL("../../../../shared/", import.meta.url));

const SOURCE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".html"]);

/**
 * Classes that are declared, dead, and tolerated anyway — each with the reason
 * on its own line. EMPTY, and it only ever shrinks: `tolerated entries are
 * still dead` below turns a tolerated class that gained an emitter into a
 * failure, so this can never quietly become a list of things nobody rechecked.
 */
const TOLERATED_DEAD: Array<{ className: string; why: string }> = [];

/**
 * Every class name the stylesheet declares, taken from SELECTOR position only.
 *
 * CONDITIONAL GROUP AT-RULES ARE TRANSPARENT. `@media`, `@supports`, `@layer`
 * and `@container` wrap ordinary rules, so a class declared only inside one is
 * still declared. Collecting at brace-depth 0 alone would make such a class
 * invisible to this guard FOREVER — never flagged whether dead or alive, which
 * is a blind spot toward silence, and this whole guard exists because blind
 * spots toward silence are where corpses hide. (Caught by the gate review on
 * the PR that added this file; the blind population was empty at the time, and
 * an empty population is exactly the argument that was wrong about the
 * composed-prefix exemption above.)
 *
 * A DECLARATION at-rule (`@keyframes`, `@font-face`, `@property`) is NOT
 * transparent — its inner blocks are keyframe stops and descriptors, not
 * selectors, and treating them as selectors would invent classes.
 */
const TRANSPARENT_AT_RULE = /^@(media|supports|layer|container|scope)\b/i;

export function declaredClasses(css: string): string[] {
  const found = new Set<string>();
  /** One entry per open brace: does its BODY hold selectors? */
  const stack: boolean[] = [];
  const inSelectorPosition = () => stack.every((transparent) => transparent);
  let selector = "";
  let i = 0;
  while (i < css.length) {
    if (css[i] === "/" && css[i + 1] === "*") {
      // A class named inside a comment is prose, not a declaration. The
      // stylesheet is heavily commented and several comments quote selectors.
      const end = css.indexOf("*/", i + 2);
      i = end === -1 ? css.length : end + 2;
      continue;
    }
    if (css[i] === "{") {
      const text = selector.trim();
      const isAtRule = text.startsWith("@");
      if (inSelectorPosition() && !isAtRule) {
        for (const m of selector.matchAll(/\.([A-Za-z_][A-Za-z0-9_-]*)/g)) found.add(m[1]);
      }
      stack.push(isAtRule ? TRANSPARENT_AT_RULE.test(text) : false);
      selector = "";
      i += 1;
      continue;
    }
    if (css[i] === "}") {
      stack.pop();
      selector = "";
      i += 1;
      continue;
    }
    if (inSelectorPosition()) selector += css[i];
    i += 1;
  }
  return [...found].sort();
}

/**
 * Sites where a `dpc-` token is followed by an interpolation. Reported in the
 * failure message ONLY — they do not vouch for anything, and that is a finding
 * rather than caution.
 *
 * The obvious design is a prefix exemption: `` `dpc-face__cut${x}` `` vouches
 * for every declared class starting `dpc-face__cut`. It was built that way and
 * then measured, and the measurement killed it — THERE IS NOT ONE
 * SUFFIX-COMPOSED CLASS NAME IN THIS PRODUCT. All four sites are something
 * else:
 *
 *   `dpc-face__cut${cond ? " dpc-face__cut--cutout" : ""}`   a conditional
 *   `dpc-rollrail__item${shown ? " is-shown" : ""}`          EXTRA class, every
 *                                                           token a literal
 *   `dpc-face-sides-${keyOf(row)}`     an `id`/`aria-controls`, not a class
 *   `dpc-settings-style-${option}`     an `id`, not a class
 *
 * So the exemption would have had an empty population — a carve-out that
 * vouches for nothing today and silently vouches for a whole family the day
 * someone writes one. A class that really is composed shows up here as dead
 * and goes in TOLERATED_DEAD with its site named, which is the outcome that
 * writes the reason down instead of hiding it.
 */
export function interpolatedSites(sources: Array<{ path: string; text: string }>): string[] {
  const out = new Set<string>();
  for (const { path, text } of sources) {
    for (const m of text.matchAll(/[`"']((?:dpc-)[A-Za-z0-9_-]*)\$\{/g)) out.add(`${m[1]}\${…}  (${path})`);
  }
  return [...out].sort();
}

/**
 * A class is EMITTED if its exact token appears in a source file — except in a
 * line that only ASSERTS ITS ABSENCE. That carve-out is not hypothetical: when
 * this sweep ran, `dockAnatomy.test.ts` held
 * `expect(source).not.toContain("dpc-dock__thumb")`, and a plain substring
 * search reads a corpse-guard as a live emitter. Two of the twenty-one were
 * hidden exactly that way.
 */
/**
 * Text a class name may NOT count as emitted from, removed before the search.
 *
 * Two shapes, both found by the gate review, both failing toward SILENCE — a
 * corpse quietly vouched live, which is the one direction a dead-code guard
 * must not fail in:
 *
 *  - **an absence assertion**, `expect(x).not.toContain("dpc-foo")`. Doing this
 *    line by line worked only because both live sites happened to fit on one
 *    line; a formatter wrapping the argument would have put the token on a line
 *    with no `not.toContain` on it and the corpse-guard would have read as an
 *    emitter.
 *  - **a comment**. The CSS side has always stripped comments; the source side
 *    did not, which was an asymmetry with a LIVE instance — this file's own
 *    docblock names `.dpc-refine__read`, so had that rule ever come back, this
 *    guard's prose would have vouched for it.
 *
 * Both removals are deliberately blunt. Over-removing can only hide a REAL
 * emitter, which makes a live class read as dead and fails loudly; under-
 * removing hides a corpse and passes green. When a stripper must be wrong, it
 * should be wrong toward the noisy side.
 */
function scannable(text: string): string {
  return text
    .replace(/\.not\s*\.\s*toContain\s*\([^)]*\)/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1 ");
}

export function emittersOf(
  className: string,
  sources: Array<{ path: string; text: string }>,
): Array<{ path: string; line: string }> {
  const token = new RegExp(`(^|[^A-Za-z0-9_-])${className.replace(/-/g, "\\-")}([^A-Za-z0-9_-]|$)`);
  const hits: Array<{ path: string; line: string }> = [];
  for (const { path, text } of sources) {
    if (!text.includes(className)) continue;
    for (const line of scannable(text).split(/\r?\n/)) {
      if (!token.test(line)) continue;
      hits.push({ path, line: line.trim() });
    }
  }
  return hits;
}

/**
 * Every `dpc-`-shaped token the sources actually write, indexed once.
 *
 * `emittersOf` answers "where", which the fixture arms want; asking it once per
 * declared class is O(classes x files) and measured at 395 ms over 322 classes
 * and ~500 files — fine alone, marginal against vitest's 5 s default when
 * `pnpm test` runs this beside everything else. The index answers "whether" in
 * one pass, and both readers strip the same non-emitting text so they cannot
 * disagree about what counts.
 */
function emittedTokens(sources: Array<{ path: string; text: string }>): Set<string> {
  const out = new Set<string>();
  for (const { text } of sources) {
    for (const m of scannable(text).matchAll(/[A-Za-z_][A-Za-z0-9_-]*/g)) out.add(m[0]);
  }
  return out;
}

export function deadClasses(
  css: string,
  sources: Array<{ path: string; text: string }>,
): string[] {
  const emitted = emittedTokens(sources);
  return declaredClasses(css).filter((name) => !emitted.has(name));
}

/*
  ONE WALK PER ROOT, SHARED BY EVERY ARM.

  Four arms each read the same ~500 files, which costs nothing when this file
  runs alone (1.4s) and times out when it runs inside `pnpm test` — measured:
  the same 15 arms took 9.6s under parallel load, and on the run before that
  three of them blew vitest's 5s default and reported as FAILURES. A guard that
  goes red because the machine was busy is worse than no guard, because the next
  shift learns to disregard it.

  Cached by root rather than by call, so the arms cannot drift onto different
  populations either.
*/
const walks = new Map<string, Promise<Array<{ path: string; text: string }>>>();

function collect(root: string): Promise<Array<{ path: string; text: string }>> {
  const cached = walks.get(root);
  if (cached) return cached;
  const started = walkRoot(root);
  walks.set(root, started);
  return started;
}

async function walkRoot(root: string): Promise<Array<{ path: string; text: string }>> {
  const out: Array<{ path: string; text: string }> = [];
  async function walk(dir: string) {
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === "node_modules" || entry === "dist" || entry === ".git") continue;
      const p = join(dir, entry);
      const st = await stat(p).catch(() => null);
      if (!st) continue;
      if (st.isDirectory()) {
        await walk(p);
        continue;
      }
      if (!SOURCE_EXT.has(extname(entry))) continue;
      out.push({ path: p, text: await readFile(p, "utf8") });
    }
  }
  await walk(root);
  return out;
}

/* 60s because this suite WALKS THE TREE and vitest's default is 5s (#216's class,
   measured 2026-08-29 under a full `pnpm test`: this suite's slowest arm TIMED OUT; 248ms alone). */
describe("castingV2.css declares no class the product never emits", { timeout: 60_000 }, () => {
  it("has no dead class outside the tolerated list", async () => {
    const css = await readFile(SHEET, "utf8");
    const sources = await collect(CLIENT_SRC);
    const tolerated = new Set(TOLERATED_DEAD.map((t) => t.className));

    const dead = deadClasses(css, sources).filter((n) => !tolerated.has(n));

    expect(
      dead,
      `These classes are declared in castingV2.css and emitted nowhere in client/src.\n` +
        `Delete the rules, or add each to TOLERATED_DEAD with the reason on its line.\n` +
        `If one is built from parts, the reader cannot see it — name its site in the reason.\n` +
        dead.map((n) => `  .${n}`).join("\n") +
        `\ninterpolated dpc- sites (they vouch for nothing — see the docblock):\n` +
        interpolatedSites(sources).map((s) => `  ${s}`).join("\n"),
    ).toEqual([]);
  });

  it("tolerated entries are still dead — the list only shrinks", async () => {
    const css = await readFile(SHEET, "utf8");
    const sources = await collect(CLIENT_SRC);
    const dead = new Set(deadClasses(css, sources));
    for (const { className, why } of TOLERATED_DEAD) {
      expect(
        dead.has(className),
        `.${className} is tolerated as dead (${why}) but something emits it now — delete its line.`,
      ).toBe(true);
    }
  });

  it("reads a real population — a parser that returns nothing cannot pass green", async () => {
    /*
      The failure this floor exists for is the one every derived-population
      guard in this repo has had: the reader stops matching, the population
      becomes empty, `[]` equals `[]`, and the suite reports PASS over a
      stylesheet nobody checked. 322 classes stood the day this landed.
    */
    const css = await readFile(SHEET, "utf8");
    const classes = declaredClasses(css);
    expect(classes.length).toBeGreaterThan(250);
    expect(classes).toContain("dpc-modal__portrait");

    const sources = await collect(CLIENT_SRC);
    expect(sources.length).toBeGreaterThan(400);
  });

  it("its two readers agree about what counts as emitted", async () => {
    /*
      `deadClasses` asks WHETHER through a one-pass token index; `emittersOf`
      asks WHERE with a per-class regex. The index exists because asking the
      locator once per class is O(classes x files) — 1,210 ms against 451 ms
      measured, which matters only because three arms of this file have already
      blown vitest's 5 s default under `pnpm test`'s parallel load and reported
      as failures rather than as slowness.

      Two mechanisms answering one question drift, so the agreement is asserted
      on the REAL tree rather than assumed. Declared honestly: they are not
      independent — both strip through `scannable`, so a fault in the stripper
      moves both together and this arm would not see it. What it does catch is
      the tokeniser and the regex disagreeing about a boundary, which is the
      likelier mistake and the one that would quietly resurrect a corpse.
    */
    const css = await readFile(SHEET, "utf8");
    const sources = await collect(CLIENT_SRC);
    const byIndex = new Set(deadClasses(css, sources));
    const byLocator = declaredClasses(css).filter((n) => emittersOf(n, sources).length === 0);
    expect([...byIndex].sort()).toEqual(byLocator.sort());
  });

  it("scopes to client/src because nothing else names a dpc- class", async () => {
    /*
      The guard searches client/src alone. That is only sound while no class
      name is written on the server, so the scope is PROVEN here rather than
      assumed — the shape of finding the one blind spot a scoped reader has.
    */
    for (const root of [SERVER, SHARED]) {
      const sources = await collect(root);
      const namers = sources.filter((s) => /["'`]dpc-[A-Za-z0-9_-]/.test(s.text));
      expect(
        namers.map((s) => s.path),
        `A dpc- class is named outside client/src, so this guard's scope is now a blind spot.`,
      ).toEqual([]);
    }
  });
});

describe("the reader itself", () => {
  /*
    Working law 2: the instrument gets its controls before its verdicts count.
    These drive the pure functions with fixtures, because the real tree is
    (correctly) clean and a clean tree exercises none of the interesting paths.
  */
  it("finds a class that nothing emits", () => {
    const css = ".dpc-live { color: red; }\n.dpc-corpse { color: blue; }";
    const sources = [{ path: "a.tsx", text: `<div className="dpc-live" />` }];
    expect(deadClasses(css, sources)).toEqual(["dpc-corpse"]);
  });

  it("does not count an absence assertion as an emitter", () => {
    const css = ".dpc-corpse { color: blue; }";
    const sources = [
      { path: "a.test.ts", text: `expect(source).not.toContain("dpc-corpse");` },
    ];
    expect(deadClasses(css, sources)).toEqual(["dpc-corpse"]);
  });

  it("counts the CONDITIONAL-extra-class shape as emitting both its literals", () => {
    /*
      The shape this product actually writes, and the reason the prefix
      exemption was deleted: both tokens are literals, so the plain token search
      already sees them and no carve-out is needed.
    */
    const css = ".dpc-face__cut { color: red; }\n.dpc-face__cut--cutout { color: blue; }";
    const sources = [
      { path: "a.tsx", text: 'className={`dpc-face__cut${crop ? " dpc-face__cut--cutout" : ""}`}' },
    ];
    expect(deadClasses(css, sources)).toEqual([]);
  });

  it("reports a genuinely composed class as DEAD rather than silently excusing it", () => {
    /*
      The declared limit. A suffix-composed name is invisible to a token
      search, and the honest answer is to FAIL and make somebody write the
      reason into TOLERATED_DEAD — not to vouch for every sibling of a prefix.
      An interpolated site is reported beside the failure so the reader knows
      why the class looks dead.
    */
    const css = ".dpc-face__cutLeft { color: red; }";
    const sources = [{ path: "a.tsx", text: "className={`dpc-face__cut${side}`}" }];
    expect(deadClasses(css, sources)).toEqual(["dpc-face__cutLeft"]);
    expect(interpolatedSites(sources)).toEqual(["dpc-face__cut${…}  (a.tsx)"]);
  });

  it("does not read a class named only in a CSS comment as declared", () => {
    const css = "/* .dpc-ghost was renamed away */\n.dpc-live { color: red; }";
    expect(declaredClasses(css)).toEqual(["dpc-live"]);
  });

  it("sees a class declared ONLY inside a conditional at-rule", () => {
    /*
      Gate-review note 1. Collecting at brace-depth 0 alone made an @media-only
      class invisible forever — never flagged dead OR alive. The blind
      population was empty when it was found, which is precisely the argument
      that was wrong about the composed-prefix exemption.
    */
    const css = "@media (max-width: 720px) {\n  .dpc-narrowOnly { display: none; }\n}";
    expect(declaredClasses(css)).toEqual(["dpc-narrowOnly"]);
    expect(deadClasses(css, [{ path: "a.tsx", text: "nothing here" }])).toEqual(["dpc-narrowOnly"]);
  });

  it("does not invent classes out of a @keyframes body", () => {
    /*
      The other half of note 1: a DECLARATION at-rule is not transparent. Its
      inner blocks are stops and descriptors, not selectors — the fix for one
      blind spot must not manufacture a population out of the other.
    */
    const css =
      "@keyframes dpc-spin { from { transform: rotate(0); } to { transform: rotate(1turn); } }\n" +
      "@font-face { font-family: Inter; src: url(x.woff2); }\n" +
      ".dpc-live { color: red; }";
    expect(declaredClasses(css)).toEqual(["dpc-live"]);
  });

  it("does not count a WRAPPED absence assertion as an emitter", () => {
    /*
      Gate-review note 2. The carve-out used to be line-based, so a formatter
      breaking the argument onto its own line put the token on a line with no
      `not.toContain` on it — and the corpse-guard read as a live emitter.
    */
    const css = ".dpc-corpse { color: blue; }";
    const sources = [
      {
        path: "a.test.ts",
        text: 'expect(source).not.toContain(\n  "dpc-corpse",\n);',
      },
    ];
    expect(deadClasses(css, sources)).toEqual(["dpc-corpse"]);
  });

  it("does not count a class named only in a SOURCE comment as an emitter", () => {
    /*
      Gate-review note 3, and it had a live instance: this file's own docblock
      names `.dpc-refine__read`, so the guard's prose would have vouched for
      that corpse had its rule ever returned. The CSS side stripped comments
      from the day it was written; the source side did not.
    */
    const css = ".dpc-corpse { color: blue; }";
    const block = [{ path: "a.tsx", text: "/* .dpc-corpse was renamed away */" }];
    const line = [{ path: "b.tsx", text: "// dpc-corpse used to live here" }];
    expect(deadClasses(css, block)).toEqual(["dpc-corpse"]);
    expect(deadClasses(css, line)).toEqual(["dpc-corpse"]);
  });

  it("does not strip a URL as if it were a line comment", () => {
    /*
      The control on the blunt stripper: `https://` must not be eaten, or a
      className sitting after one on the same line would vanish and a LIVE
      class would read as dead. That direction fails loudly rather than
      silently, which is why the stripper is allowed to be blunt — but it
      should still not be wrong here.
    */
    const css = ".dpc-live { color: red; }";
    const sources = [
      { path: "a.tsx", text: '// see https://example.com/x\n<div className="dpc-live" />' },
    ];
    expect(deadClasses(css, sources)).toEqual([]);
  });

  it("matches whole tokens, so a longer neighbour is not an emitter", () => {
    /*
      The specimen: `.dpc-refine__read` is dead while `.dpc-refine__readInput`,
      `__readResult`, `__readCaption` and `__readNote` are all live. A substring
      search calls the corpse alive four times over.

      ⚠ BOTH READERS ARE DRIVEN HERE, and the second assertion is not padding.
      When the token index was introduced, the substring sabotage (S6) stopped
      reddening ANY arm: it mutates `emittersOf`, and `deadClasses` had moved
      onto the index. The real-tree agreement arm did not catch it either —
      on a clean tree both readers return the empty list, and empty equals
      empty however either one is broken. A fixture with a KNOWN corpse in it
      is the only version of that arm that can fail.
    */
    const css = ".dpc-refine__read { display: flex; }";
    const sources = [{ path: "a.tsx", text: `<input className="dpc-refine__readInput" />` }];
    expect(deadClasses(css, sources)).toEqual(["dpc-refine__read"]);
    expect(emittersOf("dpc-refine__read", sources)).toEqual([]);
    expect(emittersOf("dpc-refine__readInput", sources)).toHaveLength(1);
  });
});
