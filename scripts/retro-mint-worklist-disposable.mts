/**
 * THE RETRO-MINT WORK LIST — the exact one, not the upper bound
 * (`RETRO_MINT_EVALUATION.md` §1's declared limit, and §5's second open item).
 *
 * # Why this runs before a line of the walker is written
 *
 * The evaluation sized the world at **24 variants** and said, in its own words,
 * that the number is *"an upper bound on variants, not a count of features owed
 * a crop"* — it does not subtract features that already have rows, and it does
 * not identify which variants delivered a feature whose kind had no slot at the
 * time. It named the fix and left it: *"the exact work list needs the delta
 * facets crossed with each row's `createdAt`… which is one more query and is the
 * first thing a build should compute rather than assume."*
 *
 * This is that query. A backfill built against 24 when the answer is 4 buys
 * gates, reports and reviewer attention for a world six times the real one; a
 * backfill built against 24 when the answer is 40 ships a silent cap.
 *
 * # It asks the OBSERVABLE question, not the promotion-date one
 *
 * "Was this kind promoted yet" is a fact about git history and it is a PROXY.
 * The thing it is a proxy FOR is observable in the database and is what actually
 * decides whether a feature drifts: **did this render deliver a feature that has
 * no crop on its branch?** A slot with no library row is carried by words alone
 * whatever the reason, and pre-promotion is only the commonest reason.
 *
 * That also makes the answer a superset rather than a guess, and every member of
 * it is a real instance of the founder's complaint.
 *
 * # Every derivation goes through the PRODUCT's own functions
 *
 * `readStoredDelta`, `facetsWrittenBy`, `slotsForFacet`, `accessoryKindOf` —
 * the same doors the mint and the recipe use. A script that re-implemented
 * "which slots does this delta touch" would be a second answer free to disagree
 * with the one that files the rows, which is the drift working law 4 is about
 * and would make this count fiction.
 *
 * Read-only. No render, no segmenter call, no credit, nothing written anywhere.
 * Prints host:port, because an empty result and a wrong database look identical.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/retro-mint-worklist-disposable.mts
 */
import { accessoryKindOf } from "../server/castingV2/accessoryKinds";
import { slotDefinition, slotsForFacet } from "../server/castingV2/referenceSlotCatalogue";
import { facetsWrittenBy, itemsOf, type RefineDelta } from "../server/castingV2/refineDelta";
import { readStoredDelta } from "../server/castingV2/refineLegacy";
import { openDatabase } from "./lib/dbConnection.mts";

const url = process.env.MYSQL_PUBLIC_URL;
if (!url) {
  console.error("REFUSING: MYSQL_PUBLIC_URL is not set. Run under `railway.cmd run --service MySQL`.");
  process.exit(1);
}
const where = new URL(url);
console.log(`world: PRODUCTION · ${where.hostname}:${where.port}`);
console.log("");

const connection = await openDatabase(url);

/* THE POSITIVE CONTROL, for the reason the scan-row read had one: a table that
   is missing and a table that is empty print the same zero. */
const [tables] = await connection.query<any[]>(
  `SELECT TABLE_NAME AS t FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN ('casting_candidate_variants','casting_reference_library')`,
);
const present = new Set(tables.map((row: any) => row.t));
console.log(`casting_candidate_variants present: ${present.has("casting_candidate_variants")}`);
console.log(`casting_reference_library  present: ${present.has("casting_reference_library")}`);
if (!present.has("casting_candidate_variants") || !present.has("casting_reference_library")) {
  console.error("REFUSING: a table this reading needs is absent.");
  process.exit(1);
}

type VariantRow = {
  id: number; publicId: string; candidateId: number; userId: number;
  parentVariantId: number | null; status: string;
  deltas: unknown; stepDeltas: unknown; createdAt: Date;
};
const [variants] = await connection.query<any[]>(
  `SELECT id, publicId, candidateId, userId, parentVariantId, status, deltas, stepDeltas, createdAt
     FROM casting_candidate_variants
    ORDER BY id`,
);
const [library] = await connection.query<any[]>(
  `SELECT id, candidateId, variantId, slot, role, tier, storageKey,
          refusedReason, refusedKind, refusedCoverage, retiredAt, createdAt
     FROM casting_reference_library
    ORDER BY id`,
);

console.log(`variants: ${variants.length} · library rows: ${library.length}`);
console.log("");

