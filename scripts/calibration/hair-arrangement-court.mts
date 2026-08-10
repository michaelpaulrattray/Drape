/**
 * THE VOCABULARY STANDS TRIAL BEFORE ITS VERDICTS COUNT (working law 2,
 * fable-056 §5/§6).
 *
 * `hairWorn` scored 25% on run-12 and 25% again on run-13 with hair that never
 * moved a pixel, because the pin was two words of unconstrained free text and
 * one of them — "loose" — means _not gathered_ to this product and _not tightly
 * curled_ to anyone looking at curls. D-238 replaces it with a closed list.
 *
 * A closed list is itself an instrument, and an instrument gets a trial before
 * anything is scored against it. Two questions, and they are different:
 *
 *   1. **Does the constrained capture pick the RIGHT value?** Every master is
 *      declared by eye first, in `truth.json`, and the machine's answer is put
 *      beside it. Repeated, because one reading of a stochastic reader cannot
 *      tell a wrong answer from an unstable one (the marks-court lesson).
 *
 *   2. **Does a real arrangement fall off the end of the list?** Anything the
 *      capture answers "other" or "unclear" to is printed as a NO PIN row with
 *      its master, so the list grows HERE, with its wording, rather than in
 *      production later on somebody's paid render.
 *
 * No credits: every master is a frame already paid for, and each call is one
 * text completion.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/calibration/hair-arrangement-court.mts --collect
 *   npx tsx scripts/calibration/hair-arrangement-court.mts --try --repeat 3
 */
import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { capturePresentation } from "../../server/castingV2/presentationState";
import {
  HAIR_ARRANGEMENTS,
  HAIR_ARRANGEMENT_IDS,
  HAIR_ARRANGEMENT_PRECEDENTS,
  type HairArrangement,
} from "../../server/castingV2/hairArrangement";
import { facetOfSubject } from "../../server/castingV2/refineFacets";

const OUT = "output/hair-court";
mkdirSync(OUT, { recursive: true });
const INDEX = `${OUT}/masters.json`;
const TRUTH = `${OUT}/truth.json`;
const HAIR_WORN = facetOfSubject("hairWorn");

const args = process.argv.slice(2);
const repeat = Number(args[args.indexOf("--repeat") + 1]) || 3;

type Master = { candidate: string; candidateId: number; file: string; url: string; note: string };

/* ── collect ─────────────────────────────────────────────────────────────── */

