/**
 * THE SIGN ENGINE COURT — the five signed views on GPT Image 2.5 Sunburst's
 * edit door against Nano Banana Pro, on his own fixtures (#1394).
 *
 * His word, 2026-09-26, verbatim: *"switch out nano banana to gpt image 2.5
 * sunburst and re-run the court"*, and later the same evening, *"on the edit
 * door with sunburst does max reduce degradation more than high?"*.
 *
 * # What this measures and what it deliberately does not
 *
 * THE DISAPPEARING-TECHNOLOGY LAW clause 2: a model choice is re-asked with a
 * MEASUREMENT on his own fixtures, never a leaderboard. Clause 3: the price and
 * the latency are named beside the quality, or the finding is not
 * decision-grade. So every arm records wall milliseconds, bytes, returned
 * pixels, the dollars the provider's own figures give it, and the product's own
 * conformance judge on the three axes it already uses in production.
 *
 * ⚠ **IT NEVER RETURNS A VERDICT ON QUALITY.** Working law 9: the judge is a
 * pointer to look, his eye closes it. This driver prints numbers and writes
 * frames; the record states what the numbers say and nothing more.
 *
 * # Why the arms send the SAME words through DIFFERENT doors
 *
 * The one thing a court like this can get wrong for free is to compare two
 * engines on two prompts. So the directive is composed exactly once per
 * (anchor, angle) — `composePackageViewPrompt` plus the `\n\nView: <angle>.`
 * line `falQueue`'s own `generateView` appends — and that one string goes to
 * every arm. The Nano Banana arms go through `createFalIdentityEngine`, which
 * is the product's own path. The Sunburst arms go through `runFalImageJob`,
 * which is the function `createFalMaskedEditEngine` itself calls, because that
 * factory pins `quality: "high"` and this court has to ask for `"max"` as well.
 * The body is otherwise that factory's body, field for field.
 *
 * # House money only
 *
 * `FAL_KEY` and `OPENROUTER_API_KEY` out of `.env`. No customer credits, no
 * database write of any kind, no production read — the fixtures are the DEV
 * database's own signed casts, reached through `scripts/lib/dbConnection.mts`
 * and their persisted public URLs.
 *
 * # The Sunburst price is UNMEASURED until `--phase price` measures it
 *
 * fal publishes `unit: "units"` for every GPT Image endpoint, which is not
 * dollars (`scripts/lib/falSpend.mts` is emphatic about this), and
 * `FAL_MEASURED_USD_PER_IMAGE` deliberately has no row for
 * `openai/gpt-image-2.5/sunburst/edit`. So the price phase renders one picture
 * per tier with a SETTLED balance reading either side — two consecutive equal
 * reads after a move, which is that module's own stated discipline — and
 * reports the direction as well as the delta, because a $20 auto top-up landing
 * mid-run once printed `fal spent $-18.6600` and destroyed a whole measurement.
 */
import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { parseStrictArgsOrRefuse } from "./lib/strictArgs.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { openDatabase } from "./lib/dbConnection.mts";
import { readFalBalance } from "./lib/falSpend.mts";
import { CAST_PACKAGE_VIEWS, composePackageViewPrompt } from "../server/castingV2/castViewPackage";
import { createViewConformanceJudge } from "../server/castingV2/viewConformance";
import { createOpenRouterTextEngine, DEFAULT_INTERPRETER_MODEL } from "../server/providers/openrouterText";
import { createFalIdentityEngine, NANO_BANANA_PRO_USD_PER_IMAGE } from "../server/providers/falQueue";
import { FAL_GPT_IMAGE_25_SUNBURST_EDIT } from "../server/providers/falImages";
import { runFalImageJob } from "../server/providers/falTransport";
import { castWardrobeLine } from "../server/castingV2/wardrobeLine";
import { ProviderQueue } from "../server/providers/providerQueue";
import type { CastViewAngle } from "../shared/boardTypes";

/*
  THE WORLD, DECLARED. This court reads its fixtures out of a database and it
  must be the DEV one: `DATABASE_URL` is the only world key it consults, and it
  writes no object anywhere — every frame lands on this machine's disk. Inert
  under a plain `npx tsx`; it refuses a half-production process under
  `railway run`, which is the shape that would silently read his customers rows.
*/
assertOneWorld(["DATABASE_URL"]);

/* ------------------------------------------------------------------ the ask */

const ARGS = parseStrictArgsOrRefuse(process.argv.slice(2), {
  value: ["phase", "only", "anchors", "draws", "out", "size", "arms", "tier", "anchor"],
  boolean: ["help", "dry-run", "run"],
});

const PHASES = ["price", "main", "chain", "sheet", "controls", "contact", "rejudge", "report"] as const;
type Phase = (typeof PHASES)[number];

const HELP = `court-sign-engine — the Sign views on Sunburst against Nano Banana Pro (#1394)

  --phase <${PHASES.join("|")}>   which arm to run (required)
  --only <angle>                  one package angle only (${CAST_PACKAGE_VIEWS.join(", ")})
  --anchors <n>                   how many fixture anchors (default ${2})
  --anchor <key>                  one fixture by key (jericho, caveman, basics)
  --draws <n>                     draws per arm in the main phase (default ${2})
  --size <WxH>                    the Sunburst ask (default 2352x3504, the door's own ceiling)
  --arms <a,b>                    a subset of nb2k,nb4k,sbhigh,sbmax — split the run across processes
  --tier <high|max>               one Sunburst tier only, for the chain and sheet phases
  --out <dir>                     where frames land (default output/1394-sign-engine)
  --dry-run                       print the plan and the cost estimate, spend nothing
  --run                           actually spend house money on the provider
  --help                          this

NOTHING SPENDS WITHOUT --run. A phase given neither --run nor --dry-run is
refused rather than defaulted, because a default is the one thing a paid driver
must never have.

  phases
    price     one Sunburst render per tier with a settled balance either side
    main      anchors x angles x 4 arms x draws, each judged
    chain     five successive Sunburst edits, high and max, judged every step
    sheet     one four-column reference sheet per tier, cut and judged (#1278 part 2)
    controls  the judge's noise floor, and the cross-anchor positive control
    contact   build the contact sheets from frames already on disk (no spend)
    rejudge   re-judge every frame on disk at a size the judge can read (no renders)
    report    fold every rows-*.json on disk into the results tables (no spend)
`;

if (ARGS.flag("help")) {
  console.log(HELP);
  process.exit(0);
}

const phaseRaw = ARGS.value("phase");
if (phaseRaw === null || !(PHASES as readonly string[]).includes(phaseRaw)) {
  console.error(`REFUSING: --phase must be one of ${PHASES.join(", ")} — got ${phaseRaw ?? "nothing"}.`);
  process.exit(1);
}
const PHASE = phaseRaw as Phase;

const DRY = ARGS.flag("dry-run");
const RUN = ARGS.flag("run");
if (PHASE !== "contact" && PHASE !== "report" && DRY === RUN) {
  console.error(
    "REFUSING: pass exactly one of --dry-run or --run. A paid driver with a default is how a"
    + " --help nobody recognised once started a 42-cell sweep.",
  );
  process.exit(1);
}

const OUT = ARGS.value("out") ?? path.join("output", "1394-sign-engine");
const DRAWS = ARGS.number("draws", 2);
const ANCHOR_COUNT = ARGS.number("anchors", 2);
const ONLY = ARGS.value("only");
if (ONLY !== null && !CAST_PACKAGE_VIEWS.includes(ONLY as CastViewAngle)) {
  console.error(`REFUSING: --only must name a package angle (${CAST_PACKAGE_VIEWS.join(", ")}).`);
  process.exit(1);
}
const ANGLES: readonly CastViewAngle[] = ONLY === null
  ? CAST_PACKAGE_VIEWS
  : [ONLY as CastViewAngle];

/**
 * WHICH ARMS AND WHICH TIERS THIS INVOCATION RUNS — so the court can be split
 * across two processes without either one measuring the other's queue.
 *
 * Renders go one at a time inside a process, because a picture waiting behind
 * two others reports the queue rather than the engine. Two processes against a
 * provider that allows twenty concurrent requests do not queue behind each
 * other, so splitting the arms halves the wall clock without touching the
 * latency figures.
 */
