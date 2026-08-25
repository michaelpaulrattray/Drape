/**
 * DISPOSABLE — **THE YIELD-RULE SWEEP** (ordered fable-1670 §5).
 *
 * The rule, named as a class after four instances on one slice:
 * **HOUSE PROSE THAT ANSWERS AN AXIS THE BRIEF ANSWERED MUST STAND DOWN.**
 *
 * This derives the population rather than eyeballing it: every sentence the
 * per-candidate SUBJECT composition can emit, with the guard (if any) standing
 * in front of it. A block with no `stated(...)`/`statedAxis(...)` in its
 * condition is one that CANNOT yield — which is the finding, not the fix.
 *
 * ⚠ It reports EMITTERS, not contradictions. Whether a stated fact can actually
 * reach a given axis is a judgement about the vocabulary, and that judgement is
 * annotated by hand in the report — this script's job is to make sure the list
 * is complete and to fail loudly if the shapes it scans stop existing.
 *
 * Read-only. No network, no database, no spend.
 */
import { readFileSync } from "node:fs";

const FILES = [
  "server/castingV2/realizedAxes.ts",
  "server/castingV2/cohortPhotorealHuman.ts",
];

type Emitter = { file: string; line: number; label: string; guard: string };
const found: Emitter[] = [];

for (const file of FILES) {
  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  for (const [i, line] of lines.entries()) {
    /* An emitted block is a string literal opening with an ALL-CAPS label and a colon. */
    /*
      ⚠ THE FIRST VERSION OF THIS PATTERN MISSED `PHYSIQUE`, WHICH IS THE MOST
      IMPORTANT BLOCK IN THE SWEEP. It required the label immediately after the
      quote, and `describeBuild` returns a template literal that opens with a
      SPACE (` PHYSIQUE: ...`) because it is joined onto the SUBJECT sentence.
      One missing block out of forty-two, and it was the one the founder's own
      complaint is about — a regex standing in for a declaration, reporting a
      complete list either way, which is the class CLAUDE.md names.
    */
    const label = line.match(/["`]\s*([A-Z][A-Z '’]{2,30}):/);
    if (!label) continue;
    /* Look back for the nearest enclosing `if (...)` within twenty lines. */
    let guard = "(none found within 20 lines)";
    for (let back = i; back >= Math.max(0, i - 20); back -= 1) {
      const candidate = lines[back]!;
      if (/^\s*(if|} else if)\s*\(/.test(candidate)) { guard = candidate.trim(); break; }
      if (/^\s*(export )?(function|const [A-Z_]+ =)/.test(candidate) && back !== i) break;
    }
    found.push({ file, line: i + 1, label: label[1]!, guard });
  }
}

if (found.length === 0) {
  throw new Error("the scanner found NO labelled blocks — the shape it reads has changed and a short list would read as a clean sweep");
}

/*
  ⚠ THERE ARE THREE YIELD MECHANISMS AND THE FIRST VERSION OF THIS SCRIPT KNEW
  ONE. A block can stand down because of `stated(axis)`, because the HAIR
  deference gate covered it, or because the composer prefers `intent.X` over the
  drawn value. A sweep that reports only the first would file the other two as
  "cannot yield", which is the exact wrong answer in the exact wrong direction.
*/
function yieldKind(guard: string): string | null {
  if (/stated\s*\(|statedAxis\s*\(/.test(guard)) return "stated(axis)";
  if (/deference|hairDeference/.test(guard)) return "hair deference";
  if (/intent\.[a-zA-Z]+/.test(guard)) return "intent precedence";
  return null;
}
const yields = (guard: string) => yieldKind(guard) !== null;

console.log(`THE YIELD-RULE SWEEP — ${found.length} labelled blocks across ${FILES.length} files\n`);
console.log("A block whose guard mentions stated(...) YIELDS to the brief. One whose guard does not");
console.log("cannot — and whether that matters depends on whether a stated fact can reach its axis,");
console.log("which is annotated by hand in the report.\n");

const cannot = found.filter((e) => !yields(e.guard));
const can = found.filter((e) => yields(e.guard));

console.log(`══ YIELDS TO A STATED FACT (${can.length}) ══`);
for (const e of can) console.log(`  ${e.label.padEnd(22)} ${e.file}:${e.line}\n      ${e.guard}`);
console.log(`\n══ DOES NOT YIELD (${cannot.length}) ══`);
for (const e of cannot) console.log(`  ${e.label.padEnd(22)} ${e.file}:${e.line}`);

console.log("\n⚠ Most of the non-yielding blocks are STRUCTURAL (framing, capture, background,");
console.log("  realism) and SHOULD NOT yield — they are the sheet, not the person. The report");
console.log("  names the ones that describe a PERSON, which is where the rule bites.");

process.exit(0);
