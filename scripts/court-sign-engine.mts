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
import { resolveDatabaseUrl, worldOf } from "./lib/dbConnection.mts";
import { CAST_PACKAGE_VIEWS, composePackageViewPrompt } from "../server/castingV2/castViewPackage";
import { createViewConformanceJudge } from "../server/castingV2/viewConformance";
import { createOpenRouterTextEngine, DEFAULT_INTERPRETER_MODEL } from "../server/providers/openrouterText";
import { createFalIdentityEngine, NANO_BANANA_PRO_USD_PER_IMAGE } from "../server/providers/falQueue";
import { FAL_GPT_IMAGE_25_SUNBURST_EDIT } from "../server/providers/falImages";
import { runFalImageJob } from "../server/providers/falTransport";
import { castWardrobeLine } from "../server/castingV2/wardrobeLine";
import { ProviderQueue } from "../server/providers/providerQueue";
import type { CastViewAngle } from "../shared/boardTypes";

/* ------------------------------------------------------------------ the ask */

const ARGS = parseStrictArgsOrRefuse(process.argv.slice(2), {
  value: ["phase", "only", "anchors", "draws", "out", "size", "arms", "tier", "anchor", "models"],
  boolean: ["help", "dry-run", "run", "prod-fixtures"],
});

/**
 * WHICH DATABASE THE FIXTURES COME OUT OF, AND THE WORLD DECLARED FROM THE SAME
 * ANSWER — widened for #1451, whose subject is one of the founder's OWN casts
 * and therefore lives in production.
 *
 * #1394 read its fixtures out of the DEV database and declared `DATABASE_URL`;
 * that is still what an undecorated run does, byte for byte. `--prod-fixtures`
 * says the answer rests on `MYSQL_PUBLIC_URL` instead — the variable the
 * production MySQL service defines and a local `.env` does not — so the guard
 * refuses exactly the shape it was built for in either mode:
 *
 *   plain `npx tsx`                     → inert, reads `DATABASE_URL` (dev)
 *   `railway run`, no `--prod-fixtures` → REFUSES: DATABASE_URL is the local one
 *   `railway run --service MySQL`, with → passes; `openDatabase`'s own
 *     `--prod-fixtures`                    `assertSameWorld` is the second gate
 *
 * ⚠ **THE DECLARATION AND THE URL ARE ONE EXPRESSION ON PURPOSE.** Two
 * statements — a flag deciding the url here and a hand-written key list there —
 * is the shape `worldGuard.mts`'s own header records being bitten by three
 * times: an honest declaration that is incomplete in a direction nobody can see
 * from the call site. And the guard now runs AFTER the strict argument parse
 * rather than before it, because it cannot know which world it is guarding until
 * the arguments are read; a bad argument is therefore refused before a world is,
 * which costs nothing since neither refusal opens a connection.
 *
 * This court still writes no database row and no bucket object in either world.
 * Every frame lands on this machine's disk.
 */
const PROD_FIXTURES = ARGS.flag("prod-fixtures");
const FIXTURE_DB_URL = PROD_FIXTURES ? resolveDatabaseUrl() : process.env.DATABASE_URL;
assertOneWorld(PROD_FIXTURES ? ["MYSQL_PUBLIC_URL"] : ["DATABASE_URL"]);

