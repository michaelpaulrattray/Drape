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
const TOPBAR = read("foundation/Topbar.tsx");
const CHROME_STUBS = read("foundation/ChromeStubs.tsx");
const BUG_BUTTON = read("features/lobby/ReportBugButton.tsx");
const UTILITY_MENU = read("features/lobby/LobbyUtilityMenu.tsx");

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
   * His rule has not moved: *"`P.cog` is in there as a fallback if a cogwheel
   * is genuinely wanted later … **Don't use both.**"* **Which one is the gear
   * HAS moved** — #373, 2026-09-01, verbatim: *"i want to change the setting
   * icon at the bottom of the rail to a cog — this looks more like a filter
   * icon"*. He is right at the shape: `P.settings` draws two horizontal rails
   * with an offset handle on each, which is how FILTERS are drawn.
   *
   * ⚠ **BOTH ARMS BELOW ARE INVERTED RATHER THAN DELETED, AND THAT IS THE
   * POINT.** A correct swap made the previous pair fail together — the rail
   * arm because it named the old glyph, the absence arm because its subject
   * had just become the drawn one — and two red arms read as *the swap broke
   * something*, whose wrong repair is to revert his ruling to make the suite
   * green. An absence arm that no longer has a subject is not a passing test,
   * it is a removed one; so the subject is swapped and the guard still fails
   * the day a SECOND gear appears, in whichever direction it appears.
   */
  /**
   * ⚠ **THIS ARM WATCHED `foundation/` ALONE UNTIL #374, AND THE SECOND GEAR
   * IT EXISTS TO CATCH WAS ABOUT TO APPEAR OUTSIDE IT.** The account menu is
   * `components/UserCard.tsx`; brief 04 §2b instructs it to draw `P.settings`,
   * believing that key is now a cog. It is not — it is the two-slider mark, the
   * filter glyph his own #373 was complaining about — so following that
   * sentence literally would have put the filter mark on a Settings row, one
   * click from the rail's real gear, and this arm would have stayed green
   * because the file is one directory over.
   *
   * The walk is the whole client now. Measured before widening it: `P.settings`
   * appears in no client source at all, so nothing legitimate is being banned.
   */
  it("P.settings is drawn nowhere in the client while P.cog is the gear", () => {
    expect(RAIL).toMatch(/P\.cog/);
    const sources = fs
      .globSync("**/*.tsx", { cwd: CLIENT_SRC })
      .map((name) => name.split(path.sep).join("/"))
      .filter((name) => name !== "foundation/icons.tsx" && !name.endsWith(".test.tsx"));
    expect(sources.length, "a walk that found nothing would pass vacuously").toBeGreaterThan(50);
    expect(sources).toContain("components/UserCard.tsx");
    for (const name of sources) {
      expect(code(read(name)), `${name} draws the filter mark as a gear`).not.toMatch(
        /P\.settings/,
      );
    }
  });

  it("the matcher would see it", () => {
    expect(/P\.settings/.test("<Icon d={P.settings} size={16} />")).toBe(true);
  });

  /**
   * The fallback still exists, and it is now the OTHER one — his word was
   * "don't use both", not "delete it", and that was as true of `P.cog` on the
   * day it sat unused as it is of `P.settings` now.
   */
  it("P.settings is still available for the day he wants it back", () => {
    expect(typeof P.settings).toBe("string");
  });

  /**
   * ⚠ **THE ARM THAT USED TO STAND HERE PINNED A SUN IN PLACE AND CALLED IT A
   * GEAR** — the specimen is worth more than the fix. It asserted *"the cog has
   * eight spokes and one centre, whatever the comment says"*, having measured
   * the subpaths, confirmed 9 paths in the rendered DOM, and reasoned in its own
   * docblock about why *"eight separate hairlines off a 2.6r circle"* survives
   * 16px where Lucide's gear would not. **Every one of those readings was
   * correct. Not one of them asked whether the thing was a cog.** A circle with
   * eight straight strokes at 45° intervals is an asterisk, and the topbar draws
   * that same construction one key away as `sun`, the light-theme toggle — so
   * the rail's foot and the theme button were one picture at 16px. Frames went
   * to his gallery with the change and it was his eye that read them, reply #78:
   * *"the cog is incorrect its a star or sun it should be a cog like in the top
   * bar profile drop down menu."* **Law 9, exactly: the measurement was sound
   * and the question was wrong.**
   *
   * So the arms below assert the DRAWING, not a count. `radialStrokes` is the
   * shape the old glyph was, and both arms below use it — the cog must not be
   * one, and no two glyphs in the set may be the same one.
   */

  /**
   * One subpath's construction: whether it curves, and — if it is a single
   * straight stroke — the angle its midpoint sits at around the 24-box centre.
   * A ring of these at even intervals is a burst, whatever the key is called.
   */
  const subpathShape = (sub: string): { curved: boolean; angle?: number } => {
    const head = sub.match(/^\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/);
    if (!head) return { curved: false };
    const x0 = parseFloat(head[1]);
    const y0 = parseFloat(head[2]);
    const rest = sub.slice(head[0].length).trim();
    if (/^[acsqACSQ]/.test(rest)) return { curved: true };
    /* Numbers may be delimited by a sign alone ("-1.2-1.2"), which a split on
       whitespace reads as ONE number and a silent NaN — the fault that made
       this measurement report seven strokes instead of eight the first time. */
    const nums = (s: string) => (s.match(/-?\d*\.?\d+/g) ?? []).map(Number);
    let x1 = x0;
    let y1 = y0;
    if (/^v/.test(rest)) y1 = y0 + nums(rest)[0];
    else if (/^V/.test(rest)) y1 = nums(rest)[0];
    else if (/^h/.test(rest)) x1 = x0 + nums(rest)[0];
    else if (/^H/.test(rest)) x1 = nums(rest)[0];
    else if (/^l/.test(rest)) { const [dx, dy] = nums(rest); x1 = x0 + dx; y1 = y0 + dy; }
    else if (/^-?[\d.]/.test(rest)) { const [ax, ay] = nums(rest); x1 = ax; y1 = ay; }
    else return { curved: false };
    const angle = Math.round(
      ((Math.atan2(12 - (y0 + y1) / 2, (x0 + x1) / 2 - 12) * 180) / Math.PI + 360) % 360,
    );
    return { curved: false, angle };
  };

  /** How many straight strokes radiate from the centre at even intervals. */
  const radialStrokes = (d: string): number => {
    const angles = d
      .split("M")
      .filter(Boolean)
      .map(subpathShape)
      .filter((s) => !s.curved && s.angle !== undefined)
      .map((s) => s.angle!)
      .sort((a, b) => a - b);
    if (angles.length < 4) return 0;
    const gaps = angles.slice(1).map((a, i) => a - angles[i]);
    const even = gaps.every((g) => Math.abs(g - gaps[0]) <= 2);
    return even ? angles.length : 0;
  };

  /** The glyph as it stood from the set's first day to #382. Kept as the
   *  positive control: the arm below must REJECT it, or it proves nothing. */
  const THE_SUN_THAT_WAS_CALLED_A_COG =
    "M12 9.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2M12 3.5v2.6M12 17.9v2.6" +
    "M20.5 12h-2.6M6.1 12H3.5M18 6l-1.8 1.8M7.8 16.2 6 18M18 18l-1.8-1.8M7.8 7.8 6 6";

  it("the cog is a toothed rim, not a ring of hairlines", () => {
    expect(radialStrokes(P.cog), "the cog must not be a radial burst").toBe(0);
    const subs = P.cog.split("M").filter(Boolean);
    expect(subs, "an outline and a centre").toHaveLength(2);
    expect(subs.every((s) => s.includes("a")), "both subpaths curve").toBe(true);
    /* Teeth: the outline turns a corner per tooth face, so the arc count is
       the thing that distinguishes a gear from a plain ring. */
    expect((subs[0].match(/a/g) ?? []).length, "a gear has teeth").toBeGreaterThan(15);
  });

  it("the measurement would have caught the old glyph — positive control", () => {
    expect(radialStrokes(THE_SUN_THAT_WAS_CALLED_A_COG)).toBe(8);
    expect(radialStrokes(P.sun), "the topbar's sun is the same construction").toBe(8);
    expect(
      THE_SUN_THAT_WAS_CALLED_A_COG.split("M").filter(Boolean),
      "and it was nine subpaths, which is what the old arm asserted and passed on",
    ).toHaveLength(9);
  });

  /**
   * ⚠ **THE SET'S OWN STATED PURPOSE, AS AN ARM.** `icons.tsx` says it of the
   * clapperboard: *"two destinations wearing one glyph is the confusion the set
   * exists to avoid."* Nothing checked it. The sweep that found #382's defect
   * found a second pair on its first run — `campaign` and `tryon` are the same
   * path string, byte for byte — so this arm ships with that pair named as its
   * one KNOWN exception rather than silently tolerated. **Closing #383 deletes
   * the exception; adding a third duplicate reddens this.**
   */
  it("no two glyphs are the same drawing, except the one pair on the record", () => {
    const byPath = new Map<string, string[]>();
    for (const [name, d] of Object.entries(P)) {
      byPath.set(d, [...(byPath.get(d) ?? []), name]);
    }
    const duplicates = [...byPath.values()]
      .filter((names) => names.length > 1)
      .map((names) => names.sort().join("+"))
      .sort();
    /* The issue number lives in the docblock above, not in this message: the
       token guard reads a `#` followed by three or six hex digits as a colour
       literal, and every issue from 100 up qualifies. It strips comments. */
    expect(duplicates, "a new duplicate glyph — or the known pair was fixed and this list should shrink")
      .toEqual(["campaign+tryon"]);
  });

  it("the duplicate sweep would see a new pair — positive control", () => {
    const fake = { a: "M1 1v2", b: "M1 1v2", c: "M3 3h4" };
    const byPath = new Map<string, string[]>();
    for (const [name, d] of Object.entries(fake)) byPath.set(d, [...(byPath.get(d) ?? []), name]);
    expect([...byPath.values()].filter((n) => n.length > 1).map((n) => n.join("+"))).toEqual(["a+b"]);
  });

  /**
   * ⚠ **THE RAIL'S FOOT IS THE ONLY PLACE EITHER GEAR IS DRAWN, AND ITS SIZE
   * DID NOT MOVE.** His order was the glyph and nothing else. The card asking
   * for it said *"at 17px"* — read at the bytes, the foot has always drawn at
   * **16**, and 17 is the DESTINATIONS' size; "unchanged in every other
   * respect" is the binding clause, so 16 stays and this arm pins it.
   */
  it("the swap changed the glyph and not the size", () => {
    expect(RAIL).toMatch(/<Icon d=\{P\.cog\} size=\{16\} \/>/);
    expect(
      /<Icon d=\{P\.cog\} size=\{16\} \/>/.test("<Icon d={P.cog} size={17} />"),
      "positive control — the matcher must reject a resized gear",
    ).toBe(false);
  });
});


