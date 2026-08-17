/**
 * ONE READ OR TWO — the measurement fable-389 §1 ordered instead of a choice
 * ("derive them from one read if quality holds, two if not; measure, don't
 * guess").
 *
 * # What is being decided
 *
 * The panel's `build` and `skin` rows are empty on every unedited face, and the
 * catalogue forbids picturing either of them, so the honest fill is WORDS from
 * the scan (fable-388 §1, fable-389 §1). `faceDescribe.ts` has two arms:
 *
 *   A  describeTogether     one read, both descriptions
 *   B  describeSeparately   one read each, so neither hears the other
 *
 * # THE BARS, WRITTEN BEFORE THE FIRST CALL
 *
 * ```
 * 0 COVERAGE       ≥5 of 6 faces get a non-null line, per subject.
 *                  Without it, bars 2 and 3 pass vacuously: a reader that
 *                  answers null to everything never blurs and never mentions a
 *                  waist, and leaves the row exactly as empty as it is today.
 *
 * 1 DISCRIMINATION ≥10 of 12 matched (chance 6, p≈0.019). A judge sees ONE
 *                  face and two notes — hers and another face's — and picks.
 *                  READ THIS ONE FIRST: without it the other bars are the
 *                  signature of a describer answering one safe phrase to
 *                  everybody, which is perfectly clean and perfectly useless.
 *                  It is the earring reader's shape and the normalizer's, and
 *                  it is the failure this program keeps meeting.
 *
 * 2 CONTAINMENT    0 of 12 notes describe the other's subject. The one-read
 *                  arm's own failure mode: the two answers blurring into one
 *                  observation said twice.
 *
 * 3 CROP HONESTY   0 mentions of a waist, hips, legs or height across every
 *                  note. The frame is cropped at the lower ribs, so a note
 *                  that names one is describing a photograph nobody took.
 * ```
 *
 * Tie goes to **A**, which is half the calls.
 *
 * # THE JUDGES ARE INSTRUMENTS, SO EACH GETS A CONTROL
 *
 * Bar 2's reader is shown a deliberately SWAPPED pair (the skin note offered as
 * the build note) and must flag it; bar 3's checker is run over a planted
 * sentence that names a waist. A checker that cannot fail proves nothing about
 * the notes it passed — and this campaign has bought that lesson three times.
 *
 * FREE: text/vision calls only. No renders, no credits, no writes, nothing
 * stored. Reads dev faces belonging to user 1.
 *
 *   npx tsx scripts/bench-face-describe-disposable.mts
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { storageReadBytes } from "../server/storage";
import { describeSeparately, describeTogether } from "../server/castingV2/faceDescribe";
import { interpreterEngine } from "../server/castingV2/interpreter";

const FACES = Number(process.env.FACES ?? 6);
const OUT = "output/face-describe";
mkdirSync(OUT, { recursive: true });

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);
const databaseUrl = process.env[databaseKey];
if (!databaseUrl) throw new Error("no database URL");
const where = new URL(databaseUrl.replace(/^mysql:/, "http:"));

const transport = interpreterEngine();
if (!transport) throw new Error("no text transport (OPENROUTER_API_KEY) — the arms would both answer null");
/* Aliased after the guard so every closure below holds a non-null engine. */
const engine = transport;

const lines: string[] = [];
function say(line = "") {
  console.log(line);
  lines.push(line);
}

say(`WORLD: ${databaseKey} → ${where.hostname}:${where.port}`);
say(`FACE DESCRIBE BENCH — ${FACES} faces, two arms, four bars written in the header.`);
say("");

/* ── the population ─────────────────────────────────────────────────────── */

const connection = await openDatabase(databaseUrl);
const [pool] = await connection.query<any[]>(
  `SELECT id, publicId, imageKey FROM casting_candidates
    WHERE userId = 1 AND status = 'ready' AND imageKey IS NOT NULL
    ORDER BY id ASC`,
);
await connection.end();

if (pool.length < FACES) throw new Error(`only ${pool.length} ready faces — the bars need ${FACES}`);

/*
  EVENLY ACROSS THE POOL, NOT THE MOST RECENT. A population chosen by recency
  was the skin-thumbnail bench's own error: six versions of nearly one face,
  and the arm that compares faces had nothing to find. Spread costs nothing
  here.
*/
const step = (pool.length - 1) / (FACES - 1);
const chosen = Array.from({ length: FACES }, (_, i) => pool[Math.round(i * step)]);
say(`pool ${pool.length} ready faces · taking every ${step.toFixed(1)}th: ${chosen.map((r) => r.publicId.slice(0, 8)).join(" ")}`);