const ALL_ARMS = ["nb2k", "nb4k", "sbhigh", "sbmax"] as const;
type ArmId = (typeof ALL_ARMS)[number];
const armsRaw = ARGS.value("arms");
const ARMS: readonly ArmId[] = (() => {
  if (armsRaw === null) return ALL_ARMS;
  const asked = armsRaw.split(",").map((part) => part.trim()).filter((part) => part !== "");
  const unknown = asked.filter((part) => !(ALL_ARMS as readonly string[]).includes(part));
  if (unknown.length > 0 || asked.length === 0) {
    console.error(`REFUSING: --arms takes a comma-separated subset of ${ALL_ARMS.join(",")}.`);
    process.exit(1);
  }
  return asked as ArmId[];
})();

const ALL_TIERS = ["high", "max"] as const;
type Tier = (typeof ALL_TIERS)[number];
const tierRaw = ARGS.value("tier");
const TIERS: readonly Tier[] = (() => {
  if (tierRaw === null) return ALL_TIERS;
  if (!(ALL_TIERS as readonly string[]).includes(tierRaw)) {
    console.error(`REFUSING: --tier is one of ${ALL_TIERS.join(", ")}.`);
    process.exit(1);
  }
  return [tierRaw as Tier];
})();

/**
 * THE SUNBURST ASK, and it is the door's own ceiling rather than the schema's.
 *
 * fal's published schema for `openai/gpt-image-2.5/sunburst/edit` (read
 * 2026-09-26) accepts `image_size` as `{width, height}` with each side
 * `> 0` and `<= 14142`, so on paper *the largest the door accepts* for a 2:3
 * view is 9428x14142 — 133 megapixels. That is not a product size, nothing
 * downstream could use it, and pricing an engine on it would answer a question
 * nobody asked, so it was declined out loud per the fidelity law.
 *
 * ⚠ **AND THE DOOR HAS A REAL CEILING THE SCHEMA DOES NOT STATE,
 * MEASURED HERE 2026-09-26 RATHER THAN READ.** Asked for 3392x5056 it returned
 * **2352x3504** — 8.24 megapixels, the aspect kept — which is the same ~8.29 MP
 * ceiling `falImages.ts` records for GPT Image 2's `image_size`. So Sunburst's
 * edit door cannot be asked for Nano Banana Pro's 4K frame at all: it sits
 * between the two tiers, about twice today's 2K and about half of 4K. The arms
 * therefore ASK for what the door actually gives, so no row has to be read as
 * an ask that was silently clamped.
 */
const DEFAULT_SUNBURST_SIZE = { width: 2352, height: 3504 } as const;
const sizeRaw = ARGS.value("size");
const SUNBURST_SIZE = (() => {
  if (sizeRaw === null) return DEFAULT_SUNBURST_SIZE;
  const match = /^(\d+)x(\d+)$/.exec(sizeRaw);
  if (!match) {
    console.error("REFUSING: --size must read WxH, e.g. 3392x5056.");
    process.exit(1);
  }
  return { width: Number(match[1]), height: Number(match[2]) };
})();

/**
 * THE SHEET'S ASK, AND IT IS BOUNDED BY THE SAME CEILING THE PRICE PHASE FOUND.
 *
 * Four columns of a 2:3 figure is an 8:3 frame, and the door's ~8.29 MP ceiling
 * (`falImages.ts` records 655,360–8,294,400 for this family, and the price phase
 * measured a 3392x5056 ask coming back as 2352x3504) puts the largest legal 8:3
 * frame at about 4704x1764. 4688x1760 is that, on multiples of sixteen.
 *
 * ⚠ **So a cut column is 1172x1760 — SMALLER than today's delivered 2K view
 * (1696x2528), and that is a fact about the sheet shape rather than a choice
 * this court made.** One render cannot hold four full-length figures at the
 * resolution four renders give each one. It is recorded beside the consistency
 * reading because it is the other half of the same trade.
 */
const SHEET_SIZE = { width: 4688, height: 1760 } as const;

/* --------------------------------------------------------------- the fixtures */

/**
 * THE FIXTURES, READ OUT OF THE DEV DATABASE RATHER THAN TYPED IN.
 *
 * Two signed casts owned by two different fixture accounts, chosen because they
 * are decisively different people — which is what makes the cross-anchor
 * positive control below worth running. Their anchors, wardrobe lines and
 * briefs come from the same rows the product's own Try again reader
 * (`readCastViewRenderSource`) reads, so the words this court composes are the
 * words a real retried view composes.
 */
const FIXTURE_MODEL_IDS = [248, 251, 253] as const;

/**
 * ⚠ **THE THIRD FIXTURE EXISTS BECAUSE SUNBURST REFUSED THE SECOND, AND THE
 * REFUSAL IS A FINDING RATHER THAN A PROBLEM WITH THE COURT** (measured
 * 2026-09-26).
 *
 * `openai/gpt-image-2.5/sunburst/edit` answered **HTTP 422
 * `content_policy_violation`** to the caveman's side, back and chain asks - the
 * Cast whose wardrobe line is *"a rough animal-hide wrap draped over one
 * shoulder, a plain hide loincloth, bare feet"*. Nano Banana Pro refused none
 * of the same asks with the same words. That is recorded in the results as a
 * refusal rate per engine.
 *
 * It leaves the degradation chain with one subject, which is n=1 on the
 * question the founder actually asked. So a THIRD signed cast joins the
 * fixtures for that arm only - model #253, a woman in a plain black top - and
 * the default `--anchors 2` keeps every other arm exactly as it was run.
 */

/** A short, stable name for a fixture, used in every frame path and every row. */
function keyOf(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("caveman")) return "caveman";
  if (lower.includes("basics")) return "basics";
  return "jericho";
}

type Fixture = {
  key: string;
  modelId: number;
  name: string;
  anchorUrl: string;
  anchor: { bytes: Buffer; contentType: string };
  anchorPixels: string;
  wardrobeLine: string | null;
  brief: string | null;
};

