/**
 * WHY RENDERS 2 AND 3 MINTED NO LIBRARY ROW — recomputed from what is stored,
 * rather than bought again (fable-228).
 *
 * The mint's slot composition is a PURE function of three things: the facets the
 * render earned, the read-back captions, and the accessory kind. If all three
 * survive on disk, the answer falls out free; if they do not, that is an
 * observability gap and it files beside `applied`-stored-nowhere.
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import { mintedSlotsForRender } from "../server/castingV2/mintedSlots";

const c = await mysql.createConnection(process.env.DATABASE_URL!);

/* WHAT THE RENDER EARNED, as persisted: the segment store files exactly the
   earned ∩ cuttable facets, so its rows are the surviving evidence of that list. */
const [segments] = await c.query<any[]>(
  "select variantId, facet, region from casting_segments where variantId in (144,145,146) order by variantId");
console.log("segments (the earned list's surviving trace):");
for (const s of segments) console.log(`  v${s.variantId}  ${s.facet}  @ ${s.region}`);

/* THE CAPTIONS. Hunt for anywhere a read-back could be persisted. */
const [tables] = await c.query<any[]>("show tables");
const names = (tables as any[]).map((r) => Object.values(r)[0] as string);
const captionish = names.filter((n) => /caption|realiz|readback|read_back/i.test(n));
console.log(`\ncaption-shaped tables: ${captionish.length ? captionish.join(", ") : "NONE"}`);

const [cols] = await c.query<any[]>("show columns from casting_candidate_variants");
const captionCols = (cols as any[]).map((r) => r.Field).filter((f: string) => /caption|realiz/i.test(f));
console.log(`caption-shaped columns on the variant: ${captionCols.length ? captionCols.join(", ") : "NONE"}`);

/* The composition, driven with what IS available, so the shape of the answer is
   visible even when one input is missing. */
console.log("\nwhat the composition returns for the earned facet with NO captions:");
const withoutCaptions = mintedSlotsForRender({
  earned: ["statedAccessories"],
  captions: {},
  accessoryKind: "earring",
});
console.log(`  slots ${withoutCaptions.slots.length}   unfiled ${JSON.stringify(withoutCaptions.unfiled)}`);

console.log("\nand with a caption present, which is the arm that mints:");
const withCaptions = mintedSlotsForRender({
  earned: ["statedAccessories"],
  captions: { statedAccessories: "Thin gold wire hoops in both lobes" },
  accessoryKind: "earring",
});
console.log(`  slots ${withCaptions.slots.map((s) => s.slot).join(", ")}`);
await c.end();

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