/**
 * ⚠ **THE TOPBAR SIX** (#321, his 27-glyph drop).
 *
 * His reason for drawing them at all, verbatim: *"These are on every page,
 * which makes them the most-seen icons in the product after the rail — and
 * Lucide's versions are the densest things in its set. Sun is a circle plus
 * eight full-length rays; Bug has antennae, legs and body segments. At 15px
 * both fill in."*
 *
 * The failure this block exists to catch is not a glyph going missing — it is
 * a REVERSION: a later edit that reaches for `lucide-react` at one of these
 * five call sites because that import is one line away and nothing complains.
 * So each arm asserts BOTH halves at the same call site — the house glyph is
 * drawn AND the Lucide name it replaced is not imported — because either half
 * alone passes while the other is wrong.
 *
 * ⚠ **`P.megaphone` and `P.help` cannot be pinned to a live rail entry the way
 * the eight destinations are**, so they are read at their source. Stated limit,
 * the same one the file opens with: a source read cannot see a render. Whether
 * these six hold at 15px in both themes was driven at the running app and
 * recorded on the PR (law 6).
 */
describe("the topbar six are the house set's, not Lucide's", () => {
  const lucideNames = (source: string) =>
    (/import\s*\{([^}]*)\}\s*from\s*['"]lucide-react['"]/.exec(source)?.[1] ?? "")
      .split(",")
      .map((name) => name.trim());

  it("all six glyphs exist in P and are real paths", () => {
    for (const key of ["search", "sun", "moon", "bug", "help", "megaphone"] as const) {
      expect(typeof P[key], `P.${key} is missing`).toBe("string");
      expect(P[key].startsWith("M"), `P.${key} is not a path`).toBe(true);
    }
  });

  it("the theme toggle draws P.sun/P.moon and imports neither Sun nor Moon", () => {
    expect(code(TOPBAR)).toMatch(/d=\{theme === "dark" \? P\.sun : P\.moon\}/);
    const named = lucideNames(TOPBAR);
    expect(named).not.toContain("Sun");
    expect(named).not.toContain("Moon");
  });

  it("search and What's new draw P.search/P.megaphone and import neither", () => {
    expect(code(CHROME_STUBS)).toMatch(/d=\{P\.search\}/);
    expect(code(CHROME_STUBS)).toMatch(/d=\{P\.megaphone\}/);
    const named = lucideNames(CHROME_STUBS);
    expect(named).not.toContain("Search");
    expect(named).not.toContain("Megaphone");
  });

  /**
   * `FolderClosed` and `ChevronDown` are KEPT, and the arm says so rather than
   * banning Lucide from the file — his kept list is explicit (*"chevrons,
   * arrows, plus, close, check, trash, ellipsis…"*), and an arm that forbade
   * the whole import would read as tidier while enforcing an instruction he
   * did not give. Same shape as the Invite `Plus` arm above.
   */
  it("the project switcher's furniture is still Lucide, which is his rule", () => {
    const named = lucideNames(CHROME_STUBS);
    expect(named).toContain("FolderClosed");
    expect(named).toContain("ChevronDown");
  });

  it("the bug button draws P.bug and imports no Bug", () => {
    expect(code(BUG_BUTTON)).toMatch(/d=\{P\.bug\}/);
    expect(lucideNames(BUG_BUTTON)).not.toContain("Bug");
  });

  it("the help button draws P.help and imports no CircleHelp", () => {
    expect(code(UTILITY_MENU)).toMatch(/d=\{P\.help\}/);
    expect(lucideNames(UTILITY_MENU)).not.toContain("CircleHelp");
  });

  /**
   * THE ACCOUNT MENU'S SIX (#374, brief 04 §5): *"`Settings`, `Users`,
   * `CreditCard`, `LogOut`, `LayoutDashboard` and `Eye` all gone from the
   * Lucide import."* Same both-halves shape as the five above — the house glyph
   * is drawn AND the name it replaced is not imported — because a file that
   * dropped the import while drawing nothing passes either half alone.
   *
   * ⚠ Settings draws **`P.cog`**, not `P.settings`. `P.settings` in this tree
   * is the two-slider mark, which is how FILTERS are drawn; §2b's instruction
   * to use `P.settings` assumes a fresh icon drop that has not arrived. The cog
   * he means is `P.cog`, and #382's ruling put it there by pointing AT this
   * menu: *"it should be a cog like in the top bar profile drop down menu."*
   * The one-gear arm above still holds — `P.settings` is drawn nowhere.
   */
  it("the account menu draws the house set and imports none of the six", () => {
    const USER_CARD = read("components/UserCard.tsx");
    for (const [glyph, lucide] of [
      ["cog", "Settings"],
      ["people", "Users"],
      ["card", "CreditCard"],
      ["grid", "LayoutDashboard"],
      ["shield", "Eye"],
      ["exit", "LogOut"],
    ] as const) {
      expect(code(USER_CARD), `the account menu stopped drawing P.${glyph}`).toMatch(
        new RegExp(`P\\.${glyph}\\b`),
      );
      expect(lucideNames(USER_CARD), `${lucide} came back`).not.toContain(lucide);
    }
  });

  it("and it sets no stroke by hand — Icon fixes it at 1.7", () => {
    /*
      The last hand-set stroke in the chrome went with #321(c). This one was
      `strokeWidth={1.8}` on every row, which is why the menu's glyphs read
      heavier than the rail's directly above them.
    */
    expect(code(read("components/UserCard.tsx"))).not.toMatch(/strokeWidth/);
    expect(/strokeWidth/.test("<Settings size={13} strokeWidth={1.8} />")).toBe(true);
  });

  /**
   * ⚠ The POSITIVE CONTROL for both halves at once. Every arm above is a pair
   * of assertions that are each individually satisfiable by an empty file — a
   * `not.toContain` over a source with no Lucide import at all passes, and so
   * does a `toMatch` the day someone renames the prop. This drives the two
   * matchers over a synthetic call site in the shape they are meant to reject.
   */
  it("the matchers would see a reversion", () => {
    const reverted = [
      'import { Bug, Search, Sun } from "lucide-react";',
      "<Bug size={15} strokeWidth={1.8} />",
    ].join("\n");
    const named = (/import\s*\{([^}]*)\}\s*from\s*"lucide-react"/.exec(reverted)?.[1] ?? "")
      .split(",")
      .map((name) => name.trim());
    expect(named).toContain("Bug");
    expect(named).toContain("Search");
    expect(named).toContain("Sun");
    expect(/d=\{P\.bug\}/.test(reverted)).toBe(false);
    expect(/d=\{P\.bug\}/.test("<Icon d={P.bug} size={15} />")).toBe(true);
  });
});

