import { readFile, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, extname } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * EVERY CLASS THIS STYLESHEET DECLARES IS EMITTED BY SOMETHING.
 *
 * #210, and the class rather than its instance. #198 found ONE broken rule
 * (`.dpc-signm__portrait > img`, a child combinator against a DOM with a
 * wrapper in it) and its law-7 sweep turned up four rules whose class had no
 * emitter at all. Read mechanically over the whole sheet, the real population
 * was twenty-one classes and thirty-two rules — corpses of surfaces that were
 * genuinely shipped and then moved: `52d3e6c4` took Sign to the dock,
 * `b974e882` rebuilt the delete and rename dialogs, `63f5f554` rebuilt the
 * room. Every one of the twenty-one had an emitter once (`git log -S`, all
 * twenty-one, not a sample), so none of them was scaffolding for the unbuilt
 * design north star. They were deleted; this stops the next refactor leaving
 * its own.
 *
 * WHY A GUARD AND NOT JUST THE DELETION. Dead CSS is cheap on its own — bytes
 * in one stylesheet. What it is not cheap on is READING: `.dpc-sign__portrait`
 * sat one character from the live `.dpc-signm__portrait` for months, so
 * anybody grepping for the sign portrait's rule found two and had no way to
 * tell which one painted. That is the cost, and it recurs on every rename.
 *
 * WHY THE TOLERATED LIST IS EMPTY. It is a real list with the shrink-only
 * doctrine this repo uses elsewhere (`KNOWN_DEBTS`, `DECLARED_BUT_UNMIGRATED`,
 * `LEGACY_ACCEPT_LITERALS`) — but it starts empty, because the twenty-one were
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

/** Every class name the stylesheet declares, taken from SELECTOR position only. */
export function declaredClasses(css: string): string[] {
  const found = new Set<string>();
  let depth = 0;
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
      if (depth === 0) {
        for (const m of selector.matchAll(/\.([A-Za-z_][A-Za-z0-9_-]*)/g)) found.add(m[1]);
      }
      depth += 1;
      selector = "";
      i += 1;
      continue;
    }
    if (css[i] === "}") {
      depth = Math.max(0, depth - 1);
      selector = "";
      i += 1;
      continue;
    }
    if (depth === 0) selector += css[i];
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
export function emittersOf(
  className: string,
  sources: Array<{ path: string; text: string }>,
): Array<{ path: string; line: string }> {
  const token = new RegExp(`(^|[^A-Za-z0-9_-])${className.replace(/-/g, "\\-")}([^A-Za-z0-9_-]|$)`);
  const hits: Array<{ path: string; line: string }> = [];
  for (const { path, text } of sources) {
    if (!text.includes(className)) continue;
    for (const line of text.split(/\r?\n/)) {
      if (!token.test(line)) continue;
      if (/\bnot\.toContain\b/.test(line)) continue;
      hits.push({ path, line: line.trim() });
    }
  }
  return hits;
}

export function deadClasses(
  css: string,
  sources: Array<{ path: string; text: string }>,
): string[] {
  return declaredClasses(css).filter((name) => emittersOf(name, sources).length === 0);
}

async function collect(root: string): Promise<Array<{ path: string; text: string }>> {
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

describe("castingV2.css declares no class the product never emits", () => {
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
      stylesheet nobody checked. 323 classes stood the day this landed.
    */
    const css = await readFile(SHEET, "utf8");
    const classes = declaredClasses(css);
    expect(classes.length).toBeGreaterThan(250);
    expect(classes).toContain("dpc-signm__portrait");

    const sources = await collect(CLIENT_SRC);
    expect(sources.length).toBeGreaterThan(400);
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

  it("matches whole tokens, so a longer neighbour is not an emitter", () => {
    /*
      The specimen: `.dpc-refine__read` is dead while `.dpc-refine__readInput`,
      `__readResult`, `__readCaption` and `__readNote` are all live. A substring
      search calls the corpse alive four times over.
    */
    const css = ".dpc-refine__read { display: flex; }";
    const sources = [{ path: "a.tsx", text: `<input className="dpc-refine__readInput" />` }];
    expect(deadClasses(css, sources)).toEqual(["dpc-refine__read"]);
  });
});
