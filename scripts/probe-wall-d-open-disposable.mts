/**
 * WALL (d) AND THE OPEN KIND — the re-read `refineDelta`'s header named as
 * step 5's second owed reader (opus-647 §7 item 3).
 *
 * The header's claim: *"the repaint recipe is built from the ask list instead,
 * so this one costs nothing on the road the open lane runs on."* That is a
 * claim about a road, and the roads are chosen by a flag. This drives the two
 * readers directly and prints what each does with an `open` field.
 *
 * Free. No transport, no database, no credits — three function calls.
 */
import { readDelta, type RefineDelta } from "../server/castingV2/refineDelta";
import { readStoredDelta } from "../server/castingV2/refineLegacy";

const withOpen = {
  free: { marks: ["a small scar on her cheek"] },
  open: { fangs: { noun: "fangs", words: "vampire fangs" } },
};

/* `variant.deltas` is a MySQL JSON column, so both readers are handed a parsed
   OBJECT. A first cut of this probe passed the stringified form and got a null
   out of `readStoredDelta` that was purely its own fault. */
const strict = readDelta(structuredClone(withOpen) as unknown as Record<string, unknown>);
const stored = readStoredDelta(structuredClone(withOpen));
const openOnly = readStoredDelta({ open: { fangs: { noun: "fangs", words: "vampire fangs" } } });
/* THE ORDINARY SHAPE. "Give her vampire fangs" is one ask and it is the open
   one, so the persisted row holds `open` and nothing else. This is what wall
   (d) re-reads it with, and the answer decides whether the throw at
   refineService.ts:3149 fires on a paid render. */
const strictOpenOnly = readDelta({ open: { fangs: { noun: "fangs", words: "vampire fangs" } } });

const show = (label: string, value: RefineDelta | null) => {
  console.log(`\n${label}`);
  if (value === null) {
    console.log("  NULL — the whole delta was refused");
    return;
  }
  console.log(`  keys:  ${Object.keys(value).join(", ") || "(none)"}`);
  console.log(`  open:  ${value.open ? JSON.stringify(value.open) : "ABSENT"}`);
  console.log(`  free:  ${value.free ? JSON.stringify(value.free) : "ABSENT"}`);
};

show("readDelta  — the strict reader, and what wall (d) re-reads the ROW with", strict);
show("readStoredDelta — our own record re-entering", stored);
show("readStoredDelta — a step whose ONLY ask was an open kind", openOnly);
show("readDelta      — THE SAME ROW, through wall (d)'s reader", strictOpenOnly);
console.log(`\nWALL (d) ON THE ORDINARY OPEN ASK: readDelta returns ${strictOpenOnly === null ? "NULL → refineService.ts:3149 THROWS" : "a delta"}`);

console.log("\n--- the three questions this was run to answer ---");
console.log(`1. does readDelta NULL on an open kind, or DROP it?   ${strict === null ? "NULL" : "DROP (delta survives, open gone)"}`);
console.log(`2. does readStoredDelta keep it?                      ${stored?.open ? "KEPT" : "LOST"}`);
console.log(`3. do the free facets beside it survive readDelta?    ${strict?.free ? "yes" : "no"}`);

process.exit(0);
