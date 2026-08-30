import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { P } from "./icons";
import { RAIL_DESTINATIONS } from "./Rail";

/**
 * The house icon set's rules, as assertions (#280 — his card and its
 * amendment; the set itself is `icons.tsx`).
 *
 * Four of his instructions are the kind a later change breaks silently, which
 * is why they are here rather than in a reviewer's memory:
 *
 *   1. **`Sparkles` is retired** for Create, and `Settings` for the gear. Both
 *      are one import line away from coming back.
 *   2. **Stroke stays 1.7 and does not scale.** *"Icons get bigger, never
 *      heavier — a heavier stroke at a larger size reads as a different
 *      family."* The obvious future "improvement" is a `strokeWidth` prop on
 *      `Icon`, or a size-proportional stroke; both are the defect.
 *   3. **A new glyph is added to `P`**, never inlined as an `<svg>` at the call
 *      site — the rule that keeps the set a set.
 *   4. **`P.settings` OR `P.cog`, never both**: *"Don't use both."* Two gears
 *      in one product is the exact drift a house set exists to stop.
 *
 * These are SOURCE guards in the shape of `section02-guard.test.ts`, plus two
 * arms that read the destination list as DATA. Stated limit: a source read
 * cannot see a render — whether the glyphs are legible at 17px in both themes
 * was driven at the running app and recorded in the PR (law 6).
 *
 * ⚠ **EVERY ABSENCE ARM IS PAIRED WITH A POSITIVE CONTROL** — a synthetic
 * string the same matcher must reject. An arm that only asserts absence is
 * green when its subject is deleted and green when its own regex is wrong.
 */

const HERE = __dirname;
const CLIENT_SRC = path.resolve(HERE, "..");

const read = (relative: string) => fs.readFileSync(path.resolve(CLIENT_SRC, relative), "utf8");

const ICONS = read("foundation/icons.tsx");
const RAIL = read("foundation/Rail.tsx");

/** Strip comments, so a rule QUOTED in a docblock never satisfies its own arm. */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("the retired glyphs are gone from the rail, not merely unused", () => {
  /**
   * His words on Sparkles: *"the universal AI glyph, it says nothing about
   * making a picture, and it's the single icon most responsible for the product
   * looking like every other one."* On the gear: *"eight teeth and an inner
   * circle, illegible at 16px beside glyphs of three strokes."*
   *
   * The bar he set is deletion rather than disuse — *"`Rail.tsx` drops
   * `Settings` and `Sparkles` from its Lucide import entirely"* — so that
   * `pnpm check` and the deletion door both see it.
   */
  it("Rail.tsx imports neither Sparkles nor Settings from Lucide", () => {
    const lucideImport = /import\s*\{([^}]*)\}\s*from\s*"lucide-react"/.exec(RAIL);
    expect(lucideImport, "the rail stopped importing from Lucide in a shape this arm reads").not
      .toBeNull();
    const named = (lucideImport?.[1] ?? "").split(",").map((s) => s.trim());
    expect(named).not.toContain("Sparkles");
    expect(named).not.toContain("Settings");
  });

  it("the matcher would see them", () => {
    const before = 'import { Clapperboard, Plus, Settings, Sparkles } from "lucide-react";';
    const named = (/import\s*\{([^}]*)\}\s*from\s*"lucide-react"/.exec(before)?.[1] ?? "")
      .split(",")
      .map((s) => s.trim());
    expect(named).toContain("Sparkles");
    expect(named).toContain("Settings");
  });

  /**
   * `Plus` is KEPT on purpose — his own line: *"So `Rail.tsx` drops `Settings`
   * and `Sparkles` from its Lucide import entirely, and keeps `Plus` for the
   * Invite."* An arm that only forbade Lucide would read as tidier and would be
   * a different instruction from the one he gave.
   */
  it("the Invite plus is still Lucide, which is what he asked for", () => {
    const named = (/import\s*\{([^}]*)\}\s*from\s*"lucide-react"/.exec(RAIL)?.[1] ?? "")
      .split(",")
      .map((s) => s.trim());
    expect(named).toContain("Plus");
  });
});

