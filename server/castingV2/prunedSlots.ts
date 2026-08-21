/**
 * WHAT A PRUNED STEP NAMES WHEN NO FACET CAN NAME IT.
 *
 * A removal that lands on a combination the cast has never worn must RE-RENDER,
 * and the repaint road builds that render's ask from the SLOTS the prune struck
 * (`restateAsksForPrune`). Every ordinary facet answers that question through
 * `slotsForFacet` — hair is `hair`, an eye colour is both eyes, an accessory is
 * its kind's pair. **Two do not, and both were driven to a charge and a refund
 * before this module existed** (opus-971, granted fable-1322 §2, ruled
 * fable-1324):
 *
 *   ink        `slotsForFacet("ink", …)` is `perPlacement` — it answers with no
 *              slots unless the caller hands it a placement, and a prune has
 *              never handed it one. Measured at the wire: *"take his chest
 *              tattoo off"* on a mid-chain branch computed the prune perfectly,
 *              then charged 25 credits and refunded them, on the shipped stated
 *              path, live for every repaint customer.
 *   open kind  `facetsWrittenBy` is blind to `delta.open`, so the struck facet
 *              set comes out EMPTY and the road refuses one line earlier — the
 *              same blindness fable-900 §2b fixed at the out-of-frame door, one
 *              door along and still unfixed here.
 *
 * # The slot is not unknowable — it is written down twice and was read from
 * # neither
 *
 * The pointers FIRST: a step that minted anything carries `inkApplied` /
 * `inkDelivered`, and their KEYS are slot keys already (`ink:upperChest`,
 * `ink:upperArm@left`). That is the fact recorded by the render that put the
 * tattoo there, and nothing about it is a reading.
 *
 * Her WORDS second, and only when the step carries no pointer at all — a
 * words-road step whose mint never fired, or a reference step that delivered
 * nothing. The vocabulary decision is `resolveInkPlacement`'s, the words road's
 * own reader, never a second one (working law 4); this module only lifts the
 * surface noun out of the step's own text, exactly as `inkSlotSheAsksAbout`
 * lifts it out of hers.
 *
 * # What it deliberately will NOT do
 *
 * A per-side surface with no side in the step's words returns NOTHING rather
 * than guessing or naming both. *Sleeve implies arm implies pick one* is the
 * inference fable-1115 §3 outlawed, and the legacy ink road paid 300 credits
 * twice for the wrong anatomical side. The caller answers that case free and
 * before the claim, which is the honest half of ruling fable-1324's (iii).
 */
import {
  INK_PLACEMENTS, inkPlacementBareNoun, inkPlacementEntry, isInkPlacement,
} from "../../shared/inkPlacementVocabulary";
import { resolveInkPlacement } from "./inkPlacementResolve";
import { INK_POINTER_FIELDS, type RefineDelta } from "./refineDelta";
import { inkSideSlotKey, inkSlotKey, openSlotKey } from "./referenceSlots";
import { sideNamedIn } from "./repaintAsks";

/** Every ink word this step filed, as one searchable string. */
function inkWordsOf(delta: RefineDelta): string {
  const said = delta.free?.ink;
  if (said === undefined || said === null) return "";
  return (Array.isArray(said) ? said : [said]).join(" ; ");
}

/**
 * The ink slot keys the step's own POINTERS name — the recorded fact.
 *
 * Derived from `INK_POINTER_FIELDS` rather than from two hand-written reads, so
 * the day a third pointer is added it reaches here without a second edit.
 */
function pointerSlots(delta: RefineDelta): string[] {
  const keys: string[] = [];
  for (const field of INK_POINTER_FIELDS) {
    for (const key of Object.keys(delta[field] ?? {})) keys.push(key);
  }
  return keys;
}

/**
 * The ink slot the step's own WORDS name, or null.
 *
 * Null covers three honest cases and one refusal: no ink words at all, no
 * measured surface in them, a surface the vocabulary has not measured, and a
 * per-side surface with no side stated.
 */
function slotFromWords(delta: RefineDelta): string | null {
  const words = inkWordsOf(delta);
  if (words.trim() === "") return null;
  const said = words.toLowerCase();
  /*
    Longest noun first, so *"upper arm"* is never answered by a shorter surface
    that happens to be a substring of a longer one. The list is the vocabulary's
    own, so a fourth surface arrives here already ordered.
  */
  const named = INK_PLACEMENTS
    .filter((placement) => said.includes(inkPlacementBareNoun(placement).toLowerCase()))
    .sort((a, b) => inkPlacementBareNoun(b).length - inkPlacementBareNoun(a).length);
  /* Two surfaces in one step's words is a step this cannot name with one slot,
     and naming the first would be picking. */
  if (named.length !== 1) return null;
  const resolved = resolveInkPlacement(inkPlacementBareNoun(named[0]!));
  if (resolved.kind !== "measured" || !isInkPlacement(resolved.placement)) return null;
  if (inkPlacementEntry(resolved.placement).sides === "one") {
    return inkSlotKey(resolved.placement);
  }
  const side = sideNamedIn(words);
  return side === null ? null : inkSideSlotKey(resolved.placement, side);
}

/**
 * Every slot key a pruned step names that its facets cannot.
 *
 * Empty is a real answer and the caller must treat it as one: a prune this
 * cannot name is answered free and before the claim, never charged and refunded.
 */
export function slotsOfPrunedStep(delta: RefineDelta): string[] {
  const keys = new Set<string>();
  const pointers = pointerSlots(delta);
  if (pointers.length > 0) {
    for (const key of pointers) keys.add(key);
  } else {
    const fromWords = slotFromWords(delta);
    if (fromWords !== null) keys.add(fromWords);
  }
  /*
    THE OPEN LANE'S SIDELESS KEY, and not `openSlotKeysFor`'s three.
    A restate names what the render is taking back so the verification has a
    question to ask; asking it of two sides of a kind whose locality nobody has
    read would be inventing instances the library may never have filed.
  */
  for (const kind of Object.keys(delta.open ?? {})) keys.add(openSlotKey(kind));
  return Array.from(keys);
}
