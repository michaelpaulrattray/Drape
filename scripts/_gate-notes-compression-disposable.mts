/**
 * THE MEASUREMENT GATE ON THE COMPRESSION RE-ASK — ordered fable-1415 (c),
 * BEFORE it ships.
 *
 * *"Drive the re-ask on the two real production specimens (rolls 128/129's
 * stored notes) plus roll 81's — three cells, free-ish — and show the
 * compressed notes keep the ink and the cornrows. If compression eats the ink
 * anyway, STOP and bring the cap-raise option with that reading; do not ship a
 * re-ask that fails its own motivating specimens."*
 *
 * # WHAT IS DRIVEN, AND WHY IT IS THE BRIEF RATHER THAN THE STORED NOTES
 *
 * The stored notes ARE the damage — 180 characters ending mid-word, with the
 * ink already gone. Compressing those would be compressing the evidence. What
 * has to be driven is the road a real roll takes: the brief through the REAL
 * interpreter, its over-long answer through the REAL compression, and the line
 * that comes out the other end.
 *
 * So the brief goes through the real reader, and its over-long answer through
 * the real compression.
 *
 * ⚠ **THE VERDICT IS RAW-versus-COMPRESSED, NOT COMPRESSED-versus-A-WISHLIST**,
 * and the first draft of this script got that wrong. It called `interpretBrief`
 * and asked whether the final line mentioned cornrows — which scores THE
 * INTERPRETER, not the compression: roll 85's own fitting answer never
 * mentioned cornrows either, so a "LOST" verdict there would have convicted the
 * re-ask of a choice made one step upstream.
 *
 * So the two steps are driven explicitly, both with the real pieces: the real
 * interpreter engine under the real system prompt for the raw line, then the
 * real compression on it. **A fact is only LOST if the raw line had it and the
 * compressed line does not.**
 *
 * ⚠ THE INTERPRETER IS STOCHASTIC. A reply that happens to FIT never reaches
 * the compression, and that cell is reported as not-exercised rather than
 * counted either way.
 *
 * It spends: three interpreter calls plus up to three compressions, on
 * OpenRouter, at classify prices. No credits, no image, no database write.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/_gate-notes-compression-disposable.mts
 */
import "dotenv/config";

import { openDatabase } from "./lib/dbConnection.mts";
import { NOTES_MAX, parseCastingIntent } from "../server/castingV2/castingIntent";
import {
  compressCharacterNotes,
  interpreterEngine,
  interpreterSystemPrompt,
} from "../server/castingV2/interpreter";

/** What each specimen must still be able to say after compression. */
const CELLS = [
  { roll: 128, world: "production", must: [/tattoo/i, /cornrow|braid/i] },
  { roll: 129, world: "production", must: [/tattoo/i, /cornrow|braid/i] },
  { roll: 81, world: "dev", must: [/tattoo/i, /cornrow|braid/i] },
];

const databaseUrl = process.env.MYSQL_PUBLIC_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("no database URL");
const world = process.env.MYSQL_PUBLIC_URL ? "production" : "dev";
const connection = await openDatabase(databaseUrl);
console.log(`world ${world} — driving the cells this world holds\n`);

const wanted = CELLS.filter((cell) => cell.world === world);
if (wanted.length === 0) {
  console.log(`no cells for ${world}; run the other world too`);
  await connection.end();
  process.exit(0);
}

const [rows] = await connection.query<any[]>(
  `SELECT id, JSON_UNQUOTE(JSON_EXTRACT(compiledBrief,'$.briefText')) AS briefText
     FROM casting_rolls WHERE id IN (${wanted.map((one) => one.roll).join(",")})`,
);
await connection.end();

const failures: string[] = [];
let overflowed = 0;

const engine = interpreterEngine();
if (!engine) throw new Error("no OPENROUTER_API_KEY — this gate drives the real reader");

