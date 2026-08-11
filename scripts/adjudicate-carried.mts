/**
 * ADJUDICATE EVERY CARRIED FACT ON A FACE, from the artifacts it left behind.
 *
 * Reads the segment rows, their objects, the frames the customer was actually
 * shown, and the assembly's own recorded intersections — then answers the only
 * question a carried fact raises: **are these the pixels she already paid for.**
 *
 *   PUBLIC_BASE=<r2 public url> railway.cmd run --service MySQL \
 *     npx tsx scripts/adjudicate-carried.mts --candidate <publicId> [--log <file>]
 *
 * `--log` supplies the recorded intersections for renders made BEFORE the
 * assembly record rode the row (they only existed in a production log line
 * then). Without it, rows that carry no assembly record are reported as
 * UNADJUDICABLE rather than passed — an absence of evidence is not evidence.
 */
import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";

import { adjudicateCarried, formatCarriedVerdict, type RecordedIntersection } from "./lib/carriedAdjudicator.mjs";
import { openDatabase } from "./lib/dbConnection.mts";

function arg(name: string, fallback = ""): string {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : fallback;
}

const url = process.env.MYSQL_PUBLIC_URL ?? process.env.DATABASE_URL;
const publicBase = process.env.PUBLIC_BASE;
if (!url) { console.error("no database url — run under `railway run --service MySQL`"); process.exit(1); }
if (!publicBase) { console.error("PUBLIC_BASE (the bucket's public url) is required"); process.exit(1); }
const candidatePublicId = arg("candidate");
if (!candidatePublicId) { console.error("--candidate <publicId> is required"); process.exit(1); }

const connection = await openDatabase({ uri: url, timezone: "Z" } as any);

/*
  EVERY variant, including the ones that never landed — a refused render still
  assembles, still logs, and its lines must not be handed to its successor. The
  fox-eyes refusal on walk two produced two assembly lines and binding them by
  ORDER moved every later render's intersections one render early, which read as
  three deficits on a face that had none. Instrument first, verdict second.
*/
const [allVariants] = await connection.query<any[]>(
  `SELECT v.id, v.publicId, v.parentVariantId, v.requestText, v.imageKey, v.internalPrompt,
          v.candidateId, v.createdAt
     FROM casting_candidate_variants v
     JOIN casting_candidates c ON c.id = v.candidateId
    WHERE c.publicId = ?
    ORDER BY v.id ASC`,
  [candidatePublicId],
);
const variants = allVariants.filter((variant: any) => variant.imageKey);
const [segments] = await connection.query<any[]>(
  `SELECT s.* FROM casting_segments s
     JOIN casting_candidates c ON c.id = s.candidateId
    WHERE c.publicId = ?
    ORDER BY s.id ASC`,
  [candidatePublicId],
);
await connection.end();

/**
 * The intersections a render declared, from the row if it is there and from the
 * production log if the render predates the row carrying it.
 *
 * # Bound by TIME, and the last line in the window
 *
 * The first form of this bound log lines to variants in ORDER, and it was
 * wrong in a way that produced a verdict: walk two's fox-eyes step was charged,
 * attempted TWICE and refused, so it left two assembly lines behind and never
 * became a delivered frame. Binding by order handed those lines to the next
 * three renders, each of which was then judged against a smaller render's
 * losses — three DEFICITS on a face that had none.
 *
 * So the window is this variant's dispatch to the NEXT variant's dispatch,
 * counting variants that never landed, and the line taken is the LAST one
 * inside it, because a render attempted twice assembled twice and the frame she
 * was shown is the last attempt.
 *
 * This whole path is a fallback for renders that predate the assembly record
 * riding the row. Once every row carries its own, none of this runs.
 */
function loggedIntersections(): Map<number, RecordedIntersection[]> {
  const file = arg("log");
  if (!file) return new Map();
  const lines: Array<{ at: number; intersections: RecordedIntersection[] }> = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.includes("assembled this render")) continue;
    const at = Date.parse(line.match(/^(\S+)/)?.[1] ?? "");
    if (Number.isNaN(at)) continue;
    const match = line.match(/intersections=(\[.*?\])\s+superseded=/);
    let intersections: RecordedIntersection[] = [];
    if (match) {
      try { intersections = JSON.parse(match[1]) as RecordedIntersection[]; } catch { intersections = []; }
    }
    lines.push({ at, intersections });
  }
  lines.sort((a, b) => a.at - b.at);

  const map = new Map<number, RecordedIntersection[]>();
  const ordered = allVariants as any[];
  ordered.forEach((variant: any, index: number) => {
    if (!variant.imageKey) return;
    const from = new Date(variant.createdAt).getTime();
    const next = ordered[index + 1];
    const until = next ? new Date(next.createdAt).getTime() : Number.POSITIVE_INFINITY;
    const inside = lines.filter((line) => line.at >= from && line.at < until);
    if (inside.length > 0) map.set(variant.id, inside[inside.length - 1].intersections);
  });
  return map;
}
const fromLog = loggedIntersections();

const fetchBytes = async (key: string) => {
  const response = await fetch(`${publicBase}/${key}`);
  if (!response.ok) throw new Error(`${key} → ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
};

console.log(`\nCARRIED ADJUDICATION — candidate ${candidatePublicId}`);
console.log(`${variants.length} delivered frames · ${segments.length} segment rows\n`);

let unadjudicable = 0;
let deficits = 0;
let judged = 0;

for (const variant of variants) {
  let record: any = variant.internalPrompt;
  if (typeof record === "string") { try { record = JSON.parse(record); } catch { record = null; } }
  const carried: string[] = (record?.verification?.checks ?? [])
    .filter((check: any) => check?.carried)
    .map((check: any) => check.facet);
  if (carried.length === 0) continue;

  const intersections: RecordedIntersection[] = record?.assembly?.intersections
    ?? fromLog.get(variant.id)
    ?? null;
  console.log(`v#${variant.id} "${variant.requestText}"  carried: ${carried.join(", ")}`);
  if (!intersections) {
    unadjudicable += carried.length;
    console.log("   UNADJUDICABLE — this render recorded no intersections anywhere (pre-record row, no --log)");
    continue;
  }

  const frameBytes = await fetchBytes(variant.imageKey);
  for (const facet of carried) {
    /* The version this render carried: the newest one filed BEFORE it. */
    const row = segments
      .filter((entry: any) => entry.facet === facet && entry.variantId !== null && entry.variantId < variant.id)
      .sort((a: any, b: any) => b.version - a.version)[0];
    if (!row) {
      unadjudicable += 1;
      console.log(`   ${facet}: UNADJUDICABLE — no stored segment older than this render`);
      continue;
    }
    const verdict = await adjudicateCarried({
      facet,
      version: row.version,
      maskBytes: await fetchBytes(row.maskKey),
      contentBytes: await fetchBytes(row.contentKey),
      frameBytes,
      bbox: { x: row.bboxX, y: row.bboxY, width: row.bboxW, height: row.bboxH },
      intersections,
    });
    judged += 1;
    if (!verdict.kept) deficits += 1;
    console.log(`   ${formatCarriedVerdict(verdict)}`);
  }
}

console.log(
  `\nVERDICT  ${
    unadjudicable > 0
      ? `UNADJUDICABLE — ${unadjudicable} carried fact(s) left no record to judge them by`
      : deficits > 0
        ? `DEFICIT — ${deficits} of ${judged} carried facts lost pixels nobody accounted for`
        : `KEPT — all ${judged} carried facts are byte-identical or recorded, every one`
  }\n`,
);
process.exit(unadjudicable > 0 || deficits > 0 ? 1 : 0);
