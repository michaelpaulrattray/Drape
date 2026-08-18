/**
 * REHEARSE THE ADOPTION SITTING'S INSTRUMENT on real bytes, before any refusal
 * row exists.
 *
 * The viewer (`open-refused-crops.mts`) is what a human opens a refused crop
 * with, and it cannot be exercised by the live database yet: 0029 is not applied
 * there and the two earring rows that WOULD have kept pixels
 * (`casting_reference_library` #6 and #7, the founder's own specimen renders)
 * are words-only, because the refusal threw the crop away — which is the whole
 * reason (ii) exists.
 *
 * So this seeds a throwaway database with a refusal row whose keys point at
 * **real objects in the dev bucket**, and runs the real viewer against it.
 *
 * **Declared, because it matters:** the pixels it borrows are a DELIVERED crop
 * from the panel fixture (`casting-v2/fixture/panel-v2-…`, library row #1, her
 * lips), standing in for a refused one. The viewer's path — fetch, cut the
 * cutout by the mask, place it on the frame at the row's box — is identical
 * either way, and the placement is checkable by eye: her lips must land on her
 * mouth.
 *
 * Two arms:
 *
 *   1. a row whose frame size AGREES with the row → three pictures written
 *   2. a row whose frame size DISAGREES → the placement is REFUSED and said out
 *      loud. A viewer that rescales to make a picture come out would draw a
 *      confident picture of the wrong place, which is the wrong-boundary class
 *      in colour.
 *
 *   npx tsx scripts/rehearse-refusal-viewer-disposable.mts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { readdir, readFile, rm, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
import sharp from "sharp";
import { openDatabase } from "./lib/dbConnection.mts";
import { openServer } from "./lib/serverConnection.mts";

const PREFIX = "drape_refusal_viewer_";
const OUT = "output/refusal-viewer-rehearsal";

function databaseUrlFromDotEnv(): string | null {
  try {
    const line = readFileSync(".env", "utf8")
      .split(/\r?\n/)
      .find((entry) => entry.startsWith("DATABASE_URL="));
    return line ? line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "") : null;
  } catch {
    return null;
  }
}

const active = process.env.DATABASE_URL!;
if (databaseUrlFromDotEnv() !== active) {
  throw new Error("Refusing: DATABASE_URL was overridden rather than read from .env.");
}
const url = new URL(active);
const databaseName = `${PREFIX}${Math.random().toString(36).slice(2, 10)}`;
if (!new RegExp(`^${PREFIX}[a-z0-9]+$`).test(databaseName)) {
  throw new Error("generated an unsafe database name");
}

/** The specimen, read out of the LIVE table read-only — real keys, real box. */
const source = await openDatabase({ uri: active, timezone: "Z" } as mysql.ConnectionOptions);
const [specimens] = await source.query<any[]>(`
  SELECT l.slot, l.storageKey, l.maskKey, l.bboxX, l.bboxY, l.bboxW, l.bboxH,
         l.frameWidth, l.frameHeight, COALESCE(v.imageKey, c.imageKey) AS frameKey
    FROM casting_reference_library l
    JOIN casting_candidates c ON c.id = l.candidateId
    LEFT JOIN casting_candidate_variants v ON v.id = l.variantId
   WHERE l.storageKey IS NOT NULL AND l.maskKey IS NOT NULL AND l.bboxW IS NOT NULL
   ORDER BY l.id LIMIT 1
`);
await source.end();
const specimen = specimens[0];
if (!specimen) throw new Error("no live library row carries a crop, a mask and a box to borrow");
console.log(
  `[rehearsal] borrowing ${specimen.slot}: ${specimen.bboxW}x${specimen.bboxH} at `
  + `${specimen.bboxX},${specimen.bboxY} in ${specimen.frameWidth}x${specimen.frameHeight}`,
);

/* The SERVER, not a database on it — shared, because six scripts wrote this
   as a parts object and every one of them was dead: `openDatabase` reads
   `options.uri`, and parts have none. See `lib/serverConnection.mts`. */
const server = await openServer(url, { multipleStatements: false });
const seededUrl = new URL(active);
seededUrl.pathname = `/${databaseName}`;

