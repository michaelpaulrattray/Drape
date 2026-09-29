/**
 * THE MEMORY INDEX'S ACCOUNTING READER — the Janitor's third reading (#1472).
 *
 * # What it is about
 *
 * `C:\Users\Admin\.claude\projects\C--Users-Admin-Drape\memory\` is the file
 * memory every session in this project shares. It sits OUTSIDE this repository,
 * under no version control, no merge driver and no CI — so nothing has ever
 * been able to notice when its structure breaks, and the breakage is silent by
 * construction: `MEMORY.md` is read WITH A LIMIT, and a pointer past the limit
 * is dropped from context with no error and no warning.
 *
 * That is not hypothetical. On 2026-09-26 the index stood at 26,134 bytes and
 * the invisible tail held `gh-secondary-limit-rest-works`; the next shift spent
 * its first ten minutes re-deriving that exact lesson from scratch. The rule
 * that keeps the index short — an instrument, toolbelt or ceremony memory goes
 * in its SUB-INDEX, never in `MEMORY.md` — is prose, and it was broken within
 * two days of being written, which is most of why the index regrew 17,081 ->
 * 18,045 bytes before #1431 and #1466 pulled it back.
 *
 * # What it reports
 *
 * It walks the indexes transitively from `MEMORY.md` and reports what a hand
 * count gets wrong:
 *
 *   - **unreachable** — a memory on disk that no index points at. It exists and
 *     no session will ever be told it does.
 *   - **dangling** — a pointer whose file is not there. A session that follows
 *     it gets nothing, at the moment it wanted something.
 *   - **duplicate** — two pointers at one file, which becomes a contradiction
 *     the moment their hooks disagree.
 *   - **joined** — two entries on one line, invisible to any reader keying on
 *     `^- [`.
 *   - **truncated hooks** — a hook that stops mid-sentence in an ellipsis.
 *     Reported, not a fault: it is a readability finding, not a broken link.
 *
 * The first four are FAULTS and the exit code is 2 when there are any.
 *
 * # ⚠ IT IS NOT, AND CANNOT BE, A GUARD
 *
 * No suite in `server/` can read the real memory directory — it is not in the
 * repository, CI has never seen it, and a test that depended on this machine's
 * home directory would be red on every other machine. So this runs from a
 * SHIFT'S OWN HANDS, on the Janitor's three-day clock
 * (`docs/JANITOR_LOG.md`), exactly as `janitor-backup-retention.mts` does.
 * `server/memoryIndexAudit.test.ts` proves the reader itself against fixture
 * trees, which is the half that CAN be automated.
 *
 * That split is the whole design, and #286's lesson is why it is written down
 * here rather than left implied: a mechanism with no caller does not exist.
 *
 * # ⚠ THE POINTER PATTERN ADMITS A PATH, AND UNTIL #1472 IT DID NOT
 *
 * The disposable this is promoted from matched `](name.md)` with no `/` in its
 * character class, so a pointer carrying a path was invisible to it — which hid
 * a 145th truncated hook at `MEMORY.md:80`, pointing at
 * `../../../../Drape/.agents/mailbox/fable-1678.md`. A reader blind to a whole
 * SHAPE of pointer reports a clean index either way, which is the worst
 * direction for an instrument whose entire job is to find the pointer nobody
 * has looked at.
 *
 * A path-carrying target is resolved and checked like any other, but it is
 * never FOLLOWED as a sub-index: an index of this structure lives in the
 * memory directory, and walking out of it would start reading mailbox entries
 * as indexes.
 *
 * # Running it
 *
 *     npx tsx scripts/memory-index-audit.mts              # the real directory
 *     npx tsx scripts/memory-index-audit.mts --root <dir> # a fixture tree
 *
 * No database, no network, no `gh`. It reads files and prints.
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const DEFAULT_ROOT = "C:/Users/Admin/.claude/projects/C--Users-Admin-Drape/memory";

const rootArg = process.argv.indexOf("--root");
if (rootArg !== -1 && !process.argv[rootArg + 1]) {
  console.error("REFUSING: --root was given with no directory.");
  process.exit(1);
}
const ROOT = rootArg === -1 ? DEFAULT_ROOT : resolve(process.argv[rootArg + 1]!);

if (!existsSync(join(ROOT, "MEMORY.md"))) {
  /* A missing index is a REFUSAL, never an empty report: "0 faults" over a
     directory that was not there is the vacuous pass this reader exists to
     stop being possible elsewhere. */
  console.error(`REFUSING: no MEMORY.md under ${ROOT}`);
  process.exit(1);
}

/* The index is the ROOT of the walk; the sub-indexes are DERIVED from it — a
   fourth sub-index added later is found here without editing any list, which is
   the whole reason not to hard-code them. */
const ENTRY = "MEMORY.md";

type Entry = { index: string; line: number; target: string; hook: string };

/* Anything up to the closing paren that ends in `.md`. The class is deliberately
   NOT `[A-Za-z0-9._-]`: that one could not see a pointer carrying a path, and a
   reader blind to a shape reports a clean index either way (see the header). */
const POINTER = /\]\(([^)\s]+\.md)\)/g;

/** A target inside the memory directory itself — the only kind that may be walked. */
const isLocal = (target: string) => !/[\\/]/.test(target);

