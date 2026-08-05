/**
 * EXPERIMENT (iv) — the founder's hybrid refresh, and the instrument check that
 * has to pass before its verdict means anything.
 *
 * # The theory
 *
 * Iterate chain-anchored, so accumulated detail is held by construction rather
 * than re-described in words. Every few edits, run a REFRESH: the current chain
 * image is the styling truth (reproduce all of it exactly — nothing re-rolls
 * from words) and the base is the identity and photographic-quality reference
 * (same person as the base; restore its fidelity). The self-updating reference
 * is periodically re-synchronised to the fixed anchor, which makes the error
 * bounded rather than compounding.
 *
 * # Step 0 is a positive control, and it gates the rest
 *
 * The specimen this runs on is four chain-anchored edits that stayed crisp
 * while the woman changed — narrower jaw, arriving freckles, lightening skin.
 * So the same-person reader **must fail** `built-step4` against `built-base`.
 * If it calls them the same person, the identity instrument is broken and no
 * identity verdict from this experiment can be trusted. Measure the ruler
 * before measuring with it.
 *
 * # Three scores, kept apart on purpose
 *
 *   1. sharpness recovery — refresh against the base, versus step 4's
 *   2. identity-to-base — the deciding one
 *   3. styling steadiness through the refresh — the jolt check, against the
 *      pre-refresh image, because a refresh that restores the face by
 *      forgetting the styling has simply undone the user's work
 *
 * All three green registers the hybrid as arm (e) behind D-191's revisit
 * trigger. A repaint, or a failed pull-back, kills it with side-by-sides.
 *
 *   npx tsx scripts/calibration/hybrid-refresh.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";

import { castingIdentityEngine } from "../../server/castingV2/signEngine";
import { interpreterEngine } from "../../server/castingV2/interpreter";

const DIR = "output/quality-unit/specimens";
const OUT = "output/quality-unit";

async function quality(bytes: Buffer): Promise<number> {
  return sharp(bytes)
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
}

/**
 * THE IDENTITY INSTRUMENT — feature by feature, because holistic failed.
 *
 * Probe B's original question — "are these the same person, ignoring styling" —
 * FAILED this experiment's positive control: it called the drifted step-4 woman
 * the same person as the base, and cited her freckle pattern as evidence when
 * the freckles had ARRIVED during the chain. Asked for one overall judgement a
 * vision reader is charitable; asked to name what it sees per feature and judge
 * each, it is honest. The rewrite passes the control six features to one.
 *
 * Which means every identity score this program has published — including the
 * trial's "zero identity failures in either arm" — was taken with an instrument
 * that could not see a drift plainly visible to the eye.
 */
async function samePerson(left: Buffer, right: Buffer): Promise<{ same: boolean | null; why: string }> {
  const engine = interpreterEngine();
  if (!engine) return { same: null, why: "no reader" };
  try {
    const reply = await engine.complete({
      system: [
        "You are shown two photographs. Compare them FEATURE BY FEATURE and report what you",
        "actually see in each, then judge whether each feature MATCHES.",
        "",
        "Judge only: jaw width, face length/shape, nose shape, lip fullness, eye spacing,",
        "skin freckling (present or absent, and where), skin tone.",
        "",
        "Do not be charitable. If a feature reads differently, say it does not match.",
        "",
        'Reply with JSON: {"features":[{"name":"...","first":"...","second":"...",',
        '"matches":true|false}], "samePerson": true|false} and nothing else.',
      ].join("\n"),
      user: "First image, then second image.",
      images: [
        { bytes: left, contentType: "image/png" },
        { bytes: right, contentType: "image/png" },
      ],
      json: true,
      temperature: 0,
      maxOutputTokens: 800,
    });
    const parsed = JSON.parse(reply.text.trim().replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, ""));
    const differing = (parsed?.features ?? [])
      .filter((feature: { matches?: unknown }) => feature?.matches === false)
      .map((feature: { name?: unknown }) => String(feature?.name));
    return {
      same: parsed?.samePerson === true,
      why: differing.length ? `differs on ${differing.join(", ")}` : "every feature matched",
    };
  } catch (error) {
    return { same: null, why: (error as Error).message.slice(0, 80) };
  }
}

/** The jolt check: did the styling survive the refresh unchanged? */
async function stylingHeld(before: Buffer, after: Buffer): Promise<{ same: number; total: number; detail: unknown }> {
  const engine = interpreterEngine();
  const facts = ["a blunt bob", "seafoam green eyes", "small gold hoop earrings", "copper hair"];
  if (!engine) return { same: 0, total: 0, detail: null };
  try {
    const reply = await engine.complete({
      system: [
        "You are shown two photographs of the same person, one before and one after a",
        "restoration pass that was supposed to change NOTHING about their styling.",
        "",
        "For each listed feature, answer whether it is the SAME REALIZATION in both — the same",
        "specific object, the same specific shade — not merely present in both.",
        "",
        'Reply with JSON: {"results":[{"id":1,"same":true|false,"why":"..."}]} and nothing else.',
      ].join("\n"),
      user: facts.map((fact, index) => `${index + 1}. ${fact}`).join("\n"),
      images: [
        { bytes: before, contentType: "image/png" },
        { bytes: after, contentType: "image/png" },
      ],
      json: true,
      temperature: 0,
      maxOutputTokens: 500,
    });
    const parsed = JSON.parse(reply.text.trim().replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, ""));
    const results = Array.isArray(parsed?.results) ? parsed.results : [];
    const detail = facts.map((fact, index) => {
      const row = results.find((entry: { id?: unknown }) => Number(entry?.id) === index + 1);
      return { fact, same: row ? row.same === true : true, why: row?.why };
    });
    return { same: detail.filter((d) => d.same).length, total: facts.length, detail };
  } catch {
    return { same: 0, total: 0, detail: null };
  }
}