async function loadFixtures(limit: number): Promise<Fixture[]> {
  const db = await openDatabase();
  try {
    const [rows] = await db.query<any[]>(
      `SELECT m.id AS modelId, m.name, m.technicalSchema, r.briefText,
              a.storageUrl AS anchorUrl
         FROM models m
         JOIN model_identity_snapshots s ON s.modelId = m.id
         JOIN model_assets a ON a.id = s.anchorAssetId
         LEFT JOIN casting_rolls r ON r.id = m.sourceRollId
        WHERE m.id IN (${FIXTURE_MODEL_IDS.join(",")})
        ORDER BY FIELD(m.id, ${FIXTURE_MODEL_IDS.join(",")})`,
    );
    const fixtures: Fixture[] = [];
    const wanted = ARGS.value("anchor");
    const chosen = wanted === null
      ? rows.slice(0, limit)
      : rows.filter((row) => keyOf(String(row.name)) === wanted);
    if (wanted !== null && chosen.length === 0) {
      throw new Error(`no fixture called ${wanted} — refusing to run a court with nothing at the bar`);
    }
    for (const row of chosen) {
      if (!row.anchorUrl) throw new Error(`fixture ${row.modelId} has no anchor URL — no fixture, no court`);
      const response = await fetch(String(row.anchorUrl));
      if (!response.ok) throw new Error(`anchor ${row.modelId} fetch ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const meta = await sharp(bytes).metadata();
      const schema = typeof row.technicalSchema === "string"
        ? JSON.parse(row.technicalSchema)
        : row.technicalSchema;
      fixtures.push({
        key: keyOf(String(row.name)),
        modelId: Number(row.modelId),
        name: String(row.name),
        anchorUrl: String(row.anchorUrl),
        anchor: { bytes, contentType: "image/png" },
        anchorPixels: `${meta.width}x${meta.height}`,
        wardrobeLine: castWardrobeLine(schema),
        brief: row.briefText === null || row.briefText === undefined ? null : String(row.briefText),
      });
    }
    if (fixtures.length === 0) throw new Error("no fixtures — refusing to run a court with nothing at the bar");
    return fixtures;
  } finally {
    await db.end();
  }
}

/* ------------------------------------------------------------------ the arms */

const ARM_LABEL: Record<ArmId, string> = {
  nb2k: "today (2K)",
  nb4k: "4K",
  sbhigh: "Sunburst high",
  sbmax: "Sunburst max",
};

/**
 * WHAT A SUNBURST EDIT COSTS, MEASURED BY THIS COURT ON 2026-09-26.
 *
 * `falImages.ts` keeps this endpoint out of `FAL_MEASURED_USD_PER_IMAGE` on
 * purpose - an unmeasured entry in a table called MEASURED is a lie with a date
 * on it - so the figures live here, beside the run that took them, with the
 * window and the direction that produced each one:
 *
 *   high   $0.14   balance 14.77 -> 14.63, one render, settled at both ends
 *   max    $0.49   balance 14.63 -> 14.14, one render, settled at both ends
 *
 * Both windows FELL, so no top-up masked either. n=1 each: these are this
 * court's own readings at 2352x3504 and not a constant anything else may quote.
 */
const SUNBURST_MEASURED_USD: Record<"sbhigh" | "sbmax", number> = { sbhigh: 0.14, sbmax: 0.49 };

type Render = {
  bytes: Buffer;
  contentType: string;
  width: number | undefined;
  height: number | undefined;
  latencyMs: number;
  usd: number | null;
  model: string;
  providerRef: string | undefined;
};

function falKey(): string {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY is required — a court that cannot reach the engine measures nothing");
  return key;
}

let identity: ReturnType<typeof createFalIdentityEngine> | null = null;
function identityEngine() {
  if (!identity) {
    identity = createFalIdentityEngine({
      apiKey: falKey(),
      /* One at a time on purpose: this court is measuring per-picture LATENCY,
         and a picture waiting behind two others in a queue reports the queue. */
      queue: new ProviderQueue({ name: "court-fal-identity", concurrency: 1, maxQueueDepth: 64 }),
    });
  }
  return identity;
}

/**
 * THE SUNBURST CALL, which is `createFalMaskedEditEngine`'s body with the
 * quality opened up.
 *
 * That factory is the product's own Sunburst edit path and it pins
 * `quality: "high"`; this court has to ask `"max"` too, so the body is sent
 * through `runFalImageJob` — the same function the factory calls, which is
 * where the engine ban, the census and the queue walk live. Every other field
 * is the factory's, field for field: the references as `data:` URIs,
 * `image_size` as exact pixels, `num_images: 1`, `output_format: "png"`.
 */
async function sunburstEdit(input: {
  prompt: string;
  references: readonly { bytes: Buffer; contentType: string }[];
  quality: "high" | "max";
  width: number;
  height: number;
}): Promise<Render> {
  const job = await runFalImageJob({
    apiKey: falKey(),
    endpoint: FAL_GPT_IMAGE_25_SUNBURST_EDIT,
    body: {
      prompt: input.prompt,
      image_urls: input.references.map(
        (reference) => `data:${reference.contentType};base64,${reference.bytes.toString("base64")}`,
      ),
      image_size: { width: input.width, height: input.height },
      num_images: 1,
      quality: input.quality,
      output_format: "png",
    },
    timeoutMs: 600_000,
    pollIntervalMs: 2_000,
  });
  return {
    bytes: job.bytes,
    contentType: job.contentType,
    width: job.width,
    height: job.height,
    latencyMs: job.latencyMs,
    /* UNPRICED rather than another engine's number — `falImages.ts` keeps this
       endpoint out of its measured table on purpose, and the price phase is
       what fills it in. */
    usd: null,
    model: FAL_GPT_IMAGE_25_SUNBURST_EDIT,
    providerRef: job.requestId,
  };
}

async function renderArm(
  arm: ArmId,
  prompt: string,
  references: readonly { bytes: Buffer; contentType: string }[],
): Promise<Render> {
  if (arm === "nb2k" || arm === "nb4k") {
    const resolution = arm === "nb2k" ? "2K" : "4K";
    const image = await identityEngine().editWithReferences({
      prompt,
      references: references.map((reference) => ({ ...reference })),
      resolution,
    });
    return {
      bytes: image.bytes,
      contentType: image.contentType,
      width: image.width,
      height: image.height,
      latencyMs: image.latencyMs,
      usd: NANO_BANANA_PRO_USD_PER_IMAGE[resolution],
      model: image.provenance.model,
      providerRef: image.provenance.providerRef,
    };
  }
  return sunburstEdit({
    prompt,
    references,
    quality: arm === "sbhigh" ? "high" : "max",
    width: SUNBURST_SIZE.width,
    height: SUNBURST_SIZE.height,
  });
}

/* ----------------------------------------------------------------- the judge */

function judge() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is required — the judge is the court's instrument");
  return createViewConformanceJudge({
    engine: createOpenRouterTextEngine({
      apiKey,
      model: process.env.SIGN_JUDGE_MODEL || DEFAULT_INTERPRETER_MODEL,
      queue: new ProviderQueue({ name: "court-view-judge", concurrency: 2, maxQueueDepth: 64 }),
    }),
  });
}

/* ------------------------------------------------------------------- the log */

type Row = Record<string, unknown>;
const ROWS: Row[] = [];

function note(row: Row): void {
  ROWS.push(row);
  console.log(JSON.stringify(row));
}

async function save(relative: string, bytes: Buffer): Promise<string> {
  const target = path.join(OUT, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  return target;
}

async function writeRows(name: string): Promise<void> {
  const target = path.join(OUT, name);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(ROWS, null, 2)}\n`);
  console.log(`rows -> ${target}`);
}

/* ------------------------------------------------------------ the balance door */

/**
 * A BALANCE THAT HAS STOPPED MOVING — two consecutive equal reads after a move,
 * which is `falSpend.mts`'s own rule and the thing an arm once skipped to print
 * `$0.0000 an image` as a verdict.
 */
async function settledBalance(label: string): Promise<number | null> {
  let previous: number | null = null;
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    const reading = await readFalBalance();
    if (!reading.ok) {
      console.log(`balance ${label}: UNREAD — ${reading.why}`);
      return null;
    }
    console.log(`balance ${label} read ${attempt}: $${reading.remaining.toFixed(4)}`);
    if (previous !== null && previous === reading.remaining) return reading.remaining;
    previous = reading.remaining;
    /* NOT unref'd. An unref'd timer lets node exit the process while this
       `await` is still pending — measured on this script's first run, which
       printed one balance read and exited 0 with nothing done. */
    await new Promise<void>((resolve) => { setTimeout(resolve, 45_000); });
  }
  console.log(`balance ${label}: never settled in twelve reads`);
  return previous;
}

/* ------------------------------------------------------------------- phases */

function directiveFor(fixture: Fixture, angle: CastViewAngle): string {
  /* The product's own words, including the line `generateView` appends — so
     every arm is handed one string and no arm is handed a different brief. */
  return `${composePackageViewPrompt(angle, fixture.wardrobeLine, fixture.brief)}\n\nView: ${angle}.`;
}

/**
 * ⚠ THE AXES ARE `identityPass` / `anglePass` / `wardrobePass` AND THE SUFFIX IS
 * LOAD-BEARING.
 *
 * The first shape of this type called them `identity` / `angle` / `wardrobe`,
 * and every row in this court spreads a verdict beside its own `angle` — the
 * VIEW angle. The two `angle`s collided, so `{ angle, ...verdict }` silently
 * overwrote the view's name with the judge's boolean and every results table
 * built from the rows would have been nonsense. Caught by `tsc` (TS2783) rather
 * than by reading, which is the only reason it is a footnote instead of a
 * finding.
 */
type Verdict = {
  pass: boolean;
  method: string;
  unjudged: boolean;
  identityPass: boolean;
  anglePass: boolean;
  wardrobePass: boolean;
  notes: Record<string, string>;
};

/**
 * THE JUDGE, WITH ITS OWN FAILURES TURNED INTO AN HONEST `unjudged` ROW - which
 * is `packageOrchestrator`'s own `judgeUnjudgedOnFailure`, for its own reason.
 *
 * ⚠ The first shape of this function let a judge failure throw, and the whole
 * RENDER row went with it: the picture arrived, cost real money and was written
 * to disk, and the row said `failed: "Interpreter call exceeded its deadline"`
 * with no pixels, no bytes and no clock. Measured on this court's first main
 * run, on the 4K arm, twice. **A broken instrument must not be able to erase the
 * measurement it was asked about** - the render's numbers are facts whatever the
 * judge managed to say, and `unjudged` is "nobody looked", never "it failed".
 */
async function judgeOne(
  judgeFn: ReturnType<typeof judge>,
  input: {
    angle: CastViewAngle;
    anchor: { bytes: Buffer; contentType: string };
    candidate: { bytes: Buffer; contentType: string };
    wardrobeLine: string | null;
    brief: string | null;
  },
): Promise<Verdict> {
  let verdict: Awaited<ReturnType<ReturnType<typeof judge>>>;
  try {
    verdict = await judgeFn({
      angle: input.angle,
      anchor: input.anchor,
      candidate: input.candidate,
      wardrobeLine: input.wardrobeLine,
      description: input.brief,
    });
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error);
    return {
      pass: false,
      method: "threw",
      unjudged: true,
      identityPass: false,
      anglePass: false,
      wardrobePass: false,
      notes: { identity: why, angle: why, wardrobe: why },
    };
  }
  return {
    pass: verdict.pass,
    method: verdict.method,
    unjudged: verdict.unjudged === true,
    identityPass: verdict.axes.identity.pass,
    anglePass: verdict.axes.angle.pass,
    wardrobePass: verdict.axes.wardrobe.pass,
    notes: {
      identity: verdict.axes.identity.note ?? "",
      angle: verdict.axes.angle.note ?? "",
      wardrobe: verdict.axes.wardrobe.note ?? "",
    },
  };
}

