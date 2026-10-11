/**
 * #2260 — at phone width the topbar lets go of inert chrome, and ONLY inert
 * chrome.
 *
 * The bar asked for ~540px at 360-420px wide, so the credits read "1,018 c…"
 * and the whole page scrolled sideways. The repair in `foundation.css` is a
 * `@media (max-width: 640px)` block that hides the project switcher, the
 * breadcrumb, the search, What's new and a hairline divider.
 *
 * The risk a rule like that carries is quiet: one more selector in the hidden
 * list and a working control disappears on every phone with nothing going red.
 * So this guard reads the hidden list out of the stylesheet and holds EVERY
 * selector in it to a proof, derived from the components, that what it hides
 * cannot be pressed — an `aria-disabled` stub, a decorative hairline, or a
 * breadcrumb that repeats the page heading. An unknown selector fails until
 * someone writes its proof here. The credits chip and the account chip may
 * never be in the list at all.
 *
 * The rendered evidence (frames at 360 / 390 / 420 / 1440, both themes, with the
 * document width equal to the viewport at every one) is in the PR; a node test
 * cannot lay out a page, so the layout itself is not claimed here.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { withoutComments } from "../../../server/testing/withoutComments";

const CLIENT_SRC = path.resolve(__dirname, "..");
const read = (relative: string) => fs.readFileSync(path.resolve(CLIENT_SRC, relative), "utf8");

/** CSS has block comments and nothing else (section02-guard's reader, same reason). */
const cssCode = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "");

const FOUNDATION_CSS = read("foundation/foundation.css");
const TOPBAR = withoutComments(read("foundation/Topbar.tsx"));
const STUBS = withoutComments(read("foundation/ChromeStubs.tsx"));

/** Every non-test .tsx under client/src, comments stripped. */
function clientTsx(): Array<{ file: string; text: string }> {
  const out: Array<{ file: string; text: string }> = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".tsx") && !entry.name.includes(".test.")) {
        out.push({ file: path.relative(CLIENT_SRC, full), text: withoutComments(fs.readFileSync(full, "utf8")) });
      }
    }
  };
  walk(CLIENT_SRC);
  return out;
}

/** The body of the phone-width media block that governs the topbar, or null. */
function phoneTopbarBlock(css: string): string | null {
  const code = cssCode(css);
  const re = /@media\s*\(max-width:\s*640px\)\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(code))) {
    let depth = 1;
    let i = match.index + match[0].length;
    const start = i;
    for (; i < code.length && depth > 0; i++) {
      if (code[i] === "{") depth++;
      else if (code[i] === "}") depth--;
    }
    const body = code.slice(start, i - 1);
    if (/\.dp-topbar\b/.test(body)) return body;
  }
  return null;
}

/** Selectors inside the block whose rule declares `display: none`. */
function hiddenSelectors(block: string): string[] {
  const out: string[] = [];
  for (const rule of block.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/display\s*:\s*none/.test(rule[2])) continue;
    for (const selector of rule[1].split(",")) out.push(selector.trim().replace(/\s+/g, " "));
  }
  return out;
}

/** The children of the element opened by `className="<cls>"` in `source`, up to its closing tag. */
function zone(source: string, cls: string): string {
  const at = source.indexOf(`className="${cls}"`);
  expect(at, `the matcher must find ${cls}`).toBeGreaterThan(-1);
  const end = source.indexOf("</div>", at);
  return source.slice(at, end);
}

/** A rendered root that is an inert stub: a span, aria-disabled, no handler. */
function isInertStub(componentSource: string, name: string): boolean {
  const at = componentSource.indexOf(`export function ${name}(`);
  if (at < 0) return false;
  const next = componentSource.indexOf("export function", at + 1);
  const body = componentSource.slice(at, next < 0 ? undefined : next);
  return /return \(\s*<span[^>]*aria-disabled="true"/.test(body) && !/onClick|<button|<input|<a /.test(body);
}

/**
 * The proofs. Each hidden selector names what it hides and why that is safe,
 * as a check against the code rather than a sentence.
 */
const PROOFS: Record<string, () => string | null> = {
  /* The context zone holds `{left}`, a divider and the breadcrumb text. */
  ".dp-topbar__context": () => {
    const z = zone(TOPBAR, "dp-topbar__context");
    if (/<button|onClick|<a /.test(z)) return "the context zone now holds a control";
    const lefts = clientTsx().flatMap(({ file, text }) =>
      [...text.matchAll(/topbarLeft=\{([^}]*)\}/g)].map((m) => ({ file, value: m[1].trim() })),
    );
    if (lefts.length === 0) return "no topbarLeft mount found (the matcher is blind)";
    for (const { file, value } of lefts) {
      const name = /^<(\w+)\s*\/>$/.exec(value)?.[1];
      if (!name || !isInertStub(STUBS, name)) return `${file} puts ${value} in the context zone, which is not an inert stub`;
    }
    return null;
  },
  /* The centre holds the search stub and nothing else. */
  ".dp-topbar__centre": () => {
    const z = zone(TOPBAR, "dp-topbar__centre").replace(/^className="dp-topbar__centre">/, "").trim();
    if (z !== "<SearchStub />") return `the centre zone holds ${JSON.stringify(z)}, not only the search stub`;
    return isInertStub(STUBS, "SearchStub") ? null : "SearchStub is no longer an inert span";
  },
  /* The hairline is decoration. */
  ".dp-topbar__divider--gutter": () =>
    /className="dp-topbar__divider dp-topbar__divider--gutter" aria-hidden="true"/.test(TOPBAR)
      ? null
      : "the gutter divider is no longer an aria-hidden hairline",
  /* Every element wearing the stub modifier is an inert span. */
  ".dp-topbar__right .dp-iconbtn--stub": () => {
    const wearers = clientTsx().flatMap(({ file, text }) =>
      [...text.matchAll(/<(\w+)[^>]*className="[^"]*\bdp-iconbtn--stub\b[^"]*"[^>]*>/g)].map((m) => ({ file, tag: m[0], el: m[1] })),
    );
    if (wearers.length === 0) return "no element wears dp-iconbtn--stub (the matcher is blind)";
    for (const { file, tag, el } of wearers) {
      if (el !== "span" || !/aria-disabled="true"/.test(tag) || /onClick/.test(tag)) return `${file}: ${tag} is not an inert span`;
    }
    return null;
  },
};

