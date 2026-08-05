/**
 * THE TWO-REFERENCE CALIBRATION TRIAL (founder directive, 2026-08-05).
 *
 * The architecture question decided on renders rather than argument: does
 * handing the render a SECOND reference — the previously accepted image, as a
 * statement of current styling — retain more of the recipe than base-anchoring
 * alone, and does it reintroduce the generation loss that killed the old
 * chain-anchored scheme?
 *
 * # It changes nothing
 *
 * Measurement only. No architecture switch, no prompt change outside this file,
 * nothing ships from it. The deliverable is a table and a wall of faces for the
 * founder's eyeball; the ruling is theirs.
 *
 * # The two arms differ in exactly two things
 *
 * Arm (a) is the REAL product path — `refineCandidate`, base-only, its own
 * prompts, its own stored verdicts. Arm (b) then renders the SAME position
 * using **arm (a)'s own stored prompt string**, with the role-distinction
 * preamble prepended and the previous accepted arm-(b) image added as a second
 * reference. Composing a fresh prompt for arm (b) would have made the arms
 * differ in ways nobody chose; this way the only variables are the second
 * reference and the preamble that explains it.
 *
 * # Measured identically
 *
 * The same facts, the same reader, the same sharpness pipeline at every chain
 * position. Arm (a)'s stored `verification.checks` supplies the fact list, so
 * both arms are asked exactly the same questions about their pictures.
 *
 *   npx tsx scripts/calibration/two-reference-trial.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { mkdirSync, writeFileSync } from "node:fs";

import { getDb } from "../../server/db/connection";
import { castingCandidateVariants, castingCandidates, users } from "../../drizzle/schema";
import { refineCandidate } from "../../server/castingV2/refineService";
import { verifyRender } from "../../server/castingV2/renderVerification";
import { castingIdentityEngine } from "../../server/castingV2/signEngine";
import { storagePublicUrl } from "../../server/storage";
import type { Facet } from "../../server/castingV2/refineFacets";

/**
 * THE ROLE DISTINCTION — founder directive, law for this trial, verbatim.
 *
 * Two references with no stated roles is the failure everyone predicts: the
 * model averages them, or treats the second as another photograph of a similar
 * person. The preamble is the whole reason arm (b) is worth measuring.
 */
const ROLE_PREAMBLE = [
  "You are given TWO reference images and they have different jobs.",
  "",
  "The FIRST image is THE PERSON. Their face, their skin, their likeness and the",
  "photographic quality of the result all come from this image and from nowhere else.",
  "",
  "The SECOND image shows THE CURRENT STYLING of that same person — how they are made up,",
  "coloured, adorned and arranged right now. Reproduce that styling faithfully.",
  "",
  "Where the instruction below disagrees with the second image, THE INSTRUCTION WINS and the",
  "second image is out of date. Never let the second image change who the person is.",
  "",
].join("\n");

/** Six edits, the same on every chain, ending on the removal probe. */
const EDITS = [
  "change her hair to a blunt bob",
  "seafoam green eyes",
  "small gold hoop earrings",
  "a warm open smile",
  "copper hair",
  /* PROBE A — the state image HAS earrings by now; the instruction must win. */
  "remove the earrings",
] as const;

const OUT = "output/two-reference-trial";
mkdirSync(OUT, { recursive: true });

/** Sharpness and tone, from the bytes each time (the gauntlet's instrument). */
async function quality(bytes: Buffer): Promise<{ sharpness: number; tone: number }> {
  const edges = await sharp(bytes)
    .resize(768, null, { fit: "inside" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })
    .then(({ data, info }) => {
      let sum = 0;
      let sumSq = 0;
      let n = 0;
      for (let y = 1; y < info.height - 1; y += 1) {
        for (let x = 1; x < info.width - 1; x += 1) {
          const i = y * info.width + x;
          const lap = -4 * data[i] + data[i - 1] + data[i + 1]
            + data[i - info.width] + data[i + info.width];
          sum += lap;
          sumSq += lap * lap;
          n += 1;
        }
      }
      const mean = sum / n;
      return Math.sqrt(sumSq / n - mean * mean);
    });
  const plain = await sharp(bytes).resize(768, null, { fit: "inside" }).greyscale().stats();
  return { sharpness: edges, tone: plain.channels[0].stdev };
}

