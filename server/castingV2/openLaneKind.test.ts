import { describe, expect, it, vi } from "vitest";

import {
  closedSubjectFor,
  foldNoun,
  normalizeOpenKind,
  OPEN_KIND_SYSTEM,
} from "./openLaneKind";
import { FACET_SLOTS } from "./referenceSlotCatalogue";
import { mintedSlotsForRender } from "./mintedSlots";
import { FREE_SUBJECT_KEYS, SUBJECT_NOUNS } from "./refineSubjects";
import type { TextEngine } from "../providers/types";

/**
 * A transport that says exactly what it is told to (law 3).
 *
 * The whole guard being driven here is one the model usually satisfies — it
 * mostly returns clean nouns — so a suite that reached a real model would be
 * testing the model's good behaviour and calling it a control. Every reading
 * below is therefore dictated.
 */
function engineSaying(text: string, extra: { truncated?: boolean } = {}): TextEngine {
  return {
    id: "fake",
    complete: vi.fn(async () => ({
      text,
      provenance: { provider: "fake", model: "fake" } as never,
      latencyMs: 1,
      ...extra,
    })),
  };
}

describe("the closed vocabulary the open lane is checked against", () => {
  it("answers for every closed subject, with no empty list", () => {
    /* Total by TYPE, so this cannot fail by omission — it can only fail by
       somebody satisfying the type with `[]`, which is the same silence one
       layer down. */
    for (const subject of FREE_SUBJECT_KEYS) {
      expect(SUBJECT_NOUNS[subject].length, subject).toBeGreaterThan(0);
    }
  });

  it("gives no folded noun to two different subjects", () => {
    /* A duplicate makes the collision check's answer depend on iteration order,
       which is the quietest kind of wrong. Reported with both owners rather
       than as a bare count, so a failure names what to fix. */
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const subject of FREE_SUBJECT_KEYS) {
      for (const noun of SUBJECT_NOUNS[subject]) {
        const folded = foldNoun(noun);
        const owner = seen.get(folded);
        if (owner && owner !== subject) clashes.push(`"${folded}": ${owner} and ${subject}`);
        else seen.set(folded, subject);
      }
    }
    expect(clashes).toEqual([]);
  });
});

/**
 * THE RESERVED LABEL, kept honest.
 *
 * `openKind` is declared scaffolding: nothing produces it, and a variant with
 * no producer is exactly the shape this program keeps finding written-but-inert
 * rules in. So it gets the two controls that make the declaration checkable —
 * the existing producer still answers correctly (it can say yes), and it cannot
 * reach the new label by any input available to it (it can say no).
 */
describe("the `openKind` unfiled reason, before anything can produce it", () => {
  it("is not reachable from any facet the catalogue owns", () => {
    /* Driven over EVERY facet rather than the three decided absences, because
       the claim is about the whole producer and not about a sample of it. */
    const facets = Object.keys(FACET_SLOTS) as (keyof typeof FACET_SLOTS)[];
    const { unfiled } = mintedSlotsForRender({
      earned: facets,
      captions: Object.fromEntries(facets.map((facet) => [facet, "something"])) as never,
    });
    expect(unfiled.map((entry) => entry.reason)).not.toContain("openKind");
  });

  it("POSITIVE CONTROL — the same producer still names a decided absence", () => {
    /* Without this, the null above is equally consistent with a producer that
       files nothing at all. */
    const { unfiled } = mintedSlotsForRender({
      earned: ["makeup"],
      captions: { makeup: "A soft nude lip" },
    });
    expect(unfiled).toEqual([{ facet: "makeup", reason: "notASlot" }]);
  });
});

describe("folding, which is comparison and not stemming", () => {
  it("folds a plural onto its singular, from either side", () => {
    expect(foldNoun("Cheeks")).toBe(foldNoun("cheek"));
    expect(foldNoun("  HORNS  ")).toBe("horn");
  });

  it("leaves a short word that merely ends in s alone", () => {
    /* "gas", "ass", "cos" — three letters is a word, not a plural, and a rule
       that shortened them would fold unrelated things together. */
    expect(foldNoun("gas")).toBe("gas");
  });

  it("collapses inner whitespace so a two-word noun has one spelling", () => {
    expect(foldNoun("body   shape")).toBe("body shape");
  });
});

