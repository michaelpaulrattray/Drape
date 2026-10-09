import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { CASTING_V2_VIEW_RETRY_PRICE_CREDITS } from "../casting/castingCreditCosts";
import {
  CASTING_V2_PACKAGE_REDO_PRICE_CREDITS,
} from "../casting/castingCreditCosts";
import {
  castPackageRedoOffer,
  castSlotRetryOffer,
  type CastSlotProjection,
} from "./castProjection";

/**
 * NO VIEW IS EVER ASKED FOR FREE — #1903 slice 3, his ruling of 2026-10-07.
 *
 * His words, verbatim: *"i think we ditch the measure and checker i mean it
 * been nothing but problems it should only detect catastropic failure the image
 * engine is excellent and following our prompting"*, and then, on what replaces
 * the apology: *"maybe we should allow retry by default incase they didnt like
 * the outfit that was invented or whatever but it costs per retry and regens
 * all views not just one"*.
 *
 * # Why this suite exists at all, and what it is standing in for
 *
 * Slice 3 deleted a rule, and deleting a rule deletes its guards. Three sets
 * went with it — `viewRetryFreeOnce.test.ts` entire (18 arms on the
 * one-free-then-paid accounting), ten arms on the delivered-unchecked reader,
 * and five on the free money road at the till. **Every one of them was right
 * about the rule it tested.**
 *
 * ⚠ **BUT A DELETION THAT ONLY REMOVES COVERAGE LEAVES THE PRODUCT LESS
 * GUARDED THAN IT WAS THE DAY BEFORE**, and the thing most likely to undo this
 * card is not malice — it is a later reader restoring a `priceCredits: 0`
 * branch because an apology seems kind. So the coverage is not dropped: it is
 * INVERTED. These arms hold the live rule, which is strictly stronger than the
 * one they replace, because the old rule permitted a free ask and this one
 * permits none.
 *
 * # What is NOT being asserted, so the suite is not read as more than it is
 *
 * It says nothing about whether the judge runs, what it records, or whether an
 * unjudgeable view is delivered. D-246 is untouched and is covered where it
 * lives (`packageOrchestrator.test.ts`). This suite is about the PRICE and the
 * OFFER only.
 */

const PROJECTION = resolve(import.meta.dirname, "castProjection.ts");
const SERVICE = resolve(import.meta.dirname, "viewRetryService.ts");
const RETRY_DB = resolve(import.meta.dirname, "../db/castingV2ViewRetry.ts");

/** Every state the projection can put a slot in, so the walk below is total. */
const SLOT_STATES = ["pending", "building", "ready", "failed-refunded"] as const;

/**
 * Every shape of slot the offer can be asked about — the cross product of state,
 * stand-in and refund, which is the whole of what the function reads.
 *
 * Built rather than listed: the function's parameter is a `Pick` of exactly
 * these three fields, so this is the entire input space and not a sample of it.
 */
function everySlotShape(): Array<{ name: string; slot: CastSlotProjection }> {
  const shapes: Array<{ name: string; slot: CastSlotProjection }> = [];
  for (const state of SLOT_STATES) {
    for (const standIn of [undefined, true, false] as const) {
      for (const refundedCredits of [null, 0, 200] as const) {
        shapes.push({
          name: `${state}/standIn=${String(standIn)}/refunded=${String(refundedCredits)}`,
          slot: { state, standIn, refundedCredits } as unknown as CastSlotProjection,
        });
      }
    }
  }
  return shapes;
}