/* ── THE ANCESTRY, so "on this branch" means what it says ─────────────────── */
const byId = new Map<number, VariantRow>(variants.map((row: any) => [Number(row.id), row]));
/** Every variant id from this one back to the candidate, this one included. */
function lineageOf(id: number): number[] {
  const chain: number[] = [];
  let at: number | null = id;
  const guard = new Set<number>();
  while (at !== null && !guard.has(at)) {
    guard.add(at);
    chain.push(at);
    at = byId.get(at)?.parentVariantId ?? null;
    if (at !== null) at = Number(at);
  }
  return chain;
}

/** Slots the library holds for a candidate, by the variant that minted them.
 *  `null` variantId is the master's own row and belongs to every branch. */
type Held = {
  slot: string; variantId: number | null; role: string;
  hasPixels: boolean; refusedReason: string | null; refusedKind: string | null;
};
const rowsByCandidate = new Map<number, Held[]>();
const roles = new Map<string, number>();
for (const row of library as any[]) {
  const candidate = Number(row.candidateId);
  const list = rowsByCandidate.get(candidate) ?? [];
  const role = String(row.role);
  roles.set(role, (roles.get(role) ?? 0) + 1);
  list.push({
    slot: String(row.slot),
    variantId: row.variantId === null ? null : Number(row.variantId),
    role,
    hasPixels: row.storageKey !== null && String(row.storageKey) !== "",
    refusedReason: row.refusedReason === null ? null : String(row.refusedReason),
    refusedKind: row.refusedKind === null ? null : String(row.refusedKind),
  });
  rowsByCandidate.set(candidate, list);
}
console.log(`  library roles: ${Array.from(roles).map(([role, n]) => `${role} ${n}`).join(" · ")}`);
console.log("");

/* ── WHAT EACH VARIANT'S OWN STEP DELIVERED ───────────────────────────────── */
type Owed = {
  variant: string; variantId: number; candidateId: number; userId: number;
  slot: string; facets: string[]; when: string;
  because: "no row at all" | "a row with no pixels";
  /** Only for the second reason: what the mint said when it declined. */
  refusal?: string;
};
const owed: Owed[] = [];
const skipped: Array<{ variant: string; why: string }> = [];
/** (slot × render) pairs left off because the slot can never take a crop. Named
 *  and counted, never silently dropped — a silent cap reads as coverage. */
const wordsOnlySkipped = new Map<string, number>();
let readable = 0;