/*
  DISTINCT OBJECTS, NOT DISTINCT ROWS (fable-441 §4a).

  The teeth bench found `#360` and `#361` pointing at ONE fixture object,
  byte-for-byte identical. Bar 1 asks a judge to tell one face's note from
  another's; two rows of the same photograph make that question unanswerable and
  the miss reads as a describer failing. This draw predates that discovery, so
  it says out loud whether it drew a duplicate rather than leaving the number to
  be re-litigated later.
*/
const distinctKeys = new Set(chosen.map((row) => row.imageKey));
say(`  distinct image objects among them: ${distinctKeys.size}/${FACES}`
  + `${distinctKeys.size < FACES ? "  *** A DUPLICATE IS IN THE DRAW — bar 1 cannot be read at face value ***" : ""}`);
say("");

const frames = await Promise.all(chosen.map(async (row) => {
  const frame = await storageReadBytes(row.imageKey);
  return { row, bytes: frame.bytes, contentType: frame.contentType ?? "image/png" };
}));

/* ── bar 3's checker, and its positive control ──────────────────────────── */

const BELOW_THE_CROP = /\b(waist|waistline|hips?|midriff|legs?|thighs?|height|tall|short in stature|full[- ]length)\b/i;

const control3 = BELOW_THE_CROP.test("slim through the waist, long legs");
say(`bar 3 checker control — planted "slim through the waist, long legs" → ${control3 ? "CAUGHT" : "MISSED"}`);
if (!control3) throw new Error("the crop checker cannot fail — nothing it passes means anything");

/* ── the arms ───────────────────────────────────────────────────────────── */

type Note = { face: string; subject: "build" | "skin"; text: string | null };

async function runArm(arm: "A" | "B"): Promise<Note[]> {
  const describe = arm === "A" ? describeTogether : describeSeparately;
  const notes: Note[] = [];
  for (const frame of frames) {
    const read = await describe({ bytes: frame.bytes, contentType: frame.contentType, engine });
    notes.push({ face: frame.row.publicId, subject: "build", text: read.build });
    notes.push({ face: frame.row.publicId, subject: "skin", text: read.skin });
    say(`  ${arm} ${frame.row.publicId.slice(0, 8)}  build: ${read.build ?? "—"}`);
    say(`  ${arm} ${frame.row.publicId.slice(0, 8)}  skin:  ${read.skin ?? "—"}`);
  }
  return notes;
}

/* ── bar 1: the judge, one face and two notes ───────────────────────────── */

async function matches(arm: string, notes: Note[]): Promise<{ asked: number; right: number }> {
  let asked = 0;
  let right = 0;
  for (const subject of ["build", "skin"] as const) {
    const forSubject = notes.filter((note) => note.subject === subject && note.text !== null);
    for (let i = 0; i < forSubject.length; i += 1) {
      const mine = forSubject[i];
      const other = forSubject[(i + 1) % forSubject.length];
      if (other.face === mine.face || other.text === null) continue;
      const frame = frames.find((f) => f.row.publicId === mine.face)!;
      /* Order alternates by index rather than randomly, so the run is
         reproducible and a judge that always answers "1" is visible as 50%. */
      const first = i % 2 === 0 ? mine : other;
      const second = i % 2 === 0 ? other : mine;
      let reply;
      try {
        reply = await engine.complete({
        system: [
          "You are shown one photograph and two short casting notes about a person's",
          `${subject === "build" ? "build (frame and shoulder line)" : "skin (tone and surface)"}.`,
          "Exactly one of them was written about THIS photograph. Choose it.",
          'Reply with JSON: {"choice": 1} or {"choice": 2} and nothing else.',
        ].join("\n"),
        user: `1. ${first.text}\n2. ${second.text}`,
        images: [{ bytes: frame.bytes, contentType: frame.contentType }],
        json: true,
        temperature: 0,
          maxOutputTokens: 600,
        });
      } catch (error) {
        /* A judgement that never arrived is a MISS, recorded — an exception
           here would end the run on the transport rather than on the bar. */
        say(`  ${arm} match ${subject} ${mine.face.slice(0, 8)} → judge failed: ${(error as Error).message}`);
        asked += 1;
        continue;
      }
      asked += 1;
      let choice: number | null = null;
      try {
        choice = JSON.parse(reply.text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()).choice;
      } catch { /* an unreadable judgement is a miss, not a crash */ }
      const correct = (choice === 1 && first === mine) || (choice === 2 && second === mine);
      if (correct) right += 1;
      say(`  ${arm} match ${subject} ${mine.face.slice(0, 8)} → chose ${choice ?? "?"} ${correct ? "✓" : "✗"}`);
    }
  }
  return { asked, right };
}

