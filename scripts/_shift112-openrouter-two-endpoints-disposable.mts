/**
 * DISPOSABLE (foreman-112) — read BOTH OpenRouter endpoints in one breath.
 *
 * The deploy rite prints them side by side and they disagreed on this shift:
 * `credits` said spent $252.30, byte-identical to the reading 10.5 hours
 * earlier, while `key` said this key had spent $3.59 TODAY. Two GETs, no
 * writes, no database. Read-only; costs nothing.
 */
import "dotenv/config";
import { readOpenRouterBalance, readOpenRouterUsage } from "./lib/openrouterBalance.mts";

async function main() {
  const at = new Date().toISOString();
  const bal = await readOpenRouterBalance();
  const usage = await readOpenRouterUsage();
  console.log(`read at ${at}`);
  console.log("credits (/api/v1/credits, ACCOUNT):", JSON.stringify(bal));
  console.log("key     (/api/v1/key, THIS KEY)  :", JSON.stringify(usage));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