for (const row of variants as any[]) {
  const id = Number(row.id);
  if (String(row.status) !== "ready") {
    skipped.push({ variant: String(row.publicId), why: `status ${row.status}` });
    continue;
  }
  /*
    THE VARIANT'S OWN CONTRIBUTION IS THE LAST STEP, not the composed delta.
    The composed one carries every ancestor's facets too, and crediting this
    render with its parents' features would put every ancestor's slot on the
    work list on every descendant.
  */
  const steps = Array.isArray(row.stepDeltas) ? row.stepDeltas : null;
  const own: unknown = steps !== null && steps.length > 0 ? steps[steps.length - 1] : row.deltas;
  const delta: RefineDelta | null = readStoredDelta(own);
  if (delta === null) {
    skipped.push({ variant: String(row.publicId), why: "its delta will not re-read" });
    continue;
  }
  readable += 1;

  /* The kind is derived the way the recipe derives it — from what the step
     files — so this walk and the mint's own name one object. */
  const accessoryKind = accessoryKindOf(itemsOf(delta.free?.statedAccessories).join(" ")) ?? null;
  const lineage = new Set(lineageOf(id));
  const rows = rowsByCandidate.get(Number(row.candidateId)) ?? [];

  for (const facet of facetsWrittenBy(delta)) {
    for (const definition of slotsForFacet(facet, { accessoryKind })) {
      /*
        A SLOT THAT IS NEVER CUT IS NOT A FEATURE OWED A CROP — the vacancy
        correction of §5 a second time, in the other tier.

        `skin` and `teeth` are catalogued `question: { from: "none" }`: no
        segmentation question names them, so `referenceMint` never plans a cut
        for them at all (`if (slot.question === null || slot.guardKind === null)
        continue;`). Their rows hold words and no pixels FOREVER and by design,
        and there is no refusal on them because no door was ever asked.

        Counted naively they arrive on a list of features to re-photograph
        wearing the label "unexplained" — which is where they sat for a shift.
        Read rather than assumed: the catalogue's own `wordsOnly` sentence says
        why, per slot, and it is printed beside the exclusion.
      */
      if (definition.question === null) {
        wordsOnlySkipped.set(definition.slot,
          (wordsOnlySkipped.get(definition.slot) ?? 0) + 1);
        continue;
      }
      /* On this BRANCH: a row minted by an ancestor is inherited, a row minted
         on a sibling branch is not, and a master row (variantId null) is
         everybody's. */
      const onBranch = rows.filter((one) => one.slot === definition.slot
        && (one.variantId === null || lineage.has(one.variantId)));
      /*
        A VACANCY ROW IS NOT A FEATURE OWED A CROP — it is a slot deliberately
        empty, because she took the thing off. It has no `storageKey` BY
        DESIGN, so counting it as a missing crop would put "the glasses she
        removed" on a list of features to re-photograph.

        Read rather than assumed: the evaluation's own §1 breakdown says two of
        the twenty-nine rows are `vacancy`, and the first cut of this script
        selected `role` and never looked at it — which is how a population that
        is not the one you think you are counting gets counted.
      */
      const real = onBranch.filter((one) => one.role !== "vacancy");
      if (onBranch.length > 0 && real.length === 0) continue;
      if (onBranch.length === 0) {
        owed.push({
          variant: String(row.publicId), variantId: id,
          candidateId: Number(row.candidateId), userId: Number(row.userId),
          slot: definition.slot, facets: [facet],
          when: new Date(row.createdAt).toISOString().slice(0, 10),
          because: "no row at all",
        });
        continue;
      }
      /*
        A ROW WITH NO PIXELS IS THE SAME DRIFT WEARING A ROW.
        `supersededCarrySlots` already treats one as a slot that must be said in
        words, and words are what the founder watched his horns change under.
        Counted separately so a reader can see the two populations rather than
        one number that quietly merges them.
      */
      if (!real.some((one) => one.hasPixels)) {
        /* WHAT THE MINT SAID WHEN IT DECLINED, carried onto the list. A slot
           the door has already refused is not a slot waiting for a backfill —
           it is a slot the door looked at and turned away, and re-calling the
           same door on the same frame will get the same answer unless the
           reason says otherwise. */
        const said = real.map((one) => one.refusedReason
          ? `${one.refusedReason}${one.refusedKind ? `/${one.refusedKind}` : ""}`
          : "no refusal recorded");
        owed.push({
          variant: String(row.publicId), variantId: id,
          candidateId: Number(row.candidateId), userId: Number(row.userId),
          slot: definition.slot, facets: [facet],
          when: new Date(row.createdAt).toISOString().slice(0, 10),
          because: "a row with no pixels",
          refusal: Array.from(new Set(said)).join(", "),
        });
      }
    }
  }
}

/* ── THE READING ──────────────────────────────────────────────────────────── */
console.log("=".repeat(78));
console.log(`READABLE variants: ${readable} of ${variants.length}`);
if (skipped.length > 0) {
  console.log(`SKIPPED ${skipped.length}, and each says why — a silent cap reads as coverage:`);
  for (const one of skipped) console.log(`  ${one.variant}  ${one.why}`);
}
console.log("");

const merged = new Map<string, Owed>();
for (const one of owed) {
  const key = `${one.variantId}·${one.slot}`;
  const held = merged.get(key);
  if (held) held.facets.push(...one.facets);
  else merged.set(key, one);
}
const list = Array.from(merged.values());

console.log(`THE WORK LIST: ${list.length} (variant × slot) pairs delivered with no crop on their branch.`);
console.log(`  against the evaluation's upper bound of 24 VARIANTS.`);
if (wordsOnlySkipped.size > 0) {
  const total = Array.from(wordsOnlySkipped.values()).reduce((a, b) => a + b, 0);
  console.log(`  EXCLUDED, and not by omission: ${total} pair(s) on slots the catalogue never cuts`
    + ` — ${Array.from(wordsOnlySkipped).map(([slot, n]) => `${slot} ${n}`).join(" · ")}.`);
  for (const slot of wordsOnlySkipped.keys()) {
    const definition = slotDefinition(slot as never);
    const reason = definition === null ? "no catalogue entry" : (definition as any).wordsOnly ?? "—";
    console.log(`    ${slot}: ${reason}`);
  }
}
console.log("");

const variantsOwed = new Set(list.map((one) => one.variantId));
const candidatesOwed = new Set(list.map((one) => one.candidateId));
const usersOwed = new Set(list.map((one) => one.userId));
console.log(`  distinct variants  ${variantsOwed.size}`);
console.log(`  distinct casts     ${candidatesOwed.size}`);
console.log(`  distinct users     ${usersOwed.size}`);
console.log("");

