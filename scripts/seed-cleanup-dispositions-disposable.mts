/**
 * SEED THE DISPOSITION TABLE FROM THE VERDICTS ALREADY ARGUED.
 *
 * One-shot. It writes a row for every symbol on the sweep's current reading
 * list, pre-filling the ones the triage document has already dispositioned BY
 * FAMILY — and leaving every other verdict EMPTY, because an empty verdict is
 * the honest record of a symbol nobody has read.
 *
 * It never overwrites: a row that already exists in the table is kept verbatim,
 * so this can be re-run after the list moves without losing a hand-written
 * verdict.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseTable } from "./check-cleanup-dispositions.mts";

const REPO = resolve(import.meta.dirname, "..");
const TABLE = resolve(REPO, "docs/specs/cleanup-dispositions.yaml");

type Seed = { verdict: string; why: string; argued: string; blocker?: string };

/** Families the triage argues as a whole, in the order they are tried. */
const FAMILIES: Array<{ when: (symbol: string, file: string) => boolean; seed: Seed }> = [
  {
    when: (s) => /ForTests$/.test(s) || /^_[a-z]/.test(s) || /^reset[A-Z]/.test(s),
    seed: {
      verdict: "KEEP",
      why: "a seam whose own NAME says test-only; the sweep cannot see a convention and a human can",
      argued: "6c/13a",
    },
  },
  {
    when: (_s, f) => f.endsWith("evidence/evidenceCandidateContract.ts"),
    seed: {
      verdict: "KEEP",
      why: "the state machine written whole in one place while the SQL writers enforce it at every write",
      argued: "6b",
    },
  },
  {
    when: (s, f) => f.endsWith("castingV2/openKindPolicy.ts") && s.startsWith("openKind"),
    seed: {
      verdict: "KEEP",
      why: "the open lane's written answer sheet, quoted by the code that implements it independently",
      argued: "7b/10",
    },
  },
  {
    when: (_s, f) => f.endsWith("castingV2/maskGeometry.ts"),
    seed: {
      verdict: "KEEP",
      why: "the declared fixture facility for tests that must not cost a credit; its vocabulary tests live algebra",
      argued: "15d",
    },
  },
  {
    when: (_s, f) => f.endsWith("security/rateLimit.ts"),
    seed: {
      verdict: "HELD",
      why: "a deleted alert and an alert that never fires look identical; wire-or-delete is the founder's call",
      argued: "9/13b",
      blocker: "founder card — the security wire-or-delete decision",
    },
  },
];

/** Symbols the triage argues one at a time. */
const NAMED: Record<string, Seed> = {
  catalogueBornWorn: {
    verdict: "HELD", why: "wire-or-retire, and it is this sweep's second positive control",
    argued: "1b", blocker: "a replacement control must land in the same commit",
  },
  commitIdentityEdit: {
    verdict: "HELD", why: "one of three uncalled symbols about who may stamp an anchor",
    argued: "18a", blocker: "M14's owner, in one sitting with commitAnchorReRoll and roleForAuthorizedResult",
  },
  commitAnchorReRoll: {
    verdict: "HELD", why: "one of three uncalled symbols about who may stamp an anchor",
    argued: "18a", blocker: "M14's owner, in one sitting with commitIdentityEdit and roleForAuthorizedResult",
  },
  roleForAuthorizedResult: {
    verdict: "HELD", why: "an unused convenience over the §7.2 role mapping; the live writers pass a literal",
    argued: "18/18a", blocker: "M14's owner, with the other two anchor symbols",
  },
  createInkCalibrationRecorder: {
    verdict: "HELD", why: "an instrument for a calibration command that does not exist",
    argued: "18a", blocker: "goes with the composer road's module-sized disposition",
  },
  evaluateInkCalibrationGate: {
    verdict: "HELD", why: "an instrument for a calibration command that does not exist",
    argued: "18a", blocker: "goes with the composer road's module-sized disposition",
  },
  compareModelSnapshotShadow: {
    verdict: "HELD", why: "its tests drive live code through it; re-pointing them is an unverified rewrite here",
    argued: "17", blocker: "a disposable database — there is no docker on this machine",
  },
  commitBeginInkAddIntent: {
    verdict: "HELD", why: "builds intents for a whole downstream lifecycle suite",
    argued: "8d", blocker: "a disposable database",
  },
  BeginInkAddIntentResult: {
    verdict: "HELD", why: "dies with commitBeginInkAddIntent",
    argued: "8d", blocker: "a disposable database",
  },
  pruneSegmentFacet: {
    verdict: "HELD", why: "a declared half-landing whose user promise removeStep already serves",
    argued: "17", blocker: "the face chart's owner — does the segment-drop road still have a job",
  },
  stageCanonicalReferencePlate: {
    verdict: "KEEP", why: "its docblock FORBIDS callers until the reviewed C4 capability",
    argued: "18",
  },
  removeEdgesForItems: {
    verdict: "FILED", why: "not debris — the missing half of a live deletion path; wiring it is a build with an owner",
    argued: "13c",
  },
  INSTRUCTION_MAY_OVERRIDE: {
    verdict: "FILED", why: "a rule declared, tested and applied by nothing; the honest repair may be that the road retires",
    argued: "7a/10a",
  },
  OPEN_QUESTIONS: {
    verdict: "KEEP", why: "an empty map kept deliberately, founder-ruled 2026-08-06",
    argued: "7c",
  },
  mintModelAtomically: {
    verdict: "FILED", why: "a docblock asserting a call site that does not exist, on a mint that claims to lock an identity",
    argued: "11b",
  },
  markModelAssetsStale: {
    verdict: "FILED", why: "one comment mention, no caller",
    argued: "11b",
  },
  inspectStorageCleanupReconciliation: {
    verdict: "KEEP", why: "a real caller in a tracked script (run-storage-cleanup.mts)",
    argued: "1a/20",
  },
};

