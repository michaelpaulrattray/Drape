/**
 * THE CAPTION LIFECYCLE DRIVER — the founder's three round-3 cases (D-159).
 *
 * # Why this one reads the database as well as the pictures
 *
 * The defect it guards was invisible to every instrument already in the repo.
 * D-147's driver scored facet survival and passed. D-152's gauntlet scored
 * sharpness and tone and passed. Both were green while recipe v3's memory half
 * did literally nothing, because captions were built and never written down —
 * the deltas were carrying the facets, so the pictures looked right.
 *
 * **A picture that looks right is not evidence that the mechanism ran.** So
 * every case here asserts on the persisted row: which facets the composed delta
 * holds, which captions the variant recorded, and what the prompt actually said.
 * The composed strip is for the founder's eye; the assertions are the test.
 *
 *   npx tsx scripts/drive-caption-lifecycle.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";

import { getDb } from "../server/db/connection";
import { castingCandidates, castingCandidateVariants, users } from "../drizzle/schema";
import { refineCandidate } from "../server/castingV2/refineService";
import { selectVariant } from "../server/db/castingV2Variants";
import { storagePublicUrl } from "../server/storage";
import { assertOneWorld } from "./lib/worldGuard.mts";

/*
  One world per process (scripts/lib/worldGuard.mts). Inert outside a Railway
  run; inside one it refuses when dotenv has filled a gap the service does not
  define, which is how a "production" read gets taken from dev.
*/
assertOneWorld(["DATABASE_URL"]);

const maybeDb = await getDb();
if (!maybeDb) throw new Error("no db");
/* Aliased after the guard so every closure below holds a non-null handle. */
const db = maybeDb;
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
const pool = [...all].sort((a, b) => (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0));

type Row = {
  deltas: Record<string, unknown>;
  captions: Record<string, string>;
  prompt: string;
};

async function readVariant(publicId: string): Promise<Row> {
  const [row] = await db
    .select({
      deltas: castingCandidateVariants.deltas,
      internalPrompt: castingCandidateVariants.internalPrompt,
    })
    .from(castingCandidateVariants)
    .where(eq(castingCandidateVariants.publicId, publicId))
    .limit(1);
  const internal = (row?.internalPrompt ?? {}) as Record<string, unknown>;
  return {
    deltas: (row?.deltas ?? {}) as Record<string, unknown>,
    captions: (internal.captions ?? {}) as Record<string, string>,
    prompt: typeof internal.prompt === "string" ? internal.prompt : "",
  };
}

