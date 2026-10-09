/**
 * #2023 — the catalogue product the spent-share line is billed under.
 * Read-only unless `--apply`. Mode comes from the key the process holds.
 *
 *   npx tsx scripts/ceremony-spent-share-product-2023.mts --expect=test            # dry run
 *   npx tsx scripts/ceremony-spent-share-product-2023.mts --expect=test --apply    # create in test mode
 *   railway run --service Drape -- npx tsx scripts/ceremony-spent-share-product-2023.mts --expect=live --apply
 *
 * A KEPT CEREMONY, NOT SCRATCH — the same road as
 * `ceremony-topup-prices-1606.mts`, and for its reason: #1609's go-live step
 * runs it by path against the live key, so it must live in every clone.
 *
 * What it creates is {@link SPENT_SHARE_PRODUCT}, READ FROM THE PRODUCT CODE
 * rather than retyped here: the id the server asks for, the name her invoice
 * line shows, and the description. A copy typed in this file is the drift
 * `ceremony-topup-prices-1606.mts`'s `WANT` docblock warns about — a product
 * created under one id while the server asks for another, and every switch
 * from a spent month refusing with Stripe looking fine.
 *
 * It REFUSES (exit 3), rather than editing, when the id already exists with a
 * different name or archived: a product his hand changed in the dashboard is a
 * conversation, not something this script overwrites.
 */
import Stripe from "stripe";
import "dotenv/config"; // fills STRIPE_SECRET_KEY from .env only when the process does not already carry one (railway run wins)
import { SPENT_SHARE_PRODUCT } from "../server/stripe/stripeProducts";

const key = process.env.STRIPE_SECRET_KEY ?? "";
if (!key) { console.log("REFUSED: no STRIPE_SECRET_KEY in this process"); process.exit(2); }
const mode = key.startsWith("sk_live_") ? "LIVE" : key.startsWith("sk_test_") ? "TEST" : "UNKNOWN";
const apply = process.argv.includes("--apply");
const expectArg = process.argv.find((a) => a.startsWith("--expect="))?.slice(9);
if (!expectArg) { console.log("REFUSED: say which mode you mean with --expect=test or --expect=live"); process.exit(4); }
if (expectArg.toUpperCase() !== mode) { console.log(`REFUSED: this process holds a ${mode} key but --expect=${expectArg} was asked`); process.exit(4); }
const stripe = new Stripe(key);

const main = async () => {
  console.log(`mode ${mode} · ${apply ? "APPLY" : "DRY RUN (read-only)"}`);
  let existing: Stripe.Product | null = null;
  try {
    existing = await stripe.products.retrieve(SPENT_SHARE_PRODUCT.id);
  } catch (e) {
    if ((e as { code?: string })?.code !== "resource_missing") throw e;
  }
  if (existing) {
    console.log(`  have ${existing.id} "${existing.name}" active=${existing.active}`);
    if (existing.name !== SPENT_SHARE_PRODUCT.name || !existing.active) {
      console.log(`  REFUSED: ${existing.id} exists but is not "${SPENT_SHARE_PRODUCT.name}" and active — read it in the dashboard first`);
      process.exit(3);
    }
    console.log("  nothing to create");
    return;
  }
  console.log(`  to create: ${SPENT_SHARE_PRODUCT.id} "${SPENT_SHARE_PRODUCT.name}"`);
  if (!apply) return;
  const created = await stripe.products.create({
    id: SPENT_SHARE_PRODUCT.id,
    name: SPENT_SHARE_PRODUCT.name,
    description: SPENT_SHARE_PRODUCT.description,
    metadata: { card: "2023" },
  });
  console.log(`  created ${created.id} "${created.name}" active=${created.active}`);
};

main().then(() => process.exit(0)).catch((e) => { console.log("ERROR", e?.message ?? e); process.exit(1); });