/** The derived-view family of §6a, named because a pattern cannot see it. */
const DERIVED_VIEWS = new Set([
  "axesOnShelf", "edgeTableNames", "fringeTableNames", "neighbourTableNames",
  "segmentableRegionNames", "namingTableFacets", "exemptSubjects", "neighbourPairs",
  "arrangementsWithPrecedent", "unmeasuredAmplitudes", "unprotectedFacets",
  "facetsWithUnreliabilityPrior", "unreadFacts", "splitByInheritance",
  "courtSeparationFor", "REFUSAL_REASONS", "VACANCY_KINDS", "FACET_KEYS",
  "COHORT_CONSTANT_MARKERS", "scopedFacets", "axesOfFacet", "facetsNeedingMagnification",
  "ALL_SUPPORTED_INK_ANATOMY_TUPLES", "isLimbInkZone", "measuredPhrasings",
]);

const sweep = execFileSync("npx", ["tsx", "scripts/sweep-uncalled-exports-disposable.mts"], {
  cwd: REPO, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, shell: true,
});
const lines = sweep.split(/\r?\n/);
const listed = lines
  .slice(lines.findIndex((line) => line.includes("THE LIST ")))
  .map((line) => line.match(/^\s{2}(\S+)\s+(\S+)$/))
  .filter((match): match is RegExpMatchArray => match !== null)
  .map((match) => ({ symbol: match[1]!, file: match[2]! }));

const existing = existsSync(TABLE) ? parseTable(readFileSync(TABLE, "utf8")) : [];
const known = new Set(existing.map((row) => row.symbol));

function seedFor(symbol: string, file: string): Seed | null {
  if (NAMED[symbol]) return NAMED[symbol]!;
  if (DERIVED_VIEWS.has(symbol)) {
    return {
      verdict: "KEEP",
      why: "a derived view the test asserts the TABLE through; deleting it pushes its test onto a hardcoded list",
      argued: "6a",
    };
  }
  for (const family of FAMILIES) if (family.when(symbol, file)) return family.seed;
  return null;
}

const out: string[] = [];
out.push("# THE CLEANUP MILESTONE'S DELETION DOOR.");
out.push("#");
out.push("# One row per symbol on the sweep's reading list. The verdict is the door;");
out.push("# `argued` names the section of CLEANUP_MILESTONE_TRIAGE.md that argues it, and");
out.push("# that section — not this line — is the reasoning. A HELD row names its blocker.");
out.push("#");
out.push("# Verdicts: KEEP · TAKEN · HELD · FILED. An EMPTY verdict is the honest record");
out.push("# of a symbol nobody has read yet, and `check-cleanup-dispositions.mts --strict`");
out.push("# is green only when there are none left.");
out.push("");

let seeded = 0;
let blank = 0;
for (const entry of listed) {
  if (known.has(entry.symbol)) continue;
  const seed = seedFor(entry.symbol, entry.file);
  if (seed) seeded += 1; else blank += 1;
  out.push(`- symbol: ${entry.symbol}`);
  out.push(`  file: ${entry.file}`);
  out.push(`  verdict: ${seed?.verdict ?? ""}`);
  out.push(`  why: ${seed?.why ?? ""}`);
  out.push(`  argued: ${seed?.argued ?? ""}`);
  if (seed?.blocker) out.push(`  blocker: ${seed.blocker}`);
  out.push("");
}

const body = existsSync(TABLE)
  ? `${readFileSync(TABLE, "utf8").replace(/\s+$/, "")}\n\n${out.slice(9).join("\n")}`
  : out.join("\n");
writeFileSync(TABLE, `${body.replace(/\s+$/, "")}\n`, "utf8");

console.log(`listed ${listed.length} · already in the table ${known.size}`);
console.log(`written: ${seeded} with a family verdict, ${blank} left EMPTY for a reader`);
process.exit(0);
