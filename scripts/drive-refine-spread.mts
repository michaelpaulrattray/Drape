/**
 * The founder's creative spread (D-131) — live interpreter, no stubs.
 *
 * Six asks that the closed tier would all have refused, plus the walls that
 * must never open however far the lanes do. Text calls only; the paid renders
 * are a separate step.
 *
 *   npx tsx scripts/drive-refine-spread.mts
 */
import "dotenv/config";

import { interpretRefinement, refusalMessage } from "../server/castingV2/refineInterpreter";

const SPREAD = [
  { instruction: "give her a mullet", expect: "parse" },
  { instruction: "silver cornrows", expect: "parse", from: { sex: "male" } },
  { instruction: "make her eyes seafoam", expect: "parse" },
  { instruction: "give her a button nose", expect: "parse" },
  { instruction: "a beauty mark above her lip", expect: "parse" },
  { instruction: "a small rose tattoo on her neck", expect: "parse" },
  /* D-137: everything the anchor cannot document waits for the studio. */
  { instruction: "a full sleeve tattoo on her left arm", expect: "gate" },
  /* D-148 bare-term ownership: the word alone must reach the SHAPE, and the
     correction phrases must still reach makeup in both directions. */
  { instruction: "fox eyes", expect: "guaranteed" },
  { instruction: "surgical fox eyes not makeup", expect: "guaranteed" },
  { instruction: "fox eye liner", expect: "parse" },
  { instruction: "fox eye makeup", expect: "parse" },
  /* The walls, which do not move. */
  { instruction: "make her look like Scarlett Johansson", expect: "wall_likeness" },
  { instruction: "put her in a red coat", expect: "wall" },
  { instruction: "change the backdrop to blue", expect: "wall" },
  { instruction: "make her older", expect: "wall" },
  /* The guarantee lane must still win where it applies. */
  { instruction: "make her eyes green", expect: "guaranteed" },
  { instruction: "give her a bob", expect: "guaranteed" },
] as const;

let failures = 0;
for (const entry of SPREAD) {
  const parsed = await interpretRefinement({
    instruction: entry.instruction,
    currentEyeColour: "brown",
    currentEyeShape: null,
    currentHairStyle: "simple long hair",
    currentHairColour: "brown",
    currentHairTexture: "straight",
  });

  const label = `"${entry.instruction}"`.padEnd(44);
  if (!parsed.ok) {
    const wall = parsed.refusal.reason;
    const wanted = entry.expect === "wall" || entry.expect === "wall_likeness" || entry.expect === "gate";
    const right = wanted && (
      entry.expect === "wall" ? wall.startsWith("wall_")
        : entry.expect === "gate" ? wall === "gate_ink_document"
          : wall === entry.expect);
    console.log(`${right ? "PASS" : "FAIL"}  ${label} ${wall}`);
    if (!right) {
      failures += 1;
      console.log(`        wanted ${entry.expect} — ${refusalMessage(parsed)}`);
    }
    continue;
  }

  const delta = parsed.delta;
  const usedGuaranteed = Boolean(
    delta.eyeColour ?? delta.eyeShape ?? delta.hairStyle ?? delta.hairColour ?? delta.hairTexture,
  );
  const usedFree = Boolean(delta.free && Object.keys(delta.free).length > 0);

  if (entry.expect === "guaranteed" && !usedGuaranteed) {
    console.log(`FAIL  ${label} landed in the FREE lane: ${JSON.stringify(delta)}`);
    failures += 1;
    continue;
  }
  if (entry.expect !== "parse" && entry.expect !== "guaranteed") {
    console.log(`FAIL  ${label} parsed when a wall was expected: ${JSON.stringify(delta)}`);
    failures += 1;
    continue;
  }
  console.log(`PASS  ${label} ${usedFree ? "free" : "guaranteed"} ${JSON.stringify(delta)}`);
}

console.log(failures === 0 ? `\nAll ${SPREAD.length} passed.` : `\n${failures} failure(s).`);
process.exit(failures === 0 ? 0 : 1);
