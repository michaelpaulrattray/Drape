/**
 * TYPED REMOVAL — the founder's round-4 cases (D-163).
 *
 * # Two phases, because most of this costs nothing
 *
 * **Phase 1 is free**: every phrasing goes through the REAL interpreter and
 * must classify correctly. This is the phrasing-list law under test — the code
 * owns the matching, so the only question is whether the model reads intent,
 * and the only way to know is to ask it in the words people actually use.
 *
 * **Phase 2 is paid**: it builds a two-step stack and then undoes, removes the
 * last step, removes a mid-chain step, and negates a feature that was never
 * asked for. Each outcome is asserted on the PERSISTED ROW rather than on the
 * returned object (D-164): the shortened `instructions`, the `stepDeltas` that
 * line up with them, and the `requestText` the ghost chip reads.
 *
 *   npx tsx scripts/drive-typed-removal.mts          — everything
 *   npx tsx scripts/drive-typed-removal.mts phrasing — phase 1 only, free
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";

import { getDb } from "../server/db/connection";
import { castingCandidates, castingCandidateVariants, users } from "../drizzle/schema";
import { interpretRefinement } from "../server/castingV2/refineInterpreter";
import { refineCandidate } from "../server/castingV2/refineService";
import { selectVariant } from "../server/db/castingV2Variants";

let failures = 0;
function check(label: string, ok: boolean, detail = ""): void {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
}

/* ---------------------------------------------------- phase 1: the phrasings */

console.log("\n=== phrasings — the model reads INTENT, the code owns the rest ===");

const PHRASINGS: Array<{ ask: string; want: "navigate" | "remove" | "edit"; subject?: string }> = [
  { ask: "undo", want: "navigate" },
  { ask: "go back", want: "navigate" },
  { ask: "nevermind", want: "navigate" },
  { ask: "remove the hoops", want: "remove", subject: "statedAccessories" },
  { ask: "get rid of the earrings", want: "remove", subject: "statedAccessories" },
  /* Anaphoric: nobody can resolve "those" without the list, so it is
     navigation — going back a step is what they mean, and it is free. */
  { ask: "take those off", want: "navigate" },
  { ask: "get rid of that", want: "navigate" },
  { ask: "undo the earrings", want: "remove", subject: "statedAccessories" },
  { ask: "lose the lipstick", want: "remove" },
  { ask: "remove the makeup", want: "remove", subject: "makeup" },
  /* Not a removal at all — the ordinary edit must not be swept up. */
  { ask: "make her eyes green", want: "edit" },
  { ask: "give her a mullet", want: "edit" },
];

for (const testCase of PHRASINGS) {
  const parsed = await interpretRefinement({
    instruction: testCase.ask,
    currentEyeColour: "brown",
    currentEyeShape: "almond",
    currentHairStyle: "a blunt bob",
    currentHairColour: "black",
    currentHairTexture: "straight",
    currentMakeup: null,
  });
  const got = !parsed.ok
    ? `refused:${parsed.refusal.reason}`
    : parsed.intent === "navigate" ? "navigate"
      : parsed.intent === "remove" ? "remove"
        : "edit";
  const subjectOk = !testCase.subject
    || (parsed.ok && parsed.intent === "remove" && parsed.subject === testCase.subject);
  check(
    `"${testCase.ask}" -> ${testCase.want}`,
    got === testCase.want && subjectOk,
    got === testCase.want
      ? (subjectOk ? "" : `subject ${(parsed as { subject?: string }).subject}`)
      : `got ${got}`,
  );
}

if (process.argv[2] === "phrasing") process.exit(failures === 0 ? 0 : 1);

/* ------------------------------------------------- phase 2: the money and the row */

const db = await getDb();
if (!db) throw new Error("no db");
const [bot] = await db.select().from(users).where(eq(users.openId, "verify-bot-local")).limit(1);
const all = await db
  .select()
  .from(castingCandidates)
  .where(and(eq(castingCandidates.userId, bot!.id), eq(castingCandidates.status, "ready")))
  .orderBy(desc(castingCandidates.id))
  .limit(40);
