/** #246 triage: WHICH WORDS the panel scan actually asks — derived from the
 *  catalogue the scan reads, never typed out. Law 7b: the claim that `eyebrows`
 *  and `hair` are panel questions is the founder-facing sentence, so it is
 *  taken from the code that asks them. */
import { catalogueSlots } from "../server/castingV2/referenceSlotCatalogue";
const slots = catalogueSlots();
const questions = [...new Set(slots.map((s: { question?: string | null }) => s.question).filter(Boolean))].sort();
console.log(`${slots.length} catalogue slots · ${questions.length} distinct questions`);
console.log(questions.join(", "));
for (const w of ["hair", "eyebrows"]) {
  console.log(`${w}: ${questions.includes(w) ? "ASKED by the panel scan" : "not a panel question"}`);
}

/* Exit discipline (#249): a script ends by exiting, so a stray handle can never
   leave it resident. */
process.exit(0);
