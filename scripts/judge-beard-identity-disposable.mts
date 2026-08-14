/**
 * IS IT STILL HIM — the arm the beard court owed (fable-533 §3).
 *
 * The removal court asked whether the beard was gone and whether the skin under
 * it was clean. It never asked about HIM. A beard covers the jaw and half the
 * mouth, so a shave that quietly rebuilds his jawline passes every arm that was
 * run — which is exactly the kind of pass that means nothing.
 *
 * # Each frame is judged against its OWN PARENT, never against the master
 *
 * A chained edit's identity question is *"is this the same person as the frame
 * this was made from"*. Judging a survival frame against the bearded master
 * would ask it to look like a man with a beard, which is the thing that was
 * deliberately removed — the branch-state rule, learned when a copper-shag
 * frame was judged against a blonde master and the carry was working perfectly.
 *
 *     control-N   ← master     (an unrelated edit; nothing about him changed)
 *     removal-N   ← master     (the shave itself)
 *     survival-N  ← removal-N  (one more edit on the shaved frame)
 *
 * Reads only. No renders, no user credits: about nine cents of house money.
 *
 *   npx tsx scripts/judge-beard-identity-disposable.mts
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";

const OPENROUTER = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER) throw new Error("OPENROUTER_API_KEY is required");

const OUT = "output/beard-court";
const { createOpenRouterTextEngine } = await import("../server/providers/openrouterText.js");
const reader = createOpenRouterTextEngine({ apiKey: OPENROUTER });

const lines: string[] = [];
const say = (line = "") => { console.log(line); lines.push(line); };

const frame = (name: string) => readFileSync(`${OUT}/${name}.png`);

async function judge(parent: string, child: string): Promise<{ same: boolean; saw: string }> {
  const answer = await reader.complete({
    system: "You are shown two photographs of a person. The FIRST is the reference. JSON only.",
    user: "Answer as {\"same_person\": true|false, \"saw\": \"<a few words>\"}. "
      + "same_person: is the second photograph the same individual as the first — the same "
      + "face, the same bone structure, the same features? Facial hair, clothing and "
      + "accessories may differ and do not make it a different person.",
    images: [
      { bytes: frame(parent), contentType: "image/png" },
      { bytes: frame(child), contentType: "image/png" },
    ],
    json: true,
  });
  const parsed = (() => {
    try { return JSON.parse(answer.text.replace(/```json|```/g, "").trim()); } catch { return null; }
  })();
  const saw = typeof parsed?.saw === "string" ? parsed.saw : "";
  /* An affirmative with no `saw` is not a reading (D-235). */
  const same = parsed?.same_person === true && saw.trim().length > 0;
  say(`  ${child.padEnd(12)} against ${parent.padEnd(12)} same=${same ? "YES" : "no "}  ${saw.slice(0, 60)}`);
  return { same, saw };
}

say("IDENTITY, RETRO-JUDGED — each frame against its own parent (fable-533 §3)");
say("");

const pairs: Array<{ parent: string; child: string; arm: string }> = [];
for (const n of ["1", "2", "3"]) {
  pairs.push({ parent: "master", child: `control-${n}`, arm: "control" });
  pairs.push({ parent: "master", child: `removal-${n}`, arm: "removal" });
  pairs.push({ parent: `removal-${n}`, child: `survival-${n}`, arm: "survival" });
}

const results: Array<{ arm: string; child: string; parent: string; same: boolean; saw: string }> = [];
for (const pair of pairs) {
  const read = await judge(pair.parent, pair.child);
  results.push({ ...pair, ...read });
}

const held = results.filter((row) => row.same).length;
say("");
say("=".repeat(74));
for (const arm of ["control", "removal", "survival"]) {
  const rows = results.filter((row) => row.arm === arm);
  say(`${arm.padEnd(9)} still him   ${rows.filter((row) => row.same).length} of ${rows.length}`);
}
say(`OVERALL   ${held} of ${results.length}`);
say(held === results.length
  ? "PASS — the shave did not quietly rebuild him"
  : "FAIL — the slice reopens: a frame came back as somebody else");
say("=".repeat(74));
say(`SPEND: ${results.length} reads × $0.01 = $${(results.length * 0.01).toFixed(2)} of house money`);

writeFileSync(`${OUT}/identity.txt`, `${lines.join("\n")}\n`);
writeFileSync(`${OUT}/identity.json`, `${JSON.stringify(results, null, 2)}\n`);
process.exit(held === results.length ? 0 : 1);
