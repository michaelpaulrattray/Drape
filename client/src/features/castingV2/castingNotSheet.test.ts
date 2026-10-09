/**
 * #2129 — the page of eight candidates is a CASTING, and "character sheet" is
 * the name of what a signed cast is delivered as.
 *
 * His word, 2026-10-09 (terminal), on a cast's room showing "THE PACKAGE":
 * *"where it says the package call it Character Sheet or somthing? thoughts"*,
 * and then, on the three options the relay offered: *"go with option 3"* —
 * CHARACTER SHEET for the delivered pictures, and "casting" for the page the
 * eight candidates live on, which had been called a "sheet" too. One word
 * meaning two things on neighbouring screens is the thing this guard stops
 * coming back.
 *
 * ⚠ THE WORD STAYS IN THE CODE. `CastingSheet.tsx`, `sheetGone`, `sheetOpen`,
 * the `sheet` sibling destination and a great many comments are engineering
 * vocabulary. So this guard does not grep: it parses each file and reads only
 * where a sentence can live — string literals (template pieces included) and
 * JSX text — and only text with a space in it, so a one-word enum value or a
 * class name is never a sentence. The controls below prove that rather than
 * assert it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..", "..", "..", "..");

/**
 * Every file on the casting road whose strings reach a customer: the three
 * casting pages, the casting feature's copy modules and components, the
 * delete-a-cast confirmation, and the server modules whose refusals and
 * receipts are shown as they are.
 */
const SURFACES = [
  "client/src/pages/CastingRoom.tsx",
  "client/src/pages/CastingSheet.tsx",
  "client/src/pages/CastingV2.tsx",
  "client/src/foundation/DestructiveConfirm.tsx",
  "client/src/features/castingV2/briefEcho.ts",
  "client/src/features/castingV2/retentionCopy.ts",
  "client/src/features/castingV2/sheetNotice.ts",
  "client/src/features/castingV2/components/SignConfirm.tsx",
  "server/castingV2/castProjection.ts",
  "server/castingV2/sheetGone.ts",
  "server/castingV2/rollRecovery.ts",
  "server/castingV2/rollService.ts",
  "server/castingV2/retryService.ts",
  "server/castingV2/refineService.ts",
  "server/castingV2/signService.ts",
  "server/routes/castingV2.ts",
];

/** "character sheet" is the delivered thing's name and is the one right use. */
const NAMED_RIGHTLY = /character[ -]sheets?/gi;
const WORD = /\bsheets?\b/i;

/** Every sentence (text with a space) in a source text that calls something a sheet. */
function sentencesSayingSheet(fileName: string, text: string): string[] {
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
      const said = node.text.trim();
      // A log line (`[module] …`) is for us, never shown to anyone.
      if (/\s/.test(said) && !said.startsWith("[") && WORD.test(said.replace(NAMED_RIGHTLY, ""))) {
        hits.push(said);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return hits;
}

const read = (file: string) => readFileSync(join(ROOT, file), "utf8");

describe("card 2129 — the candidates page is a casting, and only the delivered pictures are a sheet", () => {
  it("no sentence on the casting road calls the candidates page a sheet", () => {
    const offenders = SURFACES.flatMap((file) =>
      sentencesSayingSheet(file, read(file)).map((hit) => `${file}: ${JSON.stringify(hit)}`),
    );
    expect(
      offenders,
      `the page of candidates is a "casting" (his word, card 2129: "go with option 3"):\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("the room names the delivered pictures CHARACTER SHEET — so the arm above cannot pass on a deleted line", () => {
    const room = read("client/src/pages/CastingRoom.tsx");
    expect(room).toContain(">CHARACTER SHEET<");
    expect(room).toContain("Download character sheet");
    expect(room).not.toContain("THE PACKAGE");
    expect(room).not.toContain("Download package");
    expect(read("client/src/pages/CastingSheet.tsx")).toContain('breadcrumb="Casting / Candidates"');
    expect(read("client/src/pages/CastingV2.tsx")).toContain('label: "Open casting"');
  });

  it("the room carries the wording he approved on the Desk, 2026-10-09", () => {
    const room = read("client/src/pages/CastingRoom.tsx").replace(/\s+/g, " ");
    /* Since card 2144 the Delete item lives in the row's menu, and its words
       live in the module that builds that menu — the room draws them from
       there, which `packageRedoRow.test.ts` pins. */
    /* And since card 2150 the menu says the short word — his "in the menu
       just call it Regenerate and Delete not those full sentences". */
    expect(read("client/src/features/castingV2/packageRedoRow.ts"))
      .toContain('CHARACTER_SHEET_DELETE_LABEL = "Delete";');
    expect(room).toContain("characterSheetMenuItems({");
    expect(room).toContain("Use in a campaign · soon");
    expect(room).toContain("Use in a new campaign");
    expect(room).toContain("`Refine ${data.name.trim()}'s look` : \"Refine their look\"");
    expect(room).toContain("Refining arrives soon. Until then, a new direction means making a new character.");
    for (const retired of [
      "Delete this cast<",
      "Refine without recasting",
      "Cast in a campaign",
      "Cast into a new campaign",
      "Refining a signed Cast arrives",
    ]) {
      expect(room).not.toContain(retired);
    }
  });

  it("POSITIVE AND NEGATIVE CONTROLS — reads sentences, never identifiers, enums, classes or comments", () => {
    // Must NOT flag: identifiers, a one-word enum value, a class name, a URL
    // segment, a log line, comments, and the delivered thing's own name.
    const innocent = [
      `import { sheetGoneSentence } from "./sheetGone";`,
      `const open = data.sheetOpen && sibling.destination === "sheet";`,
      `const el = <div className="dpc-sheetcard dpc-menuhost">{/* the sheet */}x</div>;`,
      `const url = \`/api/cast/\${id}/sheet\`;`,
      `log.warn("[signSheet] the sheet did not arrive");`,
      `// a sheet of eight`,
      `const label = <span>CHARACTER SHEET</span>;`,
      `const name = "Download character sheet";`,
      `const file = "character-sheet.jpg";`,
    ].join("\n");
    expect(sentencesSayingSheet("innocent.tsx", innocent)).toEqual([]);

    // MUST flag every shape a customer sentence can take.
    expect(sentencesSayingSheet("a.tsx", `const a = <p>Nothing cast on this sheet yet</p>;`)).toHaveLength(1);
    expect(sentencesSayingSheet("b.ts", `const b = { label: "Open sheet" };`)).toHaveLength(1);
    expect(sentencesSayingSheet("c.ts", `const c = "Unsigned sheets clear " + "after thirty days";`)).toHaveLength(1);
    expect(sentencesSayingSheet("d.ts", "const d = `Cast from a sheet on ${day}`;")).toHaveLength(1);
    expect(sentencesSayingSheet("e.ts", `const e = "Your character sheet is ready — open the sheet";`)).toHaveLength(1);
  });
});
