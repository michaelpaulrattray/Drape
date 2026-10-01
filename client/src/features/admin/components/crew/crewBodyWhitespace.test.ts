import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * #1135 — **a blank line a shift writes into a Crew card must reach his eye as
 * a blank line.**
 *
 * The defect this pins: every prose field on his page was rendered into an
 * element with no `white-space` declared, so `\n\n` collapsed to a single
 * space. A four-paragraph problem detail came out as a fifteen-line wall with
 * its headings buried mid-sentence, and **shifts had been writing those bodies
 * for months believing otherwise** — the whole switch list (#1132) was drafted
 * that way and had to be rewritten for the renderer as it actually is. It was
 * invisible to the briefing schema, to 517 green crew tests and to the rite's
 * conformance judge, and visible in four seconds to a browser (law 6).
 *
 * ⚠ **THE POPULATION IS DERIVED FROM THE BRIEFING HE ACTUALLY READS, NOT
 * TYPED.** Any field of `crew-briefing.json` whose value contains a newline is
 * prose meant to render as prose, so it must be rendered by a class that
 * preserves newlines. A shift that adds a SEVENTH such field — or starts
 * writing paragraphs into a field that has never held them — reddens here
 * rather than shipping him another wall. That is the class of the bug (working
 * law 7), and the two rules fixed on the day are only its two instances.
 *
 * **Three things it holds, because a class list alone would drift:**
 *  1. every newline-carrying field is in `RENDERED_BY` (completeness);
 *  2. the class each is mapped to really is the class the component renders it
 *     through (the map is checked at the markup, not trusted);
 *  3. that class declares `white-space` in `crew.css`.
 *
 * **What a source read cannot see**, said rather than implied: whether the
 * result is legible. That was DRIVEN at `localhost:3000/admin/crew`, both
 * themes, 1440×1100 — `output/_1135-{before,after}-problem-light.png`,
 * `_1135-after-problem-dark.png`. Measured there: the specimen body 354px →
 * 437px, and a single-paragraph card 146px → **146px**, which is the negative
 * control that matters (the fourteen switch cards, written as one tight
 * paragraph each to work around this defect, do not move).
 */

const HERE = __dirname;
const CSS = path.resolve(HERE, "crew.css");
const BRIEFING = path.resolve(HERE, "..", "..", "..", "..", "..", "..", "server/crew/crew-briefing.json");

/**
 * field path in the briefing → the CSS class its component renders it through,
 * and the accessor the markup uses. Both halves are checked below; a map entry
 * that lies about either one fails.
 */
const RENDERED_BY: Record<string, { className: string; accessor: string }> = {
  "needsYou[].productImpact": { className: "dp-crew__body", accessor: "card.productImpact" },
  "needsYou[].workedExample": { className: "dp-crew__body", accessor: "card.workedExample" },
  "needsYou[].recommendation": { className: "dp-crew__body", accessor: "card.recommendation" },
  "problems[].detail": { className: "dp-crew__body", accessor: "problem.detail" },
  "eyeItems[].question": { className: "dp-crew__body", accessor: "item.question" },
  "pipeline[].note": { className: "dp-crew__rowwhy", accessor: "item.note" },
  /* #1679 — the edition's shift note, in the stamp. The ONLY mapped field
     rendered by the PAGE rather than by a crew component, which is why the
     population below had to widen before this line could be written. */
  shift: { className: "dp-crew__stampnote", accessor: "stateQuery.data.briefing.shift" },
};

/** Every string field in the briefing whose value carries a newline. */
function fieldsCarryingANewline(node: unknown, at = ""): string[] {
  if (typeof node === "string") return node.includes("\n") ? [at] : [];
  if (Array.isArray(node)) return node.flatMap((child) => fieldsCarryingANewline(child, `${at}[]`));
  if (node && typeof node === "object") {
    return Object.entries(node).flatMap(([key, value]) =>
      fieldsCarryingANewline(value, at ? `${at}.${key}` : key),
    );
  }
  return [];
}

/** The body of a top-level `.class { … }` rule in crew.css, or null. */
function ruleBody(css: string, className: string): string | null {
  const match = new RegExp(`\\n\\.${className}\\s*\\{([^}]*)\\}`).exec(css);
  return match ? match[1] : null;
}

const css = fs.readFileSync(CSS, "utf8");
const briefing = JSON.parse(fs.readFileSync(BRIEFING, "utf8")) as unknown;
const CLIENT_SRC = path.resolve(HERE, "..", "..", "..", "..");

/**
 * ⚠ **EVERY `.tsx` THAT RENDERS THE BRIEFING, NOT EVERY `.tsx` IN THIS
 * DIRECTORY — widened by #1679, and the narrowness was load-bearing.**
 *
 * The markup check below could only ever see this folder. `shift` is rendered
 * by `client/src/pages/AdminCrew.tsx`, one directory up, so **no mapping for it
 * could be written that this suite was able to verify** — and an unverifiable
 * mapping is the one thing a guard built on `RENDERED_BY` must not accept.
 * That is why the field sat unmapped while shifts wrote prose into it, and why
 * edition 599's five-paragraph note turned **main** red here with the first PR
 * to merge main forward failing its gate for a reason that was not its diff.
 *
 * The population is DERIVED from two facts rather than listed: the components
 * live in this folder, and anything else that renders the briefing has to name
 * it. Measured at the tree this landed on — 19 files here, and 3 more outside
 * it (`pages/AdminCrew.tsx`, `features/admin/overview/NeedsHuman.tsx`,
 * `features/staff/StaffSurface.tsx`). A renderer that moves out of this folder
 * stays in scope; one that is added anywhere under `client/src` joins by
 * construction.
 */
function renderingSources(): { relative: string; collapsed: string }[] {
  const out: { relative: string; collapsed: string }[] = [];
  const seen = new Set<string>();
  const take = (absolute: string) => {
    const relative = path.relative(CLIENT_SRC, absolute).split(path.sep).join("/");
    if (seen.has(relative)) return;
    seen.add(relative);
    out.push({ relative, collapsed: fs.readFileSync(absolute, "utf8").replace(/\s+/g, " ") });
  };
  for (const file of fs.readdirSync(HERE)) {
    if (file.endsWith(".tsx")) take(path.resolve(HERE, file));
  }
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.resolve(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith(".tsx")) continue;
      if (!fs.readFileSync(full, "utf8").includes("briefing")) continue;
      take(full);
    }
  };
  walk(CLIENT_SRC);
  return out;
}