for (const cell of wanted) {
  const row = rows.find((one) => one.id === cell.roll);
  if (!row?.briefText) {
    failures.push(`roll ${cell.roll} is not in ${world} — the cell could not be driven`);
    continue;
  }
  console.log(`── roll ${cell.roll} · brief ${String(row.briefText).length} chars`);

  /* STEP ONE, the real reader under the real prompt.
     Retried on TRANSPORT alone — this brief takes ~40s and the engine's own
     ceiling bites. A transport failure is not a reading, and a gate that
     reports one as a cell would be filing the provider's bad minute as a fact
     about the compression. */
  let reply: Awaited<ReturnType<typeof engine.complete>> | null = null;
  for (let attempt = 0; attempt < 3 && reply === null; attempt += 1) {
    try {
      reply = await engine.complete({
        about: "interpret",
        system: interpreterSystemPrompt(),
        user: String(row.briefText),
        json: true,
        temperature: 0.2,
        maxOutputTokens: 5000,
      });
    } catch (error) {
      console.log(`   (attempt ${attempt + 1} failed at the transport: ${String(error).slice(0, 70)})`);
    }
  }
  if (reply === null) {
    failures.push(`roll ${cell.roll}: the interpreter could not be reached in three attempts`);
    continue;
  }
  const parsed = parseCastingIntent(reply.text, String(row.briefText));
  if (!parsed.ok) {
    failures.push(`roll ${cell.roll}: the interpreter answered ${parsed.reason}`);
    continue;
  }
  /* fable-1416's attached check: if the hair lane holds the braids, the notes
     field triaging styling out is correct ROUTING rather than a loss. */
  console.log(`   statedHair: ${JSON.stringify(parsed.intent.statedHair)}`);
  const raw = parsed.notes.raw ?? "";
  console.log(`   RAW ${raw.length} chars: ${JSON.stringify(raw)}`);
  if (parsed.notes.overflow === 0) {
    console.log("   (this reply FIT — the overflow branch does not run on this sample)\n");
    continue;
  }
  overflowed += 1;
  console.log(`   over by ${parsed.notes.overflow}`);

  /* STEP TWO, the real compression on that line. */
  const compressed = await compressCharacterNotes({ notes: raw, max: NOTES_MAX, engine });
  if (compressed === null) {
    failures.push(`roll ${cell.roll}: the compression returned nothing usable`);
    continue;
  }
  console.log(`   COMPRESSED ${compressed.length} chars: ${JSON.stringify(compressed)}`);
  console.log(`   fits: ${compressed.length <= NOTES_MAX}`);
  if (compressed.length > NOTES_MAX) {
    failures.push(`roll ${cell.roll}: the compressed line is STILL over (${compressed.length})`);
  }

  for (const must of cell.must) {
    const inRaw = must.test(raw);
    const inShort = must.test(compressed);
    if (!inRaw) {
      /* The interpreter never said it. Not the compression's to lose, and
         scoring it here would convict the wrong step. */
      console.log(`   n/a   ${must} — the raw line never said it`);
      continue;
    }
    console.log(`   ${inShort ? "KEEPS" : "LOST "} ${must}`);
    if (!inShort) {
      failures.push(`roll ${cell.roll}: compression LOST ${must} — ${JSON.stringify(compressed)}`);
    }
  }
  console.log("");
}

console.log(`cells that exercised the overflow branch: ${overflowed} of ${wanted.length}`);
if (overflowed === 0) {
  console.log(
    "\nNOT A READING — no cell overflowed, so nothing here says anything about the\n"
    + "compression. Re-run, or the specimens have stopped overflowing and that is\n"
    + "itself the finding.",
  );
  process.exit(2);
}
console.log(failures.length === 0
  ? "\nGATE PASSED — every exercised cell kept its ink and its hair."
  : `\nGATE FAILED — ${failures.length}:\n  · ${failures.join("\n  · ")}`);
process.exit(failures.length === 0 ? 0 : 1);