async function phasePrice(fixtures: Fixture[]): Promise<void> {
  const fixture = fixtures[0]!;
  const angle = ANGLES[0]!;
  const prompt = directiveFor(fixture, angle);
  console.log(
    `PRICE PHASE — one ${SUNBURST_SIZE.width}x${SUNBURST_SIZE.height} Sunburst edit at each tier off`
    + ` ${fixture.name} (#${fixture.modelId}), settled balance either side.`,
  );
  if (!RUN) {
    console.log("DRY RUN — 2 Sunburst renders, price unknown by construction (that is what this measures).");
    return;
  }
  const before = await settledBalance("before");
  for (const tier of TIERS) {
    const started = Date.now();
    const render = await sunburstEdit({
      prompt,
      references: [fixture.anchor],
      quality: tier,
      width: SUNBURST_SIZE.width,
      height: SUNBURST_SIZE.height,
    });
    const meta = await sharp(render.bytes).metadata();
    const file = await save(`price/${tier}.png`, render.bytes);
    note({
      phase: "price", tier, file,
      askedPixels: `${SUNBURST_SIZE.width}x${SUNBURST_SIZE.height}`,
      returnedPixels: `${meta.width}x${meta.height}`,
      reportedPixels: `${render.width}x${render.height}`,
      bytes: render.bytes.length,
      ms: render.latencyMs,
      wallMs: Date.now() - started,
      providerRef: render.providerRef,
    });
    const between = await settledBalance(`after ${tier}`);
    note({ phase: "price", tier, balanceAfter: between });
  }
  const after = await settledBalance("after");
  note({
    phase: "price", balanceBefore: before, balanceAfter: after,
    spentUsd: before !== null && after !== null ? Number((before - after).toFixed(4)) : null,
    warning: before !== null && after !== null && after > before
      ? "THE BALANCE ROSE — a top-up landed and this window is UNMEASURED, not cheap"
      : null,
  });
}

async function phaseMain(fixtures: Fixture[]): Promise<void> {
  const arms = ARMS;
  const renders = fixtures.length * ANGLES.length * arms.length * DRAWS;
  console.log(
    `MAIN PHASE — ${fixtures.length} anchors x ${ANGLES.length} angles x ${arms.length} arms x ${DRAWS}`
    + ` draws = ${renders} renders, each judged.`,
  );
  if (!RUN) {
    const nb = fixtures.length * ANGLES.length * DRAWS;
    console.log(
      `DRY RUN — Nano Banana 2K ${nb} x $0.15 = $${(nb * 0.15).toFixed(2)};`
      + ` Nano Banana 4K ${nb} x $0.30 = $${(nb * 0.3).toFixed(2)};`
      + ` Sunburst high ${nb} and Sunburst max ${nb} at the price --phase price measures.`,
    );
    return;
  }
  const judgeFn = judge();
  for (const fixture of fixtures) {
    for (const angle of ANGLES) {
      const prompt = directiveFor(fixture, angle);
      for (const arm of arms) {
        for (let draw = 1; draw <= DRAWS; draw += 1) {
          const started = Date.now();
          try {
            const render = await renderArm(arm, prompt, [fixture.anchor]);
            const meta = await sharp(render.bytes).metadata();
            const file = await save(`${fixture.key}/${angle}/${arm}-${draw}.png`, render.bytes);
            /*
              ⚠ **THE PRODUCT'S OWN JUDGE IS PROBED ONCE PER ARM PER ANCHOR, AND
              THE ARMS ARE COMPARED ON A DOWNSCALED COPY.** The reason is
              `forTheJudge`'s docblock: at full resolution OpenRouter answers 400
              to a Sunburst frame and the clock beats a 4K one, so three of four
              arms would have NO quality reading and this court would be an
              instrument that cannot fail. The probe measures the product's real
              behaviour on eight frames; every arm's verdict is then taken the
              same way, which is the comparison the court was asked for.
            */
            if (draw === 1 && angle === ANGLES[0]) {
              const probeStarted = Date.now();
              const probe = await judgeOne(judgeFn, {
                angle,
                anchor: fixture.anchor,
                candidate: { bytes: render.bytes, contentType: render.contentType },
                wardrobeLine: fixture.wardrobeLine,
                brief: fixture.brief,
              });
              note({
                phase: "judge-readability", anchor: fixture.key, angle, arm, armLabel: ARM_LABEL[arm],
                frameBytes: render.bytes.length,
                anchorBytes: fixture.anchor.bytes.length,
                wallMs: Date.now() - probeStarted,
                theProductsJudgeCouldRead: probe.unjudged !== true,
                method: probe.method,
                why: probe.unjudged === true ? probe.notes.identity : "",
              });
            }
            const verdict = await judgeOne(judgeFn, {
              angle,
              anchor: await forTheJudge(fixture.anchor.bytes),
              candidate: await forTheJudge(render.bytes),
              wardrobeLine: fixture.wardrobeLine,
              brief: fixture.brief,
            });
            note({
              phase: "main", anchor: fixture.key, angle, arm, armLabel: ARM_LABEL[arm], draw, file,
              pixels: `${meta.width}x${meta.height}`,
              bytes: render.bytes.length,
              ms: render.latencyMs,
              wallMs: Date.now() - started,
              usd: render.usd,
              model: render.model,
              providerRef: render.providerRef,
              ...verdict,
            });
          } catch (error) {
            note({
              phase: "main", anchor: fixture.key, angle, arm, draw,
              failed: error instanceof Error ? error.message : String(error),
              wallMs: Date.now() - started,
            });
          }
        }
      }
    }
  }
}

/**
 * THE DEGRADATION CHAIN — his question, 2026-09-26: *"on the edit door with
 * sunburst does max reduce degradation more than high?"*
 *
 * Five successive edits, each step's output becoming the next step's reference,
 * on one benign directive that asks for nothing about her to change. The judge
 * is asked at every step against the ORIGINAL anchor, never against the
 * previous step, because the question is how far she has drifted from the woman
 * who was signed.
 */
