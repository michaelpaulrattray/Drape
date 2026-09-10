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
 * ⚠ **AND THE SENTENCE ABOVE WAS AN OVERCLAIM UNTIL THE GATE REVIEW OF PR #750
 * READ IT AGAINST THE MATCHER.** The first shape saw three literal spellings of
 * a class attribute and not `cn(…)` — which is the house style and is what the
 * primitive itself writes — so the promise held for the spellings it happened
 * to parse. `cn()` is parsed now, and the exemption it was silently granting is
 * declared as `THE_PRIMITIVE` below. **The limit that remains, stated rather
 * than left to be discovered: only STRING LITERALS are read.** A class name
 * reached through a variable or a lookup table is invisible to this file, so a
 * clean run is a floor and not coverage.
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

/**
 * Every `<tag …dp-iconbtn…>` in one source, as `label:tag` pairs.
 *
 * ⚠ **`cn(…)` IS READ AS WELL AS THE THREE LITERAL SPELLINGS, AND THE FIRST
 * SHAPE OF THIS FILE COULD NOT SEE IT** (found by the gate review of PR #750).
 * `cn()` is this codebase's stated house style for merging classes and is what
 * the primitive itself writes — so a matcher blind to it gave the primitive a
 * free pass through a BLIND SPOT rather than through a declared exemption, and
 * an eighth raw `<button className={cn("dp-iconbtn", open && "is-active")}>`
 * would have shipped green under a docblock promising the opposite.
 */
function classSites(source: string, label: string): string[] {
  const hits: string[] = [];
  const CLASS_ATTR =
    /class(?:Name)?\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\}|\{\s*cn\(([^)]*)\))/g;
  for (let m = CLASS_ATTR.exec(source); m; m = CLASS_ATTR.exec(source)) {
    /* For the `cn(…)` shape the captured text is the whole argument list; only
       its STRING literals are class names — an identifier like `className` is a
       value this reader cannot follow, and pretending otherwise would be the
       shape-match-where-a-declaration-exists class all over again. */
    const value =
      m[1] ??
      m[2] ??
      m[3] ??
      (m[4] ? Array.from(m[4].matchAll(/["'`]([^"'`]*)["'`]/g), (s) => s[1]).join(" ") : "");
    /* The BASE class alone. `\b` also matches `dp-iconbtn--theme`, which is the
       shell's own 28px modifier and is handed BY a call site TO the primitive —
       a legitimate use the first shape of this arm reported as an offender. */
    if (!/\bdp-iconbtn(?![\w-])/.test(value)) continue;
    const tag = owningTag(source, m.index);
    if (tag) hits.push(`${label}:${tag}`);
  }
  return hits;
}

/**
 * The one raw `<button>` that may wear the class: the primitive's own.
 *
 * ⚠ **It is a DECLARED exemption now and it was an accident before.** Naming it
 * here means arm 1 fails if the primitive grows a SECOND raw button, and it
 * fails if this one moves house — neither of which a blind matcher could have
 * told anyone about.
 */
const THE_PRIMITIVE = "foundation/primitives.tsx:button";

const EVERY_SITE = FILES.flatMap((file) =>
  classSites(fs.readFileSync(file, "utf8"), relativeName(file)),
);

describe("the icon button has one implementation", () => {
  it("no raw <button> wears .dp-iconbtn — the primitive is the only thing that writes it", () => {
    expect(EVERY_SITE.filter((hit) => hit.endsWith(":button"))).toEqual([THE_PRIMITIVE]);

    /* Positive controls — the matcher must SEE a raw button in every spelling a
       call site would actually use, INCLUDING `cn()`, which is the house style
       and was the review's finding. */
    expect(classSites('<button type="button" className="dp-iconbtn">', "x")).toEqual(["x:button"]);
    expect(classSites("<button className={`dp-iconbtn ${extra}`}>", "x")).toEqual(["x:button"]);
    expect(classSites('<button className={cn("dp-iconbtn", open && "is-active")}>', "x")).toEqual([
      "x:button",
    ]);
    expect(classSites('<span className="dp-iconbtn dp-iconbtn--stub">', "x")).toEqual(["x:span"]);
    /* …and must NOT read a modifier handed to the primitive as a raw button,
       in either spelling. */
    expect(classSites('<IconButton className="dp-iconbtn--theme">', "x")).toEqual([]);
    expect(classSites('<IconButton className={cn("dp-iconbtn--theme")}>', "x")).toEqual([]);
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

  it("the primitive is where the tooltip and the accessible name come from", () => {
    /*
      ⚠ THE GATE REVIEW OF PR #750 ASKED FOR THIS ARM AND IT WAS RIGHT.
      `section02-guard.test.ts` used to assert `title="Report a bug"` ON THE
      CALL SITE; the re-pointed arm asserts `label="Report a bug"`, which proves
      the prop is PASSED and not that anything uses it.

      **Centralising a contract without pinning it trades six small drifts for
      one silent global one**: delete these two lines and every icon button in
      the chrome loses its tooltip AND its accessible name at once, product-wide,
      with every suite still green.
    */
    const primitives = fs.readFileSync(path.join(CLIENT_SRC, "foundation/primitives.tsx"), "utf8");
    const body = primitives.slice(primitives.indexOf("export const IconButton = forwardRef"));
    const declaration = body.slice(0, body.indexOf("</button>"));

    expect(declaration, "the tooltip").toMatch(/title=\{label\}/);
    expect(declaration, "the accessible name").toMatch(/aria-label=\{label\}/);

    /* Both are set BEFORE the rest spread, which is what lets a call site with a
       genuinely different tooltip override one — the ordering is a decision, so
       it is pinned rather than left to survive a tidy-up. */
    expect(declaration.indexOf("title={label}")).toBeLessThan(declaration.indexOf("{...rest}"));

    /* Positive control: a primitive missing them must not read as compliant. */
    const stripped = "export const IconButton = forwardRef(function IconButton({ label }, ref) {\n  return <button ref={ref} className={cn('dp-iconbtn')}>{children}</button>;\n});";
    expect(/title=\{label\}/.test(stripped)).toBe(false);
    expect(/aria-label=\{label\}/.test(stripped)).toBe(false);
  });
});