describe("the collision check — §1's measured failure, at the guard", () => {
  /*
    THE SPECIMEN. "Her cheeks should be covered in scales" returned `cheeks`
    3/3 — not drift, a systematic keying of the SITE when the sentence makes it
    the grammatical subject. `cheeks` is a hair's breadth from `cheekbones`,
    which the closed lane owns, so this is a routing bug wearing a new kind's
    clothes.
  */
  it("catches `cheeks`, the noun the probe actually produced", () => {
    expect(closedSubjectFor("cheeks")).toBe("cheekbones");
  });

  it("catches the ones no check on the KEYS could have caught", () => {
    /* The misaimed-guard class, pre-empted. None of these strings resembles its
       subject's identifier, and a guard written against `FREE_SUBJECT_KEYS`
       would have passed every one of them. */
    expect(closedSubjectFor("earrings")).toBe("statedAccessories");
    expect(closedSubjectFor("tattoo")).toBe("ink");
    expect(closedSubjectFor("beard")).toBe("facialHair");
    expect(closedSubjectFor("smile")).toBe("expression");
    expect(closedSubjectFor("ponytail")).toBe("hairWorn");
  });

  it("lets the measured open concepts through — the negative control", () => {
    /* Symmetrical harm: a false collision routes a genuinely new ask into a
       closed subject, which is the same bug pointed the other way, and it fails
       SILENTLY. These are the probe's own concepts. */
    for (const kind of ["scales", "wings", "gills"]) {
      expect(closedSubjectFor(kind), kind).toBeNull();
    }
  });

  it("has stopped letting HORNS through, because horns is a subject now", () => {
    /*
      The probe's five open concepts were chosen when none of them existed. Two
      of them do now: horns was promoted off four measurement courts on
      2026-08-14 and carries `antlers` in its nouns, so an ask about either
      belongs to the closed lane and the collision check says so.

      This assertion is the promotion's own footprint at this door. If horns
      were ever unpromoted, this reddens rather than the open lane silently
      re-acquiring a kind the closed one owns.
    */
    expect(closedSubjectFor("horns")).toBe("horns");
    expect(closedSubjectFor("antlers")).toBe("horns");
  });
});

describe("naming the thing an out-of-vocabulary ask is about", () => {
  it("reads a clean key", async () => {
    /* Was "horns" until horns became a closed subject; a clean key has to be a
       kind the closed lane does NOT own, or this test is measuring the
       collision check rather than the reading. */
    const reading = await normalizeOpenKind("give her a curled ram's fleece", {
      engine: engineSaying('{"kind":"fleece"}'),
    });
    expect(reading).toEqual({ ok: true, kind: "fleece" });
  });

  it("reads a key out of a fenced reply, because providers add fences", async () => {
    const reading = await normalizeOpenKind("give her wings", {
      engine: engineSaying('```json\n{"kind":"wings"}\n```'),
    });
    expect(reading).toEqual({ ok: true, kind: "wings" });
  });

  it("refuses a key that names something the closed lane owns", async () => {
    const reading = await normalizeOpenKind("her cheeks should be covered in scales", {
      engine: engineSaying('{"kind":"cheeks"}'),
    });
    expect(reading).toEqual({ ok: false, reason: "collides", kind: "cheeks", subject: "cheekbones" });
  });

  it("refuses a sentence dressed as a key", async () => {
    /* The bars were measured on single nouns. A phrase has not obeyed the
       instruction the measurement was taken under, so keying on it would be
       keying on something nobody proved stable. */
    const reading = await normalizeOpenKind("give her wings", {
      engine: engineSaying('{"kind":"a pair of large feathered wings on her back"}'),
    });
    expect(reading).toEqual({ ok: false, reason: "unreadable" });
  });

  it("refuses a reply that is not JSON at all", async () => {
    const reading = await normalizeOpenKind("give her horns", { engine: engineSaying("horns") });
    expect(reading).toEqual({ ok: false, reason: "unreadable" });
  });

  it("tells OUR ceiling apart from THEIR nonsense", async () => {
    /* Both fail the parse identically. Conflated, the log for a ceiling we set
       reads as a model that cannot follow instructions, and §7 would record it
       as unreadable DEMAND rather than our own limit. */
    const engine = engineSaying('{"kind":"ho', { truncated: true });
    expect(await normalizeOpenKind("give her horns", { engine })).toEqual({ ok: false, reason: "unreadable" });
  });

  it("fails CLOSED with no engine, and never asks", async () => {
    expect(await normalizeOpenKind("give her horns", { engine: null }))
      .toEqual({ ok: false, reason: "unreadable" });
  });

  it("does not call the transport for an empty sentence", async () => {
    const engine = engineSaying('{"kind":"horns"}');
    expect(await normalizeOpenKind("   ", { engine })).toEqual({ ok: false, reason: "unreadable" });
    expect(engine.complete).not.toHaveBeenCalled();
  });

  it("asks on the WIRE in the form the bars were measured under", async () => {
    const engine = engineSaying('{"kind":"horns"}');
    await normalizeOpenKind("give her horns", { engine });
    const sent = vi.mocked(engine.complete).mock.calls[0]![0];
    expect(sent.system).toBe(OPEN_KIND_SYSTEM);
    expect(sent.user, "the sentence itself, not a rewrite of it").toBe("give her horns");
    /* §1's fix, asserted where it is sent rather than where it is written. */
    expect(sent.system).toContain("never the place it goes");
    expect(sent.system).toContain("never the change");
  });
});