async function phaseChain(fixtures: Fixture[]): Promise<void> {
  const STEPS = 5;
  const tiers = TIERS;
  console.log(
    `CHAIN PHASE — ${fixtures.length} anchors x ${tiers.length} tiers x ${STEPS} steps`
    + ` = ${fixtures.length * tiers.length * STEPS} renders, judged against the ORIGINAL anchor at every step.`,
  );
  if (!RUN) {
    console.log("DRY RUN — the chain spends nothing until --run.");
    return;
  }
  const judgeFn = judge();
  /* The product's own three-quarter directive, verbatim through the composer —
     a view the package already promises, so the words are the product's and not
     an author's. The chain asks for the same view five times; what changes
     across the steps is only which picture it is editing. */
  const chainAngle: CastViewAngle = "threeQuarter";
  for (const fixture of fixtures) {
    const prompt = directiveFor(fixture, chainAngle);
    for (const tier of tiers) {
      await save(`${fixture.key}/chain-${tier}/step-0.png`, fixture.anchor.bytes);
      let reference = { bytes: fixture.anchor.bytes, contentType: fixture.anchor.contentType };
      for (let step = 1; step <= STEPS; step += 1) {
        const started = Date.now();
        try {
          const render = await sunburstEdit({
            prompt,
            references: [reference],
            quality: tier,
            width: SUNBURST_SIZE.width,
            height: SUNBURST_SIZE.height,
          });
          const meta = await sharp(render.bytes).metadata();
          const file = await save(`${fixture.key}/chain-${tier}/step-${step}.png`, render.bytes);
          /* The same downscale every other arm is judged through, and against
             the ORIGINAL anchor rather than the previous step: the question is
             how far she has drifted from the woman who was signed. */
          const verdict = await judgeOne(judgeFn, {
            angle: chainAngle,
            anchor: await forTheJudge(fixture.anchor.bytes),
            candidate: await forTheJudge(render.bytes),
            wardrobeLine: fixture.wardrobeLine,
            brief: fixture.brief,
          });
          note({
            phase: "chain", anchor: fixture.key, tier, step, file,
            pixels: `${meta.width}x${meta.height}`,
            bytes: render.bytes.length,
            ms: render.latencyMs,
            wallMs: Date.now() - started,
            providerRef: render.providerRef,
            ...verdict,
          });
          reference = { bytes: render.bytes, contentType: render.contentType };
        } catch (error) {
          note({
            phase: "chain", anchor: fixture.key, tier, step,
            failed: error instanceof Error ? error.message : String(error),
          });
          break;
        }
      }
    }
  }
}

/**
 * THE SHEET ARM — #1278 part 2, which is HIS ruled preference (Crew reply 221:
 * *"my preference is the sheet-as-reference shape"*).
 *
 * One render, four columns — front, left profile, right profile, back, all full
 * length — then cut into four with sharp on equal columns. The point of the
 * shape is that one reading of the brief dresses all four, so the hem and the
 * shoes cannot differ between them by construction.
 *
 * ⚠ **The column-to-slot mapping is this court's own choice and is stated
 * rather than implied.** The package promises `frontFull` and `backFull` at
 * full length and `sideClose` at a CLOSE framing, so columns 2 and 3 are judged
 * against a spec that asks for a closer frame than the sheet was asked for. An
 * angle miss there is a framing mismatch and is not evidence about the engine.
 */
const SHEET_COLUMNS: readonly { name: string; angle: CastViewAngle }[] = [
  { name: "front", angle: "frontFull" },
  { name: "left-profile", angle: "sideClose" },
  { name: "right-profile", angle: "sideClose" },
  { name: "back", angle: "backFull" },
];

function sheetPrompt(fixture: Fixture): string {
  /* Built FROM the package's own front-full directive so the sheet is asked for
     the same picture the product asks for, with the four-column instruction
     added on top rather than a freshly authored brief. */
  const base = composePackageViewPrompt("frontFull", fixture.wardrobeLine, fixture.brief);
  return [
    base,
    "",
    "SHEET LAYOUT: return ONE image laid out as four equal vertical columns, side by side, with no"
    + " gaps, no borders, no captions and no text. The same person in the same outfit, the same shoes,"
    + " the same hem, the same lighting and the same scale in every column, standing in the same place."
    + " Column 1: facing the camera. Column 2: turned ninety degrees to her left, a full profile."
    + " Column 3: turned ninety degrees to her right, a full profile. Column 4: facing directly away"
    + " from the camera, seen from behind. Full length in every column, head to feet.",
  ].join("\n");
}

