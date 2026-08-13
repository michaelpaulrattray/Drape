/** What the did-you-mean gate does with the bald phrasings, before any interpreter sees them. */
import "dotenv/config";
import { nearMiss, didYouMeanReask } from "../server/castingV2/refineReask";

for (const text of ["shave her head", "make her bald", "remove her hair", "shave her hair off", "buzz her hair"]) {
  const miss = nearMiss(text);
  console.log(`"${text}" → ${miss ? JSON.stringify(miss) : "no near miss"}`);
  if (miss) console.log(`     reask: ${JSON.stringify(didYouMeanReask(text, miss)).slice(0, 400)}`);
}
process.exit(0);
