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
 * Its Stripe behaviour is his approved ladder and nothing here changes a value
 * of it: the archive list, the recurring/amount refusal and the `--expect=`
 * mode guard are as he approved them, and the three lookup keys and amounts are
 * now READ FROM THE PRODUCT rather than retyped — see {@link WANT}, where the
 * three rows it composes are proven byte-identical to the literals they replace
 * and resolve against Stripe's live test catalogue with nothing to create.
 */
import Stripe from "stripe";
import "dotenv/config"; // fills STRIPE_SECRET_KEY from .env only when the process does not already carry one (railway run wins)
import { TOPUP_BRACKETS, TOPUP_UNIT_DISPLAY_CREDITS, topupDisplayCredits } from "../shared/creditTopups";
import { topupPriceLookupKey } from "../server/stripe/stripePriceCatalogue";

/** Thousands separators, so a dashboard nickname reads the way his pricing page does. */
const fmt = (n: number): string => n.toLocaleString("en-US");
const key = process.env.STRIPE_SECRET_KEY ?? "";
if (!key) { console.log("REFUSED: no STRIPE_SECRET_KEY in this process"); process.exit(2); }
const mode = key.startsWith("sk_live_") ? "LIVE" : key.startsWith("sk_test_") ? "TEST" : "UNKNOWN";
const apply = process.argv.includes("--apply");
const expectArg = process.argv.find((a) => a.startsWith("--expect="))?.slice(9);
if (expectArg && expectArg.toUpperCase() !== mode) { console.log(`REFUSED: this process holds a ${mode} key but --expect=${expectArg} was asked`); process.exit(4); }
const stripe = new Stripe(key);
/**
 * WHAT STRIPE SHOULD HOLD — **DERIVED FROM THE PRODUCT, NEVER TYPED HERE** (#1828).
 *
 * ⚠ This block was three object literals carrying the three lookup keys and the
 * three amounts, and that is the second copy of the catalogue that
 * `topupPriceLookupKey`'s own docblock warns about in as many words: *"three
 * strings sitting beside three prices is a second copy of the catalogue, and the
 * drift would be a checkout that refuses while Stripe holds a perfectly good
 * price."* **This file is the thing that CREATES those prices**, so it is the
 * worst possible place for the copy to live: a ladder edited in
 * `shared/creditTopups.ts` and not here mints objects the app will never ask
 * for, and the customer meets a checkout that refuses with Stripe looking fine.
 * Working law 4, on the money path, on launch day.
 *
 * ⚠ **AND THE SECRET SCAN FOUND IT FIRST, BY ACCIDENT, WHICH IS WORTH RECORDING.**
 * PR #1839 sat RED for ten hours on three gitleaks `generic-api-key` findings
 * over those literals. The prescribed repair was to rename the field from `key`
 * to `lookupKey`; driven before it was believed, that **does not work** — the
 * rule matches any identifier CONTAINING "key", so `lookupKey` is the one rename
 * that cannot help (3 findings before, 3 after, at the same three lines). Taking
 * the keys from the builder removes the literals, so the finding goes away as a
 * CONSEQUENCE of the right fix rather than as a dodge — no allowlist entry, no
 * inline exemption, and the scanner keeps every byte of its coverage.
 *
 * Unit = {@link TOPUP_UNIT_DISPLAY_CREDITS} display credits. The nickname is
 * composed from the band too, so a reader of Stripe's dashboard and a reader of
 * this repository cannot be told two different things about one price.
 */
const WANT = TOPUP_BRACKETS.map((bracket, index) => {
  const next = TOPUP_BRACKETS[index + 1];
  const from = bracket.fromUnits;
  const span = next
    ? `${from}–${next.fromUnits - 1} units (${fmt(topupDisplayCredits(from))}–${fmt(topupDisplayCredits(next.fromUnits - 1))} credits)`
    : `${from}+ units (${fmt(topupDisplayCredits(from))}+ credits)`;
  const each = from === 1 ? `${from} unit (${fmt(topupDisplayCredits(from))} credits)` : span;
  return {
    lookupKey: topupPriceLookupKey(bracket),
    cents: bracket.centsPerUnit,
    band: `${each} — $${(bracket.centsPerUnit / 100).toFixed(0)} per ${fmt(TOPUP_UNIT_DISPLAY_CREDITS)}`,
  };
});
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
  const missing = WANT.filter((w) => !topups.some((p) => p.lookup_key === w.lookupKey && p.unit_amount === w.cents && !p.recurring));
  const wrong = WANT.filter((w) => topups.some((p) => p.lookup_key === w.lookupKey && (p.unit_amount !== w.cents || !!p.recurring)));
  console.log(`  to create: ${missing.map((m) => `${m.lookupKey}@${m.cents}`).join(", ") || "none"}`);
  if (wrong.length) { console.log(`  REFUSED: existing lookup key with a different amount or recurring: ${wrong.map((w) => w.lookupKey).join(", ")}`); process.exit(3); }
  console.log(`  to archive: ${oldOnes.map((p) => p.lookup_key).join(", ") || "none"}`);
  if (!apply) return;
  if (!product) product = (await stripe.products.create({ name: "Klieg Credit Top-up", description: "Credits bought on top of a plan. Purchased credits never expire." })).id;
  for (const w of missing) {
    const p = await stripe.prices.create({ product, currency: "usd", unit_amount: w.cents, lookup_key: w.lookupKey, transfer_lookup_key: true, nickname: `Top-up unit of 5,000 credits — ${w.band}`, metadata: { credits_display_per_unit: "5000", credits_ledger_per_unit: "25000", card: "1606" } });
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
