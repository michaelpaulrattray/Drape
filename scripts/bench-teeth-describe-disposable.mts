/**
 * THE THIRD QUESTION — fable-402 §2's bench, and the fixture problem it walked
 * into.
 *
 * # What is being decided
 *
 * `teeth` is the third row in the catalogue that draws itself and can never be
 * photographed (`question.from: "none"` — *"that question is the mouth, so a
 * crop of it filed as her teeth is the lips' crop under a second name"*).
 * build and skin were filled with words; teeth was held out with a written
 * reason, because the shipped reader was MEASURED on two questions and a third
 * makes it a reader nobody measured. fable-402: *"a small second bench (same
 * bars, three questions) before teeth joins, or a ruling that the row stays
 * empty."*
 *
 * # THE POPULATION IS THE MEASUREMENT, and this world has no smiles
 *
 * Twelve dev masters were dumped and read BY EYE before anything was asked of a
 * model: twelve closed mouths, no teeth anywhere. That is not sampling luck.
 * `cohortPhotorealHuman.ts` says it twice, in a block appended last with
 * override authority:
 *
 *   "Shoulders level, spine straight, neck relaxed. Arms relaxed at the sides.
 *    Mouth closed."
 *   "Mouth closed, lips together and relaxed. A faint closed-mouth warmth is
 *    welcome …; a broad smile is not."
 *
 * And no variant in the world has ever asked about a smile, a grin, a laugh, a
 * mouth or teeth (0 of 42, against a positive control of 28 mentioning hair).
 *
 * So an all-null teeth column would be UNFALSIFIABLE on product frames alone —
 * exactly the shape this campaign has been burned by: a clean null that is
 * indistinguishable from a reader that cannot answer at all. The population is
 * therefore two strata:
 *
 *   NEGATIVE  every distinct dev master (deduped by imageKey — two fixture
 *             candidates share one object byte-for-byte), all closed-mouth.
 *             This is where an INVENTED sentence would show up.
 *   POSITIVE  three SYNTHETIC smiling portraits, generated for this bench and
 *             declared as fixtures. They are not product frames and no claim
 *             about the product rests on them. They exist so that "null
 *             everywhere" can be told apart from "blind".
 *
 * # THE BARS, WRITTEN BEFORE THE FIRST CALL
 *
 * ```
 * 0 REGRESSION      on the comparison set, arm 3Q keeps build ≥5/6 and skin
 *                   ≥5/6 non-null — the shipped guarantee, undamaged.
 * 1 DISCRIMINATION  arm 3Q ≥10 of 12 matched on build+skin (chance 6). The
 *                   shipped arm's own bar, re-earned by the reader that would
 *                   actually ship. Arm 2Q runs beside it on the same faces and
 *                   the same day, so a drop is attributable to the third
 *                   question rather than to the weather.
 * 2 CONTAINMENT     0 of the notes describes another note's subject, across
 *                   all three pairs. The teeth-shaped failure is a line about
 *                   her LIPS filed as a line about her teeth — the catalogue's
 *                   own reason for refusing teeth a picture, in words.
 * 3 CROP HONESTY    0 mentions of a waist, hips, legs or height.
 * 4 NO INVENTION    teeth is null on EVERY closed-mouth product frame. One
 *                   invented line fails the whole bench: a sentence about
 *                   teeth nobody can see, written under her own face, is the
 *                   defect the describer's own header forbids.
 * 5 CAN BE ANSWERED teeth is non-null on ≥2 of the 3 smiling fixtures AND ≥2
 *                   of 3 matched by a judge shown one photograph and two teeth
 *                   notes. Without this, bar 4 is a blind reader passing.
 * ```
 *
 * Every judge is an instrument and gets a control that must fire: the
 * containment judge is shown a deliberately swapped triple, the crop checker a
 * planted waist, and the teeth judge is only asked about frames that visibly
 * have teeth.
 *
 * FREE: text/vision calls only. No renders, no credits, no database writes.
 *
 *   npx tsx scripts/bench-teeth-describe-disposable.mts
 */
import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { storageReadBytes } from "../server/storage";
import { describeTogether, describeWithTeeth } from "../server/castingV2/faceDescribe";
import { interpreterEngine } from "../server/castingV2/interpreter";

const COMPARE = Number(process.env.COMPARE ?? 6);
const OUT = "output/teeth-bench";
mkdirSync(OUT, { recursive: true });

