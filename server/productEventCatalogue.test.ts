/**
 * THE CONTROL ON THE PRODUCT EVENT STREAM (#509 part 2).
 *
 * `shared/productEventCatalogue.ts` decides what may leave the building. This
 * suite holds it to three things, and the first two are DERIVED rather than
 * transcribed — a list of expectations kept in step by hand would be the same
 * mirror (working law 4) the catalogue exists to avoid:
 *
 *   1. Every generation operation kind has an English noun, and every noun has
 *      a kind. Read out of `operationContract.ts` itself.
 *   2. The error vocabulary is tRPC's ENTIRE vocabulary. Read out of tRPC
 *      itself — the first draft of that list was a copy of a DIFFERENT list in
 *      `directOperation.ts` and silently dropped `SERVICE_UNAVAILABLE`,
 *      `GATEWAY_TIMEOUT` and `BAD_GATEWAY`, which is what a failing image
 *      provider returns.
 *   3. **No declared property can carry free text at all.** Not "does not
 *      today" — cannot, for every event and every property, driven rather than
 *      reasoned about. That is the one claim the metadata-only boundary rests
 *      on here, so it is proven over the whole declared population rather than
 *      spot-checked on the properties somebody thought of.
 */
import { describe, expect, it } from "vitest";
import { TRPC_ERROR_CODES_BY_KEY } from "@trpc/server/unstable-core-do-not-import";

import { GENERATION_OPERATION_KINDS } from "./casting/operationContract";
import {
  GENERATION_OUTCOMES,
  PRODUCT_EVENT_ERROR_CODES,
  PRODUCT_EVENT_PROPERTIES,
  PRODUCT_EVENTS,
  PRODUCT_NOUN,
  UNNAMED_ACTION,
  UNRECOGNISED,
  productErrorCode,
  productNoun,
  projectProductEvent,
} from "../shared/productEventCatalogue";

/** A world and a release that pass, so an arm is testing the property it names. */
const WORLD = { world: "railway:production", release: "0123456789abcdef0123456789abcdef01234567" };

describe("every generation this product performs has an English name", () => {
  it("⚠ names EVERY operation kind — a new kind fails here before it reaches a dashboard", () => {
    const unnamed = GENERATION_OPERATION_KINDS.filter((kind) => !(kind in PRODUCT_NOUN));
    expect(unnamed, "these operation kinds have no word the founder would use").toEqual([]);
  });

  it("⚠ names NOTHING THAT IS NOT A KIND — a noun left behind by a deleted kind is dead weight", () => {
    const kinds = new Set<string>(GENERATION_OPERATION_KINDS);
    expect(Object.keys(PRODUCT_NOUN).filter((named) => !kinds.has(named))).toEqual([]);
  });

  it("the population it was derived from is real, not an empty list agreeing with itself", () => {
    expect(GENERATION_OPERATION_KINDS.length).toBeGreaterThan(20);
    expect(Object.keys(PRODUCT_NOUN).length).toBe(GENERATION_OPERATION_KINDS.length);
  });

  it("uses no pipeline vocabulary in a word the founder reads (the DT law on a staff surface)", () => {
    for (const [kind, noun] of Object.entries(PRODUCT_NOUN)) {
      expect(noun, `${kind} is named with its own kind string`).not.toContain(".");
      expect(noun, `${kind} is named with a namespace`).not.toMatch(/castingV2|evidence_|canvas\.|model\./);
      expect(noun.trim().length, `${kind} has an empty name`).toBeGreaterThan(0);
    }
  });

  it("falls back to a NAMED unknown rather than to a wrong noun", () => {
    expect(productNoun("castingV2.roll")).toBe("roll");
    expect(productNoun("something.nobody.declared")).toBe(UNNAMED_ACTION);
  });
});

describe("the error vocabulary is tRPC's, entire", () => {
  it("⚠ holds every code tRPC declares — derived from tRPC, never copied", () => {
    const trpc = Object.keys(TRPC_ERROR_CODES_BY_KEY).sort();
    expect(trpc.length).toBeGreaterThan(15);
    expect([...PRODUCT_EVENT_ERROR_CODES].sort()).toEqual(trpc);
  });

  it("⚠ carries the three a failing image provider returns — the specimens the first draft lost", () => {
    for (const code of ["SERVICE_UNAVAILABLE", "GATEWAY_TIMEOUT", "BAD_GATEWAY"]) {
      expect(productErrorCode(code), `${code} would arrive as ${UNRECOGNISED}`).toBe(code);
    }
  });

  it("falls back to a NAMED unknown rather than to free text", () => {
    expect(productErrorCode("SOMETHING_NEW")).toBe(UNRECOGNISED);
  });
});

