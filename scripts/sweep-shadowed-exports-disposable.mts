/**
 * A DEAD EXPORT HIDDEN BY A LIVE ONE OF THE SAME NAME, IN ANOTHER MODULE.
 *
 * The milestone's own sweep (`sweep-uncalled-exports-disposable.mts`) reads
 * import statements for the NAMES they bring in and throws the module
 * specifier away:
 *
 *     import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["'][^"']+["']
 *                            ^^^^^^^ kept          ^^^^^^^^ discarded
 *
 * So one `import { hairRegion } from "./axisRegistry"` marks EVERY export
 * named `hairRegion` in the repository as imported — including
 * `maskGeometry.hairRegion`, which builds a `RegionSpec` out of authored
 * shapes and whose whole sub-API (`FaceGeometry`, `RegionSpec`, `eyeRegion`,
 * `browRegion`, `eyewearRegion`, `mergeRegions`) has ZERO mentions outside its
 * own file. That symbol is dead and has never appeared on any list this
 * milestone has read.
 *
 * The sweep declares three biases — namespace imports, dynamic specifiers,
 * barrel re-exports — and says they make its total a floor. This is a FOURTH,
 * in the same direction and undeclared. It can only bite where a name is
 * declared in more than one production file, so that is exactly where this
 * pass resolves specifiers properly.
 *
 * It DECIDES NOTHING: it prints the declarations no importer actually reaches.
 *
 * # Controls (law 2)
 *
 * The resolver's controls are STRUCTURAL facts about the repository's shape —
 * a relative import, a directory index, a bare package name — rather than
 * facts about today's dead code. Triage §0: a control that is a real specimen
 * dies the day the product retires that specimen, and this milestone's first
 * instrument died exactly that way. The discrimination control is the other
 * half: a name known to be LIVE must come back reached, or a resolver that
 * reaches nothing would print every declaration as dead.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "..");

function repoPath(absolute: string): string {
  return relative(REPO, absolute).replaceAll("\\", "/");
}

async function sourcesUnder(root: string): Promise<string[]> {
  const found: string[] = [];
  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "dist") continue;
        await walk(path);
        continue;
      }
      if (!/\.(ts|tsx|mts)$/.test(entry.name)) continue;
      found.push(path);
    }
  }
  await walk(join(REPO, root));
  return found.sort();
}

const isTest = (file: string): boolean => /\.test\.tsx?$/.test(file);

/** The file a specifier names, or null when it names a package. */
function resolveSpecifier(fromFile: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith(".")) base = resolve(dirname(fromFile), specifier);
  else if (specifier.startsWith("@/")) base = join(REPO, "client/src", specifier.slice(2));
  else if (specifier.startsWith("@shared/")) base = join(REPO, "shared", specifier.slice(8));
  else return null;
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mts`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (existsSync(candidate) && !candidate.endsWith("/")) {
      try {
        if (readFileSync(candidate).length >= 0) return candidate;
      } catch { /* a directory — keep looking */ }
    }
  }
  return null;
}

/* ---- controls ---------------------------------------------------------- */

const refineService = join(REPO, "server/castingV2/refineService.ts");
const anyRoute = join(REPO, "server/routes/castingV2.ts");

const relativeControl =
  repoPath(resolveSpecifier(refineService, "./maskGeometry") ?? "") === "server/castingV2/maskGeometry.ts";
const indexControl =
  repoPath(resolveSpecifier(anyRoute, "../db") ?? "") === "server/db/index.ts";
const packageControl = resolveSpecifier(refineService, "react") === null;

console.log("RESOLVER CONTROLS (structural — not facts about today's dead code)");
console.log(`  positive  a relative specifier resolves to its file   ${relativeControl ? "PASS" : "FAIL"}`);
console.log(`  positive  a directory specifier resolves to index.ts  ${indexControl ? "PASS" : "FAIL"}`);
console.log(`  negative  a bare package name resolves to nothing     ${packageControl ? "PASS" : "FAIL"}`);
if (!relativeControl || !indexControl || !packageControl) {
  console.log("REFUSED — the resolver failed its own controls; no verdict printed.");
  process.exit(1);
}

/* ---- the corpus -------------------------------------------------------- */

const roots = ["server", "client/src", "shared", "scripts", "drizzle"];
const files = (await Promise.all(roots.map(sourcesUnder))).flat();

/** name → the production files declaring it. */
const declarations = new Map<string, string[]>();
const declaration = /^export\s+(?:async\s+)?(?:function|const|class|type|interface)\s+([A-Za-z_$][\w$]*)/gm;
for (const file of files) {
  if (isTest(file)) continue;
  if (!/[\\/](server|client[\\/]src|shared)[\\/]/.test(file)) continue;
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(declaration)) {
    const name = match[1]!;
    const existing = declarations.get(name);
    if (existing) { if (!existing.includes(file)) existing.push(file); }
    else declarations.set(name, [file]);
  }
}

/** (declaring file, name) → did any importer's specifier actually reach it? */
const reachedProduction = new Set<string>();
const reachedTest = new Set<string>();
const named = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;
const starred = /import\s+\*\s+as\s+[\w$]+\s+from\s+["']([^"']+)["']/g;
const dynamic = /import\(\s*["']([^"']+)["']\s*\)/g;
const destructuredDynamic =
  /(?:const|let)\s*\{([^}]*)\}\s*=\s*await\s+import\(\s*["']([^"']+)["']\s*\)/g;
const namespaceTargets = new Set<string>();

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const target = isTest(file) ? reachedTest : reachedProduction;
  for (const match of source.matchAll(named)) {
    const resolved = resolveSpecifier(file, match[2]!);
    if (!resolved) continue;
    for (const raw of match[1]!.split(",")) {
      const name = raw.trim().split(/\s+as\s+/)[0]!.replace(/^type\s+/, "").trim();
      if (name) target.add(`${resolved}::${name}`);
    }
  }
  /*
    A namespace or dynamic import reaches a MODULE, not a name. Every export of
    such a module is treated as reached — the same floor bias the parent sweep
    declares, kept deliberately so this pass can only ever shrink the list of
    accusations, never invent one.

    IN A PRODUCTION FILE ONLY. A suite that reaches for `await import("…")` —
    and this one does, to re-read a module after changing an env var — would
    otherwise mark every export of that module as production-reached, which is
    the same false clean the parent sweep's blind spot produces, arriving by
    the other door. It cost this instrument its first true finding.
  */
  if (isTest(file)) continue;
  /*
    A DESTRUCTURED DYNAMIC IMPORT NAMES ITS SYMBOLS, so it is read as a named
    import rather than as a whole module. Without this, one tracked helper's
    `const { unionMasks } = await import("./maskGeometry")` marks all
    thirty-seven of that module's exports as reached — and the dead
    authored-shape road hides behind a single live union.
  */
  const destructured = new Set<string>();
  for (const match of source.matchAll(destructuredDynamic)) {
    const resolved = resolveSpecifier(file, match[2]!);
    if (!resolved) continue;
    destructured.add(match[2]!);
    for (const raw of match[1]!.split(",")) {
      const name = raw.trim().split(/[:=]/)[0]!.trim();
      if (name) target.add(`${resolved}::${name}`);
    }
  }
  for (const match of source.matchAll(starred)) {
    const resolved = resolveSpecifier(file, match[1]!);
    if (resolved) namespaceTargets.add(resolved);
  }
  for (const match of source.matchAll(dynamic)) {
    if (destructured.has(match[1]!)) continue;
    const resolved = resolveSpecifier(file, match[1]!);
    if (resolved) namespaceTargets.add(resolved);
  }
}

/*
  A BARREL IS A DOOR, AND REACHING THE DOOR REACHES THE ROOM BEHIND IT.

  `import { Button } from "@/components/design-system"` resolves to the
  barrel's `index.ts`, not to `Button.tsx`. Without this, every re-exported
  symbol in the repository would be accused of being unreached — the design
  system's whole surface among them. Re-exports are followed to a fixpoint, in
  both forms, and `export *` propagates the whole module because that is what
  it means.
*/
const reExports: Array<{ from: string; to: string; names: string[] | "all" }> = [];
const namedReExport = /export\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;
const starReExport = /export\s+\*\s+(?:as\s+[\w$]+\s+)?from\s*["']([^"']+)["']/g;
for (const file of files) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(namedReExport)) {
    const resolved = resolveSpecifier(file, match[2]!);
    if (!resolved) continue;
    reExports.push({
      from: file,
      to: resolved,
      names: match[1]!.split(",").map((raw) => {
        const parts = raw.trim().replace(/^type\s+/, "").split(/\s+as\s+/);
        return { source: parts[0]!.trim(), exposed: (parts[1] ?? parts[0])!.trim() };
      }).filter((pair) => pair.source).map((pair) => `${pair.exposed}>${pair.source}`),
    });
  }
  for (const match of source.matchAll(starReExport)) {
    const resolved = resolveSpecifier(file, match[1]!);
    if (resolved) reExports.push({ from: file, to: resolved, names: "all" });
  }
}

for (let pass = 0; pass < 8; pass += 1) {
  let grew = false;
  for (const link of reExports) {
    if (link.names === "all") {
      if (namespaceTargets.has(link.from) && !namespaceTargets.has(link.to)) {
        namespaceTargets.add(link.to);
        grew = true;
      }
      for (const key of [...reachedProduction]) {
        const [file, name] = key.split("::");
        if (file !== link.from) continue;
        const forwarded = `${link.to}::${name}`;
        if (!reachedProduction.has(forwarded)) { reachedProduction.add(forwarded); grew = true; }
      }
      continue;
    }
    for (const pair of link.names) {
      const [exposed, source] = pair.split(">");
      if (!reachedProduction.has(`${link.from}::${exposed}`)) continue;
      const forwarded = `${link.to}::${source}`;
      if (!reachedProduction.has(forwarded)) { reachedProduction.add(forwarded); grew = true; }
    }
  }
  if (!grew) break;
}

const shadowed = [...declarations.entries()].filter(([, where]) => where.length > 1);

/* ---- the discrimination control ---------------------------------------- */

const liveTwin = shadowed
  .flatMap(([name, where]) => where.map((file) => ({ name, file })))
  .filter((entry) => reachedProduction.has(`${entry.file}::${entry.name}`));

console.log("");
console.log("CORPUS AND DISCRIMINATION");
console.log(`  files walked                            ${files.length}`);
console.log(`  production export names                 ${declarations.size}`);
console.log(`  names declared in 2+ production files   ${shadowed.length}`);
console.log(`  of those declarations, reached by a production importer  ${liveTwin.length}`);
if (shadowed.length === 0 || liveTwin.length === 0) {
  console.log("REFUSED — a resolver that reaches nothing would print every declaration as dead.");
  process.exit(1);
}

/* ---- the finding ------------------------------------------------------- */

/*
  AN EXPORT USED INSIDE ITS OWN MODULE IS NOT DEAD, it is merely exported for
  no reason anyone imports. The parent sweep proved 175 of 175 of its own
  flagged symbols are declaration-only in their file (triage §5); this list is
  a different list and does not inherit that, so it asks the question itself.
*/
function usedInOwnModule(file: string, name: string): boolean {
  /*
    Comments first. This codebase's modules discuss their own symbols by name —
    maskGeometry's matte functions open with "Same law as `hairRegion`" — and a
    mention in prose counted as a use is how a dead function proves itself
    alive out of its own docblock.
  */
  const source = readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");
  const uses = source.match(new RegExp(`(?<![\\w$])${name}(?![\\w$])`, "g"))?.length ?? 0;
  return uses > 1;
}

type Row = { name: string; file: string; twins: string[]; tests: boolean };
const rows: Row[] = [];
for (const [name, where] of shadowed) {
  for (const file of where) {
    if (reachedProduction.has(`${file}::${name}`)) continue;
    if (namespaceTargets.has(file)) continue;
    if (usedInOwnModule(file, name)) continue;
    rows.push({
      name,
      file: repoPath(file),
      twins: where.filter((other) => other !== file).map(repoPath),
      tests: reachedTest.has(`${file}::${name}`),
    });
  }
}
rows.sort((a, b) => (a.file === b.file ? a.name.localeCompare(b.name) : a.file.localeCompare(b.file)));

console.log("");
console.log(`DECLARATIONS NO PRODUCTION IMPORTER REACHES, WHOSE NAME LIVES ELSEWHERE — ${rows.length}`);
for (const row of rows) {
  console.log("");
  console.log(`  ${row.name}   ${row.tests ? "(a test reaches it)" : "(NOTHING reaches it)"}`);
  console.log(`    dead here   ${row.file}`);
  console.log(`    name lives  ${row.twins.join(" · ")}`);
}
if (rows.length === 0) console.log("  none");

/* ======================================================================== */
/*  THE SECOND HOLE — A CONSUMER THE REPOSITORY DOES NOT CONTAIN            */
/* ======================================================================== */

/*
 * The parent sweep looks for importers in `["server", "client", "shared",
 * "scripts"]`. Two hundred and eighty-five files under `scripts/` are
 * UNTRACKED disposables (triage §2) — they exist on this machine and in no
 * clone of this repository. A server export whose only consumer is one of
 * those is dead by every standard the repository itself can check, and it has
 * never appeared on any list this milestone has read.
 *
 * Same direction as the first hole: it hides dead code, so the 110 is a floor.
 * Different door.
 */

const tracked = new Set(
  execSync("git ls-files", { cwd: REPO, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean),
);

const trackedControl = tracked.has("scripts/run-storage-cleanup.mts");
const untrackedScripts = files.filter((file) =>
  repoPath(file).startsWith("scripts/") && !tracked.has(repoPath(file)));
const untrackedControl = untrackedScripts.length > 0;

console.log("");
console.log("TRACKING CONTROLS");
console.log(`  positive  a known tracked script reads as tracked      ${trackedControl ? "PASS" : "FAIL"}`);
console.log(`  positive  untracked scripts exist to be counted (${String(untrackedScripts.length).padStart(3)})  ${untrackedControl ? "PASS" : "FAIL"}`);
if (!trackedControl || !untrackedControl) {
  console.log("REFUSED — the tracking reader failed its own controls; no verdict printed.");
  process.exit(1);
}

/** (file, name) → the consumer files that reach it, by kind. */
type Reach = { trackedProduction: number; untrackedScript: number; tests: number };
const reach = new Map<string, Reach>();
function note(key: string, kind: keyof Reach): void {
  const entry = reach.get(key) ?? { trackedProduction: 0, untrackedScript: 0, tests: 0 };
  entry[kind] += 1;
  reach.set(key, entry);
}

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const kind: keyof Reach = isTest(file)
    ? "tests"
    : tracked.has(repoPath(file)) ? "trackedProduction" : "untrackedScript";
  for (const match of source.matchAll(named)) {
    const resolved = resolveSpecifier(file, match[2]!);
    if (!resolved) continue;
    for (const raw of match[1]!.split(",")) {
      const name = raw.trim().split(/\s+as\s+/)[0]!.replace(/^type\s+/, "").trim();
      if (name) note(`${resolved}::${name}`, kind);
    }
  }
}

const serverDeclarations = [...declarations.entries()]
  .flatMap(([name, where]) => where.map((file) => ({ name, file })))
  .filter((entry) => repoPath(entry.file).startsWith("server/"));

const onlyUntracked = serverDeclarations.filter((entry) => {
  if (namespaceTargets.has(entry.file)) return false;
  if (usedInOwnModule(entry.file, entry.name)) return false;
  const seen = reach.get(`${entry.file}::${entry.name}`);
  return Boolean(seen) && seen!.untrackedScript > 0 && seen!.trackedProduction === 0;
});

console.log("");
console.log(`SERVER EXPORTS WHOSE ONLY NON-TEST CONSUMER IS AN UNTRACKED SCRIPT — ${onlyUntracked.length}`);
for (const entry of onlyUntracked.sort((a, b) => a.file.localeCompare(b.file))) {
  const seen = reach.get(`${entry.file}::${entry.name}`)!;
  console.log(`  ${entry.name.padEnd(38)} ${repoPath(entry.file)}   ${seen.tests > 0 ? "(tests too)" : "(no test either)"}`);
}
if (onlyUntracked.length === 0) console.log("  none");

process.exit(0);
