/**
 * DISPOSABLE — #1612 part 3's COURT, exactly as his card scopes it: the stored
 * framing template against no template, judged by THE MEASURED CHECKER part 1
 * built, never by the old reading.
 *
 * His words, verbatim: *"i'd like to see a court of it against our improve
 * checker we just dicused"*, and the ship test is his too: *"the template ships
 * only if the in-band share rises on at least the close-up without raising
 * identity refusals"*.
 *
 * # The two things reported, and they are not the same question
 *
 *   IN-BAND SHARE   `measureViewFraming` against the view's own declared band.
 *                   Geometry from `fal-ai/sam-3`, the same reader the delivered
 *                   checker asks. This is the number the template is FOR.
 *   IDENTITY        the real `createViewConformanceJudge`'s identity axis, which
 *                   is the one axis that still refuses and refunds (#1612 part
 *                   2). This is the number the template must not MOVE — a
 *                   template the engine borrows a face from is worse than no
 *                   template, whatever the framing says.
 *
 * # Why these two fixtures and not three
 *
 * **Cast 56 (Sifr2) is #1611's own specimen** — the close-up whose crop reads
 * 0.48 of a face-height of room below the face against a bound of 0.3, i.e. the
 * exact failure the template exists to pull in. A fixture already landing in
 * band could not show a rise.
 *
 * **Cast 63 (Pika) is the creature control and the reason it is here is #1582.**
 * A gaunt face ringed with eye-tipped spikes under tendril hair: if a grey
 * mannequin template is going to drag a cast toward looking like a person, it
 * will do it here first and the identity axis will say so.
 *
 * Spends HOUSE money only — 20 renders on the signed-view door at the measured
 * ~$0.133 each (~$2.70) and 20 judge calls. **No customer credits, no database
 * writes, no storage writes.** A Sign is 8,500 ledger credits; this drives the
 * engine and the measurer directly, as the hand-over court did.
 *
 *   npx tsx scripts/_1612-template-court-disposable.mts
 */
import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { ProviderQueue } from "../server/providers/providerQueue";
import { createOpenRouterTextEngine, DEFAULT_INTERPRETER_MODEL } from "../server/providers/openrouterText";
import { createFalIdentityEngine } from "../server/providers/falQueue";
import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { createViewConformanceJudge } from "../server/castingV2/viewConformance";
import { castPackageView, composePackageViewPrompt } from "../server/castingV2/castViewPackage";
import { measureViewFraming } from "../server/castingV2/viewFramingGeometry";
import { framingTemplateClause } from "../server/castingV2/viewFramingTemplate";
import { pronounsForSex } from "../server/castingV2/castPronouns";
import { readFalBalance } from "./lib/falSpend.mts";

const FAL = process.env.FAL_KEY;
const OR = process.env.OPENROUTER_API_KEY;
if (!FAL) throw new Error("no FAL_KEY in .env");
if (!OR) throw new Error("no OPENROUTER_API_KEY in .env");

const OUT = "output/1612-part3/court";
mkdirSync(OUT, { recursive: true });

const ANGLE = "closeUp" as const;
const RENDERS_PER_ARM = 5;

/* Read out of production read-only by `_1612-anchor-read-disposable.mts`; both
   values are pasted here so this script needs no database at all. */
const FIXTURES = [
  {
    cast: 56,
    name: "Sifr2",
    why: "#1611's own specimen — its delivered close-up reads 0.48 against a bound of 0.3",
    anchorUrl:
      "https://pub-990e39d8d995468eb61aced83162123a.r2.dev/casting-v2/casts/"
      + "737c673c-413a-468c-a791-507e7318a0c7/anchor/394ed9fc-bcfb-4d72-bf17-e3f17bf89bda.png",
    brief:
      "An East Asian cyberpunk operative with pale skin and a cold, held intensity. Graphic dark "
      + "hair that can lean black or dusty teal. Tattoos and machine in the body — ports, collars, "
      + "augments. She dresses sharp and a little worn, between Eastern tailoring and tactical "
      + "gear. Stylish, lethal, modified.",
  },
  {
    cast: 63,
    name: "Pika",
    why: "the creature control (#1582) — a gaunt face ringed with eye-tipped spikes",
    anchorUrl:
      "https://pub-990e39d8d995468eb61aced83162123a.r2.dev/casting-v2/casts/"
      + "5c3746fa-edc7-42c3-9690-dea64df77486/anchor/1a5e4f06-7fa5-4aee-a0db-4872e368091c.png",
    brief:
      "A humanoid entity with a gaunt, deeply lined face and a wide, manic grin of human teeth. "
      + "Surrounding the head are dark, jagged spike-like protrusions, each tipped with a separate "
      + "staring eye. Skin is pale and cracked; long dark tendril-like hair drapes down. Torn dark "
      + "organic drapery covers the body.",
  },
] as const;