const fetchBytes = async (url: string) => Buffer.from(await (await fetch(url)).arrayBuffer());

/**
 * PROBE B — does the second reference let the styling bleed into the identity?
 *
 * The honest instrument available: the same reader, asked whether the person is
 * the same person as the original, with the styling explicitly excluded from
 * the question.
 */
async function identityHolds(original: Buffer, rendered: Buffer): Promise<boolean | null> {
  const { interpreterEngine } = await import("../../server/castingV2/interpreter");
  const engine = interpreterEngine();
  if (!engine) return null;
  try {
    const reply = await engine.complete({
      system: [
        "You are shown two photographs. Answer whether they are the same PERSON.",
        "",
        "Ignore hair colour, hair style, makeup, jewellery and expression entirely — those are",
        "allowed to differ. Judge bone structure, eye shape and set, nose, mouth, jaw, ears and",
        "skin character only.",
        "",
        'Reply with JSON: {"samePerson": true|false, "why": "..."} and nothing else.',
      ].join("\n"),
      user: "First image: the original. Second image: after editing.",
      images: [
        { bytes: original, contentType: "image/png" },
        { bytes: rendered, contentType: "image/png" },
      ],
      json: true,
      temperature: 0,
      maxOutputTokens: 200,
    });
    const parsed = JSON.parse(reply.text.trim().replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, ""));
    return parsed?.samePerson === true;
  } catch {
    return null;
  }
}

/**
 * THE MEASURE THE HYPOTHESIS ACTUALLY NEEDS (founder addendum, 2026-08-05).
 *
 * Presence cannot see the complaint. "Gold hoop earrings present" scores the
 * same whether they are the SAME hoops as last render or a different pair the
 * model invented — and "different ones every render" was the original finding.
 * A dead-level presence score is therefore perfectly consistent with the second
 * reference winning decisively on the thing it exists to fix.
 *
 * So every fact that PERSISTS unchanged across consecutive positions is judged
 * across the pair: same object, same shade, not merely present again.
 *
 * Advisory by construction — this is cross-render judgement, not a defined
 * vocabulary, so it spends no refusals anywhere. It feeds the table.
 */
async function consistencyAcross(input: {
  previous: Buffer;
  current: Buffer;
  facts: ReadonlyArray<{ facet: Facet; asked: string }>;
}): Promise<{ same: number; total: number; detail: Array<{ asked: string; same: boolean; why?: string }> }> {
  if (input.facts.length === 0) return { same: 0, total: 0, detail: [] };
  const { interpreterEngine } = await import("../../server/castingV2/interpreter");
  const engine = interpreterEngine();
  if (!engine) return { same: 0, total: 0, detail: [] };
  try {
    const reply = await engine.complete({
      system: [
        "You are shown two photographs of the same person, taken one edit apart.",
        "",
        "For each listed feature, answer whether it is the SAME REALIZATION in both — the same",
        "specific object, the same specific shade — not merely present in both. Different",
        "earrings in the same style are NOT the same earrings. A different pink is not the",
        "same pink. Judge the thing itself, not whether the category is occupied.",
        "",
        'Reply with JSON: {"results":[{"id":1,"same":true|false,"why":"..."}]} and nothing else.',
        "Include `why` only where same is false, under 80 characters.",
      ].join("\n"),
      user: input.facts.map((fact, index) => `${index + 1}. ${fact.asked}`).join("\n"),
      images: [
        { bytes: input.previous, contentType: "image/png" },
        { bytes: input.current, contentType: "image/png" },
      ],
      json: true,
      temperature: 0,
      maxOutputTokens: 600,
    });
    const parsed = JSON.parse(reply.text.trim().replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, ""));
    const results = Array.isArray(parsed?.results) ? parsed.results : [];
    const detail = input.facts.map((fact, index) => {
      const row = results.find((entry: { id?: unknown }) => Number(entry?.id) === index + 1);
      const same = row ? row.same === true : true;
      return { asked: fact.asked, same, ...(same ? {} : { why: String(row?.why ?? "").slice(0, 80) }) };
    });
    return { same: detail.filter((entry) => entry.same).length, total: detail.length, detail };
  } catch {
    return { same: 0, total: 0, detail: [] };
  }
}

