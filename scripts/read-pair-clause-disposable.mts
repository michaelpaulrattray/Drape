/** What clause the PRODUCT itself emits for a hoop — read, not authored. */
import { pairClauseFor, accessoryEntry } from "../server/castingV2/accessoryKinds";

for (const said of ["gold hoop earring", "a small nose stud", "glasses"]) {
  console.log(`${JSON.stringify(said).padEnd(24)} clause ${JSON.stringify(pairClauseFor(said)).padEnd(34)} entry ${JSON.stringify(accessoryEntry(said))}`);
}
process.exit(0);
