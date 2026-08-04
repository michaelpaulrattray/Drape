/**
 * THE FOUR CASUALTIES, AND THE ONE REFUSAL THAT MUST SURVIVE (D-172).
 *
 * Containment has refused four honest instructions, each patched at the
 * comparison. The echo pass moves the fix upstream: only the user's words are
 * ever filed, so the model's specification never reaches the check.
 *
 * FREE — this is the interpreter only, no renders.
 *
 *   npx tsx scripts/drive-containment.mts
 */
import "dotenv/config";
import { interpretRefinement } from "../server/castingV2/refineInterpreter";

let failures = 0;
function check(label: string, ok: boolean, detail = ""): void {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
}

type Case = {
  ask: string;
  want: "files" | "refuses";
  /** Words that must NOT appear in anything filed — invented content. */
  forbid?: string[];
  prior?: Record<string, string[]>;
};

const CASES: Case[] = [
  /* THE FOURTH CASUALTY, and the founder's own words: fewer words must never
     fail where more words succeed. */
  { ask: "hair color pink", want: "files" },
  { ask: "hair color pastel pink", want: "files" },
  /* The first three, each of which cost a real instruction. */
  { ask: "more defined cupids bow", want: "files" },
  { ask: "tie her hair up", want: "files" },
  {
    ask: "add freckles",
    want: "files",
    prior: { marks: ["a scar on her cheek"] },
  },
  /* THE ONE THAT MUST STILL BE REFUSED — or rather, must file as the scar they
     typed and never as the biography they did not. */
  {
    ask: "give her a scar",
    want: "files",
    forbid: ["knife", "bar", "fight", "surgery", "accident"],
  },
  /* Short, casual, underspecified — the shape the founder says to protect. */
  { ask: "green eyes", want: "files" },
  { ask: "thicker brows", want: "files" },
  { ask: "a mole", want: "files" },
];

for (const testCase of CASES) {
  const parsed = await interpretRefinement({
    instruction: testCase.ask,
    prior: testCase.prior,
    currentEyeColour: "brown",
    currentEyeShape: "almond",
    currentHairStyle: "a blunt bob",
    currentHairColour: "black",
    currentHairTexture: "straight",
    currentMakeup: null,
  });
  const filed = parsed.ok && "delta" in parsed;
  const shown = parsed.ok
    ? ("delta" in parsed ? JSON.stringify(parsed.delta) : `intent:${parsed.intent}`)
    : `refused:${parsed.refusal.reason}`;
  check(`"${testCase.ask}" -> ${testCase.want}`,
    testCase.want === "files" ? filed : !filed, shown);
  if (filed && testCase.forbid) {
    const text = JSON.stringify((parsed as { delta: unknown }).delta).toLowerCase();
    const invented = testCase.forbid.filter((word) => text.includes(word));
    check(`  …and invents nothing`, invented.length === 0, invented.join(", ") || shown);
  }
}

console.log(failures === 0 ? "\nCONTAINMENT: ALL CASES PASS." : `\n${failures} FAILED.`);
process.exit(failures === 0 ? 0 : 1);
