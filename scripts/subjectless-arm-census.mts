/**
 * 3g's C/D census instrument — arms whose subject is a literal they declared.
 *
 * Reports every `it(...)` containing an `expect` in which NO identifier
 * reaches the product: not an import, not a dynamic `await import()` binding,
 * and not a module-scope helper whose own body reaches one. Such an arm cannot
 * fail on any change to Drape.
 *
 * Promoted from disposable with 3g's D sitting (ruled fable-1626 §5): it had
 * no reader until D needed it a second time, and an export with only a test —
 * or nothing — for a reader is what the disposition door refuses.
 *
 * ⚠ ITS NUMBER IS A CANDIDATE LIST, NEVER A CENSUS, and it is quoted with its
 * controls because IT FAILED TWICE BEFORE IT WAS BELIEVED:
 *
 *   - the first shape reported 2,614 of 9,045 — dominated by false positives,
 *     because a helper declared in the enclosing `describe` read as "no product
 *     symbol". `refineService.test.ts` alone has 36 such helpers.
 *   - the POSITIVE control then caught it SKIPPING any file with no product
 *     import at all — so a WHOLLY SUBJECTLESS FILE, its strongest possible
 *     specimen, was invisible. It read zero arms and reported zero, which is
 *     indistinguishable from a clean run.
 *   - the NEGATIVE control then caught it blind to `await import()`, which is
 *     how half of `changeRequests.test.ts` reaches its subjects.
 *
 * STATED LIMITS, both of which make it OVER-report:
 *   - ONE HOP only. A helper reaching the product through a second helper
 *     reads as unreachable.
 *   - it does not evaluate anything; a symbol mentioned in a comment inside an
 *     arm counts as used.
 *
 * So a row here is a QUESTION — "does this arm have a subject?" — and the
 * answer comes from opening it. Three of three "plain deletes" in 3g had a
 * live subject one import away.
 *
 * Usage:
 *   npx tsx scripts/subjectless-arm-census.mts            report
 *   npx tsx scripts/subjectless-arm-census.mts --controls run the controls only
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const IGNORE = new Set([
  "expect", "it", "test", "describe", "vi", "z",
  "beforeEach", "afterEach", "beforeAll", "afterAll",
]);

interface Arm {
  line: number;
  title: string;
  body: string;
}

function armsIn(src: string): Arm[] {
  const out: Arm[] = [];
  for (const m of src.matchAll(/\bit\(\s*(["'`])((?:\\.|(?!\1).)*)\1\s*,/g)) {
    let i = src.indexOf("{", m.index! + m[0].length);
    if (i < 0) continue;
    let depth = 0;
    let end = i;
    for (; end < src.length; end++) {
      if (src[end] === "{") depth++;
      else if (src[end] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    const body = src.slice(i, end + 1);
    if (!body.includes("expect(")) continue;
    out.push({ line: src.slice(0, m.index!).split("\n").length, title: m[2]!.slice(0, 70), body });
  }
  return out;
}

/** Every identifier in this file that reaches the product, one hop deep. */
function productReaching(src: string): Set<string> {
  const imported = new Set<string>();
  for (const m of src.matchAll(/import\s+(?:type\s+)?\{([^}]+)\}\s+from/g))
    for (const part of m[1]!.split(",")) imported.add(part.trim().split(/\s+as\s+/).pop()!.trim());
  for (const m of src.matchAll(/import\s+(\w+)\s+from/g)) imported.add(m[1]!);
  /* Dynamic: `const { getDb } = await import("./x")`.
   *
   * ⚠ ANCHORED ON THE DECLARATION and forbidden to cross a newline or a nested
   * brace. The first shape was `/\{([^}]+)\}\s*=\s*await\s+import\(/`, which is
   * GREEDY FROM THE FIRST BRACE IN THE FILE — on a real test file it captured
   * from the opening `describe(... => {` down to the first `}`, so the binding
   * names it "found" were whatever prose lay in between. It appeared to work
   * because that span usually happened to contain the name. Caught by the
   * negative control in `server/subjectlessArmCensus.test.ts` on its first run. */
  for (const m of src.matchAll(/(?:const|let|var)\s*\{([^{}\n]+)\}\s*=\s*await\s+import\(/g))
    for (const part of m[1]!.split(",")) imported.add(part.trim().split(/\s*:\s*/).pop()!.trim());
  for (const i of IGNORE) imported.delete(i);

  const reaching = new Set(imported);
  for (const m of src.matchAll(/^\s*(?:export\s+)?(?:const|let|function|async function)\s+(\w+)/gm)) {
    const chunk = src.slice(m.index!, m.index! + 4000);
    for (const id of chunk.matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
      if (imported.has(id[1]!)) {
        reaching.add(m[1]!);
        break;
      }
    }
  }
  return reaching;
}

export interface CensusRow {
  file: string;
  line: number;
  title: string;
}

export function sweep(files: string[]): { read: number; rows: CensusRow[] } {
  const rows: CensusRow[] = [];
  let read = 0;
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const reaching = productReaching(src);
    /* ⚠ A file with NO product import is NOT skipped. It used to be, and the
     * positive control caught it: a wholly subjectless file is this
     * instrument's strongest specimen and was invisible. Every arm in such a
     * file reaches no product symbol, which is precisely the finding. */
    for (const arm of armsIn(src)) {
      read++;
      let reaches = false;
      for (const id of arm.body.matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
        if (reaching.has(id[1]!)) {
          reaches = true;
          break;
        }
      }
      if (!reaches) rows.push({ file, line: arm.line, title: arm.title });
    }
  }
  return { read, rows };
}

export function testFilesUnder(roots: string[]): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.test\.tsx?$/.test(e.name)) out.push(full);
    }
  };
  for (const root of roots) walk(root);
  return out;
}

/* ⚠ Windows: `import.meta.url` is `file:///C:/…` while `process.argv[1]` is
 * `C:\…`, so the usual ``file://${argv[1]}`` comparison NEVER matches — the
 * script then prints nothing and exits 0, a silent no-op indistinguishable
 * from a clean run. Compared as resolved paths instead. */
const invokedDirectly =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const files = testFilesUnder(["server", "client/src", "shared"]);
  const { read, rows } = sweep(files);

  console.log(`arms READ (an it(...) containing an expect) : ${read}`);
  console.log(`arms reaching NO product symbol (CANDIDATES): ${rows.length}`);
  console.log("");
  console.log("A row is a QUESTION, not a verdict — open the arm. One hop only,");
  console.log("so this OVER-reports; it does not under-report by construction.");
  console.log("");

  const byFile = new Map<string, number>();
  for (const r of rows) byFile.set(r.file, (byFile.get(r.file) ?? 0) + 1);
  for (const [f, n] of [...byFile].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
    console.log(`  ${String(n).padStart(3)}  ${f}`);
  }

  if (read === 0) {
    console.error("REFUSING: read no arms at all — the reader is broken, not the suite clean.");
    process.exitCode = 1;
  }
}
