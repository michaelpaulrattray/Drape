/**
 * SABOTAGE DRIVER for card #11's retirement arms — proves each one can go RED.
 *
 * Working law 2: verify the instrument before believing its finding. Every arm
 * added by #11 asserts an ABSENCE or a size, and both shapes are green against a
 * reader that is simply not looking. So each is driven by putting the retired
 * thing BACK, one at a time, and asserting that exactly the arms which should
 * notice do.
 *
 * ⚠ Each sabotage restores in `finally`. A driver that crashes mid-edit and
 * leaves the tree sabotaged is how a shift loses an afternoon.
 *
 * Disposable. Run from the worktree root: npx tsx scripts/_11-sabotage-disposable.mts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

type Sabotage = {
  readonly name: string;
  readonly file: string;
  readonly find: string;
  readonly replace: string;
  /** Arms whose titles must go RED. Matched as substrings of the vitest output. */
  readonly expectRed: readonly string[];
  readonly specs: readonly string[];
};

const RETIREMENT = "server/castingV2/framingTrimRetirement.test.ts";
const ROLL = "server/castingV2/rollService.test.ts";

const SABOTAGES: readonly Sabotage[] = [
  {
    name: "the production position table names it again",
    file: "scripts/lib/productionFlagPositions.mts",
    find: "  CASTING_BRIEF_FIDELITY_SCOPE: {",
    replace:
      '  CASTING_FRAMING_TRIM_SCOPE: { position: "users:1", why: "sabotage row, long enough to pass the reason check" },\n'
      + "  CASTING_BRIEF_FIDELITY_SCOPE: {",
    expectRed: ["the production position table does not name it"],
    specs: [RETIREMENT],
  },
  {
    name: "CLAUDE.md's index table names it again",
    file: "CLAUDE.md",
    find: "| `CASTING_SEGMENTS_SCOPE` | ",
    replace:
      "| `CASTING_FRAMING_TRIM_SCOPE` | sabotage row |\n| `CASTING_SEGMENTS_SCOPE` | ",
    expectRed: ["no law surface still describes it"],
    specs: [RETIREMENT],
  },
  {
    name: "a server module reads the variable by hand (no *_ENV constant)",
    file: "server/castingV2/rollService.ts",
    find: "const log = createModuleLogger",
    replace:
      'const sabotage = process.env["CASTING_FRAMING_TRIM_SCOPE"];\nvoid sabotage;\nconst log = createModuleLogger',
    expectRed: ["SECOND READER"],
    specs: [RETIREMENT],
  },
  {
    name: "the scope constant is declared again",
    file: "server/castingV2/castingV2Scope.ts",
    find: "export const CASTING_BRIEF_FIDELITY_SCOPE_ENV",
    replace:
      'export const CASTING_FRAMING_TRIM_SCOPE_ENV = "CASTING_FRAMING_TRIM_SCOPE";\nexport const CASTING_BRIEF_FIDELITY_SCOPE_ENV',
    expectRed: ["no code declares it", "SECOND READER"],
    specs: [RETIREMENT],
  },
  {
    name: "the roll renders larger than it delivers again",
    file: "server/castingV2/rollService.ts",
    find: "        size: compiled.size,\n        quality: compiled.quality,",
    replace: '        size: "1536x2304",\n        quality: compiled.quality,',
    expectRed: ["every slice is rendered at the box it is DELIVERED at"],
    specs: [ROLL],
  },
  {
    name: "the kept original is written again",
    file: "server/castingV2/rollService.ts",
    find: "    const stored = await store({ bytes: image.bytes, contentType: image.contentType });",
    replace:
      "    const stored = await store({ bytes: image.bytes, contentType: image.contentType });\n"
      + "    await store({ bytes: image.bytes, contentType: image.contentType });",
    /* ⚠ TWO arms red here and BOTH are right — this is a confirming sibling,
       not a coupling defect. `stores a WebP beside the frame` predates #11 and
       counts png writes per sheet, so it already held half of the one-frame-one-
       object contract on its own. What the new arm adds beyond it is the ROW:
       `sourceKey` null on every landing, which the WebP arm never looked at. */
    expectRed: ["one frame is one object", "stores a WebP beside the frame"],
    specs: [ROLL],
  },
  {
    name: "⚠ THE CONTROL ITSELF — a reader that finds nothing must not read as a clean retirement",
    file: "scripts/lib/lawText.mts",
    find: 'export const LAW_SURFACES = ["CLAUDE.md", "docs/architecture/FEATURE_FLAGS.md"] as const;',
    replace: 'export const LAW_SURFACES = ["MODEL_CHANGELOG.md"] as const;',
    expectRed: ["CONTROL"],
    specs: [RETIREMENT],
  },
];

function run(specs: readonly string[]): string {
  /* ⚠ `shell: true`. Without it Node refuses a `.cmd` on Windows with EINVAL,
     both streams come back EMPTY, and every arm reads as "stayed green" — a
     driver that cannot tell a passing arm from a run that never happened. The
     assertion below is what makes that unmissable rather than merely survivable. */
  const result = spawnSync("npx", ["vitest", "run", ...specs], {
    encoding: "utf8",
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (!/Test Files/.test(output)) {
    throw new Error(
      `vitest produced no report (status ${String(result.status)}, ${output.length} bytes) — `
      + "the sabotage was never judged. Fix the driver before believing any verdict.",
    );
  }
  return output;
}

/**
 * Titles vitest printed with a failure mark.
 *
 * ⚠ The ANSI stripper is BUILT rather than written as a literal. A raw ESC in
 * a regex literal is a control byte in the file, which this repository's own
 * pre-commit guard refuses — it is the shape a mangled heredoc leaves behind,
 * and it looks fine in every editor.
 */
const ANSI = new RegExp(`${String.fromCharCode(27)}\[[0-9;]*m`, "g");

function redArms(output: string): string[] {
  const arms: string[] = [];
  for (const line of output.split("\n")) {
    const bare = line.replace(ANSI, "");
    if (/^\s*[x×]\s/.test(bare)) arms.push(bare.trim().replace(/^[x×]\s*/, ""));
  }
  return arms;
}

let failures = 0;

for (const sabotage of SABOTAGES) {
  const original = readFileSync(sabotage.file, "utf8");
  if (!original.includes(sabotage.find)) {
    console.log(`SKIPPED (find string absent — the sabotage never applied): ${sabotage.name}`);
    failures += 1;
    continue;
  }
  try {
    writeFileSync(sabotage.file, original.replace(sabotage.find, sabotage.replace), "utf8");
    const reds = redArms(run(sabotage.specs));
    const missed = sabotage.expectRed.filter(
      (want) => !reds.some((arm) => arm.includes(want)),
    );
    const unexpected = reds.filter(
      (arm) => !sabotage.expectRed.some((want) => arm.includes(want)),
    );
    const verdict = missed.length === 0 && unexpected.length === 0 ? "PASS" : "FAIL";
    if (verdict === "FAIL") failures += 1;
    console.log(`${verdict}  ${sabotage.name}`);
    console.log(`      red: ${reds.length === 0 ? "(none)" : reds.join(" | ")}`);
    if (missed.length > 0) console.log(`      MISSED (stayed green): ${missed.join(" | ")}`);
    if (unexpected.length > 0) console.log(`      ALSO RED (arms are not independent): ${unexpected.join(" | ")}`);
  } finally {
    writeFileSync(sabotage.file, original, "utf8");
  }
}

console.log(`\n${SABOTAGES.length - failures}/${SABOTAGES.length} sabotages behaved.`);
process.exit(0);