async function phaseSheet(fixtures: Fixture[]): Promise<void> {
  const tiers = TIERS;
  console.log(
    `SHEET PHASE — ${fixtures.length} anchors x ${tiers.length} tiers x 1 sheet`
    + ` = ${fixtures.length * tiers.length} renders, each cut four ways and judged (#1278 part 2).`,
  );
  if (!RUN) {
    console.log("DRY RUN — the sheet arm spends nothing until --run.");
    return;
  }
  const judgeFn = judge();
  for (const fixture of fixtures) {
    const prompt = sheetPrompt(fixture);
    for (const tier of tiers) {
      const started = Date.now();
      try {
        const render = await sunburstEdit({
          prompt,
          references: [fixture.anchor],
          quality: tier,
          width: SHEET_SIZE.width,
          height: SHEET_SIZE.height,
        });
        const meta = await sharp(render.bytes).metadata();
        const file = await save(`${fixture.key}/sheet-${tier}/sheet.png`, render.bytes);
        const width = meta.width ?? 0;
        const height = meta.height ?? 0;
        const columnWidth = Math.floor(width / 4);
        note({
          phase: "sheet", anchor: fixture.key, tier, file,
          askedPixels: `${SHEET_SIZE.width}x${SHEET_SIZE.height}`,
          returnedPixels: `${width}x${height}`,
          bytes: render.bytes.length,
          ms: render.latencyMs,
          wallMs: Date.now() - started,
          providerRef: render.providerRef,
          cutGeometry: `4 columns of ${columnWidth}x${height}, left edges at `
            + [0, 1, 2, 3].map((index) => index * columnWidth).join("/"),
        });
        for (const [index, column] of SHEET_COLUMNS.entries()) {
          const cut = await sharp(render.bytes)
            .extract({ left: index * columnWidth, top: 0, width: columnWidth, height })
            .png()
            .toBuffer();
          const cutFile = await save(`${fixture.key}/sheet-${tier}/cut-${index + 1}-${column.name}.png`, cut);
          const verdict = await judgeOne(judgeFn, {
            angle: column.angle,
            anchor: await forTheJudge(fixture.anchor.bytes),
            candidate: await forTheJudge(cut),
            wardrobeLine: fixture.wardrobeLine,
            brief: fixture.brief,
          });
          note({
            phase: "sheet-cut", anchor: fixture.key, tier,
            column: column.name, judgedAgainst: column.angle, file: cutFile,
            pixels: `${columnWidth}x${height}`,
            bytes: cut.length,
            ...verdict,
          });
        }
      } catch (error) {
        note({
          phase: "sheet", anchor: fixture.key, tier,
          failed: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

/**
 * THE CONTROLS, AND THEY RUN BEFORE THE FINDING IS BELIEVED (working law 2).
 *
 * NEGATIVE — the same anchor beside the same rendered view, judged twice. Any
 * disagreement between those two answers is the judge's own noise, and a
 * difference between arms smaller than it means nothing.
 *
 * POSITIVE — a DIFFERENT person's anchor beside a rendered view. The identity
 * axis must fail. If it does not, this judge cannot tell people apart and every
 * identity number in this court is worthless; the run says so and stops rather
 * than reporting them.
 */
async function phaseControls(fixtures: Fixture[]): Promise<void> {
  console.log("CONTROLS — the judge's noise floor, then the cross-anchor positive control.");
  if (!RUN) {
    console.log("DRY RUN — the controls spend no renders at all: they re-judge frames already on disk.");
    return;
  }
  const judgeFn = judge();
  const { readFile } = await import("node:fs/promises");
  const angle = ANGLES[0]!;
  const frames: { fixture: Fixture; bytes: Buffer; file: string }[] = [];
  for (const fixture of fixtures) {
    /* The frame the noise floor is taken on is the SHIPPED arm's first draw —
       today's engine, today's tier, so the floor is a floor on the answer this
       court is comparing everything against. */
    const file = path.join(OUT, fixture.key, angle, "nb2k-1.png");
    try {
      frames.push({ fixture, bytes: await readFile(file), file });
    } catch {
      note({ phase: "controls", anchor: fixture.key, missing: file });
    }
  }
  if (frames.length === 0) {
    note({ phase: "controls", refused: "no rendered frame on disk — run --phase main first" });
    return;
  }

  for (const frame of frames) {
    for (const pass of [1, 2]) {
      const verdict = await judgeOne(judgeFn, {
        angle,
        /* Through the SAME downscale every arm is judged through: a noise floor
           taken on a different instrument is a floor on nothing. */
        anchor: await forTheJudge(frame.fixture.anchor.bytes),
        candidate: await forTheJudge(frame.bytes),
        wardrobeLine: frame.fixture.wardrobeLine,
        brief: frame.fixture.brief,
      });
      note({
        control: "negative", anchor: frame.fixture.key, viewAngle: angle, judgePass: pass,
        file: frame.file, ...verdict,
      });
    }
  }

  if (frames.length >= 2) {
    for (const [index, frame] of frames.entries()) {
      const other = frames[(index + 1) % frames.length]!;
      const verdict = await judgeOne(judgeFn, {
        angle,
        /* A DIFFERENT person's anchor. The identity axis must fail. */
        anchor: await forTheJudge(other.fixture.anchor.bytes),
        candidate: await forTheJudge(frame.bytes),
        wardrobeLine: frame.fixture.wardrobeLine,
        brief: frame.fixture.brief,
      });
      note({
        control: "positive",
        anchorFrom: other.fixture.key,
        frameFrom: frame.fixture.key,
        viewAngle: angle,
        mustFailIdentity: true,
        identityFailedAsRequired: verdict.identityPass === false,
        ...verdict,
      });
    }
  } else {
    note({ control: "positive", refused: "needs two fixtures to cross their anchors" });
  }
}

/* ----------------------------------------------------- the contact sheets */

const LABEL_HEIGHT = 96;

async function labelled(bytes: Buffer, caption: string, width: number): Promise<Buffer> {
  const resized = await sharp(bytes).resize({ width, fit: "inside" }).png().toBuffer();
  const meta = await sharp(resized).metadata();
  const height = meta.height ?? width;
  const escaped = caption.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const label = Buffer.from(
    `<svg width="${width}" height="${LABEL_HEIGHT}" xmlns="http://www.w3.org/2000/svg">`
    + `<rect width="${width}" height="${LABEL_HEIGHT}" fill="#0A0A0A"/>`
    + `<text x="${Math.round(width / 2)}" y="${Math.round(LABEL_HEIGHT * 0.66)}" `
    + `font-family="Inter, Arial, sans-serif" font-size="48" fill="#FFFFFF" `
    + `text-anchor="middle">${escaped}</text></svg>`,
  );
  return sharp({
    create: { width, height: height + LABEL_HEIGHT, channels: 3, background: "#0A0A0A" },
  })
    .composite([
      { input: label, top: 0, left: 0 },
      { input: resized, top: LABEL_HEIGHT, left: 0 },
    ])
    .png()
    .toBuffer();
}

async function strip(panels: readonly { bytes: Buffer; caption: string }[], panelWidth: number): Promise<Buffer> {
  const tiles = await Promise.all(panels.map((panel) => labelled(panel.bytes, panel.caption, panelWidth)));
  const metas = await Promise.all(tiles.map((tile) => sharp(tile).metadata()));
  const height = Math.max(...metas.map((meta) => meta.height ?? 0));
  return sharp({
    create: { width: panelWidth * tiles.length, height, channels: 3, background: "#0A0A0A" },
  })
    .composite(tiles.map((tile, index) => ({ input: tile, top: 0, left: index * panelWidth })))
    .png()
    .toBuffer();
}

async function phaseContact(fixtures: Fixture[]): Promise<void> {
  const { readFile } = await import("node:fs/promises");
  const read = async (relative: string): Promise<Buffer | null> => {
    try {
      return await readFile(path.join(OUT, relative));
    } catch {
      return null;
    }
  };
  const PANEL = 700;

  /* One sheet per anchor x angle: the four arms side by side, plus the anchor. */
  for (const fixture of fixtures) {
    for (const angle of ANGLES) {
      const panels: { bytes: Buffer; caption: string }[] = [
        { bytes: fixture.anchor.bytes, caption: "the face she signed" },
      ];
      for (const arm of ["nb2k", "nb4k", "sbhigh", "sbmax"] as const) {
        const bytes = await read(`${fixture.key}/${angle}/${arm}-1.png`);
        if (bytes) panels.push({ bytes, caption: ARM_LABEL[arm] });
      }
      if (panels.length < 2) continue;
      const sheet = await strip(panels, PANEL);
      const file = await save(`contact/1394-${fixture.key}-${angle}-arms.png`, sheet);
      note({ contact: "arms", anchor: fixture.key, angle, panels: panels.length, file });

      /* And the same region of the face out of each, at matched scale — the
         only honest way to compare detail between frames of different sizes. */
      const crops: { bytes: Buffer; caption: string }[] = [];
      for (const panel of panels) {
        const meta = await sharp(panel.bytes).metadata();
        const width = meta.width ?? 0;
        const height = meta.height ?? 0;
        if (width === 0 || height === 0) continue;
        const side = Math.round(width * 0.42);
        crops.push({
          bytes: await sharp(panel.bytes)
            .extract({
              left: Math.round((width - side) / 2),
              top: Math.round(height * 0.06),
              width: side,
              height: side,
            })
            .png()
            .toBuffer(),
          caption: panel.caption,
        });
      }
      if (crops.length >= 2) {
        const cropSheet = await strip(crops, PANEL);
        const cropFile = await save(`contact/1394-${fixture.key}-${angle}-faces.png`, cropSheet);
        note({ contact: "faces", anchor: fixture.key, angle, panels: crops.length, file: cropFile });
      }
    }
  }

  /* The chain, steps 0-5 in a row, one sheet per tier — and the two tiers' last
     step beside the anchor. */
  for (const fixture of fixtures) {
    for (const tier of ["high", "max"] as const) {
      const panels: { bytes: Buffer; caption: string }[] = [];
      for (let step = 0; step <= 5; step += 1) {
        const bytes = await read(`${fixture.key}/chain-${tier}/step-${step}.png`);
        if (bytes) panels.push({ bytes, caption: step === 0 ? "the anchor" : `edit ${step}` });
      }
      if (panels.length < 2) continue;
      const sheet = await strip(panels, 520);
      const file = await save(`contact/1394-${fixture.key}-chain-${tier}.png`, sheet);
      note({ contact: "chain", anchor: fixture.key, tier, panels: panels.length, file });
    }
    const last: { bytes: Buffer; caption: string }[] = [
      { bytes: fixture.anchor.bytes, caption: "the face she signed" },
    ];
    for (const tier of ["high", "max"] as const) {
      const bytes = await read(`${fixture.key}/chain-${tier}/step-5.png`);
      if (bytes) last.push({ bytes, caption: `five edits on ${tier}` });
    }
    if (last.length >= 2) {
      const sheet = await strip(last, PANEL);
      const file = await save(`contact/1394-${fixture.key}-chain-endpoints.png`, sheet);
      note({ contact: "chain-endpoints", anchor: fixture.key, panels: last.length, file });
    }
  }

  /* The sheet arm: four cut views beside four renders made one at a time. */
  for (const fixture of fixtures) {
    for (const tier of ["high", "max"] as const) {
      const cuts: { bytes: Buffer; caption: string }[] = [];
      for (const [index, column] of SHEET_COLUMNS.entries()) {
        const bytes = await read(`${fixture.key}/sheet-${tier}/cut-${index + 1}-${column.name}.png`);
        if (bytes) cuts.push({ bytes, caption: `one sheet, cut — ${column.name}` });
      }
      const arm: ArmId = tier === "high" ? "sbhigh" : "sbmax";
      const singles: { bytes: Buffer; caption: string }[] = [];
      for (const [angle, draw, name] of [
        ["frontFull", 1, "front"],
        ["sideClose", 1, "side"],
        ["sideClose", 2, "side, second draw"],
        ["backFull", 1, "back"],
      ] as const) {
        const bytes = await read(`${fixture.key}/${angle}/${arm}-${draw}.png`);
        if (bytes) singles.push({ bytes, caption: `rendered one by one — ${name}` });
      }
      if (cuts.length === 0 && singles.length === 0) continue;
      const sheet = await strip([...cuts, ...singles], 520);
      const file = await save(`contact/1394-${fixture.key}-sheet-vs-single-${tier}.png`, sheet);
      note({
        contact: "sheet-vs-single", anchor: fixture.key, tier,
        cut: cuts.length, single: singles.length, file,
      });
    }
  }
}



/* ----------------------------------------------------------------- rejudge */

/**
 * ⚠ **THE PRODUCT'S OWN JUDGE CANNOT READ A BIG FRAME, AND THAT IS WHY THIS
 * PHASE EXISTS** (measured in this court's own main phase, 2026-09-26).
 *
 * `viewConformance` posts the anchor and the candidate to OpenRouter as `data:`
 * URIs at FULL resolution - `openrouterText.ts` does not resize - and on the
 * first Sunburst frame (2352x3504, 11.5 MB) OpenRouter answered **HTTP 400**.
 * `classifyOpenRouterTextHttp` reads a 400 as `capability`, which is not
 * retryable, so the view comes back `unjudged: "unavailable"`. Today's 2K
 * frames (6.3 MB) go through.
 *
 * That is a finding about the product and it is reported as one: under #1387's
 * 4K proposal every view would be DELIVERED UNJUDGED and charged, which is
 * exactly the road D-246 opened for a broken detector and not a road anyone
 * chose. **It is also, right now, a broken instrument in this court** - three of
 * four arms would have no quality reading at all, and working law 2 says an
 * instrument gets its controls before its verdicts count.
 *
 * So this phase re-asks the SAME judge, with the SAME anchor and the SAME
 * spec, about a **downscaled copy** of every frame on disk: longest edge 1,568
 * pixels, JPEG at quality 92. The size is not arbitrary - it is the largest
 * edge the served model uses before it resizes for itself, so the reduction
 * costs the judge nothing it was going to see.
 *
 * ⚠ **THE DEVIATION FROM THE PRODUCT IS THE WHOLE POINT AND IS DECLARED**: this
 * is NOT what a Sign does today. It is applied IDENTICALLY to every arm,
 * including today's 2K, so the arms stay comparable with each other - which is
 * the question this court was asked. The product-path verdicts stay in the main
 * rows beside these, so the record can show both.
 */
const REJUDGE_LONGEST_EDGE = 1568;

async function forTheJudge(bytes: Buffer): Promise<{ bytes: Buffer; contentType: string }> {
  return {
    bytes: await sharp(bytes)
      .resize({ width: REJUDGE_LONGEST_EDGE, height: REJUDGE_LONGEST_EDGE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 92 })
      .toBuffer(),
    contentType: "image/jpeg",
  };
}

async function phaseRejudge(fixtures: Fixture[]): Promise<void> {
  console.log(
    `REJUDGE — every frame on disk, downscaled to ${REJUDGE_LONGEST_EDGE}px on its longest edge,`
    + " judged by the product's own judge against the same anchor. No renders.",
  );
  if (!RUN) {
    console.log("DRY RUN — this phase renders nothing; it spends only judge calls.");
    return;
  }
  const { readFile } = await import("node:fs/promises");
  const judgeFn = judge();
  for (const fixture of fixtures) {
    const anchor = await forTheJudge(fixture.anchor.bytes);
    for (const angle of ANGLES) {
      for (const arm of ARMS) {
        for (let draw = 1; draw <= DRAWS; draw += 1) {
          const relative = `${fixture.key}/${angle}/${arm}-${draw}.png`;
          let raw: Buffer;
          try {
            raw = await readFile(path.join(OUT, relative));
          } catch {
            continue;
          }
          const candidate = await forTheJudge(raw);
          const verdict = await judgeOne(judgeFn, {
            angle, anchor, candidate, wardrobeLine: fixture.wardrobeLine, brief: fixture.brief,
          });
          note({
            phase: "rejudge", anchor: fixture.key, angle, arm, armLabel: ARM_LABEL[arm], draw,
            file: path.join(OUT, relative),
            judgedBytes: candidate.bytes.length,
            ...verdict,
          });
        }
      }
    }
  }
}

/* ------------------------------------------------------------------ report */

/**
 * THE TABLES, FOLDED OUT OF THE ROWS RATHER THAN OUT OF A NOTEBOOK.
 *
 * Every number the record quotes comes from here, so the record and the rows
 * cannot drift - and re-running it after another slice lands re-answers rather
 * than asking somebody to redo arithmetic by hand.
 */
async function phaseReport(): Promise<void> {
  const { readdir, readFile } = await import("node:fs/promises");
  const files = (await readdir(OUT)).filter((name) => /^rows-.*\.json$/.test(name));
  const rows: Row[] = [];
  for (const file of files) {
    rows.push(...JSON.parse(await readFile(path.join(OUT, file), "utf8")) as Row[]);
  }
  console.log(`read ${rows.length} rows from ${files.length} file(s): ${files.join(", ")}`);

  const mean = (values: number[]) => (values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length);
  const p95 = (values: number[]) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)]!;
  };
  const rate = (hits: number, total: number) =>
    (total === 0 ? "-" : `${hits}/${total} (${Math.round((hits / total) * 100)}%)`);

  console.log("\n## MAIN - per arm\n");
  console.log(
    "| arm | renders | identity | angle | wardrobe | all three | unjudged | mean s | p95 s | MB |"
    + " pixels | $/picture | $/Sign of 5 | s/Sign (3 at a time) |",
  );
  console.log("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const arm of ALL_ARMS) {
    const mine = rows.filter((row) => row.phase === "main" && row.arm === arm && row.failed === undefined);
    if (mine.length === 0) continue;
    const seconds = mine.map((row) => Number(row.ms) / 1000);
    const megabytes = mine.map((row) => Number(row.bytes) / 1_048_576);
    const usd = mine
      .map((row) => (typeof row.usd === "number" ? row.usd : NaN))
      .filter((value) => !Number.isNaN(value));
    const perPicture = usd.length > 0
      ? mean(usd)
      : (SUNBURST_MEASURED_USD[arm as "sbhigh" | "sbmax"] ?? NaN);
    const judged = mine.filter((row) => row.unjudged !== true);
    /* Five views, three at a time, is two waves - the shape SIGN_VIEW_CONCURRENCY
       gives a Sign - so the per-Sign clock is two mean renders, not five. */
    console.log(
      `| ${ARM_LABEL[arm]} | ${mine.length}`
      + ` | ${rate(judged.filter((row) => row.identityPass === true).length, judged.length)}`
      + ` | ${rate(judged.filter((row) => row.anglePass === true).length, judged.length)}`
      + ` | ${rate(judged.filter((row) => row.wardrobePass === true).length, judged.length)}`
      + ` | ${rate(judged.filter((row) => row.pass === true).length, judged.length)}`
      + ` | ${mine.filter((row) => row.unjudged === true).length}`
      + ` | ${mean(seconds).toFixed(1)} | ${p95(seconds).toFixed(1)}`
      + ` | ${mean(megabytes).toFixed(1)}`
      + ` | ${String(mine[0]!.pixels)}`
      + ` | $${perPicture.toFixed(2)} | $${(perPicture * 5).toFixed(2)}`
      + ` | ${(mean(seconds) * 2).toFixed(0)} |`,
    );
  }

  console.log("\n## MAIN - all three axes, per arm per angle\n");
  console.log(`| angle | ${ALL_ARMS.map((arm) => ARM_LABEL[arm]).join(" | ")} |`);
  console.log(`|---|${ALL_ARMS.map(() => "---").join("|")}|`);
  for (const angle of CAST_PACKAGE_VIEWS) {
    const cells = ALL_ARMS.map((arm) => {
      const mine = rows.filter((row) => row.phase === "main" && row.arm === arm && row.angle === angle
        && row.failed === undefined && row.unjudged !== true);
      if (mine.length === 0) return "-";
      return rate(mine.filter((row) => row.pass === true).length, mine.length);
    });
    console.log(`| ${angle} | ${cells.join(" | ")} |`);
  }

  const failures = rows.filter((row) => row.failed !== undefined);
  console.log(`\n## RENDERS THAT NEVER ARRIVED: ${failures.length}\n`);
  for (const row of failures) console.log(`- ${JSON.stringify(row)}`);

  const controls = rows.filter((row) => row.control !== undefined);
  if (controls.length > 0) {
    console.log("\n## CONTROLS\n");
    for (const row of controls) console.log(`- ${JSON.stringify(row)}`);
  }

  const chain = rows.filter((row) => row.phase === "chain");
  if (chain.length > 0) {
    console.log("\n## THE DEGRADATION CHAIN - judged against the ORIGINAL anchor at every step\n");
    console.log("| anchor | tier | step | identity | angle | wardrobe | s | MB | pixels |");
    console.log("|---|---|---|---|---|---|---|---|---|");
    for (const row of chain) {
      if (row.failed !== undefined) {
        console.log(`| ${row.anchor} | ${row.tier} | ${row.step} | RENDER FAILED: ${row.failed} | | | | | |`);
        continue;
      }
      console.log(
        `| ${row.anchor} | ${row.tier} | ${row.step}`
        + ` | ${row.identityPass === true ? "pass" : "FAIL"}`
        + ` | ${row.anglePass === true ? "pass" : "FAIL"}`
        + ` | ${row.wardrobePass === true ? "pass" : "FAIL"}`
        + ` | ${(Number(row.ms) / 1000).toFixed(1)} | ${(Number(row.bytes) / 1_048_576).toFixed(1)} | ${row.pixels} |`,
      );
    }
  }

  const sheets = rows.filter((row) => row.phase === "sheet");
  const cuts = rows.filter((row) => row.phase === "sheet-cut");
  if (sheets.length > 0 || cuts.length > 0) {
    console.log("\n## THE SHEET ARM (#1278 part 2)\n");
    for (const row of sheets) console.log(`- ${JSON.stringify(row)}`);
    console.log("\n| anchor | tier | column | judged against | identity | angle | wardrobe | pixels |");
    console.log("|---|---|---|---|---|---|---|---|");
    for (const row of cuts) {
      console.log(
        `| ${row.anchor} | ${row.tier} | ${row.column} | ${row.judgedAgainst}`
        + ` | ${row.identityPass === true ? "pass" : "FAIL"}`
        + ` | ${row.anglePass === true ? "pass" : "FAIL"}`
        + ` | ${row.wardrobePass === true ? "pass" : "FAIL"}`
        + ` | ${row.pixels} |`,
      );
    }
  }

  const readability = rows.filter((row) => row.phase === "judge-readability");
  if (readability.length > 0) {
    console.log("\n## CAN THE PRODUCT'S OWN JUDGE EVEN READ THE FRAME? (full resolution, as a Sign does it)\n");
    console.log("| arm | anchor | frame MB | read? | how it ended | seconds |");
    console.log("|---|---|---|---|---|---|");
    for (const row of readability) {
      console.log(
        `| ${row.armLabel} | ${row.anchor} | ${(Number(row.frameBytes) / 1_048_576).toFixed(1)}`
        + ` | ${row.theProductsJudgeCouldRead === true ? "YES" : "**NO**"}`
        + ` | ${row.method}${row.why === "" ? "" : ` — ${row.why}`}`
        + ` | ${(Number(row.wallMs) / 1000).toFixed(1)} |`,
      );
    }
  }

  const rejudged = rows.filter((row) => row.phase === "rejudge");
  if (rejudged.length > 0) {
    console.log(
      "\n## THE SAME FRAMES, RE-JUDGED AT A SIZE THE JUDGE CAN READ"
      + " (1,568px longest edge, identical for every arm)\n",
    );
    console.log("| arm | frames | identity | angle | wardrobe | all three | unjudged |");
    console.log("|---|---|---|---|---|---|---|");
    for (const arm of ALL_ARMS) {
      const mine = rejudged.filter((row) => row.arm === arm);
      if (mine.length === 0) continue;
      const judged = mine.filter((row) => row.unjudged !== true);
      console.log(
        `| ${ARM_LABEL[arm]} | ${mine.length}`
        + ` | ${rate(judged.filter((row) => row.identityPass === true).length, judged.length)}`
        + ` | ${rate(judged.filter((row) => row.anglePass === true).length, judged.length)}`
        + ` | ${rate(judged.filter((row) => row.wardrobePass === true).length, judged.length)}`
        + ` | ${rate(judged.filter((row) => row.pass === true).length, judged.length)}`
        + ` | ${mine.filter((row) => row.unjudged === true).length} |`,
      );
    }
    console.log("\n| angle | " + ALL_ARMS.map((arm) => ARM_LABEL[arm]).join(" | ") + " |");
    console.log(`|---|${ALL_ARMS.map(() => "---").join("|")}|`);
    for (const angle of CAST_PACKAGE_VIEWS) {
      const cells = ALL_ARMS.map((arm) => {
        const mine = rejudged.filter((row) => row.arm === arm && row.angle === angle && row.unjudged !== true);
        if (mine.length === 0) return "-";
        return rate(mine.filter((row) => row.pass === true).length, mine.length);
      });
      console.log(`| ${angle} | ${cells.join(" | ")} |`);
    }
  }

  const prices = rows.filter((row) => row.phase === "price");
  if (prices.length > 0) {
    console.log("\n## THE PRICE PHASE\n");
    for (const row of prices) console.log(`- ${JSON.stringify(row)}`);
  }
}

/* -------------------------------------------------------------------- main */

async function main(): Promise<number> {
  console.log(`court-sign-engine — phase ${PHASE}, ${RUN ? "SPENDING" : "dry run"}, frames under ${OUT}`);
  const fixtures = await loadFixtures(ANCHOR_COUNT);
  for (const fixture of fixtures) {
    console.log(
      `fixture ${fixture.key}: model #${fixture.modelId} "${fixture.name}", anchor ${fixture.anchorPixels},`
      + ` wardrobeLine ${fixture.wardrobeLine === null ? "none" : JSON.stringify(fixture.wardrobeLine.slice(0, 60))},`
      + ` brief ${fixture.brief === null ? "none" : `${fixture.brief.length} chars`}`,
    );
  }
  if (PHASE === "price") await phasePrice(fixtures);
  else if (PHASE === "main") await phaseMain(fixtures);
  else if (PHASE === "chain") await phaseChain(fixtures);
  else if (PHASE === "sheet") await phaseSheet(fixtures);
  else if (PHASE === "controls") await phaseControls(fixtures);
  else if (PHASE === "rejudge") await phaseRejudge(fixtures);
  else if (PHASE === "report") await phaseReport();
  else await phaseContact(fixtures);
  /* The rows file NAMES the slice that wrote it, because this court is run as
     two processes at once and one filename would have had the second overwrite
     the first's readings without a word. */
  const slice = [
    ARMS.length === ALL_ARMS.length ? "" : ARMS.join("-"),
    TIERS.length === ALL_TIERS.length ? "" : TIERS.join("-"),
    ONLY === null ? "" : ONLY,
    ARGS.value("anchor") ?? "",
  ].filter((part) => part !== "").join("-");
  if (ROWS.length > 0) await writeRows(`rows-${PHASE}${slice === "" ? "" : `-${slice}`}.json`);
  return 0;
}

/* A script ends by ending the process: `getDb()`'s pool and the S3 client both
   hold the event loop open with everything done. Happy path exits 0, failure
   exits 1. */
main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(1);
  },
);