let failures = 0;
function check(label: string, ok: boolean, detail = ""): void {
  if (!ok) failures += 1;
  console.log(`     ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

async function compose(urls: string[], name: string): Promise<void> {
  const W = 400;
  const cells: Buffer[] = [];
  for (const url of urls) {
    cells.push(await sharp(Buffer.from(await (await fetch(url)).arrayBuffer())).resize(W).toBuffer());
  }
  const meta = await sharp(cells[0]).metadata();
  const out = await sharp({
    create: {
      width: W * cells.length + 10 * (cells.length - 1),
      height: meta.height!,
      channels: 3,
      background: "#111111",
    },
  })
    .composite(cells.map((input, i) => ({ input, left: i * (W + 10), top: 0 })))
    .jpeg({ quality: 86 })
    .toBuffer();
  writeFileSync(`docs/specs/evidence/refine/${name}`, out);
  console.log(`     wrote ${name} (${cells.length} frames)`);
}

async function run(candidateIndex: number, steps: string[]): Promise<{ rows: Row[]; urls: string[] }> {
  const candidate = pool[candidateIndex];
  if (!candidate) throw new Error("not enough ready candidates");
  await selectVariant({
    userId: bot!.id,
    candidatePublicId: candidate.publicId,
    variantPublicId: null,
  });
  const urls = [storagePublicUrl(candidate.imageKey!)];
  const rows: Row[] = [];
  for (const instruction of steps) {
    const started = Date.now();
    const result = await refineCandidate({}, {
      userId: bot!.id,
      clientRequestId: randomUUID(),
      candidatePublicId: candidate.publicId,
      instruction,
    });
    console.log(`  OK  "${instruction}" (${Math.round((Date.now() - started) / 1000)}s)`);
    urls.push(result.imageUrl);
    rows.push(await readVariant(result.variantId));
  }
  return { rows, urls };
}

/* One case at a time when asked, so a re-run costs one case's renders. */
const only = process.argv[2];
const wanted = (name: string) => !only || only === name;

/* ---- (a) branch from worn, then colour: worn SURVIVES and colour APPLIES ---- */

if (wanted("a")) console.log("\n=== (a) worn + colour — the worn state must survive the colour edit ===");
if (wanted("a")) {
  const { rows, urls } = await run(0, ["hair worn down", "pastel pink hair"]);
  const [worn, coloured] = rows;
  check("the worn edit captured a caption", Boolean(worn.captions.hairWorn),
    worn.captions.hairWorn ?? "NO CAPTION — v3's memory is dead again");
  check("the colour edit CARRIED the worn caption forward",
    coloured.captions.hairWorn === worn.captions.hairWorn,
    coloured.captions.hairWorn ?? "dropped");
  check("the worn instruction is still filed", Boolean((coloured.deltas.free as Record<string, string>)?.hairWorn));
  check("the worn state is stated as already true in the prompt",
    coloured.prompt.includes("ALREADY TRUE") && coloured.prompt.includes("HAIR WORN"));
  check("a fresh colour caption was captured", Boolean(coloured.captions["hair.colour"]),
    coloured.captions["hair.colour"] ?? "none");
  await compose(urls, "d159-worn-then-colour.jpg");
}

/* ---- (b) the founder's exact pink stack: pink RENDERS, copper is GONE ---- */

console.log("\n=== (b) copper then pastel pink — one head, one colour ===");
if (wanted("b")) {
  const { rows, urls } = await run(1, ["copper hair", "pastel pink hair color"]);
  const [copper, pink] = rows;
  check("copper captured a colour caption", Boolean(copper.captions["hair.colour"]),
    copper.captions["hair.colour"] ?? "none");
  check("the pink edit DROPPED the copper caption",
    copper.captions["hair.colour"] !== pink.captions["hair.colour"],
    pink.captions["hair.colour"] ?? "none");
  check("only ONE colour survives composition",
    !(pink.deltas.hairColour && (pink.deltas.free as Record<string, string>)?.hairShade),
    JSON.stringify({ guaranteed: pink.deltas.hairColour, free: (pink.deltas.free as Record<string, string>)?.hairShade }));
  check("the prompt asks for pink", /pink/i.test(pink.prompt));
  check("the prompt never mentions copper", !/copper/i.test(pink.prompt));
  await compose(urls, "d159-copper-then-pink.jpg");
}

/* ---- (c) cut stability across three unrelated edits ---- */

console.log("\n=== (c) a mullet must survive three edits that are not about hair ===");
if (wanted("c")) {
  const { rows, urls } = await run(2, [
    "change hair to a mullet",
    "give her green eyes",
    "thick straight brows",
    "a small beauty mark on her cheek",
  ]);
  const cut = rows[0];
  const last = rows.at(-1)!;
  const captured = cut.captions.hairCut ?? cut.captions["hair.cut"];
  const carried = last.captions.hairCut ?? last.captions["hair.cut"];
  check("the cut captured a caption", Boolean(captured), captured ?? "none");
  check("the cut caption is carried UNCHANGED through three unrelated edits",
    Boolean(captured) && carried?.trim() === captured?.trim(), carried ?? "lost");
  check("the cut is still filed after three unrelated edits",
    Boolean(last.deltas.hairStyle || (last.deltas.free as Record<string, string>)?.hairCut));
  check("the cut is restated in the final prompt", /HAIR CUT|cut into/i.test(last.prompt));
  await compose(urls, "d159-cut-stability.jpg");
}

console.log(failures === 0
  ? "\nALL CAPTION-LIFECYCLE CASES PASS."
  : `\n${failures} assertion(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