const bySlot = new Map<string, number>();
for (const one of list) bySlot.set(one.slot, (bySlot.get(one.slot) ?? 0) + 1);
console.log("  by slot:");
for (const [slot, count] of Array.from(bySlot.entries()).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${slot.padEnd(20)} ${count}`);
}
console.log("");
const byReason = new Map<string, number>();
for (const one of list) byReason.set(one.because, (byReason.get(one.because) ?? 0) + 1);
console.log("  by reason:");
for (const [reason, count] of byReason) console.log(`    ${reason.padEnd(20)} ${count}`);
console.log("");

console.log("  every row, oldest first:");
for (const one of list.sort((a, b) => a.variantId - b.variantId)) {
  console.log(`    ${one.when}  u${String(one.userId).padEnd(3)} cand ${String(one.candidateId).padEnd(5)}`
    + ` ${one.variant.slice(0, 12).padEnd(13)} ${one.slot.padEnd(18)} ${one.because.padEnd(21)}`
    + ` [${Array.from(new Set(one.facets)).join(", ")}]`
    + `${one.refusal ? `  door said: ${one.refusal}` : ""}`);
}

/*
  ── AND THE QUESTION A BACKFILL ACTUALLY TURNS ON ─────────────────────────────

  Everything above is *"did THIS render deliver a feature with no crop AT THE
  TIME"*, which is the right question about drift and the wrong one about work.
  A slot whose crop was refused in August and minted successfully two renders
  later is carried today; minting it again would buy a second copy of something
  the branch already has.

  So each owed pair is asked once more, anchored on its cast's NEWEST render:
  does the live library hold pixels for that slot right now? A pair that answers
  yes is drift that has already healed, and it is not work.

  The same branch rule as above — newest version per slot along the tip's own
  ancestry, master rows belonging to every branch, vacancies excluded.
*/
const tipOfCandidate = new Map<number, number>();
for (const row of variants as any[]) {
  if (String(row.status) !== "ready") continue;
  const candidate = Number(row.candidateId);
  const held = tipOfCandidate.get(candidate);
  if (held === undefined || Number(row.id) > held) tipOfCandidate.set(candidate, Number(row.id));
}

let healed = 0;
console.log("");
console.log("  AND WHAT THE LIVE LIBRARY HOLDS TODAY, at each cast's newest render:");
for (const one of list) {
  const tip = tipOfCandidate.get(one.candidateId);
  const lineage = tip === undefined ? new Set<number>() : new Set(lineageOf(tip));
  const rows = (rowsByCandidate.get(one.candidateId) ?? []).filter((row) =>
    row.slot === one.slot && row.role !== "vacancy"
    && (row.variantId === null || lineage.has(row.variantId)));
  const carriesNow = rows.some((row) => row.hasPixels);
  if (carriesNow) healed += 1;
  console.log(`    cand ${String(one.candidateId).padEnd(5)} ${one.slot.padEnd(14)}`
    + ` at v#${tip ?? "—"}: ${carriesNow ? "CARRIES A CROP TODAY — nothing owed" : "still no crop"}`);
}
console.log("");
console.log(`  ${healed} of ${list.length} have healed on their own branch since; `
  + `${list.length - healed} are still carried by words alone.`);

/*
  AND THE REFUSALS AS THEIR OWN TABLE, because they decide the walker's shape.

  The evaluation framed the backfill as *"a walker that finds pre-promotion
  features, loads their old frame, buys the reads, and calls the existing mint
  through the existing door."* That is the right shape for a slot with NO row.
  For a slot whose row exists with no pixels, the door has already been called
  on that feature and said no — so what the walker needs to know first is
  whether the reason it gave is one a fresh read could answer differently.
*/
const refusals = new Map<string, number>();
for (const one of list) {
  if (one.refusal === undefined) continue;
  refusals.set(one.refusal, (refusals.get(one.refusal) ?? 0) + 1);
}
if (refusals.size > 0) {
  console.log("");
  console.log("  what the door said on the pixel-less rows:");
  for (const [said, count] of Array.from(refusals).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${said.padEnd(36)} ${count}`);
  }
}

console.log("");
console.log("=".repeat(78));
console.log("WHAT THIS READING IS NOT");
console.log("  It counts features delivered with no crop ON THEIR BRANCH, which is the");
console.log("  observable thing the promotion date was a proxy for. It does NOT prove each");
console.log("  one is retro-mintable: whether the old frame still reads two-sidedly is");
console.log("  §3.1's quiet risk and only a segmenter can answer it, per slot, at $0.005.");
console.log("  So this is the walker's INPUT, and its output will be smaller.");

await connection.end();
process.exit(0);
