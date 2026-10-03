/**
 * #1606 — the three top-up prices, his ladder (2026-10-02: "i prefer your
 * reccomendation"). Read-only unless `--apply`. Mode comes from the key the
 * process holds (test or live).
 *
 *   npx tsx scripts/ceremony-topup-prices-1606.mts                     # dry run
 *   railway run --service Drape -- npx tsx scripts/ceremony-topup-prices-1606.mts --expect=live --apply
 *
 * ⚠ **A KEPT CEREMONY, NOT SCRATCH — AND THE NAME IS THE WHOLE POINT (#1828).**
 * #1609's go-live step names this file by path as a command his launch-day
 * ceremony runs. It stood untracked as `_1606-topup-prices-disposable.mts` for
 * a day: in no commit, in no clone, invisible to CI — a money-path go-live
 * step pointing at a file that existed on exactly one machine. Nothing
 * automated deletes it, but `_NNNN-…-disposable` is the convention that tells
 * every future sweep a file is scratch, and the Janitor's 2026-10-03 run
 * destroyed 59 untracked files of exactly that shape. Committed under the
 * `ceremony-*` name on 2026-10-03, bytes unchanged but for this header and the
 * terminal statement below.
 *
 * ⚠ **AND COMMITTING IT ALONE WOULD HAVE REDDENED EVERY GATE AND REFUSED THE
 * RITE**, which is why the ending below is the shape it is. `exitContract`
 * (`server/scriptExitDiscipline.test.ts`) reads the LAST TOP-LEVEL STATEMENT
 * and its `isChain` test is identifier-rooted — `/^(await\s+)?[\w$.]+\(…/` —
 * so the `(async () => { … })().catch(…)` this file shipped with can never
 * match it however many exits are added, and the guard walks the DISK, where
 * tracked-ness means nothing to it. The accepted shape is a named `main` with
 * an exit on BOTH arms, and it is already in the tree twice
 * (`scripts/apply-ink-add-migration.mts`, `scripts/SKELETON-disposable.mts`).
 *
 * Its Stripe behaviour is his approved ladder and was deliberately not touched:
 * the three lookup keys, the amounts, the archive list, the recurring/amount
 * refusal and the `--expect=` mode guard are all as he approved them.
 */
import Stripe from "stripe";
import "dotenv/config"; // fills STRIPE_SECRET_KEY from .env only when the process does not already carry one (railway run wins)
const key = process.env.STRIPE_SECRET_KEY ?? "";
if (!key) { console.log("REFUSED: no STRIPE_SECRET_KEY in this process"); process.exit(2); }
const mode = key.startsWith("sk_live_") ? "LIVE" : key.startsWith("sk_test_") ? "TEST" : "UNKNOWN";
const apply = process.argv.includes("--apply");
const expectArg = process.argv.find((a) => a.startsWith("--expect="))?.slice(9);
if (expectArg && expectArg.toUpperCase() !== mode) { console.log(`REFUSED: this process holds a ${mode} key but --expect=${expectArg} was asked`); process.exit(4); }
const stripe = new Stripe(key);
/* Unit = 5,000 display credits (25,000 ledger). The three prices are the slider's brackets;
   the packs are quantities 1, 2 and 5 of them: $12 · $22 · $50. */
const WANT: Array<{ key: string; cents: number; band: string }> = [
  { key: "klieg_topup_5000_v2",  cents: 1200, band: "1 unit (5,000 credits) — $12 per 5,000" },
  { key: "klieg_topup_10000_v2", cents: 1100, band: "2–4 units (10,000–20,000 credits) — $11 per 5,000" },
  { key: "klieg_topup_25000_v2", cents: 1000, band: "5+ units (25,000+ credits) — $10 per 5,000" },
];
const OLD = ["klieg_topup_500_v2", "klieg_topup_1000_v2", "klieg_topup_2500_v2"];
const main = async () => {
  console.log(`mode ${mode} · ${apply ? "APPLY" : "DRY RUN (read-only)"}`);
  const all = await stripe.prices.list({ limit: 100, active: true, expand: ["data.product"] });
  const topups = all.data.filter((p) => (p.lookup_key ?? "").startsWith("klieg_topup"));
  for (const p of topups) console.log(`  have ${p.lookup_key} ${p.unit_amount} ${p.currency} ${p.recurring ? "RECURRING" : "one-off"} product=${(p.product as Stripe.Product).name ?? p.product}`);
  const oldOnes = topups.filter((p) => OLD.includes(p.lookup_key ?? ""));
  let product: string | null = oldOnes[0] ? (typeof oldOnes[0].product === "string" ? oldOnes[0].product : oldOnes[0].product.id) : null;
  if (!product) {
    const products = await stripe.products.list({ limit: 100, active: true });
    product = products.data.find((x) => x.name === "Klieg Credit Top-up")?.id ?? null;
  }
  console.log(`  product: ${product ?? "NONE — would create 'Klieg Credit Top-up'"}`);
  const missing = WANT.filter((w) => !topups.some((p) => p.lookup_key === w.key && p.unit_amount === w.cents && !p.recurring));
  const wrong = WANT.filter((w) => topups.some((p) => p.lookup_key === w.key && (p.unit_amount !== w.cents || !!p.recurring)));
  console.log(`  to create: ${missing.map((m) => `${m.key}@${m.cents}`).join(", ") || "none"}`);
  if (wrong.length) { console.log(`  REFUSED: existing key with a different amount or recurring: ${wrong.map((w) => w.key).join(", ")}`); process.exit(3); }
  console.log(`  to archive: ${oldOnes.map((p) => p.lookup_key).join(", ") || "none"}`);
  if (!apply) return;
  if (!product) product = (await stripe.products.create({ name: "Klieg Credit Top-up", description: "Credits bought on top of a plan. Purchased credits never expire." })).id;
  for (const w of missing) {
    const p = await stripe.prices.create({ product, currency: "usd", unit_amount: w.cents, lookup_key: w.key, transfer_lookup_key: true, nickname: `Top-up unit of 5,000 credits — ${w.band}`, metadata: { credits_display_per_unit: "5000", credits_ledger_per_unit: "25000", card: "1606" } });
    console.log(`  created ${p.lookup_key} ${p.id} ${p.unit_amount}`);
  }
  for (const p of oldOnes) { await stripe.prices.update(p.id, { active: false }); console.log(`  archived ${p.lookup_key} ${p.id}`); }
  const after = await stripe.prices.list({ limit: 100, active: true });
  for (const p of after.data.filter((x) => (x.lookup_key ?? "").startsWith("klieg_topup"))) console.log(`  now ${p.lookup_key} ${p.unit_amount} ${p.recurring ? "RECURRING" : "one-off"} ${p.id}`);
};

/* The accepted terminal shape — an exit on BOTH arms, identifier-rooted so the
   guard's chain test can see it. The failure arm's words and code are the ones
   this file already had; what is new is the happy arm, which the IIFE never
   had and which is what left the process resident on a finished dry run. */
main().then(() => process.exit(0)).catch((e) => { console.log("ERROR", e?.message ?? e); process.exit(1); });