/* ── bar 2: containment, with its swapped-pair control ──────────────────── */

async function blurs(build: string, skin: string): Promise<{ buildBlurs: boolean; skinBlurs: boolean } | null> {
  let reply;
  try {
    reply = await engine.complete({
    system: [
      "Two casting notes. Note A should describe ONLY a person's build — their frame,",
      "their shoulder line. Note B should describe ONLY their skin — its tone, its surface.",
      "Say whether either note describes the OTHER note's subject.",
      'Reply with JSON: {"aDescribesSkin": true|false, "bDescribesBuild": true|false}.',
    ].join("\n"),
    user: `A. ${build}\nB. ${skin}`,
    json: true,
    temperature: 0,
      maxOutputTokens: 600,
    });
  } catch {
    /* null is "the judge did not answer", which is not the same as "no blur" —
       a failed instrument must not read as a pass. */
    return null;
  }
  try {
    const parsed = JSON.parse(reply.text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim());
    return { buildBlurs: parsed.aDescribesSkin === true, skinBlurs: parsed.bDescribesBuild === true };
  } catch {
    return null;
  }
}

const control2 = await blurs(
  "warm olive skin, freckled across the nose and cheeks",
  "broad through the shoulders, athletic frame",
);
say("");
say(`bar 2 judge control — deliberately swapped pair → ${control2 === null ? "NO VERDICT" : `aDescribesSkin ${control2.buildBlurs} · bDescribesBuild ${control2.skinBlurs}`}`);
if (!control2 || !control2.buildBlurs || !control2.skinBlurs) {
  throw new Error("the containment judge did not catch a swapped pair — its passes would mean nothing");
}

/* ── the run ────────────────────────────────────────────────────────────── */

const results: Record<string, any> = {};
for (const arm of ["A", "B"] as const) {
  say("");
  say(`── arm ${arm} — ${arm === "A" ? "one read, both descriptions" : "one read each"}`);
  const notes = await runArm(arm);

  const coverage = {
    build: notes.filter((n) => n.subject === "build" && n.text !== null).length,
    skin: notes.filter((n) => n.subject === "skin" && n.text !== null).length,
  };
  const crop = notes.filter((n) => n.text !== null && BELOW_THE_CROP.test(n.text));

  let blurred = 0;
  for (const frame of frames) {
    const build = notes.find((n) => n.face === frame.row.publicId && n.subject === "build")?.text;
    const skin = notes.find((n) => n.face === frame.row.publicId && n.subject === "skin")?.text;
    if (!build || !skin) continue;
    const verdict = await blurs(build, skin);
    if (verdict === null || verdict.buildBlurs || verdict.skinBlurs) {
      blurred += 1;
      say(`  ${arm} BLUR ${frame.row.publicId.slice(0, 8)} — ${verdict === null ? "judge gave no verdict, counted against the arm" : "build↔skin"}`);
    }
  }

  say("");
  const match = await matches(arm, notes);

  results[arm] = { coverage, crop: crop.map((n) => n.text), blurred, match, notes };
  say("");
  say(`  arm ${arm} · bar 0 coverage build ${coverage.build}/${FACES} skin ${coverage.skin}/${FACES}`
    + ` · bar 1 discrimination ${match.right}/${match.asked}`
    + ` · bar 2 blurs ${blurred}`
    + ` · bar 3 crop mentions ${crop.length}`);
}

/* ── the verdict ────────────────────────────────────────────────────────── */

function passes(arm: string): boolean {
  const r = results[arm];
  return r.coverage.build >= FACES - 1
    && r.coverage.skin >= FACES - 1
    && r.match.right >= 10
    && r.blurred === 0
    && r.crop.length === 0;
}

say("");
say("── VERDICT");
for (const arm of ["A", "B"]) say(`  arm ${arm}: ${passes(arm) ? "PASS" : "FAIL"}`);
const winner = passes("A") ? "A" : passes("B") ? "B" : "neither";
say(`  → ${winner === "neither" ? "NEITHER ARM PASSES — the row does not ship" : `arm ${winner} (tie goes to A, half the calls)`}`);

writeFileSync(`${OUT}/bench.txt`, lines.join("\n"), "utf8");
writeFileSync(`${OUT}/bench.json`, JSON.stringify(results, null, 2), "utf8");
say("");
say(`written to ${OUT}/`);

/* The suite's own rule: a script ends by ending the process, so a lingering
   transport handle cannot hold a run open. */
process.exit(0);
