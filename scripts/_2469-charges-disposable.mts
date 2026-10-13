/**
 * #2469 — account for the SIX unexplained 350-character "Voice Generation"
 * charges recorded on the rung card (#499, 02:08–02:15 UTC on 2026-10-13),
 * which the card names as a thing to explain *"before money is reckoned per
 * design"*. Reads the provider's own usage books. No database, no spend.
 *
 *   npx tsx scripts/_2469-charges-disposable.mts
 */
import "dotenv/config";

const key = process.env.ELEVENLABS_API_KEY;
if (!key) {
  console.error("ELEVENLABS_API_KEY absent");
  process.exit(1);
}

const headers = { "xi-api-key": key };
const say = (line: string) => console.log(line);

/* The provider's own ledger for the window, by request. */
const day = Date.UTC(2026, 9, 13, 0, 0, 0);
const url =
  "https://api.elevenlabs.io/v1/usage/character-stats"
  + `?start_unix=${Math.floor(day / 1000)}`
  + `&end_unix=${Math.floor(Date.now() / 1000)}`
  + "&breakdown_type=request_queue";

const stats = await fetch(url, { headers });
say(`character-stats (breakdown by queue): ${stats.status}`);
if (stats.ok) say(JSON.stringify(await stats.json()).slice(0, 1200));

/* And the per-item history, which is what names a charge's SOURCE. */
const history = await fetch("https://api.elevenlabs.io/v1/history?page_size=100", { headers });
say(`\nhistory: ${history.status}`);
if (history.ok) {
  const body = (await history.json()) as {
    history?: Array<Record<string, unknown>>;
  };
  const items = body.history ?? [];
  say(`  ${items.length} item(s)`);

  const bySource = new Map<string, { count: number; characters: number; example: string }>();
  for (const item of items) {
    const source = String(item.source ?? "unknown");
    const model = String(item.model_id ?? "unknown");
    const characters = Number(item.character_count_change_to ?? 0) - Number(item.character_count_change_from ?? 0);
    const label = `${source} · ${model}`;
    const seen = bySource.get(label) ?? { count: 0, characters: 0, example: "" };
    seen.count += 1;
    seen.characters += characters;
    if (!seen.example) seen.example = String(item.text ?? "").slice(0, 70).replace(/\s+/g, " ");
    bySource.set(label, seen);
  }
  say("\n  by source and model:");
  for (const [label, seen] of bySource) {
    say(`    ${label.padEnd(34)} ${String(seen.count).padStart(3)} call(s) · ${seen.characters} chars`);
    if (seen.example) say(`        e.g. "${seen.example}"`);
  }

  /* The card's own question: items of EXACTLY 350 characters. */
  const threeFifty = items.filter((item) => {
    const characters = Number(item.character_count_change_to ?? 0) - Number(item.character_count_change_from ?? 0);
    return characters === 350;
  });
  say(`\n  items billed exactly 350 characters: ${threeFifty.length}`);
  for (const item of threeFifty) {
    const when = new Date(Number(item.date_unix ?? 0) * 1000).toISOString();
    say(`    ${when} · source ${item.source} · model ${item.model_id} · voice ${item.voice_name}`);
    say(`        text: "${String(item.text ?? "").slice(0, 90).replace(/\s+/g, " ")}"`);
  }
}

process.exit(0);