if (args.includes("--collect")) {
  const { openDatabase } = await import("../lib/dbConnection.mts");
  const { assertOneWorld } = await import("../lib/worldGuard.mts");
  const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
  /*
    BOTH WORLDS DECLARED, because this script reads production ROWS and
    production BYTES and the two arrive by different doors.

    The first run of this script declared only the database and then read
    `R2_PUBLIC_URL` anyway — so the guard stayed quiet, dotenv supplied the DEV
    bucket base, and all forty masters 404'd. That is `worldGuard`'s own origin
    story, repeated by under-declaring rather than by carelessness, which is
    worth writing down: the guard protects what you TELL it you read.

    `--public-base` is how a `--service MySQL` run passes the other half
    explicitly, and passing it IS the declaration.
  */
  const explicitBase = args.includes("--public-base")
    ? args[args.indexOf("--public-base") + 1]
    : undefined;
  assertOneWorld(explicitBase ? [databaseKey] : [databaseKey, "R2_PUBLIC_URL"]);
  const databaseUrl = process.env[databaseKey];
  if (!databaseUrl) throw new Error("no database URL — run under `railway run --service MySQL`");
  const publicBase = explicitBase ?? process.env.R2_PUBLIC_URL;
  if (!publicBase) throw new Error("no bucket base — pass --public-base or run where R2_PUBLIC_URL is set");

  const connection = await openDatabase(databaseUrl);
  /*
    The campaign's own faces first — run-9 through run-13 are the specimens the
    two broken pins were written about — then a wider sweep of the founder's
    walkable candidates, because a list validated only on the faces that broke
    it is a list validated on one shape of hair.
  */
  /* The five walked faces, named rather than hoped for: run-12's pixie and
     run-13's tight crop are the two specimens this vocabulary exists because
     of, and they are older than any "most recent 40" window. */
  const WALKED = [
    "0ff75eb2-c53e-4e7b-b1e4-872499c258b6", // run-9
    "0bf245b2-332e-42fd-8237-553289304c03", // run-10
    "42c67b90-a2bd-4fe6-b297-866392f71b42", // run-11
    "8154ac6d-64ee-45ad-834b-fcbabca0f3ef", // run-12 — the pixie
    "72fa6229-6adf-453a-bff0-0dc9065c8b92", // run-13 — the tight crop
  ];
  /* Two statements, because one `ORDER BY id DESC LIMIT n` silently drops the
     named faces the moment the recent pool outgrows n — which it did, and the
     two it dropped were run-11 and run-12. A named specimen is not a row you
     hope survives a window. */
  const [named] = await connection.query<any[]>(
    `SELECT id, publicId, imageKey, createdAt
       FROM casting_candidates
      WHERE userId = 1 AND imageKey IS NOT NULL AND publicId IN (?)`,
    [WALKED],
  );
  if (named.length !== WALKED.length) {
    throw new Error(`only ${named.length} of ${WALKED.length} walked masters found — the specimens are the point`);
  }
  const [recent] = await connection.query<any[]>(
    `SELECT id, publicId, imageKey, createdAt
       FROM casting_candidates
      WHERE userId = 1 AND status = 'ready' AND imageKey IS NOT NULL
      ORDER BY id DESC LIMIT 55`,
  );
  const seen = new Set<number>();
  const rows = [...named, ...recent].filter((row) => !seen.has(row.id) && seen.add(row.id));
  await connection.end();

  const masters: Master[] = [];
  for (const row of rows) {
    const url = `${publicBase.replace(/\/$/, "")}/${row.imageKey}`;
    const file = `${OUT}/cand-${row.id}.png`;
    if (!existsSync(file)) {
      const response = await fetch(url);
      if (!response.ok) { console.log(`  SKIP ${row.id} — ${response.status}`); continue; }
      writeFileSync(file, Buffer.from(await response.arrayBuffer()));
    }
    masters.push({
      candidate: row.publicId, candidateId: row.id, file, url,
      note: `candidate ${row.id}`,
    });
    console.log(`  saved ${file}`);
  }
  /* A run that saved nothing is a wrong bucket, not an empty campaign — and it
     printed forty tidy SKIP lines and exited 0 the first time. */
  if (masters.length === 0) {
    throw new Error(`no master fetched from ${publicBase} — that is the wrong bucket, not an empty pool`);
  }
  writeFileSync(INDEX, JSON.stringify(masters, null, 2));
  console.log(`\n${masters.length} masters in ${INDEX}.`);
  console.log("Now LOOK at each one and write output/hair-court/truth.json as");
  console.log('  { "cand-1564": "worn as cut", ... }   — ids only, "other" if none fits.');
  process.exit(0);
}

/* ── try ─────────────────────────────────────────────────────────────────── */

if (!existsSync(INDEX)) throw new Error(`no ${INDEX} — run --collect first`);
const masters = JSON.parse(readFileSync(INDEX, "utf8")) as Master[];
const truth: Record<string, string> = existsSync(TRUTH)
  ? JSON.parse(readFileSync(TRUTH, "utf8"))
  : {};

const wordingToId = new Map<string, HairArrangement>(
  HAIR_ARRANGEMENT_IDS.map((id) => [HAIR_ARRANGEMENTS[id], id]),
);

type Row = {
  master: string;
  declared: string | null;
  answers: string[];
  unanimous: boolean;
  agrees: boolean | null;
};

const results: Row[] = [];
for (const master of masters) {
  const bytes = readFileSync(master.file);
  const key = master.file.split("/").pop()!.replace(/\.png$/, "");
  const answers: string[] = [];
  for (let attempt = 0; attempt < repeat; attempt += 1) {
    const pinned = await capturePresentation({ bytes, contentType: "image/png" });
    const wording = pinned[HAIR_WORN];
    answers.push(wording ? (wordingToId.get(wording) ?? `??${wording}`) : "NO PIN");
  }
  const declared = truth[key] ?? null;
  const unanimous = new Set(answers).size === 1;
  const agrees = declared ? answers.every((answer) => answer === declared) : null;
  results.push({ master: key, declared, answers, unanimous, agrees });
  console.log(
    `${key.padEnd(12)} declared ${String(declared ?? "—").padEnd(20)} `
    + `→ ${answers.join(" | ").padEnd(46)} ${unanimous ? "" : "SPLIT"} `
    + `${agrees === null ? "" : agrees ? "✓" : "✗"}`,
  );
}