const runViewer = (label: string, out: string) => new Promise<{ code: number; output: string }>((resolve) => {
  console.log(`\n── ${label}`);
  let output = "";
  /*
    `--bucket` IS NOT DECORATION HERE — it is what makes this rehearsal legal.

    The viewer gained a guard (the two-legs-one-world rule): rows coming from a
    world `.env` does not name, while the bucket is taken from the ambient
    environment, is refused. This rehearsal does exactly that by design — it
    points the rows at a throwaway database — so without naming the bucket it
    gets a correct refusal on ARM 1 and reads it as the viewer being broken.

    Found dead by RUNNING it (2026-08-19, the rehearse-* sweep ordered
    fable-1011 §4). It had been failing since the guard landed; nothing was
    wrong with the viewer, and the instrument said there was.

    The bucket named is the ambient one, which is the same bucket the rows'
    crops live in — the two legs really are one world, and now they say so.
  */
  const child = spawn("npx", [
    "tsx", "scripts/open-refused-crops.mts",
    "--user", "1", "--out", out,
    "--bucket", process.env.R2_PUBLIC_URL ?? "",
  ], {
    shell: process.platform === "win32",
    env: { ...process.env, DATABASE_URL: seededUrl.toString() },
  });
  child.stdout.on("data", (chunk) => { output += String(chunk); process.stdout.write(chunk); });
  child.stderr.on("data", (chunk) => { output += String(chunk); process.stderr.write(chunk); });
  child.on("exit", (code) => resolve({ code: code ?? 1, output }));
});

async function isPng(file: string): Promise<boolean> {
  const bytes = await readFile(file).catch(() => null);
  return bytes !== null && bytes.length > 8 && bytes.subarray(0, 4).toString("hex") === "89504e47";
}

/**
 * A CUTOUT THAT KEEPS EVERYTHING IS NOT A CUTOUT.
 *
 * The first version of the viewer wrote a three-channel PNG — `joinChannel`
 * drops the joined channel on the way out — so the "cutout" was the rectangle
 * again under a different name. Nothing here noticed, because the arm asserted
 * the file was a PNG. It now reads the alpha: some pixels transparent, some
 * opaque, and neither extreme.
 */
async function alphaOf(file: string): Promise<{ opaque: number; total: number }> {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let opaque = 0;
  for (let index = 3; index < data.length; index += info.channels) if (data[index]! > 0) opaque += 1;
  return { opaque, total: info.width * info.height };
}