/** Never hidden at any width: the two controls a phone most needs. */
const NEVER_HIDDEN = [/\.dp-credits\b/, /\.dp-accountchip\b/, /\.dp-account\b/, /\.dp-topbar__right\s*$/, /^\.dp-topbar$/];

function audit(css: string): string[] {
  const block = phoneTopbarBlock(css);
  if (!block) return ["no @media (max-width: 640px) block governs the topbar"];
  const problems: string[] = [];
  for (const selector of hiddenSelectors(block)) {
    if (NEVER_HIDDEN.some((re) => re.test(selector))) {
      problems.push(`${selector} is hidden at phone width`);
      continue;
    }
    const proof = PROOFS[selector];
    if (!proof) problems.push(`${selector} is hidden at phone width with no proof that it hides only inert chrome`);
    else {
      const failure = proof();
      if (failure) problems.push(`${selector}: ${failure}`);
    }
  }
  return problems;
}

describe("card 2260 — the phone topbar hides inert chrome and nothing else", () => {
  it("READS A REAL BLOCK — the media rule exists and hides exactly the four proven selectors", () => {
    const block = phoneTopbarBlock(FOUNDATION_CSS);
    expect(block, "foundation.css must carry the phone-width topbar block").not.toBeNull();
    expect(hiddenSelectors(block!).sort()).toEqual(Object.keys(PROOFS).sort());
  });

  it("every hidden selector carries a proof that holds against the code", () => {
    expect(audit(FOUNDATION_CSS)).toEqual([]);
  });

  it("the credits chip and the account chip are never hidden (negative controls)", () => {
    const withCredits = FOUNDATION_CSS.replace(
      ".dp-topbar__divider--gutter,",
      ".dp-topbar__divider--gutter,\n  .dp-topbar .dp-credits,",
    );
    expect(withCredits).not.toBe(FOUNDATION_CSS);
    expect(audit(withCredits)).toContain(".dp-topbar .dp-credits is hidden at phone width");

    const withAccount = FOUNDATION_CSS.replace(
      ".dp-topbar__divider--gutter,",
      ".dp-topbar__divider--gutter,\n  .dp-accountchip,",
    );
    expect(audit(withAccount)).toContain(".dp-accountchip is hidden at phone width");
  });

  it("an unproven selector fails, and so does a missing block (negative controls)", () => {
    const withUnknown = FOUNDATION_CSS.replace(
      ".dp-topbar__divider--gutter,",
      ".dp-topbar__divider--gutter,\n  .dp-topbar__right .dp-iconbtn,",
    );
    expect(audit(withUnknown)).toContain(
      ".dp-topbar__right .dp-iconbtn is hidden at phone width with no proof that it hides only inert chrome",
    );
    expect(audit(FOUNDATION_CSS.replace(/max-width:\s*640px/g, "max-width: 641px"))).toEqual([
      "no @media (max-width: 640px) block governs the topbar",
    ]);
  });

  it("the stub proof fails when a stub becomes a control (negative control on the derivation)", () => {
    expect(isInertStub(STUBS, "WhatsNewStub")).toBe(true);
    expect(isInertStub(STUBS, "ProjectSwitcherStub")).toBe(true);
    const live = STUBS.replace(
      '<span className="dp-projswitch" aria-disabled="true"',
      '<button className="dp-projswitch" onClick={go}',
    );
    expect(live).not.toBe(STUBS);
    expect(isInertStub(live, "ProjectSwitcherStub")).toBe(false);
  });
});
