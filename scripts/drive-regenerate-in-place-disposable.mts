/**
 * REGENERATE IN PLACE — the four arms, driven. (Founder ruling 2026-08-15,
 * design note ratified in fable-573; arm 5 is 573 §3.)
 *
 * > *"Just allow a refresh or regeneration of the same edit which essentially
 * > produces no extra version"* — and the trade he confirmed: *"you can
 * > regenerate it without causing extra clutter."*
 *
 * ```
 * 1  a re-ask REPLACES in place      one chip before, one chip after, new picture
 * 2  a DIFFERENT ask still appends   the rail grows; nothing is swallowed
 * 3  a fork from a SUPERSEDED take   still resolves its own chain
 * 4  the money moves exactly once    read at the LEDGER, per render
 * 5  step-back-then-re-ask APPENDS   a different parent is a different chip
 * ```
 *
 * Arm 3 is the dangerous one: the older take is meant to be INVISIBLE, not
 * absent, and a fork made from it must still resolve. It is read rather than
 * rendered — the fork already exists in the chain — so it costs nothing.
 *
 * Money is read at the ledger before and after every render, because a claim
 * about money is measured in money.
 *
 * ~3 paid renders (75 dev credits) + ~3 house generations. Dev only.
 *
 *   pnpm dev            (or a server on PROBE_BASE_URL)
 *   npx tsx scripts/drive-regenerate-in-place-disposable.mts
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

import { openDatabase } from "./lib/dbConnection.mts";
import { ensureOutsider } from "./lib/outsider.mts";

const OUT = "output/regenerate-in-place";
mkdirSync(OUT, { recursive: true });
const lines: string[] = [];
const say = (line = "") => { console.log(line); lines.push(line); };
const records: { ok: boolean; name: string; saw: string }[] = [];
const check = (ok: boolean, name: string, saw: string) => {
  records.push({ ok, name, saw });
  say(`${ok ? "PASS" : "FAIL"}  ${name} — saw ${saw}`);
};

const outsider = await ensureOutsider();
const conn = await openDatabase(process.env.DATABASE_URL);
const balance = async () => {
  const [rows] = await conn.execute(`SELECT balance FROM points WHERE userId = ?`, [outsider.id]);
  return (rows as Array<{ balance: number }>)[0]!.balance;
};

/** Her cast with a chain on it — the one the take-back probe built. */
const [candidates] = await conn.execute(
  `SELECT c.publicId, COUNT(v.id) AS versions
     FROM casting_candidates c LEFT JOIN casting_candidate_variants v ON v.candidateId = c.id
    WHERE c.userId = ? AND c.status = 'ready'
    GROUP BY c.id ORDER BY versions DESC, c.id DESC LIMIT 1`,
  [outsider.id],
);
const candidatePublicId = (candidates as Array<{ publicId: string }>)[0]!.publicId;

const { refineCandidate } = await import("../server/castingV2/refineService.js");
const { listCandidateVariants } = await import("../server/db/castingV2Variants.js");
const { declaredTakes, takeShownFor } = await import("../server/castingV2/railTakes.js");
const { readRegeneratedFrom, readStepDeltas } = await import("../server/castingV2/refineService.js");

/** The rail as the client would see it — the same derivation the projection runs. */
async function rail() {
  const rows = await listCandidateVariants(outsider.id, candidatePublicId);
  const { live, supersededBy } = declaredTakes(rows.map((row) => ({
    publicId: row.publicId,
    regeneratedFrom: readRegeneratedFrom(row.internalPrompt),
    row,
  })));
  return { rows, live, supersededBy };
}

const spends: { kind: string; spent: number }[] = [];

async function ask(instruction: string, answering?: string) {
  const before = await balance();
  const started = Date.now();
  const result = await refineCandidate({}, {
    userId: outsider.id,
    clientRequestId: randomUUID(),
    candidatePublicId,
    instruction,
    ...(answering ? { answering } : {}),
  });
  const after = await balance();
  say(`  "${instruction}" → ${result.kind} · ${after - before === 0 ? "free" : `${before - after} credits`}`
    + ` · ${Math.round((Date.now() - started) / 1000)}s`);
  spends.push({ kind: result.kind ?? "?", spent: before - after });
  return { result, spent: before - after };
}


