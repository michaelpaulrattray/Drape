/**
 * A CROP WHOSE ASK HAS BEEN TAKEN BACK STOPS RIDING — V3(c) step 2
 * (fable-534 §2, on the shape note's own proposal).
 *
 * # The two answers to "what does she have"
 *
 * The CHAIN already prunes: a removal deletes the matching steps and recomposes
 * what is left, so the delta forgets. The LIBRARY does not: crops and words are
 * filed per render and live until something retires them, and the only thing
 * that retires anything is an explicit `vacated` on a delivered recipe.
 *
 * Two sources of truth for one question, and a prune moved only one of them. On
 * the repaint road today that shows up as a refusal — `repaintCannotRemove`
 * says so in the product's own words, *"a removal strikes matching words from
 * the library's stack, which is not yet derived from the chain's own pruning"*
 * — so a chain-added removal is charged, refunded and given no picture.
 *
 * # What this does, and what it deliberately does not
 *
 * It DERIVES the carry list: live rows ∩ what the surviving chain still names.
 * Nothing is deleted, retired or written. That matters three ways:
 *
 *   - a prune stays cheap: no write on a path that must not half-commit;
 *   - it is reversible by construction — re-adding the step brings the crop
 *     back, because the crop was never destroyed. That is the founder's own
 *     remove-then-re-add behaviour, generalised;
 *   - it cannot delete the wrong row, because it deletes nothing.
 *
 * # Why NOT "retire the rows that step created"
 *
 * The load-bearing paragraph, and it is the reason this file exists rather than
 * a one-liner at the prune site: **a crop is minted from a RENDER, and a render
 * usually answers several asks.** The render that added her earrings may also
 * have minted her hair. Retiring "the rows that step made" takes her hair crop
 * off because it happened to be minted beside the earrings — her hair is
 * innocent of her earrings.
 *
 * # The two exemptions, and both are about proving a row was NOT pruned
 *
 * A row is dropped only where its existence is EXPLAINED by an ask that is now
 * gone. Two kinds of row are explained by something else and are never dropped:
 *
 *   MASTER-MINTED (`variantId === null`)  born anatomy, or an item that was in
 *     the photograph before any edit landed. The library's own words: *"a
 *     master-minted row belongs to every branch"*. No chain step put it there,
 *     so no chain step can take it away — that is the vacancy road's job.
 *   RE-MINTED EVERY RENDER  a slot whose crop is re-cut on every render
 *     regardless of what was asked (her build, today). It is minted by the
 *     RENDER rather than by the ask, so an unnamed slot here means nothing.
 *
 * Everything else the chain does not name is a crop whose ask has been taken
 * back, and it stops riding.
 */
import { facetsWrittenBy, type RefineDelta } from "./refineDelta";
import type { Facet } from "./refineFacets";
import type { FeatureSlot } from "./recipeAssembler";
import {
  FACET_SLOTS,
  catalogueSlots,
  slotDefinition,
} from "./referenceSlotCatalogue";
import { openSlotKeysFor } from "./referenceSlots";
import type { StoredReference } from "./referenceLibrary";

/**
 * The slots the surviving chain still names.
 *
 * Deliberately GENEROUS at the one place it cannot be exact: the accessories
 * family is one facet over several kinds (an earring is at the lobe, glasses at
 * the eyes), and which kind a step named is a question about its words rather
 * than its facet. So a chain that still names `statedAccessories` supports
 * every accessory slot. Over-supporting keeps a crop that could have been
 * dropped; under-supporting takes a feature off a customer's face. Those are
 * not the same mistake.
 */
export function slotsNamedByChain(composed: RefineDelta): Set<FeatureSlot> {
  const named = new Set<FeatureSlot>();
  /*
    THE OPEN KINDS FIRST, BECAUSE THE FACET LOOP CANNOT SEE THEM — and a paid
    render is the specimen (5b, 2026-08-17; fable-900 §2a).

    `facetsWrittenBy` answers *what does this recipe name* in FACETS, and an open
    kind has none by construction — that is the open lane's whole premise. So
    every crop minted for an uncatalogued word was invisible here, was not
    master-minted and was not re-minted every render, and **was dropped on every
    subsequent render.** The first one this product ever minted (a halo) was
    dropped by the very next edit: one reference went out, the master, and the
    delivered frame had no halo at all — charged, unrefused.

    Two answers to one question with the second invisible to the first, which is
    working law 4 in its usual coat. The repair is to derive from the same delta
    the carry itself reads (`composed.open`), not to exempt the namespace: an open
    kind whose step has been PRUNED must still lose its crop, exactly like a
    closed feature, and `prunedCarries.test.ts` holds that arm beside this one.
  */
  for (const kind of Object.keys(composed.open ?? {})) {
    /*
      Through the catalogue rather than by string concatenation: a key the
      catalogue cannot resolve is one `parseSlot` refuses at the library door, so
      naming it here would put a name in the set that nothing can ever file
      against — and a mismatch between the two grammars would hide behind it.
    */
    /*
      ALL THREE KEYS THE KIND COULD BE FILED UNDER — sideless, and its two sides
      (the D1 wire, fable-1001 §3).

      A DELTA says which kinds the chain carries; it never says where their
      instances sit, because the locality lives in the property store one read
      away. A distributed kind files `open:wings@left` and `open:wings@right`,
      and a set holding only `open:wings` would drop BOTH crops on the very next
      render — the halo defect above, one door along and twice as expensive.

      Naming a key the mint never files under costs nothing: this set only ever
      KEEPS rows, and a name with no row behind it matches nothing.
    */
    for (const slot of openSlotKeysFor(kind)) {
      if (slotDefinition(slot as FeatureSlot) !== null) named.add(slot as FeatureSlot);
    }
  }
  const facets = facetsWrittenBy(composed);
  const slots = catalogueSlots();
  for (const facet of Array.from(facets)) {
    const assignment = FACET_SLOTS[facet as Facet];
    if (assignment === undefined) continue;
    if ("notASlot" in assignment) continue;
    if ("family" in assignment) {
      for (const slot of slots) {
        if (slot.group === "accessories") named.add(slot.slot);
      }
      continue;
    }
    for (const slot of slots) {
      if (slot.feature === assignment.feature) named.add(slot.slot);
    }
  }
  return named;
}

/** The slots re-cut on every render, whatever was asked — never dropped. */
function remintedEveryRender(): Set<FeatureSlot> {
  return new Set(catalogueSlots().filter((slot) => slot.remint === "everyRender").map((slot) => slot.slot));
}

/**
 * The rows that still ride, and the ones a prune took the ask out from under.
 *
 * Returns both halves rather than the survivors alone: the dropped list is what
 * a log line, a test and a court all need to say what actually happened, and a
 * filter that silently swallowed them would be indistinguishable from a filter
 * that ran on nothing.
 */
export function carriesAfterPruning(input: {
  rows: readonly StoredReference[];
  /** The composed delta of the chain that SURVIVED the prune. */
  composed: RefineDelta;
}): { rows: StoredReference[]; dropped: StoredReference[] } {
  const named = slotsNamedByChain(input.composed);
  const alwaysReminted = remintedEveryRender();
  const rows: StoredReference[] = [];
  const dropped: StoredReference[] = [];
  for (const row of input.rows) {
    const explainedByTheMaster = row.variantId === null;
    const explainedByTheRender = alwaysReminted.has(row.slot);
    const explainedByTheChain = named.has(row.slot);
    if (explainedByTheMaster || explainedByTheRender || explainedByTheChain) rows.push(row);
    else dropped.push(row);
  }
  return { rows, dropped };
}