/* The synthetic positives, generated for this bench and named as such. */
const FIXTURES = [
  { file: `${OUT}/fixtures/smile-01-even-upper-teeth-casting-v1.png`, eye: "broad open smile, even bright upper teeth" },
  { file: `${OUT}/fixtures/smile-02-central-diastema-casting-v1.png`, eye: "broad open smile, small gap between the upper front teeth" },
  { file: `${OUT}/fixtures/smile-03-crowded-upper-teeth-casting-v1.png`, eye: "broad open smile, slightly uneven warmer upper teeth" },
];

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);
const databaseUrl = process.env[databaseKey];
if (!databaseUrl) throw new Error("no database URL");
const where = new URL(databaseUrl.replace(/^mysql:/, "http:"));

const engine = interpreterEngine();
if (!engine) throw new Error("no text transport (OPENROUTER_API_KEY) — every arm would answer null");

const lines: string[] = [];
function say(line = "") {
  console.log(line);
  lines.push(line);
}

say(`WORLD: ${databaseKey} → ${where.hostname}:${where.port}`);
say("TEETH BENCH — two arms, six bars, two strata. The bars are in the header.");
say("");

/* ── the population ─────────────────────────────────────────────────────── */

const connection = await openDatabase(databaseUrl);
const [pool] = await connection.query<any[]>(
  `SELECT id, publicId, imageKey FROM casting_candidates
    WHERE userId = 1 AND status = 'ready' AND imageKey IS NOT NULL
    ORDER BY id ASC`,
);
await connection.end();

/*
  DEDUPED BY OBJECT, NOT BY ROW. #360 and #361 are two candidate rows pointing
  at one fixture object, byte-identical — a judge asked to tell them apart would
  miss for a reason that has nothing to do with the reader.
*/
const byKey = new Map<string, any>();
for (const row of pool) if (!byKey.has(row.imageKey)) byKey.set(row.imageKey, row);
const distinct = Array.from(byKey.values());
say(`pool ${pool.length} ready masters · ${distinct.length} distinct objects (${pool.length - distinct.length} duplicate row(s) dropped)`);

const step = (distinct.length - 1) / (COMPARE - 1);
const comparison = Array.from({ length: COMPARE }, (_, i) => distinct[Math.round(i * step)]);
say(`comparison set (${COMPARE}, evenly across the pool): ${comparison.map((r) => r.publicId.slice(0, 8)).join(" ")}`);
say(`negative stratum (every distinct master): ${distinct.length} frames, all read by eye as closed-mouth`);
say("");

type Frame = { name: string; bytes: Buffer; contentType: string; synthetic: boolean };

const realFrames: Frame[] = await Promise.all(distinct.map(async (row) => {
  const frame = await storageReadBytes(row.imageKey);
  return {
    name: row.publicId.slice(0, 8),
    bytes: frame.bytes,
    contentType: frame.contentType ?? "image/png",
    synthetic: false,
  };
}));
const comparisonFrames = comparison.map((row) => realFrames.find((f) => f.name === row.publicId.slice(0, 8))!);
const smileFrames: Frame[] = FIXTURES.map((fixture) => ({
  name: fixture.file.split("/").pop()!.slice(0, 8),
  bytes: readFileSync(fixture.file),
  contentType: "image/png",
  synthetic: true,
}));

/* ── bar 3's checker, and its positive control ──────────────────────────── */

const BELOW_THE_CROP = /\b(waist|waistline|hips?|midriff|legs?|thighs?|height|tall|short in stature|full[- ]length)\b/i;
const control3 = BELOW_THE_CROP.test("slim through the waist, long legs");
say(`bar 3 checker control — planted "slim through the waist, long legs" → ${control3 ? "CAUGHT" : "MISSED"}`);
if (!control3) throw new Error("the crop checker cannot fail — nothing it passes means anything");

/* ── bar 2: containment across three subjects, with its swapped control ─── */

async function blurs(notes: { build: string; skin: string; teeth: string | null }): Promise<
  { buildBlurs: boolean; skinBlurs: boolean; teethBlurs: boolean } | null
> {
  let reply;
  try {
    reply = await engine!.complete({
      system: [
        "Three casting notes about one person.",
        "Note A should describe ONLY her build — her frame, her shoulder line.",
        "Note B should describe ONLY her skin — its tone, its surface.",
        "Note C should describe ONLY her teeth — the teeth themselves, not her lips,",
        "not her mouth, not her smile.",
        "Say whether any note describes a subject that belongs to one of the others.",
        'Reply with JSON: {"aDescribesOther": true|false, "bDescribesOther": true|false, "cDescribesOther": true|false}.',
      ].join("\n"),
      user: `A. ${notes.build}\nB. ${notes.skin}\nC. ${notes.teeth ?? "(no note)"}`,
      json: true,
      temperature: 0,
      maxOutputTokens: 600,
    });
  } catch {
    /* A judge that did not answer is not a pass — this campaign has paid for
       that confusion before. */
    return null;
  }
  try {
    const parsed = JSON.parse(reply.text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim());
    return {
      buildBlurs: parsed.aDescribesOther === true,
      skinBlurs: parsed.bDescribesOther === true,
      teethBlurs: parsed.cDescribesOther === true,
    };
  } catch {
    return null;
  }
}