const REPEATED = "give her a thin silver chain necklace";
const OTHER = "make her hair jet black";

say("=".repeat(78));
say(`cast ${candidatePublicId} · outsider ${outsider.id}`);

/* ---- arm 1: the offer, then the re-roll in place ---------------------- */
say("");
say("ARM 1 — the same ask twice, and the offer between them");
const first = await ask(REPEATED);
const afterFirst = await rail();
const chipsAfterFirst = afterFirst.live.length;
const firstTakeId = afterFirst.live.at(-1)!.publicId;

const offered = await ask(REPEATED);
check(
  offered.result.kind === "asked" && offered.result.reask?.kind === "same-again",
  "the same ask again OFFERS a fresh take rather than refusing",
  `${offered.result.kind} · ${offered.result.reask?.question ?? "no question"}`,
);
check(offered.spent === 0, "and the offer itself costs nothing", `${offered.spent} credits`);
check(
  (offered.result.reask?.question ?? "").includes(`${25} credits`),
  "with the price in the question, before the money",
  offered.result.reask?.question ?? "no question",
);

const yes = offered.result.reask!.options[0]!;
const second = await ask(yes.label, offered.result.reask!.about ?? REPEATED);
const afterSecond = await rail();

check(second.result.kind === "rendered", "saying yes renders", `${second.result.kind}`);
check(
  afterSecond.live.length === chipsAfterFirst,
  "a re-roll leaves the rail the same length",
  `${chipsAfterFirst} chips before, ${afterSecond.live.length} after`,
);
check(
  afterSecond.supersededBy.get(firstTakeId) !== undefined,
  "the older take is superseded, and by the newer one",
  `${firstTakeId.slice(0, 8)} → ${(afterSecond.supersededBy.get(firstTakeId) ?? "nothing").slice(0, 8)}`,
);
check(
  afterSecond.rows.length === afterFirst.rows.length + 1,
  "and the row is still THERE — invisible, not absent",
  `${afterFirst.rows.length} rows before, ${afterSecond.rows.length} after`,
);
/*
  ARM 4, IN ITS HONEST SHAPE. The first version asserted "the first ask spent
  something" and tripped on a run where the first ask was itself an OFFER (the
  previous run had left that necklace on her, free) — a fact about the fixture's
  state, not about the money. What the arm means is: a rendered outcome costs
  the price, and a question costs nothing.
*/
check(
  spends.every((call) => (call.kind === "rendered" ? call.spent === 25 : call.spent === 0)),
  "arm 4 — every render cost the price, every question cost nothing",
  spends.map((call) => `${call.kind}:${call.spent}`).join(" · "),
);

/* ---- arm 3: a fork from the superseded take still resolves ------------ */
const superseded = afterSecond.rows.find((row) => row.publicId === firstTakeId);
check(
  superseded !== undefined && readStepDeltas(superseded.stepDeltas).length > 0,
  "arm 3 — the superseded take's own chain still reads",
  superseded ? `${readStepDeltas(superseded.stepDeltas).length} steps` : "the row is gone",
);
check(
  takeShownFor(firstTakeId, afterSecond.supersededBy) !== firstTakeId,
  "and a selection pointing at it resolves to the take on screen",
  `${firstTakeId.slice(0, 8)} → ${(takeShownFor(firstTakeId, afterSecond.supersededBy) ?? "").slice(0, 8)}`,
);

/* ---- arm 2: a different ask appends ----------------------------------- */
say("");
say("ARM 2 — a different ask");
const third = await ask(OTHER);
const afterThird = await rail();
check(
  afterThird.live.length === afterSecond.live.length + 1,
  "a different ask still appends — nothing is swallowed",
  `${afterSecond.live.length} chips before, ${afterThird.live.length} after`,
);
check(third.spent > 0, "and it is paid for like any render", `${third.spent} credits`);

say("");
say("=".repeat(78));
const failed = records.filter((row) => !row.ok);
say(`${records.length - failed.length}/${records.length}`);
say(`ledger: ${await balance()} credits left`);
writeFileSync(`${OUT}/run.txt`, `${lines.join("\n")}\n`);
writeFileSync(`${OUT}/checks.json`, `${JSON.stringify(records, null, 2)}\n`);
await conn.end();
process.exit(failed.length === 0 ? 0 : 1);
