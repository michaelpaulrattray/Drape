import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ONE icon button (#276 — his word, 2026-09-10: *"promote primitive — ONE
 * IconButton component; the six raw dp-iconbtn buttons switch to it; the unused
 * duplicate in components/design-system/Button.tsx is deleted"*).
 *
 * The card that carried that ruling counted THREE implementations of one idea:
 * the foundation primitive (whose only consumer was its own specimen page), a
 * second declaration of the same NAME in the marketing kit (no consumers at
 * all), and the raw class written out at SEVEN call sites — six named on the
 * card, plus `StaffBar`'s Refresh, which the card's list missed and which this
 * guard's own population found.
 *
 * ⚠ **THE ARMS ARE DERIVED, NEVER A SECOND LIST** (working law 4). Nothing here
 * names the six files; every arm WALKS `client/src` and counts what it finds, so
 * an eighth raw button in a directory nobody has thought of yet reddens this
 * suite the day it is written, and closing a call site needs no edit here.
 *
 * ⚠ **AND THE CARVE-OUT IS A SHAPE, NOT A FILENAME.** `ChromeStubs` wears
 * `.dp-iconbtn` on a `<span aria-disabled>` on purpose — 00b §3 and his #228
 * ruling keep inert stubs out of the tab order by construction — so what these
 * arms forbid is a raw `<button>` wearing the class, not the class itself. A
 * second inert stub is legitimate and passes; a second hand-rolled button is
 * the thing that produced three implementations and does not.
 *
 * Every absence arm carries a positive control, because an arm that only
 * asserts absence is green when its own matcher is wrong and green when its
 * subject is deleted (working law 2).
 */

const CLIENT_SRC = path.resolve(__dirname, "..");

/** Every `.tsx` under `client/src`, so the population is the tree's, not a list. */
function everyComponentFile(dir: string = CLIENT_SRC): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...everyComponentFile(full));
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const FILES = everyComponentFile();

/** One spelling of a path on both platforms, so an arm may quote one. */
const relativeName = (file: string) => path.relative(CLIENT_SRC, file).split(path.sep).join("/");

/**
 * The tag name an occurrence of `dp-iconbtn` sits inside — found by walking
 * back to the nearest `<`, which is what tells a `<button>` from a `<span>`.
 * Returns null for an occurrence in prose (a comment, a docblock, a fixture
 * string), which is deliberate: this file's subject is markup.
 */
function owningTag(source: string, at: number): string | null {
  const open = source.lastIndexOf("<", at);
  if (open === -1) return null;
  const name = /^<\s*([A-Za-z][\w.-]*)/.exec(source.slice(open, at));
  return name ? name[1] : null;
}

/** Every `<tag …dp-iconbtn…>` in one source, as `label:tag` pairs. */
function classSites(source: string, label: string): string[] {
  const hits: string[] = [];
  const CLASS_ATTR = /class(?:Name)?\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/g;
  for (let m = CLASS_ATTR.exec(source); m; m = CLASS_ATTR.exec(source)) {
    const value = m[1] ?? m[2] ?? m[3] ?? "";
    /* The BASE class alone. `\b` also matches `dp-iconbtn--theme`, which is the
       shell's own 28px modifier and is handed BY a call site TO the primitive —
       a legitimate use the first shape of this arm reported as an offender. */
    if (!/\bdp-iconbtn(?![\w-])/.test(value)) continue;
    const tag = owningTag(source, m.index);
    if (tag) hits.push(`${label}:${tag}`);
  }
  return hits;
}

const EVERY_SITE = FILES.flatMap((file) =>
  classSites(fs.readFileSync(file, "utf8"), relativeName(file)),
);

describe("the icon button has one implementation", () => {
  it("no raw <button> wears .dp-iconbtn — the primitive is the only thing that writes it", () => {
    expect(EVERY_SITE.filter((hit) => hit.endsWith(":button"))).toEqual([]);

    /* Positive controls — the matcher must SEE a raw button in the two
       spellings a call site would actually use, and must let the stub past. */
    expect(classSites('<button type="button" className="dp-iconbtn">', "x")).toEqual(["x:button"]);
    expect(classSites("<button className={`dp-iconbtn ${extra}`}>", "x")).toEqual(["x:button"]);
    expect(classSites('<span className="dp-iconbtn dp-iconbtn--stub">', "x")).toEqual(["x:span"]);
    /* …and must NOT read a modifier handed to the primitive as a raw button. */
    expect(classSites('<IconButton className="dp-iconbtn--theme">', "x")).toEqual([]);
  });

  it("the stub is still a span, and it is the only non-button wearing the class", () => {
    /* Not "ChromeStubs is exempt" — the SHAPE is what is allowed, so this reads
       what the tree actually has rather than trusting the carve-out's name. */
    expect(EVERY_SITE.filter((hit) => !hit.endsWith(":button"))).toEqual([
      "foundation/ChromeStubs.tsx:span",
    ]);
  });

  it("exactly one component in the client is named IconButton", () => {
    /* NOT a shared `/g` regex: `test` on a global regex carries `lastIndex`
       between calls, so the next file it is asked about is read from the middle
       and a real second declaration slips through. */
    const DECLARATION = /export\s+(?:const|function)\s+IconButton\b/;
    const declaring = FILES.filter((file) => DECLARATION.test(fs.readFileSync(file, "utf8"))).map(
      relativeName,
    );

    expect(declaring).toEqual(["foundation/primitives.tsx"]);

    /* Positive control: the exact line #276 deleted from the marketing kit must
       still read as a declaration, or this arm goes green the day somebody puts
       it back in that spelling. */
    expect(
      DECLARATION.test("export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>("),
    ).toBe(true);
  });

  it("the primitive forwards its ref — two popover triggers are positioned off it", () => {
    /* `ReportBugButton` and `LobbyUtilityMenu` hand `useAnchoredPanel` a
       `triggerRef`, and each panel is placed against that element's measured
       box. A source arm cannot see a placement, so it pins the one thing that
       makes the placement possible. */
    const primitives = fs.readFileSync(path.join(CLIENT_SRC, "foundation/primitives.tsx"), "utf8");
    const FORWARDED =
      /export const IconButton = forwardRef<HTMLButtonElement,[\s\S]{0,400}?ref=\{ref\}/;

    expect(FORWARDED.test(primitives)).toBe(true);
    expect(FORWARDED.test("export function IconButton({ label }) { return <button />; }")).toBe(
      false,
    );
  });
});