const rendering = renderingSources();
const sources = rendering.map((source) => source.collapsed);

// The card number lives in the docblock above and not in this title: the
// foundation's token guard reads `#1135` as a hex literal, and it strips
// comments but not strings.
describe("crew: prose a shift writes for him renders as prose", () => {
  const carrying = [...new Set(fieldsCarryingANewline(briefing))].sort();

  it("reads a real population — an empty read is a failure, not a pass", () => {
    // The floor: at edition 491 there were six such fields across 225 strings.
    // A reader that suddenly finds none has broken, not been fixed.
    expect(carrying.length).toBeGreaterThanOrEqual(5);
  });

  it("reads every file that RENDERS the briefing, including the page — the floor", () => {
    // The card number lives in the docblock on `renderingSources` and not in
    // this title, for the reason the file header already gives: the
    // foundation's token guard reads a four-digit card number as a hex
    // literal, and it strips comments but not strings.
    // ⚠ The arm that would have made #1679 impossible. The markup check below
    // only ever read this folder, so `shift` — rendered one directory up in
    // `pages/AdminCrew.tsx` — could not be mapped in a way this suite could
    // verify, and it therefore went unmapped while shifts wrote prose into it.
    // A narrowing of the walk reddens here rather than quietly shrinking what
    // the mapping arms can see.
    const named = rendering.map((source) => source.relative);
    expect(named.length, "the walk must find the crew's components").toBeGreaterThan(18);
    expect(named, "the page that renders the edition stamp").toContain("pages/AdminCrew.tsx");
    expect(named).toContain("features/admin/components/crew/CrewNeedsYou.tsx");
    expect(named).toContain("features/admin/components/crew/CrewPipeline.tsx");
  });

  it("every field he reads paragraphs in is mapped to the class that renders it", () => {
    const unmapped = carrying.filter((field) => !(field in RENDERED_BY));
    expect(
      unmapped,
      `These briefing fields contain a blank line but nothing here says which class renders them. ` +
        `Add each to RENDERED_BY (and give that class a white-space declaration in crew.css), ` +
        `or write the field as a single paragraph — what must not happen is his page flattening it silently.`,
    ).toEqual([]);
  });

  for (const [field, { className, accessor }] of Object.entries(RENDERED_BY)) {
    it(`${field} is rendered through .${className}, and that class keeps its newlines`, () => {
      // ⚠ The class is matched as a WHOLE token of the attribute, never as a
      // substring of it. The first shape of this arm used `\b…\b`, and `-` is
      // a word boundary: renaming the class to `dp-crew__rowwhy-renamed` in
      // the component left the arm green (driven — the sabotage that caught
      // it is the reason this comment exists).
      const rendered = sources.some((source) => {
        const pattern = new RegExp(
          `className="([^"]*)"[^>]*> ?\\{ ?${accessor.replace(".", "\\.")}\\b`,
          "g",
        );
        for (const hit of source.matchAll(pattern)) {
          if (hit[1].split(/\s+/).includes(className)) return true;
        }
        return false;
      });
      expect(rendered, `no component in this directory renders {${accessor}} with .${className}`).toBe(
        true,
      );

      const body = ruleBody(css, className);
      expect(body, `.${className} has no rule in crew.css`).not.toBeNull();
      expect(
        body as string,
        `.${className} renders prose he reads; without a white-space declaration a blank line in it collapses`,
      ).toMatch(/white-space:\s*pre-line/);
    });
  }

  it("the css reader can come back empty — the positive control for the arms above", () => {
    // Without this, a `ruleBody` that silently matched everything would make
    // every assertion above pass for the wrong reason (working law 2).
    // `.dp-crew__title` is a heading: it legitimately declares no white-space.
    const title = ruleBody(css, "dp-crew__title");
    expect(title).not.toBeNull();
    expect(title as string).not.toMatch(/white-space/);
  });
});