describe("⚠ NO DECLARED PROPERTY CAN CARRY FREE TEXT — driven over the whole population", () => {
  /* Every string a customer's work could reach an event as. Each must be
     refused by EVERY property of EVERY event, or the metadata-only boundary
     rests on nobody having tried. */
  const CUSTOMER_PROSE = [
    "a tall woman in a red coat",
    "https://pub-abc.r2.dev/casts/secret.png",
    "someone@example.com",
    "The engine refused: a tall woman in a red coat",
    "",
    "roll; DROP TABLE",
  ];

  it("refuses prose in every property of every event", () => {
    let checked = 0;
    for (const event of PRODUCT_EVENTS) {
      for (const property of Object.keys(PRODUCT_EVENT_PROPERTIES[event])) {
        for (const prose of CUSTOMER_PROSE) {
          const verdict = projectProductEvent(event, { ...WORLD, [property]: prose });
          checked += 1;
          expect(
            verdict.verdict,
            `${event}.${property} accepted the string ${JSON.stringify(prose)}`,
          ).toBe("refuse");
        }
      }
    }
    /* The tally is the verdict, not the absence of a failure: a population that
       silently became empty would pass every arm above (memory: a case list
       every arm clears reads as 100% caught). */
    expect(checked).toBe(
      PRODUCT_EVENTS.reduce(
        (total, event) => total + Object.keys(PRODUCT_EVENT_PROPERTIES[event]).length * CUSTOMER_PROSE.length,
        0,
      ),
    );
    expect(checked).toBeGreaterThan(30);
  });

  it("declares no property shape that could ever take prose", () => {
    /* The arm above proves it behaviourally; this proves it structurally, so a
       future `{ type: "text" }` shape is caught at the declaration rather than
       only when somebody sends something through it. */
    for (const event of PRODUCT_EVENTS) {
      for (const [key, shape] of Object.entries(PRODUCT_EVENT_PROPERTIES[event])) {
        expect(["count", "boolean", "vocabulary"], `${event}.${key}`).toContain(shape.type);
      }
    }
  });
});

describe("the gate drops what it does not know and refuses what is malformed", () => {
  it("sends a well-formed event, rebuilt from the allowlist", () => {
    const verdict = projectProductEvent("generation delivered", {
      ...WORLD,
      action: "roll",
      outcome: "partial",
      creditsCharged: 160,
      creditsRefunded: 40,
    });
    expect(verdict.verdict).toBe("send");
    if (verdict.verdict !== "send") return;
    expect(verdict.properties).toEqual({
      ...WORLD,
      action: "roll",
      outcome: "partial",
      creditsCharged: 160,
      creditsRefunded: 40,
    });
    expect(verdict.dropped).toEqual([]);
  });

  it("⚠ DROPS an undeclared key and still sends — an extra field is not a defect", () => {
    const verdict = projectProductEvent("generation started", {
      ...WORLD,
      action: "sign",
      masterPrompt: "a tall woman in a red coat",
    });
    expect(verdict.verdict).toBe("send");
    if (verdict.verdict !== "send") return;
    expect(verdict.properties).toEqual({ ...WORLD, action: "sign" });
    expect(verdict.dropped).toEqual(["masterPrompt"]);
  });

  it("⚠ REFUSES the whole event when a DECLARED key is malformed — half an event would hide it", () => {
    const verdict = projectProductEvent("generation delivered", {
      ...WORLD,
      action: "roll",
      outcome: "complete",
      creditsCharged: -1,
      creditsRefunded: 0,
    });
    expect(verdict).toEqual({ verdict: "refuse", key: "creditsCharged", reason: "wrong shape" });
  });

  it("refuses an event name nobody declared", () => {
    expect(projectProductEvent("credits bought", WORLD)).toEqual({
      verdict: "refuse",
      key: "credits bought",
      reason: "unknown event",
    });
  });

  it("treats an ABSENT optional property as absent, never as malformed", () => {
    /* `release` is null on every laptop and in every test. A refusal there would
       mean the stream only ever worked on Railway. */
    const verdict = projectProductEvent("generation started", {
      world: "local",
      release: null,
      action: "roll",
    });
    expect(verdict.verdict).toBe("send");
    if (verdict.verdict !== "send") return;
    expect(verdict.properties).toEqual({ world: "local", action: "roll" });
  });

  it("checks `world` and `release` by SHAPE, since neither is a closed list", () => {
    for (const world of ["local", "node:production", "railway:production", "railway:staging"]) {
      expect(projectProductEvent("generation started", { world, action: "roll" }).verdict).toBe("send");
    }
    for (const world of ["prod", "railway:", "a tall woman in a red coat", "railway:a b"]) {
      expect(
        projectProductEvent("generation started", { world, action: "roll" }).verdict,
        `${world} was accepted as a world`,
      ).toBe("refuse");
    }
    expect(projectProductEvent("generation started", { ...WORLD, release: "abc1234", action: "roll" }).verdict).toBe("send");
    expect(projectProductEvent("generation started", { world: "local", release: "not-a-sha", action: "roll" }).verdict).toBe("refuse");
  });

  it("accepts only the outcomes this product has words for", () => {
    for (const outcome of GENERATION_OUTCOMES) {
      expect(
        projectProductEvent("generation delivered", { ...WORLD, action: "roll", outcome }).verdict,
      ).toBe("send");
    }
    expect(
      projectProductEvent("generation delivered", { ...WORLD, action: "roll", outcome: "succeeded" }).verdict,
    ).toBe("refuse");
  });
});