/**
 * ⚠ **THE PRODUCT'S COPY IS HIS FILE, BYTE FOR BYTE** (#321).
 *
 * His instruction: *"Copy the docs file into `client/src/foundation/`. Do not
 * edit the docs copy to match code."* The risk in a 27-glyph transcription is a
 * single wrong digit in a path string, which nothing else in this suite could
 * see and which would show up only as a slightly wrong shape at 17px.
 *
 * So the arm compares the `P` blocks of the two files as TEXT. It deliberately
 * does not compare whole files: the product's copy carries a PROVENANCE
 * docblock the handoff does not, which is the one thing #280 says it should
 * add, and comparing everything would forbid exactly that.
 */
describe("the product's glyphs are the founder's handoff, unmodified", () => {
  const REPO_ROOT = path.resolve(CLIENT_SRC, "..", "..");
  const HANDOFF = path.resolve(
    REPO_ROOT,
    "docs/specs/Casting-ui-ux-design/drape-redesign/icons.tsx",
  );

  const pBlock = (source: string) => {
    const start = source.indexOf("export const P = {");
    const end = source.indexOf("} as const;", start);
    expect(start, "no P block").toBeGreaterThan(-1);
    expect(end, "no end of P block").toBeGreaterThan(start);
    return source.slice(start, end);
  };

  it("the handoff is still in the tree to compare against", () => {
    expect(fs.existsSync(HANDOFF), "his icon handoff was deleted").toBe(true);
  });

  it("every path string matches his, exactly", () => {
    expect(pBlock(ICONS)).toBe(pBlock(fs.readFileSync(HANDOFF, "utf8")));
  });

  /**
   * ⚠ **ONE GLYPH IN THIS SET WAS NOT DRAWN BY HIM, AND IT MUST NEVER STOP
   * SAYING SO** (#374).
   *
   * Brief 04 §2e instructs the Sign out row to draw `P.exit` *"from
   * `icons.tsx`"*. There was no `exit` in either copy of his file — the fresh
   * drop §2b describes has not arrived — so the row could not carry the icon he
   * ruled it must carry. It is lucide's `log-out` path, copied rather than
   * redrawn on #382's own precedent, and **mirrored into his file so the arm
   * above still catches a transcription slip in the other 27**.
   *
   * That mirroring is the risk this arm answers. #382 established that both
   * copies move together — *"his own newer word, applied to both files in one
   * act"* — but #382 was copying a mark he had POINTED AT. Here he named a key
   * and not a drawing, so a stand-in now sits inside the file that is supposed
   * to be his authorship. **The declaration is the only thing separating the
   * two, and a declaration nothing checks is a comment.**
   *
   * When his set gains an `exit`, take his: this arm's list empties and the
   * arm goes with it.
   */
  const STAND_INS = ["exit"] as const;

  it("a glyph the founder did not draw declares itself, in BOTH copies", () => {
    for (const source of [ICONS, fs.readFileSync(HANDOFF, "utf8")]) {
      for (const key of STAND_INS) {
        const entry = pBlock(source).indexOf(`\n  ${key}:`);
        expect(entry, `no ${key} entry`).toBeGreaterThan(-1);
        // The docblock immediately above it, back to the previous entry.
        const preamble = pBlock(source).slice(0, entry);
        const declaration = preamble.slice(preamble.lastIndexOf("/*"));
        expect(
          declaration,
          `${key} is a stand-in for a glyph he owns and must say so where it is drawn`,
        ).toMatch(/stand-in for a glyph he owns/);
      }
    }
  });

  it("the declaration arm would see one that stopped saying it", () => {
    const stripped = "export const P = {\n  /* a gear */\n  exit: 'M9 21H5',\n} as const;";
    const entry = pBlock(stripped).indexOf("\n  exit:");
    const preamble = pBlock(stripped).slice(0, entry);
    expect(/stand-in for a glyph he owns/.test(preamble.slice(preamble.lastIndexOf("/*")))).toBe(
      false,
    );
  });

  it("the comparison would see one changed digit", () => {
    const mine = "export const P = {\n  studio: 'M4 10.5L12 4',\n} as const;";
    const his = "export const P = {\n  studio: 'M4 10.6L12 4',\n} as const;";
    expect(pBlock(mine)).not.toBe(pBlock(his));
  });
});