let exitCode = 1;
try {
  await rm(OUT, { recursive: true, force: true });
  await server.query(`CREATE DATABASE \`${databaseName}\``);
  await server.changeUser({ database: databaseName });
  const files = (await readdir("drizzle")).filter((file) => /^\d{4}_.+\.sql$/.test(file)).sort();
  for (const file of files) {
    const sql = await readFile(`drizzle/${file}`, "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await server.query(trimmed);
    }
  }

  await server.execute(
    "INSERT INTO users (id, openId, name, approved, emailVerified) VALUES (1, ?, 'Rehearsal', 1, 1)",
    [`viewer-${randomUUID()}`],
  );
  const [session] = await server.execute<mysql.ResultSetHeader>(
    "INSERT INTO casting_sessions (publicId, userId, status) VALUES (?, 1, 'open')",
    [randomUUID()],
  );
  const [roll] = await server.execute<mysql.ResultSetHeader>(
    "INSERT INTO casting_rolls (publicId, sessionId, userId, rollIndex, briefText, status, operationId, priceCredits)"
    + " VALUES (?, ?, 1, 0, 'a rehearsal', 'complete', ?, 640)",
    [randomUUID(), session.insertId, randomUUID()],
  );
  const candidatePublicId = randomUUID();
  const [candidate] = await server.execute<mysql.ResultSetHeader>(
    "INSERT INTO casting_candidates (publicId, rollId, sessionId, userId, position, status, imageKey, thumbKey)"
    + " VALUES (?, ?, ?, 1, 0, 'ready', ?, ?)",
    [candidatePublicId, roll.insertId, session.insertId, specimen.frameKey, specimen.frameKey],
  );

  /** One refusal row, keys borrowed, geometry as given or deliberately wrong. */
  const seedRefusal = async (slot: string, frame: { width: number; height: number }) => {
    await server.execute(
      "INSERT INTO casting_reference_library"
      + " (publicId, userId, candidateId, variantId, role, slot, tier, noun, words,"
      + "  refusedContentKey, refusedMaskKey, refusedReason, refusedKind, refusedCoverage,"
      + "  refusedBboxX, refusedBboxY, refusedBboxW, refusedBboxH, refusedFrameWidth, refusedFrameHeight, version)"
      + " VALUES (?, 1, ?, NULL, 'carry', ?, 'anatomy', ?, ?, ?, ?, 'noSpecimen', ?, 9560, ?, ?, ?, ?, ?, ?, 1)",
      [
        randomUUID(), candidate.insertId, slot, slot, JSON.stringify(["borrowed for the rehearsal"]),
        specimen.storageKey, specimen.maskKey, slot,
        specimen.bboxX, specimen.bboxY, specimen.bboxW, specimen.bboxH, frame.width, frame.height,
      ],
    );
  };

  /* ------------------------------------------- 1. the frame sizes agree */

  await seedRefusal("lips", { width: specimen.frameWidth, height: specimen.frameHeight });
  const first = await runViewer("ARM 1 — the row's frame size agrees with the frame", OUT);
  if (first.code !== 0) throw new Error("the viewer exited non-zero on a good row");
  for (const suffix of ["crop", "cutout", "on-frame"]) {
    const file = `${OUT}/01-lips-v1-${suffix}.png`;
    if (!(await isPng(file))) throw new Error(`${file} is missing or is not a PNG`);
    const { size } = await stat(file);
    console.log(`[rehearsal]   ${file} — ${size} bytes`);
  }
  if (!first.output.includes("drawn")) throw new Error("the table did not report the placement as drawn");

  /* The cutout is a SHAPE or it is nothing. */
  const alpha = await alphaOf(`${OUT}/01-lips-v1-cutout.png`);
  if (alpha.opaque === alpha.total) {
    throw new Error(
      `the cutout keeps every one of its ${alpha.total} pixels — the mask was not applied as alpha,`
      + " so this is the rectangle wearing the name of a shape",
    );
  }
  if (alpha.opaque === 0) throw new Error("the cutout keeps nothing at all — the mask was applied inverted");
  console.log(
    `[rehearsal]   cutout alpha: ${alpha.opaque}/${alpha.total} opaque `
    + `(${((alpha.opaque / alpha.total) * 100).toFixed(1)}%)`,
  );
  console.log("\n[rehearsal] ARM 1 PASSED — crop, a cutout that is a real shape, and it drawn on her own frame");

  /* --------------------------------------- 2. the frame sizes disagree */

  await server.query("DELETE FROM casting_reference_library");
  await seedRefusal("lips", { width: Number(specimen.frameWidth) + 7, height: Number(specimen.frameHeight) });
  const second = await runViewer("ARM 2 — CONTROL: the row claims a frame 7px wider", `${OUT}-control`);
  if (second.code !== 0) throw new Error("the viewer exited non-zero on the control row");
  if (!second.output.includes("MISMATCH")) {
    throw new Error("the viewer did not report the frame mismatch — it drew the box anyway");
  }
  if (await isPng(`${OUT}-control/01-lips-v1-on-frame.png`)) {
    throw new Error("the viewer placed a crop against a frame it could not verify");
  }
  if (!(await isPng(`${OUT}-control/01-lips-v1-cutout.png`))) {
    throw new Error("the control lost the cutout too — the refusal should be the PLACEMENT alone");
  }
  console.log(
    "\n[rehearsal] ARM 2 PASSED — placement refused and named, and the cutout still written",
  );

  console.log(
    `\n[rehearsal] REHEARSED CLEAN. Look at ${OUT}/01-lips-v1-on-frame.png — her lips must be`
    + "\non her mouth, inside the red box. That is the check no assertion here can make.",
  );
  exitCode = 0;
} finally {
  await server.changeUser({ database: undefined as never }).catch(() => undefined);
  await server.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
  console.log(`[rehearsal] dropped ${databaseName}`);
  await server.end();
}

process.exit(exitCode);