const counts = new Map<number, number>();
for (const c of all) {
  const rows = await db
    .select({ id: castingCandidateVariants.id })
    .from(castingCandidateVariants)
    .where(eq(castingCandidateVariants.candidateId, c.id));
  counts.set(c.id, rows.length);
}
const candidate = [...all].sort((a, b) => (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0))[0]!;

async function readRow(publicId: string) {
  const [row] = await db!
    .select({
      instructions: castingCandidateVariants.instructions,
      stepDeltas: castingCandidateVariants.stepDeltas,
      requestText: castingCandidateVariants.requestText,
      deltas: castingCandidateVariants.deltas,
    })
    .from(castingCandidateVariants)
    .where(eq(castingCandidateVariants.publicId, publicId))
    .limit(1);
  return row!;
}

async function ask(instruction: string) {
  const started = Date.now();
  const result = await refineCandidate({}, {
    userId: bot!.id,
    clientRequestId: randomUUID(),
    candidatePublicId: candidate.publicId,
    instruction,
  });
  console.log(`  "${instruction}" -> ${result.kind} (${Math.round((Date.now() - started) / 1000)}s)`);
  return result;
}

console.log("\n=== building a two-step stack ===");
await selectVariant({ userId: bot!.id, candidatePublicId: candidate.publicId, variantPublicId: null });
const one = await ask("a smokey eye");
const two = await ask("small gold hoops");

console.log("\n=== undo — free navigation, never a render ===");
{
  const result = await ask("undo");
  check("selected rather than rendered", result.kind === "selected");
  check("landed on the first step", result.variantId === one.variantId, String(result.variantId));
  check("said it was free", /nothing charged/i.test(result.note ?? ""), result.note ?? "");
}

console.log("\n=== removing the LAST step — lands on a picture that exists, so free ===");
{
  await selectVariant({
    userId: bot!.id,
    candidatePublicId: candidate.publicId,
    variantPublicId: two.variantId,
  });
  const result = await ask("take the gold hoops off");
  check("selected rather than rendered", result.kind === "selected");
  check("landed on the smokey-eye version", result.variantId === one.variantId, String(result.variantId));
  check("said it already existed", /already have/i.test(result.note ?? ""), result.note ?? "");
}

console.log("\n=== removing a MID-CHAIN step — a new combination, so it renders ===");
{
  await selectVariant({
    userId: bot!.id,
    candidatePublicId: candidate.publicId,
    variantPublicId: two.variantId,
  });
  const result = await ask("get rid of the smokey eye");
  check("rendered", result.kind === "rendered");
  if (result.variantId) {
    const row = await readRow(result.variantId);
    const instructions = row.instructions as string[];
    const steps = row.stepDeltas as unknown[];
    check("the recipe is chain-minus-step", JSON.stringify(instructions) === JSON.stringify(["small gold hoops"]), JSON.stringify(instructions));
    check("the step chain lines up with it", steps?.length === instructions.length, `${steps?.length} vs ${instructions.length}`);
    check("the removed step is gone from the composed delta", !JSON.stringify(row.deltas).includes("smokey"), JSON.stringify(row.deltas));
    /* D-161: the ghost chip must name what they TYPED, not the last survivor. */
    check("what they typed is kept apart from the recipe", row.requestText === "get rid of the smokey eye", String(row.requestText));
  }
}

console.log("\n=== negating a feature that was never asked for — the face second ===");
{
  await selectVariant({
    userId: bot!.id,
    candidatePublicId: candidate.publicId,
    variantPublicId: two.variantId,
  });
  const result = await ask("remove her freckles");
  check("rendered as an ordinary edit", result.kind === "rendered");
  if (result.variantId) {
    const row = await readRow(result.variantId);
    const instructions = row.instructions as string[];
    check("appended rather than subtracted", instructions.length === 3, JSON.stringify(instructions));
    check("their own sentence is the last step", instructions.at(-1) === "remove her freckles", String(instructions.at(-1)));
  }
}

console.log(failures === 0 ? "\nTYPED REMOVAL: ALL CASES PASS." : `\n${failures} assertion(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