type Cell = {
  chain: number;
  position: number;
  instruction: string;
  facts: Array<{ facet: Facet; asked: string }>;
  aChecks: unknown;
  bChecks: unknown;
  /** Facts that persisted from the previous position, judged across the pair. */
  aSteady?: { same: number; total: number; detail: unknown };
  bSteady?: { same: number; total: number; detail: unknown };
  a: { verified: number; total: number; sharpness: number; identity: boolean | null };
  b: { verified: number; total: number; sharpness: number; identity: boolean | null };
};

const db = await getDb();
if (!db) throw new Error("no db");
const [bot] = await db.select().from(users).where(eq(users.openId, "verify-bot-local")).limit(1);
if (!bot) throw new Error("verify-bot-local is missing — seed it first");

/* Fresh, throwaway candidates cast for the purpose. */
const candidates = await db
  .select({
    id: castingCandidates.id,
    publicId: castingCandidates.publicId,
    imageKey: castingCandidates.imageKey,
  })
  .from(castingCandidates)
  .where(eq(castingCandidates.userId, bot.id))
  .orderBy(castingCandidates.id);

/* Unrefined only: a candidate carrying an old driver's chain would make arm (a)
   continue somebody else's history instead of starting one. */
const withVariants = new Set(
  (await db.select({ candidateId: castingCandidateVariants.candidateId })
    .from(castingCandidateVariants)).map((row) => row.candidateId),
);
const usable = candidates
  .filter((row) => row.imageKey && !withVariants.has(row.id))
  .slice(-3);
if (usable.length < 3) throw new Error(`need 3 fresh candidates for the bot, found ${usable.length}`);
console.log("chains:", usable.map((row) => row.publicId).join(", "));

const engine = castingIdentityEngine();
const cells: Cell[] = [];

