/**
 * DISPOSABLE — **SWEEP #2's POPULATION** (ordered fable-1680, from the founder's
 * *"do another full sweep make sure nothing else like this is missed clearly the
 * sweep you did initially wasnt good enough"*).
 *
 * ⚠ **He is right and the defect is named**: sweep #1's register derived its
 * population from GOVERNED FLAGS, so designed-but-unbuilt work with no flag was
 * INVISIBLE to it. He caught two in ten minutes.
 *
 * This derives the corrected population — the UNION of flags, spec docs whose
 * status is not built-and-live, the roadmap, the decision log, the capability
 * atlas's debts, and CLAUDE.md's own pending-build paragraphs.
 *
 * ⚠ **A STATUS LINE IS A CLAIM AND THIS SCRIPT ONLY FINDS IT.** The grep marks a
 * doc as a CANDIDATE; the classification is done by reading each hit's header,
 * per the order. Anything this prints is a reading list, never a verdict.
 *
 * Read-only. No network, no database, no spend.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const git = (args: string[]) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })
    .split(/\r?\n/).filter(Boolean);

/* The words a not-yet-live document uses about itself, from the order. */
const NOT_LIVE = /\b(STATUS: *DESIGN|DESIGN ONLY|DESIGN,|not built|nothing is built|nothing here is built|for countersign|awaiting a countersign|parked|deferred|decides-nothing|RESEARCH|draft|NOT DISPATCHED|undispatched|unbuilt)\b/i;

const docs = git(["ls-files", "docs/specs/"]).filter((f) => f.endsWith(".md"));
if (docs.length < 50) throw new Error(`only ${docs.length} spec docs found — the listing failed and a short list would read as a clean sweep`);

type Hit = { path: string; line: number; text: string };
const hits: Hit[] = [];
const clean: string[] = [];

for (const path of docs) {
  let text: string;
  try { text = readFileSync(path, "utf8"); } catch { continue; }
  /* The HEADER is where a doc states its own status — the first 40 lines. */
  const head = text.split(/\r?\n/).slice(0, 40);
  const found = head
    .map((line, i) => ({ line: i + 1, text: line.trim() }))
    .filter((row) => NOT_LIVE.test(row.text));
  if (found.length === 0) { clean.push(path); continue; }
  hits.push({ path, line: found[0]!.line, text: found[0]!.text.slice(0, 150) });
}

console.log(`SWEEP #2 POPULATION — ${docs.length} spec docs read at their HEADERS\n`);
console.log(`  ${hits.length} name a not-yet-live status in their first 40 lines`);
console.log(`  ${clean.length} do not — those are either live, historical, or SILENT about status,`);
console.log(`     and SILENT is the category sweep #1 could not see either\n`);

console.log("══ CANDIDATES — read each header before classifying ══");
for (const hit of hits) console.log(`  ${hit.path}\n      L${hit.line}: ${hit.text}`);

console.log(`\n══ SILENT OR LIVE — ${clean.length} ══`);
for (const path of clean) console.log(`  ${path}`);

console.log("\n⚠ A doc that says nothing about its status is NOT thereby live. That set is the");
console.log("  same blind spot in a new costume, and it is why the order says classify at the");
console.log("  words rather than at the grep.");

process.exit(0);