const PHASES = [
  "price", "main", "outfit", "chain", "sheet", "controls", "contact", "rejudge", "report",
] as const;
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
  --models <ids>                  the fixture model ids to read (default ${[248, 251, 253].join(",")})
  --prod-fixtures                 read the fixtures from the PRODUCTION database (read-only), for a
                                  court on one of the founder's own casts — pair it with
                                  \`railway run --service MySQL\` or it reads dev and says so
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
    outfit    the four INVENTING views x draws x {nb2k, sbhigh}, each judged, each read
              for what it invented below the anchor's crop (#1451)
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
 * THE FIXTURES, READ OUT OF A DATABASE RATHER THAN TYPED IN.
 *
 * #1394's default is three signed casts in the DEV database, owned by two
 * different fixture accounts, chosen because they are decisively different
 * people — which is what makes the cross-anchor positive control below worth
 * running. Their anchors, wardrobe lines and briefs come from the same rows the
 * product's own Try again reader (`readCastViewRenderSource`) reads, so the
 * words this court composes are the words a real retried view composes.
 *
 * `--models <ids>` names a different set, and #1451 needs one: his own words
 * were *"use one of my more creative casts"*, and his casts are in PRODUCTION.
 * A model id means nothing without the world it belongs to, so the ids are an
 * argument rather than a second constant here and every row this court writes
 * carries `world` beside them.
 */
const DEFAULT_FIXTURE_MODEL_IDS = [248, 251, 253] as const;
const FIXTURE_MODEL_IDS: readonly number[] = (() => {
  const raw = ARGS.value("models");
  if (raw === null) return DEFAULT_FIXTURE_MODEL_IDS;
  const ids = raw.split(",").map((part) => Number(part.trim()));
  if (ids.length === 0 || ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    console.error("REFUSING: --models takes a comma-separated list of positive model ids.");
    process.exit(1);
  }
  return ids;
})();

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

/**
 * A short, stable name for a fixture, used in every frame path and every row.
 *
 * ⚠ **THE LAST CLAUSE WAS A FALLBACK AND IT IS NOW DERIVED — #1451.** It read
 * `return "jericho"`, which was true of #1394's three fixtures and silently
 * wrong of every other cast in either world: run against the founder's own
 * production Sifr, every frame would have landed under `output/…/jericho/` and
 * every row would have said `anchor: "jericho"` — a court reporting confidently
 * about a woman it never rendered. The two hand-written cases stay, because
 * #1394's paths on disk and its `--anchor caveman` invocations are part of a
 * published record; anything else is slugged from the cast's own name, which
 * gives `Jericho` → `jericho` and leaves that record byte-identical.
 */
function keyOf(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("caveman")) return "caveman";
  if (lower.includes("basics")) return "basics";
  const slug = lower.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  /* A name made entirely of characters a path cannot hold still needs a folder,
     and the id is the one thing every fixture has. */
  return slug === "" ? "cast" : slug;
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
  const db = await openDatabase(FIXTURE_DB_URL);
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

/* ------------------------------------------------- the outfit phase (#1451) */

/**
 * THE OUTFIT COURT — his order, 2026-09-27, verbatim: *"actually i want one more
 * test and use one of my more creative casts for it. test NBP and sunburst high
 * on outfit creation. meaning sunburst might invent the outfit it cant see
 * better then NBP can"*.
 *
 * # What #1394's wardrobe axis could not answer
 *
 * That court's third axis asks *"the SAME outfit the reference photograph shows"*
 * — agreement with what is VISIBLE. The anchor is a chest-up photograph, so on
 * the four views that show a whole body, most of the outfit is not in the
 * reference at all and the axis is silent about it by construction (the spec
 * says so in as many words: *"anything below the frame of the reference CANNOT
 * be compared to it"*). His hypothesis lives exactly in that silence.
 *
 * # The four views, and why two of them are this court's own ask
 *
 * `frontFull` and `backFull` are the package's own, composed by
 * `composePackageViewPrompt` and sent unchanged — a real Sign's front and back.
 *
 * ⚠ **THE TWO PROFILES ARE NOT.** Read at the code: the package's `sideClose`
 * spec is *"a head-and-shoulders TRUE side profile"* and its directive says
 * *"Head and shoulders only"* — it shows no outfit below the chest, so it cannot
 * carry an outfit-invention question, and it names only the RIGHT edge so it has
 * no left twin. So this court asks for a FULL-LENGTH profile, built from the
 * package's own `frontFull` prompt with one appended TURN clause. That clause is
 * authored here and is declared as such, on the precedent already in this file:
 * {@link sheetPrompt} adds its four-column instruction to the same base for the
 * same reason.
 *
 * ⚠ **The clause says out loud that it overrides the stance above it.** The base
 * prompt reads *"stands square to camera"*; a turn instruction appended without
 * saying so is a prompt that contradicts its own earlier line and leaves the
 * engine to pick. The sheet arm got away with that because its layout clause was
 * obviously later and more specific; a single figure gets no such help.
 *
 * ⚠ **AND THE TWO SIDES ARE NAMED BY THE FRAME'S EDGE, NEVER BY HER ANATOMY** —
 * which is the package's own craft (*"the subject's nose points toward the RIGHT
 * EDGE OF THE OUTPUT FRAME"*, ported from the legacy per-angle framing under
 * §I's craft-reference law) and this repository's own measurement: an
 * anatomy-relative side ask is answered against the image half about as often as
 * not. So `leftProfileFull` means *her nose points at the frame's left edge*, and
 * that is what the reader is asked and what the caption says.
 *
 * # What is measured, and what is deliberately not
 *
 * Per render: wall seconds, the provider's own latency, bytes, returned pixels,
 * the price. Then the product's own three-axis judge at the mapped angle, so a
 * refused or off-angle render is not read as a wardrobe finding. Then ONE prose
 * question about the outfit — the card's own wording, no score, no verdict.
 *
 * ⚠ **THE ANGLE AXIS IS NOT TRUSTWORTHY ON THE TWO PROFILES AND THE ROWS SAY SO
 * PER ROW.** They are judged against `sideClose`'s spec, which asks for the true
 * 90° turn this court wants read and for a head-and-shoulders framing this court
 * deliberately widened, so an angle FAIL there is this court's own framing
 * mismatch. #1394's sheet arm declared the same thing about its middle two
 * columns. That would have left half the views with no honest angle reading at
 * all, which is why {@link phaseOutfitControls} exists.
 */
const OUTFIT_VIEWS = [
  {
    id: "frontFull",
    base: "frontFull",
    turn: "",
    judgedAs: "frontFull",
    angleAxisTrustworthy: true,
    caption: "front, full length",
  },
  {
    id: "leftProfileFull",
    base: "frontFull",
    turn:
      "TURN — THIS OVERRIDES \"square to camera\" ABOVE: the subject is turned a full ninety degrees"
      + " so that her nose points toward the LEFT EDGE OF THE OUTPUT FRAME. A true profile: one eye"
      + " visible, never a three-quarter view. Still full length, head to feet entirely inside the"
      + " frame with margin above the hair and below the feet, arms relaxed at the sides, standing"
      + " still rather than posing.",
    judgedAs: "sideClose",
    angleAxisTrustworthy: false,
    caption: "profile, nose to the frame's LEFT, full length",
  },
  {
    id: "rightProfileFull",
    base: "frontFull",
    turn:
      "TURN — THIS OVERRIDES \"square to camera\" ABOVE: the subject is turned a full ninety degrees"
      + " so that her nose points toward the RIGHT EDGE OF THE OUTPUT FRAME. A true profile: one eye"
      + " visible, never a three-quarter view. Still full length, head to feet entirely inside the"
      + " frame with margin above the hair and below the feet, arms relaxed at the sides, standing"
      + " still rather than posing.",
    judgedAs: "sideClose",
    angleAxisTrustworthy: false,
    caption: "profile, nose to the frame's RIGHT, full length",
  },
  {
    id: "backFull",
    base: "backFull",
    turn: "",
    judgedAs: "backFull",
    angleAxisTrustworthy: true,
    caption: "back, full length",
  },
] as const satisfies readonly {
  id: string;
  base: CastViewAngle;
  turn: string;
  judgedAs: CastViewAngle;
  angleAxisTrustworthy: boolean;
  caption: string;
}[];

/**
 * The two arms this court is asked for, and only those — narrowed further by
 * `--arms` so the run can be split across two processes the way #1394's main
 * phase was, for the reason stated there: a picture waiting behind two others
 * reports the queue rather than the engine.
 *
 * ⚠ **A `--arms` that names neither of these REFUSES rather than running an
 * empty loop.** An empty arm list is a court that spends nothing, writes no rows
 * and exits 0 — indistinguishable from a clean run, which is how a measurement
 * comes to be believed on the strength of having not happened.
 */
const OUTFIT_CANDIDATE_ARMS = ["nb2k", "sbhigh"] as const satisfies readonly ArmId[];
const OUTFIT_ARMS: readonly (typeof OUTFIT_CANDIDATE_ARMS)[number][] = (() => {
  const kept = OUTFIT_CANDIDATE_ARMS.filter((arm) => (ARMS as readonly ArmId[]).includes(arm));
  if (kept.length === 0 && PHASE === "outfit") {
    console.error(
      `REFUSING: the outfit phase runs ${OUTFIT_CANDIDATE_ARMS.join(" and ")} only, and --arms named`
      + ` ${ARMS.join(",")} — nothing would render and the run would look clean.`,
    );
    process.exit(1);
  }
  return kept;
})();

/**
 * The one string both arms are handed, composed exactly once per view.
 *
 * `\n\nView: <base angle>.` is the line `falQueue`'s own `generateView` appends,
 * kept here for the same reason {@link directiveFor} keeps it: the arms must not
 * differ in a byte, and the Nano Banana arm gets that line from the engine
 * whether this court wants it or not.
 */
function outfitPrompt(fixture: Fixture, view: (typeof OUTFIT_VIEWS)[number]): string {
  const base = `${composePackageViewPrompt(view.base, fixture.wardrobeLine, fixture.brief)}\n\nView: ${view.base}.`;
  return view.turn === "" ? base : `${base}\n${view.turn}`;
}

/**
 * WHAT THE OUTFIT READER IS HANDED AS THE CAST'S OWN WORDS ABOUT HER CLOTHES.
 *
 * The card says *"the brief's wardrobe line"*. Measured on his casts: none of
 * the five signed Casts in production carries a stored `wardrobe.line` at all
 * (`castWardrobeLine` returns `null`), so on this subject there is no line to
 * quote and the only record of her clothes is the brief — which is precisely
 * what the product itself hands the judge as `description`. Cutting the wardrobe
 * sentence out of the brief by hand would be an authored extraction standing in
 * for a field, so the whole record goes across and the row says which it was.
 */
function wardrobeRecordOf(fixture: Fixture): { text: string | null; source: "storedLine" | "brief" | "none" } {
  if (fixture.wardrobeLine !== null) return { text: fixture.wardrobeLine, source: "storedLine" };
  if (fixture.brief !== null) return { text: fixture.brief, source: "brief" };
  return { text: null, source: "none" };
}

/**
 * THE OUTFIT READER — the card's own question, prose only.
 *
 * ⚠ **IT RETURNS NO SCORE AND NO BOOLEAN, ON PURPOSE** (working law 9). Four
 * prose answers for his eye to read beside the frames; nothing in this court
 * folds them into a rate, because *"which engine invented the better dress"* is
 * not a question a reader is allowed to close.
 */
const OUTFIT_READER_SYSTEM =
  "You are looking at two photographs of the same person. IMAGE 1 is the signed reference photograph:"
  + " it is cropped at the chest, so most of the outfit is not in it. IMAGE 2 is a new full-length"
  + " photograph of the same person. Describe what you can see. Answer in plain prose, in the JSON"
  + " shape asked for, and never guess at something the picture does not show — say that it does not"
  + " show it.";

type OutfitReading = {
  outfit: string;
  agreesWithAnchor: string;
  agreesWithRecord: string;
  addedByNeither: string;
};

async function readOutfit(
  engine: ReturnType<typeof createOpenRouterTextEngine>,
  input: {
    anchor: { bytes: Buffer; contentType: string };
    candidate: { bytes: Buffer; contentType: string };
    wardrobeRecord: string | null;
  },
): Promise<{ reading: OutfitReading | null; why: string; wallMs: number; tokens: { in: number; out: number } | null; truncated: boolean }> {
  const started = Date.now();
  const user = [
    "Answer as a JSON object with exactly these four string fields, each one or two sentences of prose:",
    "  \"outfit\"            — describe the outfit in IMAGE 2, head to feet: garments, cut, length,"
    + " hardware, footwear, and how worn or pristine it looks.",
    "  \"agreesWithAnchor\"  — does IMAGE 2's outfit agree with the part of the outfit IMAGE 1 actually"
    + " shows? Name what agrees and what does not.",
    "  \"agreesWithRecord\"  — does IMAGE 2's outfit agree with the WRITTEN RECORD below? Name what"
    + " agrees and what does not. If there is no record, say so.",
    "  \"addedByNeither\"    — what does IMAGE 2 wear that IMAGE 1 does not show AND the written record"
    + " does not name? If nothing, say nothing.",
    "",
    "WRITTEN RECORD of what this person wears:",
    input.wardrobeRecord ?? "(there is no written record of this person's clothes)",
  ].join("\n");
  let text: string;
  let tokens: { in: number; out: number } | null = null;
  let truncated = false;
  try {
    const reply = await engine.complete({
      about: "describe",
      system: OUTFIT_READER_SYSTEM,
      user,
      images: [input.anchor, input.candidate],
      json: true,
      temperature: 0,
      /* Four prose fields run long; the ceiling is for the answer and the
         reasoning is off, which is `viewConformance`'s own hard-won shape after
         a judge came back empty twice on this very cast's Sign (#1220). */
      reasoning: "off",
      maxOutputTokens: 1_200,
    });
    text = reply.text;
    tokens = reply.tokens ?? null;
    truncated = reply.truncated === true;
  } catch (error) {
    return {
      reading: null, why: error instanceof Error ? error.message : String(error),
      wallMs: Date.now() - started, tokens: null, truncated: false,
    };
  }
  const fail = (why: string) => ({ reading: null, why, wallMs: Date.now() - started, tokens, truncated });
  const match = /\{[\s\S]*\}/.exec(text);
  if (!match) return fail(`no JSON object in the reply: ${text.slice(0, 200)}`);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(match[0]) as Record<string, unknown>;
  } catch (error) {
    return fail(`unparseable JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  const field = (name: string): string => (typeof parsed[name] === "string" ? String(parsed[name]) : "");
  const reading: OutfitReading = {
    outfit: field("outfit"),
    agreesWithAnchor: field("agreesWithAnchor"),
    agreesWithRecord: field("agreesWithRecord"),
    addedByNeither: field("addedByNeither"),
  };
  if (reading.outfit === "") return fail(`the reply carried no "outfit" prose: ${text.slice(0, 200)}`);
  return { reading, why: "", wallMs: Date.now() - started, tokens, truncated };
}