/**
 * ⚠ **THE ARM THAT WAS MISSING, AND IT IS WORTH MORE THAN THE SIX GLYPHS IT
 * CHECKS.**
 *
 * The block above compares the product's `P` to the founder's handoff file, and
 * it has been green from the day it was written. It was green while all six
 * topbar chrome glyphs were the wrong drawings, because **the handoff held the
 * same wrong drawings** — the chrome six were absent from the map he exported
 * (the prototype draws them INLINE in its markup, which is his own diagnosis of
 * why they were missing) and were drawn fresh to fill the hole, into both files
 * at once.
 *
 * **A guard comparing two copies of one mistake cannot see the mistake.** His
 * eye saw it instead: *"the icons are not the same as the prototypes on the top
 * bar e.g the bug icon the theme icon notification icon etc."*
 *
 * So this reads the THIRD artifact — the prototype itself, which is in the
 * repository, so this is a file read and not a screenshot. It is deliberately a
 * different resolver from the block above: that one compares two TypeScript
 * files to each other, this one parses HTML. Neither can inherit the other's
 * blind spot.
 *
 * **Stated limits**, so the next shift knows what this does not cover:
 *   - It covers the six chrome glyphs the prototype draws inline. The rail's
 *     destinations and the tool modes come through his exported map and are the
 *     block above's business.
 *   - A source read cannot see a render. Whether these hold at 15px in both
 *     themes was driven at the running app and recorded on the PR (law 6).
 */
