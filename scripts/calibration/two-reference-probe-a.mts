/**
 * PROBE A, scored with the right instrument.
 *
 * The removal probe cannot be read off the fact list: removal is SUBTRACTION,
 * so the composed recipe simply stops holding `statedAccessories` and there is
 * no positive fact for the net to check. The verified counts at that position
 * are about the other facts entirely, and reporting them as the probe's score
 * would be an asterisk wearing a number.
 *
 * So it is asked directly, of both arms, on the position-6 renders: are the
 * earrings there? Arm (b)'s state image was WEARING them when the instruction
 * said to take them off, which is the whole point — the instruction must win.
 *
 *   npx tsx scripts/calibration/two-reference-probe-a.mts
 */
import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { interpreterEngine } from "../../server/castingV2/interpreter";

const OUT = "output/two-reference-trial";

async function earringsPresent(bytes: Buffer): Promise<boolean | null> {
  const engine = interpreterEngine();
  if (!engine) return null;
  try {
    const reply = await engine.complete({
      system: [
        "You look at one photograph of a person and answer a single question about it.",
        "",
        "Are they wearing EARRINGS? Hoops, studs, drops — anything in or on the ear counts.",
        "Glasses, necklaces and hair ornaments do not. Look closely at both ears; hair may",
        "partly cover one.",
        "",
        'Reply with JSON: {"earrings": true|false, "what": "..."} and nothing else.',
      ].join("\n"),
      user: "Are there earrings in this photograph?",
      images: [{ bytes, contentType: "image/png" }],
      json: true,
      temperature: 0,
      maxOutputTokens: 150,
    });
    const parsed = JSON.parse(
      reply.text.trim().replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, ""),
    );
    return parsed?.earrings === true;
  } catch {
    return null;
  }
}

const cells = JSON.parse(readFileSync(`${OUT}/results.json`, "utf8")) as Array<{
  chain: number; position: number; instruction: string;
}>;
const removals = cells.filter((cell) => cell.instruction.startsWith("remove"));
const lines: string[] = [];

for (const cell of removals) {
  /* The position BEFORE the removal is the proof the earrings were there to
     remove — otherwise "absent" means nothing. */
  const before = `${OUT}/chain${cell.chain}-${cell.position - 1}-b.png`;
  const results: Record<string, boolean | null> = {};
  for (const [label, file] of [
    ["before (b)", before],
    ["after (a)", `${OUT}/chain${cell.chain}-${cell.position}-a.png`],
    ["after (b)", `${OUT}/chain${cell.chain}-${cell.position}-b.png`],
  ] as const) {
    results[label] = existsSync(file) ? await earringsPresent(readFileSync(file)) : null;
  }
  const verdict = results["after (a)"] === false && results["after (b)"] === false
    ? "BOTH ARMS OBEYED"
    : results["after (b)"] === true
      ? "ARM (b) KEPT THE STATE IMAGE'S EARRINGS — the probe failed"
      : "inconclusive";
  lines.push(
    `chain ${cell.chain}: before(b) ${results["before (b)"]} · after(a) ${results["after (a)"]}`
    + ` · after(b) ${results["after (b)"]} → ${verdict}`,
  );
  console.log(lines.at(-1));
}

writeFileSync(`${OUT}/probe-a.txt`, lines.join("\n"));

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