describe("no view is ever asked for free (#1903 slice 3)", () => {
  /**
   * ⚠ **THE ONE ARM THIS WHOLE SUITE IS FOR.**
   *
   * An INJECTED price that is neither of the product's own numbers, so a branch
   * that reached for a constant instead of the argument cannot pass by
   * coincidence — the same discipline `viewRetryOffer.test.ts` already applies
   * to its state walk.
   */
  it("NO slot shape produces ANY offer — walked over the function's whole input space (#2089)", () => {
    /*
      ⚠ **THIS ARM'S FLOOR WAS `offers > 0` AND IT IS NOW THE OPPOSITE — #2089,
      his word of 2026-10-08: *"regenerate is the only option"*.** It used to
      hold that the paid Try again on a refunded view still existed; his ruling
      retired that too, so the strongest form of "never free" is now "never
      offered". The floor that keeps this honest moves to the WALK: it must have
      visited the shapes that used to offer, or an empty walk would pass.
    */
    const price = 777;
    let walked = 0;
    let formerlyOffered = 0;
    for (const { name, slot } of everySlotShape()) {
      walked += 1;
      if (slot.state === "failed-refunded" || (slot.state === "ready" && slot.standIn === true && slot.refundedCredits !== null)) {
        formerlyOffered += 1;
      }
      expect(castSlotRetryOffer(slot, price), `${name}: offered a per-view ask`).toBeNull();
    }
    expect(walked).toBe(SLOT_STATES.length * 9);
    expect(formerlyOffered, "the walk never reached a refunded shape").toBeGreaterThan(0);
  });

  it("a DELIVERED view has nothing to ask for, at any price", () => {
    /*
      `ready` and not a stand-in is the shape every delivered view has — the one
      that used to carry the free ask. A refund figure on it changes nothing:
      only the stand-in road reads that field.
    */
    for (const refundedCredits of [null, 0, 200] as const) {
      expect(
        castSlotRetryOffer(
          { state: "ready", refundedCredits } as unknown as CastSlotProjection,
          777,
        ),
        `a delivered view with refunded=${String(refundedCredits)} is offering something`,
      ).toBeNull();
    }
  });

  it("⚠ CONTROL — the remedy still exists: the whole-set redo is offered on a Cast whose views offer nothing", () => {
    /*
      This control used to hold that a REFUNDED view still offered a paid Try
      again, so that a function refusing everything could not pass the arms
      above while taking a customer's remedy away. #2089 retired that remedy BY
      RULING and named its replacement — *"regenerate is the only option"* — so
      the control now holds the replacement: on the very slots that used to
      offer, the package-level offer is present, priced, and not free.
    */
    const slots = [
      { retrying: undefined },
      { retrying: undefined },
    ] as unknown as CastSlotProjection[];
    const redo = castPackageRedoOffer({ status: "ready", slots }, CASTING_V2_PACKAGE_REDO_PRICE_CREDITS);
    expect(redo).toEqual({ priceCredits: CASTING_V2_PACKAGE_REDO_PRICE_CREDITS });
    expect(CASTING_V2_PACKAGE_REDO_PRICE_CREDITS).toBeGreaterThan(0);
    /* And the per-view price still exists as a constant for the in-flight road
       — it is the price those operations were bought at. */
    expect(CASTING_V2_VIEW_RETRY_PRICE_CREDITS).toBeGreaterThan(0);
  });
});

/**
 * THE MACHINERY IS GONE, NOT MERELY UNREACHABLE.
 *
 * The arms above hold the behaviour. These hold the absence of the roads that
 * produced it — because a dead branch beside a live rule is an invitation to
 * re-enter it, which is the sentence `packageOrchestrator.ts` already carries
 * about the `deliver anyway` branch this card's slice 1 deleted.
 *
 * ⚠ **READ AT THE DECLARATION, NEVER AT THE EFFECT.** A behavioural arm cannot
 * see a resurrected spent-ask list that is read and then ignored; a source read
 * can, and that is the only reason these are text arms.
 */
describe("the free-ask machinery is deleted, not left standing", () => {
  const sourceOf = (path: string) => readFileSync(path, "utf8");

  /** Source with comments stripped — the retirement notes NAME these symbols. */
  const code = (source: string) => source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");

  it("the projection declares no unjudged field and no spent-ask input", () => {
    const projection = code(sourceOf(PROJECTION));
    expect(projection).not.toContain("unjudged?: true");
    expect(projection).not.toContain("freeRetrySpentAngles");
    expect(projection).not.toContain("freeRetrySpent");
    /*
      THE POSITIVE CONTROL: this really is the projection, so the three refusals
      above are refusing something in a file that exists and was read. A path
      typo, or a comment-stripper that ate the whole file, would otherwise pass
      all three.
    */
    expect(projection).toContain("export function castSlotRetryOffer");
    expect(projection).toContain("export type CastSlotRetry");
  });

  it("the offer takes TWO arguments — a third would be an accounting fact returning", () => {
    const projection = sourceOf(PROJECTION);
    const start = projection.indexOf("export function castSlotRetryOffer");
    expect(start).toBeGreaterThan(-1);
    /* Sliced to the signature, so a mention of the price anywhere in the body
       cannot satisfy this. */
    const signature = projection.slice(start, projection.indexOf("{", start));
    expect(signature).toContain("slot:");
    expect(signature).toContain("paidRetryPrice: number");
    expect(signature).not.toContain("freeRetrySpent");
  });

  it("the till reads the offer with no third fact, and the service carries no spent list", () => {
    const service = code(sourceOf(SERVICE));
    expect(service).not.toContain("freeRetrySpentAngles");
    expect(service).not.toContain("listSpentFreeViewRetryAngles");
    /* The positive control: the till still re-reads the offer rather than
       trusting the button, which is the rule the absences above sit inside. */
    expect(service).toContain("castSlotRetryOffer(slot, CASTING_V2_VIEW_RETRY_PRICE_CREDITS)");
  });

  it("the operation-row accounting for a spent free ask is deleted", () => {
    const db = code(sourceOf(RETRY_DB));
    expect(db).not.toContain("spentFreeViewRetryFilter");
    expect(db).not.toContain("listSpentFreeViewRetryAngles");
    /*
      ⚠ And `plannedCredits = 0` is no longer a predicate anywhere in this
      module. That was the free/paid discriminator, and a reader asking it again
      would be asking about a value this road can no longer write.
    */
    expect(db).not.toContain("generationOperations.plannedCredits, 0");
    /* The positive control, so the four refusals are not passing on an empty
       read: the module's live view-replacement readers are still here. */
    expect(db).toContain("export function runningViewRetryFilter");
    expect(db).toContain("export async function listRunningViewRetryAngles");
  });
});
