/**
 * #1969 — "canonical" is our word, not hers.
 *
 * His word, 2026-10-08, verbatim: *"on the canonical views thing yes change
 * the wording."* The Sign dialog told a customer it "builds five canonical
 * views" — a term from the pipeline (D-39's view package), not from anyone
 * casting a person. The disappearing-technology law's third question asks
 * where the technology shows; this was one place.
 *
 * The sweep (law 7) found the same word in two more sentences a customer
 * reads — the lobby's comp-card option ("The canonical card") and the
 * delete-a-cast confirmation ("every canonical view") — plus one server
 * refusal that `readableFailure` passes straight to a toast
 * (`server/lib/boardOps.ts`, pinned in `server/r7-canvas-package-readers.test.ts`).
 *
 * ⚠ THE WORD STAYS IN THE CODE. `CanonicalViewAngle`, `CANONICAL_VIEW_ANGLES`,
 * `isCanonicalViewType` and a great many comments are ordinary engineering
 * vocabulary and are none of the customer's business either way. So this guard
 * does not grep: it parses each file and reads only the two places a sentence
 * can live — string literals (template pieces included) and the text between
 * JSX tags. Identifiers, type names and comments are not nodes it reads, which
 * the positive control below proves rather than asserts.
 */
import { globSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const CLIENT = join(import.meta.dirname, "..");
const WORD = /canonical/i;

/** Every string literal and JSX text in a source text that carries the word. */
function sentencesWithTheWord(fileName: string, text: string): string[] {
  const kind = fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.ESNext, true, kind);
  const hits: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
    ) {
      if (WORD.test(node.text)) hits.push(node.text.trim());
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return hits;
}

const sourceFiles = () =>
  globSync("**/*.{ts,tsx}", { cwd: CLIENT })
    .filter((name) => !/\.test\.tsx?$/.test(name))
    .map((name) => ({ name: name.split(sep).join("/"), text: readFileSync(join(CLIENT, name), "utf8") }));

describe("#1969 — no sentence a customer reads says 'canonical'", () => {
  it("THE SWEEP SAW THE CLIENT — an empty walk must never read as clean", () => {
    const names = sourceFiles().map(({ name }) => name);
    expect(names.length).toBeGreaterThan(200);
    for (const surface of [
      "features/castingV2/components/SignConfirm.tsx",
      "features/lobby/ModelCardChooser.tsx",
      "foundation/DestructiveConfirm.tsx",
    ]) {
      expect(names).toContain(surface);
    }
  });

  it("no string or JSX text anywhere in the client carries the word", () => {
    const offenders = sourceFiles().flatMap(({ name, text }) =>
      sentencesWithTheWord(name, text).map((hit) => `${name}: ${JSON.stringify(hit)}`),
    );
    expect(offenders, `"canonical" is pipeline vocabulary (his word, #1969):\n${offenders.join("\n")}`).toEqual([]);
  });

  it("the three sentences say what they now say, so the arm above cannot pass on a deleted line", () => {
    const read = (file: string) => readFileSync(join(CLIENT, file), "utf8").replace(/\s+/g, " ");
    expect(read("features/castingV2/components/SignConfirm.tsx")).toContain(
      "Locks this face and builds five matching views of them. Nothing else in the casting changes.",
    );
    expect(read("features/lobby/ModelCardChooser.tsx")).toContain("Every view of them, on one card.");
    expect(read("foundation/DestructiveConfirm.tsx")).toContain(
      "Their signed face, all of their views and every take made with them",
    );
  });

  it("POSITIVE AND NEGATIVE CONTROLS — reads sentences, never identifiers or comments", () => {
    // Must NOT flag: types, constants, calls, imports, comments.
    const innocent = [
      `import { type CanonicalViewAngle, CANONICAL_VIEW_ANGLES } from "@shared/boardTypes";`,
      `const ok = isCanonicalViewType(asset.viewType);`,
      `// the canonical six, D-39`,
      `/* The canonical comp card, statically */ const x = 1;`,
      `const el = <p>{/* canonical */}Every view of them</p>;`,
    ].join("\n");
    expect(sentencesWithTheWord("innocent.tsx", innocent)).toEqual([]);

    // MUST flag every shape a customer sentence can take.
    expect(sentencesWithTheWord("a.tsx", `const a = <p>Builds five canonical views.</p>;`)).toHaveLength(1);
    expect(sentencesWithTheWord("b.ts", `const b = { desc: 'The canonical card' };`)).toHaveLength(1);
    expect(sentencesWithTheWord("c.ts", `const c = "Every canonical view " + "goes";`)).toHaveLength(1);
    expect(sentencesWithTheWord("d.ts", "const d = `Five canonical ${n} views`;")).toHaveLength(1);
  });
});