/**
 * THE REFRESH PROMPT — role-inverted, per the founder's directive.
 *
 * The inversion is where AUTHORITY over styling sits. In the shelved arm (b)
 * the instruction beat the styling image; here there is no instruction at all
 * and the styling image is final. The base is demoted to what it is best at:
 * being the person.
 */
const REFRESH_PROMPT = [
  "You are given TWO reference images of the same person and they have different jobs.",
  "",
  "The FIRST image is WHO SHE IS. Her bone structure, the set and shape of her eyes, her",
  "nose, mouth, jaw, ears, skin character and the photographic quality of the result all",
  "come from this image and from nowhere else. Restore its fidelity exactly.",
  "",
  "The SECOND image is HOW SHE IS STYLED RIGHT NOW. Reproduce every part of that styling",
  "exactly as shown — the haircut, the hair colour, the eye colour, any jewellery, the",
  "makeup, the expression, how the hair is worn. Nothing about the styling is re-decided",
  "here; copy it.",
  "",
  "Produce one photograph: the person from the first image, styled exactly as the second.",
  "Same clothing, lighting, framing and background as the first image.",
].join("\n");

const base = readFileSync(`${DIR}/built-base.png`);
const drifted = readFileSync(`${DIR}/built-step4.png`);

/* ---------------------------------------------- step 0: calibrate the ruler */
console.log("STEP 0 — positive control: the reader MUST fail step 4 against the base\n");
const control = await samePerson(base, drifted);
console.log(`  samePerson(base, step4) = ${control.same}  ${JSON.stringify(control.why)}`);
if (control.same !== false) {
  console.log("\n  INSTRUMENT FAILS ITS POSITIVE CONTROL.");
  console.log("  The identity reader cannot see a drift plainly visible to the eye, so no");
  console.log("  identity verdict from this experiment can be trusted. Stopping.");
  writeFileSync(`${OUT}/hybrid-refresh.json`, JSON.stringify({ control, aborted: true }, null, 2));
  process.exit(0);
}
console.log("  control passed — the ruler can see the drift\n");

/* ------------------------------------------------------ the refresh itself */
console.log("REFRESH — base as identity, chain image as styling truth\n");
const engine = castingIdentityEngine();
const refreshed = await engine.editWithReferences({
  prompt: REFRESH_PROMPT,
  references: [
    { bytes: base, contentType: "image/png" },
    { bytes: drifted, contentType: "image/png" },
  ],
  resolution: "1K",
});
writeFileSync(`${DIR}/refreshed.png`, refreshed.bytes);

const [baseSharp, driftedSharp, refreshedSharp] = await Promise.all([
  quality(base), quality(drifted), quality(refreshed.bytes),
]);
const [identity, styling] = await Promise.all([
  samePerson(base, refreshed.bytes),
  stylingHeld(drifted, refreshed.bytes),
]);

const scores = {
  control,
  sharpness: {
    driftedRatio: driftedSharp / baseSharp,
    refreshedRatio: refreshedSharp / baseSharp,
  },
  identityToBase: identity,
  stylingHeld: styling,
};
writeFileSync(`${OUT}/hybrid-refresh.json`, JSON.stringify(scores, null, 2));

console.log(`  1. sharpness   drifted ${(scores.sharpness.driftedRatio * 100).toFixed(0)}% → refreshed ${(scores.sharpness.refreshedRatio * 100).toFixed(0)}% of base`);
console.log(`  2. identity    same person as base: ${identity.same}  ${JSON.stringify(identity.why)}`);
console.log(`  3. styling     ${styling.same}/${styling.total} held through the refresh`);
console.log(`\n  ${JSON.stringify(styling.detail)}`);

/* the side-by-side, for the verdict either way */
const tiles = await Promise.all([base, drifted, refreshed.bytes].map((b) => sharp(b).resize(480).toBuffer()));
const meta = await sharp(tiles[0]).metadata();
await sharp({
  create: { width: 480 * 3, height: meta.height ?? 640, channels: 3, background: { r: 11, g: 11, b: 12 } },
}).composite(tiles.map((input, index) => ({ input, left: 480 * index, top: 0 })))
  .png().toFile(`${OUT}/refresh-sheet.png`);
console.log("\n  sheet: output/quality-unit/refresh-sheet.png (base · drifted · refreshed)");