writeFileSync(`${OUT}/court.json`, JSON.stringify({ repeat, results }, null, 2));

/* ── the two findings, stated separately ─────────────────────────────────── */

/*
  `ambiguous` is excluded from the score, deliberately and out loud. Some faces
  genuinely admit two values from the list — a low gathered knot is a bun and an
  up; a jaw-length cut is down and worn-as-cut — and forcing a truth there would
  score the reader against a coin toss. Counting them is the finding; scoring
  them would be manufacturing one.
*/
const scored = results.filter(
  (row) => row.declared && row.declared !== "other" && row.declared !== "ambiguous",
);
const ambiguous = results.filter((row) => row.declared === "ambiguous");
const right = scored.filter((row) => row.agrees).length;
const noPin = results.filter((row) => row.answers.includes("NO PIN"));
const split = results.filter((row) => !row.unanimous);

console.log(`\nagreement with the eye: ${right}/${scored.length} masters, unanimous across ${repeat} readings`);
console.log(`split readings:         ${split.length}   (a split is an unstable value, not a wrong one)`);
console.log(`no pin at all:          ${noPin.length}   ${noPin.map((row) => row.master).join(", ")}`);
console.log(`declared ambiguous:     ${ambiguous.length}   `
  + `(${ambiguous.map((row) => `${row.master}→${row.answers[0]}`).join(", ")})`);

if (scored.length > 0) {
  console.log(`\nwrong, by master — each one a face the pin would argue with:`);
  for (const row of scored.filter((entry) => !entry.agrees)) {
    console.log(`  ${row.master.padEnd(12)} eye said ${String(row.declared).padEnd(16)} reader said ${row.answers.join(" | ")}`);
  }
}

/*
  §6: a real arrangement falling to "other" is the list being too small, and the
  answer is to grow it HERE with its wording — never to loosen the parser.
*/
const declaredOther = results.filter((row) => row.declared === "other");
if (declaredOther.length > 0) {
  console.log(`\nDECLARED "other" by eye — the list is missing a real arrangement:`);
  for (const row of declaredOther) console.log(`  ${row.master}  → ${row.answers.join(" | ")}`);
}

/* Coverage, so a value nobody ever exercised is named rather than assumed. */
const exercised = new Set(results.flatMap((row) => row.answers));
const untried = HAIR_ARRANGEMENT_IDS.filter((id) => !exercised.has(id));
console.log(`\nvalues never chosen on this pool: ${untried.length ? untried.join(", ") : "none"}`);

/*
  THE PRECEDENTS — where the boundaries actually live (D-238 ruling).

  Every other row above is evidence; these are the rulings. A precedent that
  stops holding is not a bad score, it is a ruling that needs a new hearing WITH
  ITS FRAME — so it exits non-zero rather than printing a percentage and letting
  the campaign walk on.
*/
const byMaster = new Map(results.map((row) => [row.master, row]));
const precedents = HAIR_ARRANGEMENT_PRECEDENTS.map((entry) => ({
  entry,
  row: byMaster.get(`cand-${entry.candidateId}`),
}));
const present = precedents.filter((item) => item.row);
console.log(`\nPRECEDENTS — the boundaries, replayed (${present.length} of ${precedents.length} in this pool):`);
let broken = 0;
for (const { entry, row } of precedents) {
  if (!row) { console.log(`  cand-${entry.candidateId}  NOT IN POOL — re-collect before trusting this run`); continue; }
  const holds = row.answers.every((answer) => answer === entry.value);
  if (!holds) broken += 1;
  console.log(
    `  ${holds ? "holds " : "BROKEN"} cand-${entry.candidateId}  ruled ${entry.value.padEnd(16)} `
    + `→ ${row.answers.join(" | ").padEnd(46)} ${entry.why}`,
  );
}
if (broken > 0) {
  console.error(`\n${broken} precedent(s) no longer hold. That is a ruling needing a new hearing with its frame, `
    + `not a wording to adjust — see hairArrangement.ts.`);
  process.exit(1);
}
console.log(`\nAll ${present.length} precedents hold.`);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