const control2 = await blurs({
  build: "warm olive skin, freckled across the nose and cheeks",
  skin: "broad through the shoulders, athletic frame",
  teeth: "full lips, a wide relaxed mouth",
});
say(`bar 2 judge control — deliberately swapped triple → ${control2 === null ? "NO VERDICT" : `a ${control2.buildBlurs} · b ${control2.skinBlurs} · c ${control2.teethBlurs}`}`);
if (!control2 || !control2.buildBlurs || !control2.skinBlurs || !control2.teethBlurs) {
  throw new Error("the containment judge did not catch a swapped triple — its passes would mean nothing");
}

/* ── bar 1 and bar 5: the matching judge ────────────────────────────────── */

const SUBJECT_WORDS: Record<string, string> = {
  build: "build (frame and shoulder line)",
  skin: "skin (tone and surface)",
  teeth: "teeth",
};

type Note = { face: string; subject: "build" | "skin" | "teeth"; text: string | null };

async function matches(
  label: string,
  notes: Note[],
  subjects: readonly ("build" | "skin" | "teeth")[],
  frames: Frame[],
): Promise<{ asked: number; right: number }> {
  let asked = 0;
  let right = 0;
  for (const subject of subjects) {
    const forSubject = notes.filter((note) => note.subject === subject && note.text !== null);
    for (let i = 0; i < forSubject.length; i += 1) {
      const mine = forSubject[i];
      const other = forSubject[(i + 1) % forSubject.length];
      if (other.face === mine.face || other.text === null) continue;
      const frame = frames.find((f) => f.name === mine.face)!;
      /* Alternating rather than random, so the run reproduces and a judge that
         always answers "1" reads as 50%. */
      const first = i % 2 === 0 ? mine : other;
      const second = i % 2 === 0 ? other : mine;
      let reply;
      try {
        reply = await engine!.complete({
          system: [
            `You are shown one photograph and two short casting notes about a person's ${SUBJECT_WORDS[subject]}.`,
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
        say(`  ${label} match ${subject} ${mine.face} → judge failed: ${(error as Error).message}`);
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
      say(`  ${label} match ${subject} ${mine.face} → chose ${choice ?? "?"} ${correct ? "✓" : "✗"}`);
    }
  }
  return { asked, right };
}

/* ── the arms, on the comparison set ────────────────────────────────────── */

const results: Record<string, any> = {};

for (const arm of ["2Q", "3Q"] as const) {
  say("");
  say(`── arm ${arm} — ${arm === "2Q" ? "the shipped reader, build + skin" : "the candidate reader, build + skin + teeth"}`);
  const notes: Note[] = [];
  for (const frame of comparisonFrames) {
    const read = arm === "2Q"
      ? { ...await describeTogether(frame), teeth: null as string | null }
      : await describeWithTeeth(frame);
    notes.push({ face: frame.name, subject: "build", text: read.build });
    notes.push({ face: frame.name, subject: "skin", text: read.skin });
    notes.push({ face: frame.name, subject: "teeth", text: read.teeth });
    say(`  ${arm} ${frame.name}  build: ${read.build ?? "—"}`);
    say(`  ${arm} ${frame.name}  skin:  ${read.skin ?? "—"}`);
    say(`  ${arm} ${frame.name}  teeth: ${read.teeth ?? "—"}`);
  }

  const coverage = {
    build: notes.filter((n) => n.subject === "build" && n.text !== null).length,
    skin: notes.filter((n) => n.subject === "skin" && n.text !== null).length,
    teeth: notes.filter((n) => n.subject === "teeth" && n.text !== null).length,
  };
  const crop = notes.filter((n) => n.text !== null && BELOW_THE_CROP.test(n.text));

  let blurred = 0;
  for (const frame of comparisonFrames) {
    const build = notes.find((n) => n.face === frame.name && n.subject === "build")?.text;
    const skin = notes.find((n) => n.face === frame.name && n.subject === "skin")?.text;
    const teeth = notes.find((n) => n.face === frame.name && n.subject === "teeth")?.text ?? null;
    if (!build || !skin) continue;
    const verdict = await blurs({ build, skin, teeth });
    if (verdict === null || verdict.buildBlurs || verdict.skinBlurs || verdict.teethBlurs) {
      blurred += 1;
      say(`  ${arm} BLUR ${frame.name} — ${verdict === null ? "judge gave no verdict, counted against the arm" : JSON.stringify(verdict)}`);
    }
  }

  say("");
  const match = await matches(arm, notes, ["build", "skin"], comparisonFrames);

  results[arm] = { coverage, crop: crop.map((n) => n.text), blurred, match, notes };
  say("");
  say(`  arm ${arm} · bar 0 coverage build ${coverage.build}/${COMPARE} skin ${coverage.skin}/${COMPARE}`
    + ` · bar 1 discrimination ${match.right}/${match.asked}`
    + ` · bar 2 blurs ${blurred}`
    + ` · bar 3 crop mentions ${crop.length}`
    + ` · teeth non-null ${coverage.teeth}/${COMPARE}`);
}

/* ── bar 4: no invention, over EVERY distinct closed-mouth product frame ── */

say("");
say(`── bar 4 — NO INVENTION, arm 3Q over all ${realFrames.length} closed-mouth masters`);
const invented: { face: string; text: string }[] = [];
const negativeNotes: Note[] = [];
for (const frame of realFrames) {
  /* The comparison set was already read by 3Q; re-reading it here would pay
     twice for the same answer and, worse, would let two different reads of one
     frame disagree in the record. */
  const already = results["3Q"].notes.find((n: Note) => n.face === frame.name && n.subject === "teeth");
  const teeth = already !== undefined ? already.text : (await describeWithTeeth(frame)).teeth;
  negativeNotes.push({ face: frame.name, subject: "teeth", text: teeth });
  say(`  ${frame.name}  teeth: ${teeth ?? "null"}${already !== undefined ? "  (from the arm run)" : ""}`);
  if (teeth !== null) invented.push({ face: frame.name, text: teeth });
}

/* ── bar 5: the positive control — can this reader answer at all? ───────── */

say("");
say("── bar 5 — CAN BE ANSWERED, arm 3Q over three SYNTHETIC smiling fixtures");
say("   (declared: these are not product frames; they exist so an all-null column can be told from a blind reader)");
const smileNotes: Note[] = [];
for (const [index, frame] of smileFrames.entries()) {
  const read = await describeWithTeeth(frame);
  smileNotes.push({ face: frame.name, subject: "teeth", text: read.teeth });
  say(`  ${FIXTURES[index].file.split("/").pop()}`);
  say(`     my eye: ${FIXTURES[index].eye}`);
  say(`     reader: ${read.teeth ?? "null"}`);
}
const answered = smileNotes.filter((n) => n.text !== null).length;
say("");
const smileMatch = await matches("smile", smileNotes, ["teeth"], smileFrames);

/* ── the verdict ────────────────────────────────────────────────────────── */

const three = results["3Q"];
const bars = {
  "0 regression":   three.coverage.build >= COMPARE - 1 && three.coverage.skin >= COMPARE - 1,
  "1 discrimination": three.match.right >= 10,
  "2 containment":  three.blurred === 0,
  "3 crop honesty": three.crop.length === 0,
  "4 no invention": invented.length === 0,
  "5 can be answered": answered >= 2 && smileMatch.right >= 2,
};

say("");
say("── VERDICT");
say(`  arm 2Q (shipped, beside it on the same day): build ${results["2Q"].coverage.build}/${COMPARE}`
  + ` skin ${results["2Q"].coverage.skin}/${COMPARE} · discrimination ${results["2Q"].match.right}/${results["2Q"].match.asked}`
  + ` · blurs ${results["2Q"].blurred}`);
for (const [bar, passed] of Object.entries(bars)) say(`  bar ${bar}: ${passed ? "PASS" : "FAIL"}`);
say(`  invented teeth lines on closed mouths: ${invented.length}`);
say(`  teeth answered on smiling fixtures: ${answered}/3 · matched ${smileMatch.right}/${smileMatch.asked}`);
const all = Object.values(bars).every(Boolean);
say("");
say(`  → ${all ? "ALL BARS PASS — the three-question reader is measured and safe to join" : "A BAR FAILED — teeth stays in NOT_DESCRIBED with its reason"}`);
say("");
say("  NOTE, separate from the bars: every frame this product casts today has a");
say("  closed mouth by prompt law, so a passing teeth row would be empty on all");
say("  of them. That is a ruling about whether to carry the question at all, and");
say("  it is not something a bench can decide.");

writeFileSync(`${OUT}/bench.txt`, lines.join("\n"), "utf8");
writeFileSync(`${OUT}/bench.json`, JSON.stringify({ results, invented, negativeNotes, smileNotes, smileMatch, bars }, null, 2), "utf8");
say("");
say(`written to ${OUT}/`);

process.exit(0);