describe("every rail destination carries a house glyph", () => {
  /**
   * Read as DATA rather than as text: the list is the product's own, imported,
   * so a regex cannot agree with a source line that no longer runs.
   *
   * The eight against the keys he named (#280): *"P.studio, P.image, P.thread,
   * P.campaign, P.avatar, P.asset, P.library, plus Cinema"* — seven listed in
   * rail order, with Cinema where his section-02 ruling puts it.
   */
  it("each of the eight is a path string from P, in his mapping", () => {
    const byId = Object.fromEntries(RAIL_DESTINATIONS.map((d) => [d.id, d.glyph]));
    expect(byId).toEqual({
      home: P.studio,
      create: P.image,
      canvas: P.thread,
      templates: P.campaign,
      cinema: P.cinema,
      casting: P.avatar,
      assets: P.asset,
      library: P.library,
    });
  });

  /**
   * ⚠ **CREATE IS THE ONE HE NAMED BY NAME** — *"Create uses `P.image`"* — and
   * it is the one most likely to be "improved" back to a sparkle by someone who
   * finds a picture frame dull. Pinned on its own so the failure names itself.
   */
  it("Create is P.image", () => {
    const create = RAIL_DESTINATIONS.find((d) => d.id === "create");
    expect(create?.glyph).toBe(P.image);
  });

  /** Every glyph is a real SVG path, not an empty string a refactor left behind. */
  it("no destination carries an empty glyph", () => {
    for (const destination of RAIL_DESTINATIONS) {
      expect(destination.glyph.startsWith("M"), `${destination.id} is not a path`).toBe(true);
    }
  });
});

describe("stroke is fixed at 1.7 and cannot be scaled", () => {
  /**
   * His rule: *"Stroke stays 1.7 and doesn't scale. Icons get bigger, never
   * heavier."* The mechanism is that `Icon` takes `size` and NOT `strokeWidth`,
   * so a caller has nowhere to put a heavier stroke. Both halves are asserted:
   * the literal, and the absence of a prop that would let it move.
   */
  it("Icon renders strokeWidth 1.7", () => {
    expect(ICONS).toMatch(/strokeWidth=\{1\.7\}/);
  });

  it("Icon accepts no strokeWidth prop", () => {
    const signature = /export function Icon\(\{([\s\S]*?)\}: \{([\s\S]*?)\}\)/.exec(ICONS);
    expect(signature, "Icon's signature changed shape").not.toBeNull();
    expect(signature?.[1]).not.toMatch(/strokeWidth/);
    expect(signature?.[2]).not.toMatch(/strokeWidth/);
  });

  it("the signature matcher would see one", () => {
    const before = [
      "export function Icon({ d, size = 15, strokeWidth = 1.7 }: {",
      "  d: string;",
      "  size?: number;",
      "  strokeWidth?: number;",
      "}) {",
    ].join("\n");
    const signature = /export function Icon\(\{([\s\S]*?)\}: \{([\s\S]*?)\}\)/.exec(before);
    expect(signature?.[1]).toMatch(/strokeWidth/);
  });

  /**
   * The rail set 1.8 by hand on every glyph until this landed. No call site
   * passes a stroke to `Icon` — if one ever tries, it is a type error, and this
   * arm says so in words before the compiler says it in types.
   */
  it("no call site hands Icon a stroke", () => {
    expect(code(RAIL)).not.toMatch(/<Icon[^>]*strokeWidth/);
    expect(/<Icon[^>]*strokeWidth/.test('<Icon d={P.studio} size={17} strokeWidth={2} />')).toBe(
      true,
    );
  });
});

describe("a new glyph goes into P, never inline at the call site", () => {
  /**
   * His rule: *"Add it to `P` rather than inlining an SVG at the call site."*
   * The set stops being a set the first time someone drops a `<svg>` into a
   * component because it was quicker.
   */
  it("the foundation's components draw no raw SVG", () => {
    for (const file of ["Rail.tsx", "Topbar.tsx", "ChromeStubs.tsx", "AppShell.tsx"]) {
      expect(code(read(`foundation/${file}`)), `${file} inlines an SVG`).not.toMatch(/<svg/);
    }
  });

  it("the matcher would see one", () => {
    expect(/<svg/.test('<svg viewBox="0 0 24 24"><path d="M4 4h16" /></svg>')).toBe(true);
  });
});

describe("one gear, not two", () => {
  /**
   * His words: *"`P.cog` is in there as a fallback if a cogwheel is genuinely
   * wanted later … **Don't use both.**"* `P.cog` exists and is deliberately
   * unused; this arm fails the day a second surface reaches for it while the
   * rail still draws `P.settings`.
   */
  it("P.cog is drawn nowhere while P.settings is the gear", () => {
    expect(RAIL).toMatch(/P\.settings/);
    const sources = fs
      .readdirSync(path.resolve(CLIENT_SRC, "foundation"))
      .filter((name) => name.endsWith(".tsx") && name !== "icons.tsx")
      .map((name) => code(read(`foundation/${name}`)));
    for (const source of sources) {
      expect(source).not.toMatch(/P\.cog/);
    }
  });

  it("the matcher would see it", () => {
    expect(/P\.cog/.test("<Icon d={P.cog} size={16} />")).toBe(true);
  });

  /** The fallback still exists — his word was "don't use both", not "delete it". */
  it("P.cog is still available for the day he wants it", () => {
    expect(typeof P.cog).toBe("string");
  });
});
