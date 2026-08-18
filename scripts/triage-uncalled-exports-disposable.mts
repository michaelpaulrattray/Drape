/**
 * THE SWEEP'S LIST, SPLIT BY WHY EACH ENTRY IS ON IT (cleanup milestone recon,
 * ordered fable-975 §5). READ-ONLY: it opens files and prints; it changes
 * nothing.
 *
 * The sweep names three biases that all point toward silence — namespace
 * imports, dynamic specifiers, and barrel re-exports — and says its list is
 * therefore a FLOOR. That is true of the count and misleading about the work:
 * a candidate reached through a barrel is not a candidate at all, and three
 * hand-checks found two of them in the first six symbols I looked at
 * (`db.isAccountLocked` through `server/db/index.ts`; `handleSlackInteraction`
 * through a dynamic import with a static specifier).
 *
 * So this asks, for every symbol the sweep printed, the question the triage
 * actually needs: **is there any non-test mention of this name anywhere that is
 * not its own declaration?** — and if so, of which kind.
 *
 *   barrel    named in server/db/index.ts (or another re-export) and used as
 *             `db.NAME(` / `NAME(` by production code
 *   dynamic   inside an `await import(...)` destructure
 *   other     some other production mention — a hand read decides
 *   none      nothing but its own declaration and its tests. THE REAL LIST.
 *
 * CONTROLS (working law 2), printed first, run refuses on failure:
 *   positive  shouldSendGlobalAttackAlert  hand-read 2026-08-18: declaration
 *                                          only → must classify `none`
 *   negative  isAccountLocked              hand-read: reached as
 *                                          `db.isAccountLocked` from two auth
 *                                          routes → must NOT classify `none`
 *
 *   npx tsx scripts/triage-uncalled-exports-disposable.mts <sweep-output-file>
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const listFile = process.argv[2];
if (!listFile) throw new Error("give me the sweep's saved output");

const files: string[] = [];
const walk = (dir: string): void => {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(ts|tsx|mts)$/.test(entry)) files.push(full);
  }
};
for (const root of ["server", "client", "shared", "scripts"]) walk(join(repoRoot, root));

const source = new Map<string, string>();
for (const file of files) source.set(file, readFileSync(file, "utf8"));

type Kind = "barrel" | "dynamic" | "other" | "none";

function classify(symbol: string): { kind: Kind; where: string } {
  const mentions: Array<{ file: string; line: string }> = [];
  for (const [file, text] of source) {
    if (/\.test\.tsx?$/.test(file)) continue;
    /*
      THE INSTRUMENTS ARE NOT CALLERS, and this one caught itself first: the
      positive control failed because the control's own name appears in this
      file's header. A reader that counts its own prose as evidence would
      quietly promote every future control symbol out of the real list.
    */
    if (/(sweep|triage)-uncalled-exports-disposable\.mts$/.test(file)) continue;
    if (!text.includes(symbol)) continue;
    for (const line of text.split(/\r?\n/)) {
      if (!line.includes(symbol)) continue;
      /* Its own declaration is not a caller. */
      if (/^\s*export\s+(async\s+)?(function|const|class|type|interface)\s/.test(line)
        && line.includes(symbol)) continue;
      mentions.push({ file: file.slice(repoRoot.length + 1).split("\\").join("/"), line: line.trim() });
    }
  }
  if (mentions.length === 0) return { kind: "none", where: "nothing but its own declaration" };
  const barrel = mentions.find((m) => m.file.endsWith("server/db/index.ts"));
  const dynamic = mentions.find((m) => /await import\(|import\(/.test(m.line));
  const first = mentions[0]!;
  if (barrel) return { kind: "barrel", where: `${mentions.length} mention(s), incl. ${barrel.file}` };
  if (dynamic) return { kind: "dynamic", where: `${dynamic.file}: ${dynamic.line.slice(0, 70)}` };
  return { kind: "other", where: `${first.file}: ${first.line.slice(0, 70)}` };
}

/* ---- CONTROLS ---- */
const positive = classify("shouldSendGlobalAttackAlert");
const negative = classify("isAccountLocked");
console.log("CONTROLS");
console.log(`  positive  shouldSendGlobalAttackAlert → ${positive.kind}  ${positive.kind === "none" ? "PASS" : "FAIL"}`);
console.log(`  negative  isAccountLocked             → ${negative.kind}  ${negative.kind !== "none" ? "PASS" : "FAIL"}`);
if (positive.kind !== "none" || negative.kind === "none") {
  console.log("\nREFUSED — the classifier failed its own controls; no verdict printed.");
  process.exit(1);
}
console.log();

const symbols = readFileSync(resolve(listFile), "utf8").split(/\r?\n/)
  .map((line) => line.match(/^\s{2}(?:function|const|class|type|interface)\s+(\S+)\s+(\S+)$/))
  .filter((match): match is RegExpMatchArray => match !== null)
  .map((match) => ({ symbol: match[1]!, file: match[2]! }));

const byKind: Record<Kind, Array<{ symbol: string; file: string; where: string }>> = {
  barrel: [], dynamic: [], other: [], none: [],
};
for (const entry of symbols) {
  const verdict = classify(entry.symbol);
  byKind[verdict.kind].push({ ...entry, where: verdict.where });
}

console.log(`${symbols.length} symbols off the sweep\n`);
for (const kind of ["none", "other", "barrel", "dynamic"] as const) {
  console.log(`${kind.toUpperCase()} — ${byKind[kind].length}`);
  for (const entry of byKind[kind]) {
    console.log(`  ${entry.symbol.padEnd(44)} ${entry.file}`);
    if (kind === "other") console.log(`      ${entry.where}`);
  }
  console.log();
}

/* A script ends by ending the process (`scriptExitDiscipline.test.ts`). This one
   opens nothing but the filesystem; the rule is deliberately wider than the
   handles a file happens to hold. */
process.exit(0);