/**
 * THE TURN READER — a court-owned instrument, because the product has none for a
 * view the product does not promise.
 *
 * It answers two things about one frame, with no reference beside it: is this a
 * TRUE ninety-degree profile, and if so which edge of the frame does the nose
 * point at. That is what makes an off-angle profile legible as off-angle rather
 * than as an outfit finding — which is what the card asked the three-axis judge
 * for and what the three-axis judge cannot give here.
 *
 * ⚠ **IT IS CONTROLLED BEFORE ITS VERDICTS COUNT** (working law 2), and the
 * controls cost no renders: see {@link phaseOutfitControls}.
 */
const TURN_READER_SYSTEM =
  "You are looking at one photograph of a person standing. Answer only about the direction the person"
  + " faces in this photograph. Use the EDGES OF THIS IMAGE as your reference, never the person's own"
  + " left and right. Answer in the JSON shape asked for.";

type TurnReading = { profile: boolean; edge: "left" | "right" | "neither"; note: string };

async function readTurn(
  engine: ReturnType<typeof createOpenRouterTextEngine>,
  frame: { bytes: Buffer; contentType: string },
): Promise<{ reading: TurnReading | null; why: string }> {
  const user = [
    "Answer as a JSON object with exactly these three fields:",
    "  \"profile\" — true if this is a TRUE side profile: the person turned a full ninety degrees so"
    + " that one eye and one ear are visible and the far eye is hidden. false for a front view, a back"
    + " view, or a three-quarter turn where both eyes are visible.",
    "  \"edge\"    — \"left\" if the nose points toward the LEFT EDGE of this image, \"right\" if it"
    + " points toward the RIGHT EDGE, \"neither\" if the person faces the camera or faces away.",
    "  \"note\"    — one short sentence saying what you actually see.",
  ].join("\n");
  let text: string;
  try {
    const reply = await engine.complete({
      about: "classify",
      system: TURN_READER_SYSTEM,
      user,
      images: [frame],
      json: true,
      temperature: 0,
      reasoning: "off",
      maxOutputTokens: 400,
    });
    text = reply.text;
  } catch (error) {
    return { reading: null, why: error instanceof Error ? error.message : String(error) };
  }
  const match = /\{[\s\S]*\}/.exec(text);
  if (!match) return { reading: null, why: `no JSON object in the reply: ${text.slice(0, 200)}` };
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(match[0]) as Record<string, unknown>;
  } catch (error) {
    return { reading: null, why: `unparseable JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (typeof parsed.profile !== "boolean") return { reading: null, why: `no boolean "profile": ${text.slice(0, 200)}` };
  const edge = parsed.edge === "left" || parsed.edge === "right" ? parsed.edge : "neither";
  return {
    reading: { profile: parsed.profile, edge, note: typeof parsed.note === "string" ? parsed.note : "" },
    why: "",
  };
}

/**
 * THE TURN READER'S CONTROLS — three frames, no renders, and every one of them
 * a picture the founder has already paid for.
 *
 * The fixture's own DELIVERED package views are in the database and in the
 * bucket. So the reader is asked about:
 *
 *   1. her delivered `frontFull` — a square-to-camera full length. It must read
 *      `profile: false`. **If it does not, this reader cannot tell a turn from a
 *      stance and every profile angle reading in this court is struck.**
 *   2. her delivered `sideClose` — a real ninety-degree profile of her. It must
 *      read `profile: true`. The edge it names is recorded rather than asserted,
 *      because nothing here knows a priori which way that delivered frame faces.
 *   3. the SAME frame, flipped horizontally. It must read `profile: true` and it
 *      must name **the opposite edge from (2)**. That is the positive control on
 *      the SIDE half of the reading, and it is exact: one picture, one bit
 *      changed, an answer that must invert.
 *
 * ⚠ **The two halves of this reader are controlled separately and can fail
 * separately.** (1) failing strikes both; (3) failing strikes only the edge, and
 * the record says the left/right rows are unverified while the presence rows
 * stand. A single pass/fail over an instrument that answers two questions is how
 * a half-blind reader keeps a whole reputation.
 */
async function phaseOutfitControls(fixtures: Fixture[]): Promise<void> {
  console.log(
    "OUTFIT CONTROLS — the turn reader against the fixture's own delivered views."
    + " No renders: these frames are already paid for.",
  );
  const engine = textEngineForReaders();
  const db = await openDatabase(FIXTURE_DB_URL);
  let delivered: { modelId: number; viewType: string; url: string }[];
  try {
    const [rows] = await db.query<any[]>(
      `SELECT modelId, viewType, storageUrl FROM model_assets
        WHERE modelId IN (${fixtures.map((fixture) => fixture.modelId).join(",")})
          AND viewType IN ('frontFull','sideClose')
          AND storageUrl IS NOT NULL
        ORDER BY modelId, viewType, id`,
    );
    delivered = rows.map((row) => ({
      modelId: Number(row.modelId), viewType: String(row.viewType), url: String(row.storageUrl),
    }));
  } finally {
    await db.end();
  }

  for (const fixture of fixtures) {
    for (const viewType of ["frontFull", "sideClose"] as const) {
      const row = delivered.find((entry) => entry.modelId === fixture.modelId && entry.viewType === viewType);
      if (!row) {
        note({ control: "turn-reader", anchor: fixture.key, viewType, missing: "this cast has no delivered view of this kind" });
        continue;
      }
      const response = await fetch(row.url);
      if (!response.ok) {
        note({ control: "turn-reader", anchor: fixture.key, viewType, missing: `fetch ${response.status}` });
        continue;
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const frame = await forTheJudge(bytes);
      const straight = await readTurn(engine, frame);
      note({
        control: "turn-reader",
        anchor: fixture.key,
        viewType,
        variant: "as delivered",
        mustRead: viewType === "frontFull" ? "profile: false" : "profile: true",
        readAsRequired: straight.reading === null
          ? false
          : straight.reading.profile === (viewType === "sideClose"),
        ...(straight.reading ?? {}),
        why: straight.why,
      });
      if (viewType !== "sideClose") continue;
      /* The same picture with one bit changed. `flop` is the horizontal flip;
         `flip` is vertical, and using the wrong one here would be a control that
         asks the reader about a woman standing on her head. */
      const flipped = await forTheJudge(await sharp(bytes).flop().png().toBuffer());
      const mirrored = await readTurn(engine, flipped);
      note({
        control: "turn-reader",
        anchor: fixture.key,
        viewType,
        variant: "mirrored",
        mustRead: "profile: true, and the OPPOSITE edge from the delivered frame",
        readAsRequired: straight.reading !== null && mirrored.reading !== null
          && mirrored.reading.profile
          && straight.reading.edge !== "neither"
          && mirrored.reading.edge !== "neither"
          && mirrored.reading.edge !== straight.reading.edge,
        deliveredEdge: straight.reading?.edge ?? null,
        ...(mirrored.reading ?? {}),
        why: mirrored.why,
      });
    }
  }
}

/** One engine for both readers, one queue, so neither measures the other's wait. */
let readerEngine: ReturnType<typeof createOpenRouterTextEngine> | null = null;
function textEngineForReaders() {
  if (!readerEngine) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY is required — the readers are this court's instruments");
    readerEngine = createOpenRouterTextEngine({
      apiKey,
      model: process.env.SIGN_JUDGE_MODEL || DEFAULT_INTERPRETER_MODEL,
      queue: new ProviderQueue({ name: "court-outfit-reader", concurrency: 2, maxQueueDepth: 64 }),
    });
  }
  return readerEngine;
}

async function phaseOutfit(fixtures: Fixture[]): Promise<void> {
  const renders = fixtures.length * OUTFIT_VIEWS.length * OUTFIT_ARMS.length * DRAWS;
  console.log(
    `OUTFIT PHASE — ${fixtures.length} anchor(s) x ${OUTFIT_VIEWS.length} inventing views x`
    + ` ${OUTFIT_ARMS.length} arms x ${DRAWS} draws = ${renders} renders.`,
  );
  /* The four composed strings land on disk whether or not anything spends, so
     the record can QUOTE the prompt instead of describing it (working law 5:
     the contract is proven on the outgoing request). */
  for (const fixture of fixtures) {
    const prompts = Object.fromEntries(
      OUTFIT_VIEWS.map((view) => [view.id, outfitPrompt(fixture, view)]),
    );
    await save(
      `${fixture.key}/outfit/prompts.json`,
      Buffer.from(`${JSON.stringify({
        modelId: fixture.modelId,
        name: fixture.name,
        world: worldOf(FIXTURE_DB_URL),
        wardrobeLine: fixture.wardrobeLine,
        brief: fixture.brief,
        prompts,
      }, null, 2)}\n`),
    );
  }
  if (!RUN) {
    const perArm = fixtures.length * OUTFIT_VIEWS.length * DRAWS;
    let total = 0;
    for (const arm of OUTFIT_ARMS) {
      const each = arm === "nb2k" ? NANO_BANANA_PRO_USD_PER_IMAGE["2K"] : SUNBURST_MEASURED_USD.sbhigh;
      total += perArm * each;
      console.log(`DRY RUN — ${ARM_LABEL[arm]} ${perArm} x $${each.toFixed(2)} = $${(perArm * each).toFixed(2)}`);
    }
    console.log(
      `DRY RUN — total $${total.toFixed(2)} plus text-reader cents.`
      + " The composed prompts are on disk either way.",
    );
    return;
  }
  /* ⚠ THE CONTROLS RUN IN THIS PROCESS, BEFORE THE FIRST RENDER (working law 2).
     Not a sibling phase somebody could forget to invoke: an instrument whose
     controls are one flag away from being skipped is an instrument that will one
     day report without them. */
  await phaseOutfitControls(fixtures);
  const judgeFn = judge();
  const reader = textEngineForReaders();
  for (const fixture of fixtures) {
    const record = wardrobeRecordOf(fixture);
    const anchorForReading = await forTheJudge(fixture.anchor.bytes);
    for (const view of OUTFIT_VIEWS) {
      const prompt = outfitPrompt(fixture, view);
      for (const arm of OUTFIT_ARMS) {
        for (let draw = 1; draw <= DRAWS; draw += 1) {
          const started = Date.now();
          try {
            const render = await renderArm(arm, prompt, [fixture.anchor]);
            const meta = await sharp(render.bytes).metadata();
            const file = await save(`${fixture.key}/outfit/${view.id}/${arm}-${draw}.png`, render.bytes);
            const candidate = await forTheJudge(render.bytes);
            const verdict = await judgeOne(judgeFn, {
              angle: view.judgedAs,
              anchor: anchorForReading,
              candidate,
              wardrobeLine: fixture.wardrobeLine,
              brief: fixture.brief,
            });
            const turn = view.turn === "" ? null : await readTurn(reader, candidate);
            const outfit = await readOutfit(reader, {
              anchor: anchorForReading,
              candidate,
              wardrobeRecord: record.text,
            });
            note({
              phase: "outfit", anchor: fixture.key, world: worldOf(FIXTURE_DB_URL),
              view: view.id, judgedAs: view.judgedAs,
              angleAxisTrustworthy: view.angleAxisTrustworthy,
              arm, armLabel: ARM_LABEL[arm], draw, file,
              pixels: `${meta.width}x${meta.height}`,
              bytes: render.bytes.length,
              ms: render.latencyMs,
              wallMs: Date.now() - started,
              usd: render.usd ?? SUNBURST_MEASURED_USD[arm as "sbhigh"] ?? null,
              usdMeasuredBy: render.usd === null ? "this court's price phase, n=1" : "the provider's own figure",
              model: render.model,
              providerRef: render.providerRef,
              wardrobeRecordSource: record.source,
              ...verdict,
              turnProfile: turn?.reading?.profile ?? null,
              turnEdge: turn?.reading?.edge ?? null,
              turnNote: turn?.reading?.note ?? (turn?.why ?? ""),
              outfitRead: outfit.reading,
              outfitReadWhy: outfit.why,
              outfitReadMs: outfit.wallMs,
              /* ⚠ ADDED AFTER THE 2026-09-27 RUN, WHICH IS WHY THAT RUN'S ROWS
                 DO NOT CARRY IT. `readOutfit` returned the provider's token
                 usage from the first line it was written and the only consumer
                 threw it away — the exact silhouette of the arm-at-the-producer
                 defect `packageOrchestrator` records about its own `dropped`.
                 The readers bill on OpenRouter, so they are outside the fal
                 balance window entirely and the record had no other way to
                 price them. */
              outfitReadTokens: outfit.tokens,
              outfitReadTruncated: outfit.truncated,
            });
          } catch (error) {
            /* A Sunburst content refusal is a FINDING and is recorded with the
               prompt that earned it, never retried into silence (#1394 measured
               seven of them on the caveman's asks). */
            const why = error instanceof Error ? error.message : String(error);
            note({
              phase: "outfit", anchor: fixture.key, view: view.id, arm, draw,
              failed: why,
              refusal: /content_policy_violation|content checker/.test(why),
              promptChars: prompt.length,
              wallMs: Date.now() - started,
            });
          }
        }
      }
    }
  }
}

/**
 * THE OUTFIT CONTACT SHEETS — one per view, plus one outfit-region strip per
 * view, which is what his eye actually closes this on (law 9).
 *
 * The anchor first, then every Nano Banana draw, then every Sunburst draw. All
 * four views and both arms are 2:3, so matching the panel WIDTH matches the
 * scale; the anchor is 1024x1536 and the same aspect.
 *
 * ⚠ **THE OUTFIT-REGION STRIP ENLARGES WITH HARD PIXELS AND NOTHING ELSE.** The
 * arms deliver different sizes (1696x2528 against 2352x3504), so a crop of the
 * same fractional region is a different number of pixels in each. Every crop is
 * brought up to the LARGEST crop's size with `kernel: "nearest"` — no
 * interpolation, no sharpening, no invented detail. A smooth upscale of the
 * smaller side would be this court inventing the very thing it is asking him to
 * compare.
 *
 * ⚠ **AND THE ANCHOR'S PANEL IN THAT STRIP IS NOT THE SAME REGION**, because it
 * cannot be: the anchor is cropped at the chest and has no hem. Its panel is the
 * bottom of what it does show — the only piece of this outfit that is on record
 * as a photograph — and it is captioned as that rather than as a torso-to-hem
 * crop it is not.
 */
const OUTFIT_REGION = { top: 0.30, height: 0.52 } as const;

async function hardEnlarge(bytes: Buffer, width: number, height: number): Promise<Buffer> {
  return sharp(bytes)
    .resize({ width, height, fit: "fill", kernel: "nearest" })
    .png()
    .toBuffer();
}

async function phaseOutfitContact(fixtures: Fixture[]): Promise<void> {
  const { readFile } = await import("node:fs/promises");
  const read = async (relative: string): Promise<Buffer | null> => {
    try {
      return await readFile(path.join(OUT, relative));
    } catch {
      return null;
    }
  };
  const PANEL = 620;
  for (const fixture of fixtures) {
    for (const view of OUTFIT_VIEWS) {
      const panels: { bytes: Buffer; caption: string }[] = [
        { bytes: fixture.anchor.bytes, caption: "the anchor she signed" },
      ];
      const forCrop: { bytes: Buffer; caption: string; wholeFigure: boolean }[] = [
        { bytes: fixture.anchor.bytes, caption: "anchor — all it shows", wholeFigure: false },
      ];
      for (const arm of OUTFIT_CANDIDATE_ARMS) {
        for (let draw = 1; draw <= DRAWS; draw += 1) {
          const bytes = await read(`${fixture.key}/outfit/${view.id}/${arm}-${draw}.png`);
          if (!bytes) continue;
          panels.push({ bytes, caption: `${ARM_LABEL[arm]} ${draw}` });
          forCrop.push({ bytes, caption: `${ARM_LABEL[arm]} ${draw}`, wholeFigure: true });
        }
      }
      if (panels.length < 2) continue;
      const sheet = await strip(panels, PANEL);
      const file = await save(`contact/1451-${fixture.key}-${view.id}-arms.png`, sheet);
      note({ contact: "outfit-arms", anchor: fixture.key, view: view.id, panels: panels.length, file });

      /* The outfit region out of each, at matched scale. */
      const crops: { bytes: Buffer; caption: string }[] = [];
      for (const panel of forCrop) {
        const meta = await sharp(panel.bytes).metadata();
        const width = meta.width ?? 0;
        const height = meta.height ?? 0;
        if (width === 0 || height === 0) continue;
        /* A full-length frame gives torso-to-hem; the chest-up anchor gives the
           bottom of its own frame, which is all the garment it holds. */
        const top = panel.wholeFigure
          ? Math.round(height * OUTFIT_REGION.top)
          : Math.round(height * (1 - OUTFIT_REGION.height));
        const band = Math.min(Math.round(height * OUTFIT_REGION.height), height - top);
        crops.push({
          bytes: await sharp(panel.bytes).extract({ left: 0, top, width, height: band }).png().toBuffer(),
          caption: panel.caption,
        });
      }
      if (crops.length < 2) continue;
      const sizes = await Promise.all(crops.map((crop) => sharp(crop.bytes).metadata()));
      const widest = Math.max(...sizes.map((size) => size.width ?? 0));
      const tallest = Math.max(...sizes.map((size) => size.height ?? 0));
      const matched = await Promise.all(crops.map(async (crop, index) => ({
        caption: crop.caption,
        bytes: (sizes[index]!.width ?? 0) === widest && (sizes[index]!.height ?? 0) === tallest
          ? crop.bytes
          : await hardEnlarge(crop.bytes, widest, tallest),
      })));
      const cropSheet = await strip(matched, PANEL);
      const cropFile = await save(`contact/1451-${fixture.key}-${view.id}-outfit.png`, cropSheet);
      note({
        contact: "outfit-region", anchor: fixture.key, view: view.id,
        panels: matched.length, matchedTo: `${widest}x${tallest}`,
        enlargement: "nearest-neighbour, no interpolation", file: cropFile,
      });
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

  /* #1451's sheets, from the same disk pass. It builds only what is there, so a
     tree with no outfit phase on it emits nothing and says nothing — which is
     why this is not a tenth phase name to remember. */
  await phaseOutfitContact(fixtures);
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

  const outfit = rows.filter((row) => row.phase === "outfit");
  if (outfit.length > 0) {
    console.log("\n## THE OUTFIT COURT (#1451) — per arm\n");
    console.log(
      "| arm | renders | refusals | identity | angle (front/back only) | wardrobe | mean s | p95 s |"
      + " MB | pixels | $/picture | $ total |",
    );
    console.log("|---|---|---|---|---|---|---|---|---|---|---|---|");
    for (const arm of OUTFIT_CANDIDATE_ARMS) {
      const mine = outfit.filter((row) => row.arm === arm && row.failed === undefined);
      const failed = outfit.filter((row) => row.arm === arm && row.failed !== undefined);
      if (mine.length === 0 && failed.length === 0) continue;
      const seconds = mine.map((row) => Number(row.ms) / 1000);
      const megabytes = mine.map((row) => Number(row.bytes) / 1_048_576);
      const judged = mine.filter((row) => row.unjudged !== true);
      /* ⚠ The angle rate counts ONLY the views whose spec this court did not
         widen. Folding the two profiles in would publish a number that is mostly
         this court's own framing mismatch, and a reader would quote it. */
      const anglePopulation = judged.filter((row) => row.angleAxisTrustworthy === true);
      const perPicture = mine.length === 0 ? NaN : mean(
        mine.map((row) => (typeof row.usd === "number" ? row.usd : NaN)).filter((value) => !Number.isNaN(value)),
      );
      console.log(
        `| ${ARM_LABEL[arm]} | ${mine.length} | ${failed.length}`
        + ` | ${rate(judged.filter((row) => row.identityPass === true).length, judged.length)}`
        + ` | ${rate(anglePopulation.filter((row) => row.anglePass === true).length, anglePopulation.length)}`
        + ` | ${rate(judged.filter((row) => row.wardrobePass === true).length, judged.length)}`
        + ` | ${mean(seconds).toFixed(1)} | ${p95(seconds).toFixed(1)}`
        + ` | ${mean(megabytes).toFixed(1)} | ${mine.length === 0 ? "-" : String(mine[0]!.pixels)}`
        + ` | $${perPicture.toFixed(2)} | $${(perPicture * mine.length).toFixed(2)} |`,
      );
    }

    console.log("\n## THE OUTFIT COURT — the turn reader on the two profiles\n");
    console.log("| view | arm | draw | a true 90° profile? | nose at which frame edge? | the reader's own words |");
    console.log("|---|---|---|---|---|---|");
    for (const row of outfit) {
      if (row.turnProfile === null || row.turnProfile === undefined) continue;
      console.log(
        `| ${row.view} | ${row.armLabel} | ${row.draw} | ${row.turnProfile === true ? "yes" : "**no**"}`
        + ` | ${row.turnEdge} | ${String(row.turnNote).replace(/\|/g, "/")} |`,
      );
    }

    console.log("\n## THE OUTFIT COURT — what each render was read as wearing (prose, no score)\n");
    for (const row of outfit) {
      const reading = row.outfitRead as Record<string, string> | null | undefined;
      console.log(`### ${row.view} — ${row.armLabel}, draw ${row.draw}`);
      if (row.failed !== undefined) {
        console.log(`\n${row.refusal === true ? "**REFUSED by the engine**" : "**never arrived**"}: ${row.failed}\n`);
        continue;
      }
      if (!reading) {
        console.log(`\nthe reader did not answer: ${row.outfitReadWhy}\n`);
        continue;
      }
      console.log(`\n- **the outfit:** ${reading.outfit}`);
      console.log(`- **against the anchor's visible half:** ${reading.agreesWithAnchor}`);
      console.log(`- **against her written record:** ${reading.agreesWithRecord}`);
      console.log(`- **added by neither:** ${reading.addedByNeither}\n`);
    }
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
  /* WHICH WORLD THE FIXTURES CAME FROM, on stdout beside the plan as well as on
     stderr from `openDatabase` — a report whose world has to be inferred has had
     it inferred wrongly here before. */
  console.log(`fixtures from ${worldOf(FIXTURE_DB_URL)}${PROD_FIXTURES ? " (--prod-fixtures, read-only)" : ""}`);
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
  else if (PHASE === "outfit") await phaseOutfit(fixtures);
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