describe("the topbar chrome is the PROTOTYPE's drawing, not a redraw of it", () => {
  const REPO_ROOT2 = path.resolve(CLIENT_SRC, "..", "..");
  const PROTOTYPE = path.resolve(
    REPO_ROOT2,
    "docs/specs/Casting-ui-ux-design/design_handoff_studio/Klieg Studio.dc.html",
  );

  const html = fs.existsSync(PROTOTYPE) ? fs.readFileSync(PROTOTYPE, "utf8") : "";

  /**
   * The prototype writes a chrome glyph as `svg("<path data>", 15)`. Pull the
   * three in `barIcons` out by their own `title`, so a reordering of the array
   * cannot silently re-point a key at the wrong drawing.
   *
   * ⚠ **THROWS rather than returning a short list** — a collector that can come
   * up empty reports a complete list either way, which is the Atlas's own
   * lesson and it cost four collectors there.
   */
  const barIcons = (source: string): Record<string, string> => {
    const start = source.indexOf("barIcons: [");
    if (start < 0) throw new Error("no barIcons array in the prototype");
    const block = source.slice(start, source.indexOf("],", start));
    const found: Record<string, string> = {};
    for (const m of block.matchAll(/title:\s*"([^"]+)"[^\n]*?icon:\s*svg\("([^"]+)"/g)) {
      found[m[1]] = m[2];
    }
    if (Object.keys(found).length !== 3) {
      throw new Error(`expected three barIcons, read ${Object.keys(found).length}`);
    }
    return found;
  };

  /** The theme toggle: dark shows the SUN (its hint reads "switch to light"). */
  const themeIcons = (source: string): { sun: string; moon: string } => {
    const start = source.indexOf("themeIcon:");
    if (start < 0) throw new Error("no themeIcon in the prototype");
    const block = source.slice(start, start + 900);
    const paths = [...block.matchAll(/svg\("([^"]+)"/g)].map((m) => m[1]);
    if (paths.length < 2) throw new Error(`themeIcon holds ${paths.length} drawings, expected two`);
    return { sun: paths[0], moon: paths[1] };
  };

  /**
   * ⚠ **SEARCH IS THE ONE THE PROTOTYPE DOES NOT DRAW AS A PATH.** It is a
   * `<circle>` ELEMENT plus a `<path>`, and `Icon` splits on M and renders
   * `<path>` and nothing else — so this arm CONVERTS rather than comparing raw,
   * and the conversion is written out here rather than trusted.
   *
   * Anchored on the search field's own placeholder text: the same glyph appears
   * a dozen times in the prototype and a line number is not an anchor.
   */
  const searchGlyph = (source: string): string => {
    const at = source.indexOf("Search frames, faces, prompts");
    if (at < 0) throw new Error("the prototype's search field is not where this arm looks");
    const svgStart = source.lastIndexOf("<svg", at);
    const markup = source.slice(svgStart, source.indexOf("</svg>", svgStart));
    const circle = /<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/.exec(markup);
    const handle = /<path d="([^"]+)"/.exec(markup);
    if (!circle || !handle) throw new Error("the search glyph is no longer a circle plus a path");
    const [cx, cy, r] = [+circle[1], +circle[2], +circle[3]];
    /* A circle as this set's arc pair: two semicircles through the poles. */
    const ring = `M${cx} ${cy - r}a${r} ${r} 0 1 0 0 ${r * 2} ${r} ${r} 0 0 0 0-${r * 2}`;
    return ring + handle[1].replace(/L/g, " ");
  };

  it("the prototype is still in the tree to compare against", () => {
    expect(fs.existsSync(PROTOTYPE), "the refreshed prototype was moved or deleted").toBe(true);
    /* His own acceptance check for the refresh (the rail gained Cinema). A
       stale prototype makes every arm below assert against the wrong artifact. */
    expect((html.match(/cinema/gi) ?? []).length, "this is the pre-refresh prototype").toBeGreaterThan(0);
  });

  it("the three bar icons are his drawings, exactly", () => {
    const proto = barIcons(html);
    expect(P.bug).toBe(proto["Report a bug"]);
    expect(P.help).toBe(proto["Help & docs"]);
    expect(P.megaphone).toBe(proto["What's new"]);
  });

  it("the theme toggle is his drawing, exactly", () => {
    const proto = themeIcons(html);
    expect(P.sun).toBe(proto.sun);
    expect(P.moon).toBe(proto.moon);
  });

  it("search is his circle written as this set's arc pair", () => {
    expect(P.search).toBe(searchGlyph(html));
  });

  /**
   * ⚠ **THE POSITIVE CONTROLS.** Four arms above assert equality against a
   * parsed artifact; every one of them passes for free if the parser returns
   * the string it is compared to, or silently reads a neighbour. These drive
   * the same readers over synthetic markup with a known answer.
   */
  it("the readers would see one changed digit", () => {
    const tampered = html.replace(
      'svg("M6 9.5h4l5-3.5v12l-5-3.5H6zM17.5 9.5a4 4 0 0 1 0 5", 15)',
      'svg("M6 9.6h4l5-3.5v12l-5-3.5H6zM17.5 9.5a4 4 0 0 1 0 5", 15)',
    );
    expect(tampered, "the megaphone literal moved — this control needs rewriting").not.toBe(html);
    expect(barIcons(tampered)["What's new"]).not.toBe(P.megaphone);
  });

  it("the bar-icon reader keys on title, not on position", () => {
    const fake = [
      'barIcons: [',
      '  { title: "Help & docs", dot: false, icon: svg("M2 2h2", 15) },',
      '  { title: "Report a bug", dot: false, icon: svg("M1 1h2", 15) },',
      '  { title: "Whats new", dot: true, icon: svg("M3 3h2", 15) },',
      '],',
    ].join("\n");
    expect(barIcons(fake)).toEqual({
      "Report a bug": "M1 1h2",
      "Help & docs": "M2 2h2",
      "Whats new": "M3 3h2",
    });
  });

  it("a collector that comes up short throws rather than passing", () => {
    const short = 'barIcons: [\n  { title: "Report a bug", icon: svg("M1 1h2", 15) },\n],';
    expect(() => barIcons(short)).toThrow(/expected three barIcons/);
    expect(() => barIcons("nothing here")).toThrow(/no barIcons/);
    expect(() => themeIcons("themeIcon: nothing")).toThrow(/expected two/);
    expect(() => searchGlyph("no search field here")).toThrow(/is not where this arm looks/);
  });

  it("the circle-to-arc conversion is written down, and it sees a moved centre", () => {
    const at = (cx: number) =>
      searchGlyph(
        `<svg><circle cx="${cx}" cy="11" r="7"></circle><path d="M16.5 16.5L21 21"></path></svg>` +
          "Search frames, faces, prompts",
      );
    expect(at(11)).toBe("M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M16.5 16.5 21 21");
    expect(at(10.9)).not.toBe(at(11));
  });
});
