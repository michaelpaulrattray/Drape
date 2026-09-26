/**
 * #1413 — CAN THE GUARD FAIL? A sabotage driver with an UNSABOTAGED CONTROL
 * FIRST, and the verdict keyed on the TALLY rather than on "nothing failed" —
 * which is identical for a blind guard and a suite that never ran.
 *
 * Every case asserts its anchor is UNIQUE in the file before editing, because a
 * surviving sabotage has four causes and three of them are the driver's fault.
 *
 *   node scripts/_1413-sabotage-disposable.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const SUITE = "server/castingV2/readerFrameBound.test.ts";

const CASES = [
  {
    name: "faceDescribe posts the RAW frame again",
    file: "server/castingV2/faceDescribe.ts",
    from: "images: [frame.image],",
    to: "images: [{ bytes: input.bytes, contentType: input.contentType }],",
  },
  {
    name: "the judgeFrame import is dropped from a bounded module",
    file: "server/castingV2/makeupFromReference.ts",
    from: 'import { boundForJudge } from "./judgeFrame";\n',
    to: "",
  },
  {
    name: "a park-list entry is deleted, leaving a real unbounded post unnamed",
    file: SUITE,
    from: '  { file: "casting/evidence/composer/inkProbe.ts", reason: "R7 evidence composer — parked (#6)" },\n',
    to: "",
  },
  {
    name: "a park entry is invented for a module that posts nothing",
    file: SUITE,
    from: '  { file: "casting/evidence/evidencePackageProbe.ts",',
    to: '  { file: "castingV2/refineFacets.ts", reason: "invented — parked (#6)" },\n  { file: "casting/evidence/evidencePackageProbe.ts",',
  },
  {
    name: "the sub-512 skip is removed, so a tiny cut is re-encoded",
    file: "server/castingV2/realizationCaption.ts",
    from: "  if (longEdge > 0 && longEdge < LEGIBLE_LONG_EDGE) return image;",
    to: "",
  },
  {
    name: "the threshold is inverted — the bound and the enlargement swap sides",
    file: "server/castingV2/realizationCaption.ts",
    from: "  if (longEdge > 0 && longEdge < LEGIBLE_LONG_EDGE) return image;",
    to: "  if (longEdge > 0 && longEdge > LEGIBLE_LONG_EDGE) return image;",
  },
  {
    name: "the enlargement edge is pushed PAST the bound",
    file: "server/castingV2/realizationCaption.ts",
    from: "export const LEGIBLE_LONG_EDGE = 512;",
    to: "export const LEGIBLE_LONG_EDGE = 3000;",
  },
  {
    name: "conceptDescribe bounds nothing",
    file: "server/castingV2/conceptDescribe.ts",
    from: "        images: [frame],",
    to: "        images: [{ bytes: input.bytes, contentType: input.contentType }],",
  },
  {
    name: "referenceMediumDoor posts her photograph whole",
    file: "server/castingV2/referenceMediumDoor.ts",
    from: "      images: [(await boundForJudge({ bytes: input.bytes, contentType: input.contentType })).image],",
    to: "      images: [{ bytes: input.bytes, contentType: input.contentType }],",
  },
  {
    name: "boundedForReader stops bounding, so both realizationCaption posts go whole",
    file: "server/castingV2/realizationCaption.ts",
    from: "  return (await boundForJudge(image)).image;",
    to: "  return image;",
  },
];

function runSuite() {
  try {
    const out = execFileSync(
      process.execPath,
      ["node_modules/vitest/vitest.mjs", "run", SUITE],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 600_000 },
    );
    return { red: false, out };
  } catch (error) {
    return { red: true, out: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
}

const tally = (out) => {
  const m = out.match(/Tests\s+(?:(\d+) failed \|\s*)?(\d+) passed/);
  return m ? { failed: Number(m[1] ?? 0), passed: Number(m[2]) } : null;
};

console.log("── CONTROL: unsabotaged ─────────────────────────────────");
const control = runSuite();
const controlTally = tally(control.out);
console.log(`  red=${control.red}  tally=${JSON.stringify(controlTally)}`);
if (control.red || !controlTally || controlTally.failed !== 0 || controlTally.passed === 0) {
  console.log("\nREFUSED — the control is not green, so no sabotage verdict below means anything.");
  console.log(control.out.slice(-3000));
  process.exit(1);
}
const BASELINE = controlTally.passed;

let caught = 0;
const survived = [];
for (const kase of CASES) {
  const before = readFileSync(kase.file, "utf8");
  const hits = before.split(kase.from).length - 1;
  if (hits !== 1) {
    console.log(`\n✗ ${kase.name}\n   REFUSED: anchor appears ${hits} times in ${kase.file}, not once — an edit that cannot be placed is not a sabotage.`);
    survived.push(`${kase.name} (anchor ${hits}x)`);
    continue;
  }
  writeFileSync(kase.file, before.replace(kase.from, kase.to));
  const changed = readFileSync(kase.file, "utf8") !== before;
  const result = runSuite();
  writeFileSync(kase.file, before);
  const t = tally(result.out);
  const verdict = result.red && (t === null || t.failed > 0 || t.passed < BASELINE);
  if (!changed) {
    console.log(`\n✗ ${kase.name}\n   REFUSED: the write changed no bytes.`);
    survived.push(`${kase.name} (inert edit)`);
    continue;
  }
  if (verdict) {
    caught += 1;
    console.log(`\n✓ CAUGHT — ${kase.name}\n   tally=${JSON.stringify(t)}`);
  } else {
    survived.push(kase.name);
    console.log(`\n✗ SURVIVED — ${kase.name}\n   red=${result.red} tally=${JSON.stringify(t)}`);
  }
}

console.log(`\n════ ${caught}/${CASES.length} caught (control green at ${BASELINE} passing) ════`);
if (survived.length) console.log("survived:\n  " + survived.join("\n  "));
process.exit(survived.length ? 1 : 0);
