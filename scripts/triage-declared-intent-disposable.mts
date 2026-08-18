/**
 * ${symbol}(?![A-Za-z0-9_])Does the DECLARATION say why the symbol exists?
 *
 * The cleanup milestone's reading list is 118 symbols whose only importer is a
 * test. Reading each one costs a file open and a judgement — except that a
 * large share of them ANSWER THE QUESTION IN THEIR OWN DOCBLOCK: "Test seam:
 * …", "Exported for the contract test", "for the reverse-direction test",
 * "never used at runtime". A symbol that declares its own purpose has already
 * been triaged by the person who wrote it.
 *
 * So this reads the comment block immediately above each declaration and asks
 * one question: does it name a test, a suite, or a report as the reason?
 *
 * It DECIDES NOTHING. A DECLARED symbol is a candidate for KEEP that a human
 * still confirms; a SILENT one is where the milestone's reading time goes. The
 * value is in the split, not in the verdict.
 *
 * # Controls (law 2 — they run first and refuse the verdict on failure)
 *
 *  positive  SYSTEM_PROMPT_FOR_TESTS — "Exported for the prompt-contract
 *            tests; never used at runtime" — must read DECLARED.
 *  negative  isBilateral — "Facets rendered on both sides, with cross-side
 *            sameness asserted" — must read SILENT. It is the trap this
 *            instrument would otherwise fall into: ordinary prose about
 *            assertions is not a statement about tests, and a matcher keyed on
 *            "assert" would call it DECLARED.
 */
import { readFileSync } from "node:fs";

type Row = { symbol: string; file: string };

/** The reason vocabulary. Deliberately narrow — see the negative control. */
const DECLARES = /\btests?\b|\bsuite\b|\bspec\b|never used at runtime/i;

function docblockAbove(source: string, symbol: string): string | null {
  const declaration = new RegExp(
    `^export (?:async )?(?:function|const|class) ${symbol}(?![A-Za-z0-9_])`,
    "m",
  );
  const match = declaration.exec(source);
  if (!match) return null;
  const before = source.slice(0, match.index);
  const lines = before.split("\n");
  const block: string[] = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line === "") { if (block.length) break; continue; }
    if (line.startsWith("*") || line.startsWith("/*") || line.startsWith("//")) {
      block.unshift(line);
      if (line.startsWith("/*")) break;
      continue;
    }
    break;
  }
  return block.length ? block.join(" ") : "";
}

function classify(row: Row): "DECLARED" | "SILENT" | "NOT FOUND" {
  let source: string;
  try { source = readFileSync(row.file, "utf8"); } catch { return "NOT FOUND"; }
  const block = docblockAbove(source, row.symbol);
  if (block === null) return "NOT FOUND";
  return DECLARES.test(block) ? "DECLARED" : "SILENT";
}

const CONTROLS: Array<{ row: Row; expect: "DECLARED" | "SILENT" }> = [
  {
    row: { symbol: "SYSTEM_PROMPT_FOR_TESTS", file: "server/castingV2/interpreter.ts" },
    expect: "DECLARED",
  },
  {
    row: { symbol: "isBilateral", file: "server/castingV2/zoneScope.ts" },
    expect: "SILENT",
  },
];

console.log("CONTROLS");
let controlsPass = true;
for (const control of CONTROLS) {
  const got = classify(control.row);
  const ok = got === control.expect;
  controlsPass &&= ok;
  console.log(
    `  ${control.expect === "DECLARED" ? "positive" : "negative"}  `
    + `${control.row.symbol.padEnd(26)} ${got.padEnd(10)} ${ok ? "pass" : "FAIL"}`,
  );
}
if (!controlsPass) {
  console.log("REFUSED — the instrument failed its own controls; no verdict printed.");
  process.exit(1);
}

/** The list arrives on stdin as `symbol<TAB>file` lines (the sweep's own shape). */
const rows: Row[] = readFileSync(0, "utf8")
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    const [symbol, file] = line.split(/\s+/);
    return { symbol, file };
  });

const tally = { DECLARED: 0, SILENT: 0, "NOT FOUND": 0 };
const silent: Row[] = [];
for (const row of rows) {
  const verdict = classify(row);
  tally[verdict]++;
  if (verdict === "SILENT") silent.push(row);
}

console.log(`\n${rows.length} symbols read`);
console.log(`  DECLARED   ${tally.DECLARED}\tthe declaration names a test, suite or report`);
console.log(`  SILENT     ${tally.SILENT}\tno stated reason — this is the reading list`);
console.log(`  NOT FOUND  ${tally["NOT FOUND"]}\tdeclaration not matched (type/interface, or re-export)`);
console.log("\nSILENT — where the milestone's reading time goes");
for (const row of silent) console.log(`  ${row.symbol.padEnd(38)} ${row.file}`);
process.exit(0);