for (const [chainIndex, candidate] of usable.entries()) {
  const original = await fetchBytes(storagePublicUrl(candidate.imageKey!));
  const baseQuality = await quality(original);
  writeFileSync(`${OUT}/chain${chainIndex + 1}-00-original.png`, original);
  console.log(`\n=== CHAIN ${chainIndex + 1} · ${candidate.publicId} · base sharpness ${baseQuality.sharpness.toFixed(1)}`);

  /* Arm (b) walks its own history; arm (a) is the product's. */
  let previousB = original;
  /* The image the previous position ACCEPTED, per arm, plus the facts that were
     true then — the pair the consistency reader is shown. */
  let previousA: Buffer | null = null;
  let previousBAccepted: Buffer | null = null;
  let previousFacts: Array<{ facet: Facet; asked: string }> = [];

  for (const [step, instruction] of EDITS.entries()) {
    /* ---------- arm (a): the real product path ---------- */
    let armA;
    try {
      armA = await refineCandidate({}, {
        userId: bot.id,
        clientRequestId: crypto.randomUUID(),
        candidatePublicId: candidate.publicId,
        instruction,
      });
    } catch (error) {
      console.log(`  ${step + 1}. "${instruction}" — arm (a) REFUSED: ${(error as Error).message.slice(0, 90)}`);
      continue;
    }
    if (!armA.variantId) {
      console.log(`  ${step + 1}. "${instruction}" — arm (a) returned no variant (${armA.kind})`);
      continue;
    }

    const [row] = await db
      .select({
        internalPrompt: castingCandidateVariants.internalPrompt,
        imageKey: castingCandidateVariants.imageKey,
      })
      .from(castingCandidateVariants)
      .where(eq(castingCandidateVariants.publicId, armA.variantId))
      .limit(1);
    const stored = row?.internalPrompt as {
      prompt?: string;
      verification?: {
        checks?: Array<{ facet: Facet; asked: string; verified: boolean; binding?: boolean }>;
      };
    } | null;
    const prompt = stored?.prompt ?? "";
    /* `binding` travels, or the table cannot tell a refusable miss from a
       watched one — which is the distinction D-187 exists to draw. */
    const facts = (stored?.verification?.checks ?? []).map((check) => ({
      facet: check.facet,
      asked: check.asked,
      binding: check.binding !== false,
    }));

    const aBytes = await fetchBytes(storagePublicUrl(row!.imageKey!));

    /* ---------- arm (b): same prompt, second reference, role preamble ---------- */
    const bRendered = await engine.editWithReferences({
      prompt: `${ROLE_PREAMBLE}${prompt}`,
      references: [
        { bytes: original, contentType: "image/png" },
        { bytes: previousB, contentType: "image/png" },
      ],
      resolution: "1K",
    });
    previousBAccepted = previousB;
    previousB = bRendered.bytes;

    /* ---------- measured identically ---------- */
    const [aVerdict, bVerdict] = await Promise.all([
      verifyRender({ bytes: aBytes, contentType: "image/png", facts }),
      verifyRender({ bytes: bRendered.bytes, contentType: bRendered.contentType, facts }),
    ]);
    const [aQuality, bQuality] = await Promise.all([quality(aBytes), quality(bRendered.bytes)]);

    /*
      THE CONSISTENCY COLUMN — the hypothesis's actual test.

      Only facts that PERSISTED unchanged from the previous position are judged:
      a fact this instruction just rewrote is supposed to look different. Same
      reader, same pairs, both arms, so the comparison stays clean.
    */
    const persisted = previousFacts.filter((earlier) =>
      facts.some((fact) => fact.facet === earlier.facet && fact.asked === earlier.asked));
    const [aSteady, bSteady] = previousA && previousBAccepted && persisted.length > 0
      ? await Promise.all([
        consistencyAcross({ previous: previousA, current: aBytes, facts: persisted }),
        consistencyAcross({ previous: previousBAccepted, current: bRendered.bytes, facts: persisted }),
      ])
      : [undefined, undefined];
    /* Identity is only interesting once the styling is heavy — probe B. */
    const heavy = step >= 3;
    const [aIdentity, bIdentity] = heavy
      ? await Promise.all([identityHolds(original, aBytes), identityHolds(original, bRendered.bytes)])
      : [null, null];

    writeFileSync(`${OUT}/chain${chainIndex + 1}-${step + 1}-a.png`, aBytes);
    writeFileSync(`${OUT}/chain${chainIndex + 1}-${step + 1}-b.png`, bRendered.bytes);

    const cell: Cell = {
      chain: chainIndex + 1,
      position: step + 1,
      instruction,
      facts,
      aChecks: aVerdict.checks,
      bChecks: bVerdict.checks,
      ...(aSteady ? { aSteady } : {}),
      ...(bSteady ? { bSteady } : {}),
      a: {
        verified: aVerdict.checks.filter((check) => check.verified).length,
        total: aVerdict.checks.length,
        sharpness: aQuality.sharpness / baseQuality.sharpness,
        identity: aIdentity,
      },
      b: {
        verified: bVerdict.checks.filter((check) => check.verified).length,
        total: bVerdict.checks.length,
        sharpness: bQuality.sharpness / baseQuality.sharpness,
        identity: bIdentity,
      },
    };
    cells.push(cell);
    previousA = aBytes;
    previousFacts = facts;
    /* The advisory watch list travels with the table (D-187): a miss the
       product will not refuse over is still the reader-defect instrument. */
    console.log(
      `  ${step + 1}. "${instruction}"  a ${cell.a.verified}/${cell.a.total} sharp ${(cell.a.sharpness * 100).toFixed(0)}%`
      + `   |   b ${cell.b.verified}/${cell.b.total} sharp ${(cell.b.sharpness * 100).toFixed(0)}%`
      + (aSteady && bSteady
        ? `   steady a ${aSteady.same}/${aSteady.total} b ${bSteady.same}/${bSteady.total}`
        : "")
      + (heavy ? `   identity a=${cell.a.identity} b=${cell.b.identity}` : ""),
    );
    writeFileSync(`${OUT}/results.json`, JSON.stringify(cells, null, 2));
  }
}

console.log(`\n${cells.length} positions measured. Faces and results.json in ${OUT}`);
