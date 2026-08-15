/**
 * HIS SHOT 293, FROM THE ROWS — the selection tangle, read before it is
 * reproduced. (fable-581 §2: diagnose by layer BEFORE fixing.)
 *
 * The founder clicked between versions while a refine landed and got: the
 * ORIGINAL chip displaying the EDITED image, the edited thumbnail unclickable,
 * and the sheet showing the edited frame.
 *
 * Three of tonight's changes have never co-existed under a mid-click landing —
 * the optimistic override, the highlight riding it, and the takes remap — and
 * only one of them leaves a trace in the database. This puts the rail's own
 * derivation over his real rows and prints what the projection would have
 * answered: which chips are live, which are hidden behind a newer take, and
 * where the selection lands after the remap.
 *
 * Read-only, production rows, no PII printed — ids, keys and his own
 * instruction text, which is his own casting work.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/read-selection-tangle-disposable.mts
 */
import { openDatabase } from "./lib/dbConnection.mts";

import { liveTakes, takeShownFor } from "../server/castingV2/railTakes.js";
import { readStepDeltas } from "../server/castingV2/refineService.js";

const url = process.env.MYSQL_PUBLIC_URL ?? process.env.DATABASE_URL;
if (!url || !url.includes("23768")) throw new Error("this reads the PRODUCTION ledger — run it under railway");
const conn = await openDatabase(url);

const [candidates] = await conn.execute(
  `SELECT c.id, c.publicId, c.imageKey, c.thumbKey, c.selectedVariantId, COUNT(v.id) AS versions
     FROM casting_candidates c JOIN casting_candidate_variants v ON v.candidateId = c.id
    WHERE v.requestText LIKE '%horns%' OR v.requestText LIKE '%fiery red%'
    GROUP BY c.id ORDER BY c.id DESC LIMIT 3`,
);

for (const candidate of candidates as Array<Record<string, never>>) {
  const row = candidate as unknown as {
    id: number; publicId: string; imageKey: string; thumbKey: string | null; selectedVariantId: number | null;
    versions: number;
  };
  console.log(`\n═══ candidate ${row.id} · ${row.versions} versions`);
  console.log(`  master image ${row.imageKey}`);
  console.log(`  master thumb ${row.thumbKey ?? "— none, so the chip draws the full frame"}`);

  const [variants] = await conn.execute(
    `SELECT id, publicId, status, imageKey, thumbKey, stepDeltas, LEFT(requestText, 40) AS ask,
            parentVariantId,
            JSON_UNQUOTE(JSON_EXTRACT(internalPrompt, '$.regeneratedFrom')) AS regeneratedFrom
       FROM casting_candidate_variants WHERE candidateId = ? ORDER BY id`,
    [row.id],
  );
  const rows = variants as unknown as Array<{
    id: number; publicId: string; status: string; imageKey: string | null; thumbKey: string | null;
    stepDeltas: unknown; ask: string; parentVariantId: number | null; regeneratedFrom: string | null;
  }>;
  const ready = rows.filter((one) => one.status === "ready");

  /* The projection's own derivation, over his own rows. */
  const { live, supersededBy } = liveTakes(ready.map((variant) => ({
    publicId: variant.publicId,
    steps: readStepDeltas(variant.stepDeltas),
    variant,
  })));
  const liveIds = new Set(live.map((take) => take.publicId));

  const selected = rows.find((one) => one.id === row.selectedVariantId) ?? null;
  console.log(`  selection points at ${selected ? `${selected.id} "${selected.ask}"` : "the ORIGINAL"}`);
  console.log(`  after the takes remap the rail lights `
    + `${takeShownFor(selected?.publicId ?? null, supersededBy) ?? "the ORIGINAL"}`);
  console.log(`  ${ready.length} delivered · ${live.length} chips on the rail`);
  for (const variant of rows) {
    const hidden = variant.status === "ready" && !liveIds.has(variant.publicId);
    console.log(`    ${String(variant.id).padEnd(5)} ${variant.status.padEnd(8)}`
      + ` ${hidden ? "HIDDEN behind a newer take" : variant.status === "ready" ? "on the rail       " : "                  "}`
      + ` parent ${String(variant.parentVariantId ?? "-").padEnd(5)}`
      + ` "${variant.ask}"`);
    if (variant.regeneratedFrom) console.log(`          regeneratedFrom ${variant.regeneratedFrom}`);
  }
}

await conn.end();
process.exit(0);