function readEntries(indexFile: string): {
  entries: Entry[];
  joined: { line: number; text: string }[];
  bytes: number;
  lines: number;
} {
  const raw = readFileSync(join(ROOT, indexFile), "utf8");
  const lines = raw.split(/\r?\n/);
  const entries: Entry[] = [];
  const joined: { line: number; text: string }[] = [];

  lines.forEach((text, i) => {
    /* A SECOND `- [` inside one line is two entries with no newline between
       them. The first hook runs into the next entry and the second entry is
       invisible to `^- [`. */
    const opens = text.split("- [").length - 1;
    if (opens > 1) joined.push({ line: i + 1, text });

    POINTER.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = POINTER.exec(text)) !== null) {
      const target = m[1]!;
      const hook = text.slice(m.index + m[0].length).replace(/^\s*—\s*/, "");
      entries.push({ index: indexFile, line: i + 1, target, hook });
    }
  });

  return { entries, joined, bytes: Buffer.byteLength(raw, "utf8"), lines: lines.length };
}

/* THE WALK. Start at MEMORY.md; a local pointer whose target carries pointers
   of its own is itself an index and is followed. A visited set terminates a
   cycle. */
const visited = new Set<string>();
const allEntries: Entry[] = [];
const allJoined: { index: string; line: number; text: string }[] = [];
const indexReport: { file: string; bytes: number; lines: number; pointers: number }[] = [];

const queue = [ENTRY];
while (queue.length > 0) {
  const file = queue.shift()!;
  if (visited.has(file)) continue;
  visited.add(file);
  if (!existsSync(join(ROOT, file))) continue;

  const { entries, joined, bytes, lines } = readEntries(file);
  allEntries.push(...entries);
  allJoined.push(...joined.map((j) => ({ index: file, ...j })));
  indexReport.push({ file, bytes, lines, pointers: entries.length });

  /* A target is a sub-index when it carries markdown pointers of its own. Read
     it and find out rather than keeping a list that drifts (working law 4).
     ANY pointer counts, and the threshold is not a judgement call: measured
     across the real directory, the ONLY files carrying `](x.md)` are the four
     indexes — every ordinary memory cross-links in `[[name]]` wiki style. A
     count threshold was tried first and the fixture arm that deletes ONE
     pointer from a sub-index caught it: dropping that sub-index under the
     threshold un-indexed it, and the reader called all five of its children
     unreachable instead of the one. Wrong toward noise rather than silence,
     and still wrong. */
  for (const e of entries) {
    if (!isLocal(e.target) || visited.has(e.target)) continue;
    const child = join(ROOT, e.target);
    if (!existsSync(child)) continue;
    POINTER.lastIndex = 0;
    if (POINTER.test(readFileSync(child, "utf8"))) queue.push(e.target);
  }
}

const onDisk = readdirSync(ROOT)
  .filter((f) => f.endsWith(".md"))
  .filter((f) => statSync(join(ROOT, f)).isFile());

const pointed = new Set(allEntries.map((e) => e.target));

const unreachable = onDisk.filter((f) => f !== ENTRY && !pointed.has(f));
const dangling = allEntries.filter((e) => !existsSync(join(ROOT, e.target)));

const byTarget = new Map<string, Entry[]>();
for (const e of allEntries) {
  const list = byTarget.get(e.target) ?? [];
  list.push(e);
  byTarget.set(e.target, list);
}
const duplicates = [...byTarget.entries()].filter(([, v]) => v.length > 1);

const ellipsis = allEntries.filter((e) => /(\.\.\.|…)\s*$/.test(e.hook));

console.log(`root: ${ROOT}`);
console.log(`\nINDEXES WALKED (${indexReport.length}):`);
for (const r of indexReport) {
  console.log(
    `  ${r.file.padEnd(34)} ${String(r.bytes).padStart(6)} bytes  ${String(r.lines).padStart(4)} lines  ${String(r.pointers).padStart(4)} pointers`,
  );
}
console.log(`\nmemory files on disk: ${onDisk.length}`);
console.log(`distinct files pointed at: ${pointed.size}`);

console.log(`\nUNREACHABLE (on disk, no index points at it): ${unreachable.length}`);
for (const f of unreachable) console.log(`  ${f}`);

console.log(`\nDANGLING (pointer with no file): ${dangling.length}`);
for (const d of dangling) console.log(`  ${d.index}:${d.line} -> ${d.target}`);

console.log(`\nDUPLICATE POINTERS (one file, several entries): ${duplicates.length}`);
for (const [target, list] of duplicates) {
  console.log(`  ${target}`);
  for (const e of list) console.log(`    ${e.index}:${e.line}  "${e.hook.slice(0, 90)}"`);
}

console.log(`\nJOINED LINES (two entries, one line): ${allJoined.length}`);
for (const j of allJoined) console.log(`  ${j.index}:${j.line}  ${j.text.slice(0, 120)}…`);

console.log(`\nHOOKS ENDING MID-SENTENCE IN AN ELLIPSIS: ${ellipsis.length}`);
for (const e of ellipsis) console.log(`  ${e.index}:${e.line} -> ${e.target}`);

const faults = unreachable.length + dangling.length + duplicates.length + allJoined.length;
console.log(`\nFAULTS (unreachable + dangling + duplicate + joined): ${faults}`);

/* A script exits when its work is done, and the code IS half the report:
   2 means there is something to fix, which is what a shift's close reads. */
process.exit(faults === 0 ? 0 : 2);