const template = {
  bytes: readFileSync(`assets/views/${ANGLE}-framing-template.png`),
  contentType: "image/png",
};
const engine = createFalIdentityEngine({ apiKey: FAL });
const framingReader = createFalRegionReader({ apiKey: FAL });
const judge = createViewConformanceJudge({
  engine: createOpenRouterTextEngine({
    apiKey: OR,
    model: process.env.SIGN_JUDGE_MODEL || DEFAULT_INTERPRETER_MODEL,
    queue: new ProviderQueue({ name: "template-court", concurrency: 2, maxQueueDepth: 32 }),
  }),
  framingReader,
});
const band = castPackageView(ANGLE).band;
const pronouns = pronounsForSex("female");

const before = await readFalBalance();
console.log(`fal balance BEFORE: ${JSON.stringify(before)}`);

type Row = {
  cast: number;
  arm: "A-no-template" | "B-template";
  render: number;
  framing: string;
  roomBelow: number | null;
  identity: string;
  wardrobe: string;
  latencyMs: number;
  file: string;
};
const rows: Row[] = [];

for (const fixture of FIXTURES) {
  const response = await fetch(fixture.anchorUrl);
  if (!response.ok) throw new Error(`anchor ${fixture.cast}: ${response.status}`);
  const anchor = { bytes: Buffer.from(await response.arrayBuffer()), contentType: "image/png" };
  console.log(`\n=== cast ${fixture.cast} ${fixture.name} — ${fixture.why}`);

  const base = composePackageViewPrompt(ANGLE, null, fixture.brief, { pronouns });
  /* Ordinal 2 — anchor is 1, and this fixture carries no crops and no plate. In
     the product it is `references.length`, derived from the array itself. */
  const templated = [base, framingTemplateClause({ ordinal: 2, pronouns })].join("\n");

  for (const arm of ["A-no-template", "B-template"] as const) {
    const withTemplate = arm === "B-template";
    const prompt = withTemplate ? templated : base;
    const references = withTemplate ? [anchor, template] : [anchor];
    writeFileSync(`${OUT}/prompt-${fixture.cast}-${arm}.txt`, prompt, "utf8");

    for (let render = 1; render <= RENDERS_PER_ARM; render += 1) {
      const image = await engine.generateView({
        prompt,
        references,
        resolution: "2K",
        viewAngle: ANGLE,
      });
      const file = `${fixture.cast}-${arm}-${render}.png`;
      writeFileSync(`${OUT}/${file}`, image.bytes);

      /* THE MEASURED CHECKER — his card's own instruction, and the whole point:
         the framing answer is geometry, not a reading. */
      const measurement = await measureViewFraming({ band, image: image.bytes, reader: framingReader });
      const roomRule = measurement.readings.find((reading) => reading.rule.must === "roomBelowAtMost");
      const roomBelow = (roomRule as { value?: number } | undefined)?.value ?? null;

      /* AND THE REAL JUDGE, for the axis the template must not move. */
      const verdict = await judge({
        angle: ANGLE,
        anchor,
        candidate: { bytes: image.bytes, contentType: image.contentType },
        description: fixture.brief,
        pronouns,
      });

      rows.push({
        cast: fixture.cast,
        arm,
        render,
        framing: measurement.verdict,
        roomBelow,
        identity: verdict.axes.identity.verdict ?? "—",
        wardrobe: verdict.axes.wardrobe.verdict ?? "—",
        latencyMs: image.latencyMs,
        file,
      });
      console.log(
        `  ${arm.padEnd(14)} ${render}/${RENDERS_PER_ARM}  framing=${measurement.verdict.padEnd(13)}`
        + ` roomBelow=${roomBelow === null ? "   —" : roomBelow.toFixed(2)}`
        + `  identity=${verdict.axes.identity.verdict}  ${Math.round(image.latencyMs / 100) / 10}s`,
      );
    }
  }
}

const after = await readFalBalance();
console.log(`\nfal balance AFTER: ${JSON.stringify(after)}`);

writeFileSync(
  `${OUT}/court-rows.json`,
  JSON.stringify({ card: 1612, part: 3, angle: ANGLE, balance: { before, after }, rows }, null, 1),
  "utf8",
);

console.log("\n=== THE SHIP TEST, read off the rows");
console.log("cast  arm             in band  identity differs  median room below");
for (const fixture of FIXTURES) {
  for (const arm of ["A-no-template", "B-template"] as const) {
    const mine = rows.filter((row) => row.cast === fixture.cast && row.arm === arm);
    const inBand = mine.filter((row) => row.framing === "inBand").length;
    const differs = mine.filter((row) => row.identity === "differs").length;
    const rooms = mine.map((row) => row.roomBelow).filter((value): value is number => value !== null).sort((a, b) => a - b);
    const median = rooms.length === 0 ? null : rooms[Math.floor(rooms.length / 2)]!;
    console.log(
      `${String(fixture.cast).padEnd(5)} ${arm.padEnd(15)} ${String(`${inBand}/${mine.length}`).padEnd(8)}`
      + ` ${String(`${differs}/${mine.length}`).padEnd(17)} ${median === null ? "—" : median.toFixed(2)}`,
    );
  }
}

process.exit(0);
