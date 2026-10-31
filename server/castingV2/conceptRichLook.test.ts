/**
 * THE RICH LOOK, THE FACE AND HAIR LEFT FREE — the second reading (#2911).
 *
 * Every reading here is DICTATED through a fake transport, as in
 * `conceptDescribe.test.ts` (working law 3): a suite that reached the live
 * model would be measuring its manners. What a suite cannot answer — whether a
 * real picture now reads as a rich look with no face and no hair in it — is
 * the acceptance read on his concept picture, through `describeConcept`, on
 * the record on the PR.
 *
 * # WHICH OF TODAY'S GUARDS THIS FILE RE-ASKS, AND WHICH IT DOES NOT
 *
 * `conceptDescribe.test.ts` keeps guarding TODAY's reader, unchanged, because
 * today's reader is unchanged (`conceptReaderWire.test.ts` pins its bytes).
 * The rich look gets its own equivalent of every guard whose RULE it keeps:
 * the being-not-person line held against the roll road's wall, the IP rule,
 * the medium rule, the hardware rule with its refusal reason in its own
 * neighbourhood, the never-mention list, the absence rule, the closed build
 * list and the size ban, the surface and creature rules, the species-over-
 * styling precedence beside the target, the envelope on every re-ask, both
 * sweeps at runtime, and the specimens inside the bounds.
 *
 * Today's guards that do NOT carry over, each because the rule they guard is
 * the one this reading changes on his word: the HAIR WORLD and the "never the
 * cut" rule (the hair is not mentioned at all now), "WORLDS, NEVER ITEMS" and
 * "never itemise" with "never name a single worn accessory" (signature pieces
 * are now the point — *"give it details to imagine"*), the ~150–250 target and
 * the 300/400 ceilings (the rich look's own numbers replace them), and
 * {@link GOLDEN_NOTES} / {@link INVENTORY_NOTE} as specimens (both carry hair,
 * so neither may be shown to this reader; {@link RICH_LOOK_NOTES} stands in).
 */
import { describe, expect, it, vi } from "vitest";

import {
  BUILD_FAMILIES,
  CONCEPT_DESCRIPTION_MIN,
  CONCEPT_RICH_LOOK_MAX,
  CONCEPT_RICH_LOOK_MAX_RETRY,
  CONCEPT_RICH_LOOK_TARGET,
  GOLDEN_NOTES,
  INVENTORY_NOTE,
  RICH_LOOK_NOTES,
  absenceClaimIn,
  describeConcept,
  notAboutThePersonIn,
} from "./conceptDescribe";
import { SUBJECT_INSTRUCTION } from "./interpreter";
import type { TextEngine } from "../providers/types";

const PICTURE = { bytes: Buffer.from("a-picture"), contentType: "image/png" };
const said = (description: string | null) => JSON.stringify({ description });

function engineSaying(...replies: string[]): TextEngine & { sent: { system: string; user: string }[] } {
  const sent: { system: string; user: string }[] = [];
  let index = 0;
  return {
    id: "fake",
    sent,
    complete: vi.fn(async (request: { system: string; user: string }) => {
      sent.push({ system: request.system, user: request.user });
      const text = replies[Math.min(index, replies.length - 1)];
      index += 1;
      return { text, provenance: { provider: "fake", model: "fake" } as never, latencyMs: 1 };
    }),
  } as never;
}

/**
 * THE READING HE PICKED, as the bench returned it — 602 characters, compared
 * byte for byte against `drape-scratch/concept-bench/facefree-descriptions.json`
 * when it was copied here (a local file, never committed). It names the
 * hair ("long dark hair"), which is why the hair line was then taken out; it is
 * used here for its LENGTH and its shape, the thing today's bounds refuse.
 */
const HIS_PICK =
  "A young adult East Asian woman with an athletic build, cast as a cyberpunk mercenary with long dark "
  + "hair. Cybernetic augmentations include a dark ribbed synthetic casing fused up the throat and "
  + "jawline, plus a central mechanical core plate fitted at the waist. Dark graphic tattoos mark the "
  + "face, arms, and flanks. Signature pieces include glowing round goggles on the forehead, asymmetrical "
  + "shoulder and arm armor, and plated gauntlets with cord wraps. The wardrobe blends a cropped "
  + "matte-black top with tech-text, low-slung utility shorts with metal hardware, tactical thigh "
  + "straps, and fishnet mesh.";

/** A rich look of `length` characters, clean through both sweeps. */
function richOf(length: number): string {
  const sentence = "Dark graphic tattoos run down both arms and a mechanical core plate is fitted at the waist. ";
  return `A young adult woman, a cyberpunk operative type. ${sentence.repeat(20)}`.slice(0, length - 1) + ".";
}

const systemOf = async () => {
  const engine = engineSaying(said(RICH_LOOK_NOTES.right));
  await describeConcept({ ...PICTURE, engine, richLook: true });
  return engine.sent[0]!.system;
};

const todaySystemOf = async () => {
  const engine = engineSaying(said(GOLDEN_NOTES.plain));
  await describeConcept({ ...PICTURE, engine });
  return engine.sent[0]!.system;
};

/** A slice from an anchor, with a non-empty floor (an absent anchor must not pass as an empty slice). */
const sliceFrom = (system: string, anchor: string, length: number) => {
  const at = system.indexOf(anchor);
  expect(at, `anchor: ${anchor}`).toBeGreaterThan(-1);
  const slice = system.slice(at, at + length).replace(/\s+/g, " ");
  expect(slice.length, `anchor: ${anchor}`).toBeGreaterThan(anchor.length);
  return slice;
};

/* The face's own words and the hair's, as a describer would write them. */
const FACE_OR_HAIR = /\bhair\b|\bbangs\b|\bfringe\b|platinum|\beyes\b|eye colou?r|eyeliner|make-?up|\blips\b|\bbrows?\b|cheekbones?|\bjaw/i;
const BARE_BODY = /\b(torso|chest|belly|ribs|abdomen|midriff)\b/i;

describe("the flag chooses the instruction", () => {
  it("sends a different instruction when on — and today's when off", async () => {
    const rich = await systemOf();
    const today = await todaySystemOf();
    expect(rich).not.toBe(today);
    expect(rich).toContain("RICH");
    expect(today).toContain("SHORT CASTING NOTE");
  });

  it("does not show this reader today's specimens — every one of them names the hair", async () => {
    const system = await systemOf();
    for (const note of [GOLDEN_NOTES.plain, GOLDEN_NOTES.styled, GOLDEN_NOTES.secondMan, INVENTORY_NOTE]) {
      expect(FACE_OR_HAIR.test(note), "the reason they are excluded must stay true").toBe(true);
      expect(system).not.toContain(note);
    }
  });
});

describe("no face and no hair — his line", () => {
  it("tells the reader the face stays free, naming each thing he named", async () => {
    const rule = sliceFrom((await systemOf()).toLowerCase(), "the face stays free", 420);
    for (const part of ["no eye colour", "eyeliner or makeup", "no lips", "no brows", "face shape"]) {
      expect(rule, part).toContain(part);
    }
    /* Hardware and markings on the face are NOT the face — his reply 28 holds. */
    expect(rule, "fitted hardware is not the face").toContain("hardware fitted into the face");
  });

  it("tells the reader the hair is not mentioned at all — his 'we just settle on that'", async () => {
    const rule = sliceFrom((await systemOf()).toLowerCase(), "the hair is not mentioned at all", 260);
    for (const part of ["colour", "length", "cut", "style"]) expect(rule, part).toContain(part);
    /* And a creature's surface is not its hair, so #231's 'write hairless' survives. */
    expect(rule, "the surface is not the hair").toContain("surface rather than its hair");
  });

  it("carries NO instruction to write the hair or the face — none of today's hair lines survive", async () => {
    const system = (await systemOf()).toLowerCase();
    for (const todays of [
      "hair world", "sculpted platinum", "hair going grey", "never the cut", "the fringe or the fade",
      "take it to a barber",
    ]) {
      expect(system, todays).not.toContain(todays);
    }
    /* Positive control: the same phrases ARE in today's instruction, so this arm can fail. */
    const today = (await todaySystemOf()).toLowerCase();
    for (const todays of ["hair world", "sculpted platinum", "never the cut"]) {
      expect(today, `control: ${todays}`).toContain(todays);
    }
  });

  it("its RIGHT specimen names nothing about the face or the hair", () => {
    expect(RICH_LOOK_NOTES.right).not.toMatch(FACE_OR_HAIR);
    /* Control: the regex can see a face and a haircut. */
    expect(RICH_LOOK_NOTES.faceAndHair).toMatch(FACE_OR_HAIR);
  });

  it("its WRONG specimen is wrong ONLY on the face and the hair — the pieces are the right note's", () => {
    for (const shared of [
      "dark-fashion / cyber-goth model type with pale skin",
      "fitted mechanical eye is set into the face",
      "Facial piercings and fine-line markings across the face",
      "script tattoos running down both arms",
      "black lace, leather and metal accents in a fitted, layered silhouette",
    ]) {
      expect(RICH_LOOK_NOTES.right, shared).toContain(shared);
      expect(RICH_LOOK_NOTES.faceAndHair, shared).toContain(shared);
    }
    for (const fixed of ["green eyes", "eyeliner", "lips", "brows", "platinum hair", "bangs"]) {
      expect(RICH_LOOK_NOTES.faceAndHair, fixed).toContain(fixed);
    }
  });

  it("shows the reader both, the wrong one LABELLED and its reason after it", async () => {
    const system = await systemOf();
    expect(system).toContain(RICH_LOOK_NOTES.right);
    const at = system.indexOf(RICH_LOOK_NOTES.faceAndHair);
    expect(at).toBeGreaterThan(-1);
    expect(system.slice(Math.max(0, at - 120), at)).toContain("WRONG");
    expect(system.slice(at).toLowerCase()).toContain("only where it describes the face and the hair");
    expect(system.indexOf(RICH_LOOK_NOTES.right)).toBeLessThan(at);
  });
});

describe("the standout trait is a direction, never a value — his eye edit, generalised", () => {
  it("says so, with his own example of the wrong form", async () => {
    const rule = sliceFrom((await systemOf()).toLowerCase(), "a standout trait is a direction, never a value", 420);
    expect(rule).toContain("genuinely unusual for this type");
    expect(rule).toContain("an unusual eye colour");
    expect(rule).toContain("never \"green eyes\"");
    expect(rule, "an ordinary trait is not a standout").toContain("ordinary for the type goes");
  });
});

describe("never a bare body area — the request-stage refusal he measured", () => {
  it("names the areas once, in the rule, with the reason — and nowhere else in the instruction", async () => {
    const system = await systemOf();
    const at = system.indexOf("NEVER NAME A BARE BODY AREA");
    expect(at).toBeGreaterThan(-1);
    const end = system.indexOf("image engine refuses notes that name them", at);
    expect(end, "the reason travels with the rule").toBeGreaterThan(at);
    const rule = system.slice(at, end);
    for (const area of ["torso", "chest", "belly", "ribs", "abdomen", "midriff"]) {
      expect(rule, area).toContain(area);
    }
    /* THE BENCH'S OWN CONTRADICTION, held shut: its hardware example said
       "an implant plate in the abdomen" two lines above this ban. Outside the
       rule, no example and no specimen may name one. */
    const elsewhere = system.slice(0, at) + system.slice(end);
    expect(elsewhere).not.toMatch(BARE_BODY);
  });

  it("is a rule and not a sweep — a robot's torso is its anatomy (declared)", async () => {
    const note = `${RICH_LOOK_NOTES.right.slice(0, -1)}, over a chrome torso.`;
    expect(notAboutThePersonIn(note)).toBeNull();
    expect(await describeConcept({ ...PICTURE, engine: engineSaying(said(note)), richLook: true }))
      .toEqual({ ok: true, description: note, attempts: 1 });
  });
});

describe("kept from today's rules — each one re-asked of the rich look", () => {
  it("draws the same being line the roll road's wall draws", async () => {
    const describer = (await systemOf()).toLowerCase();
    const wall = SUBJECT_INSTRUCTION.toLowerCase();
    for (const word of ["creature", "robot", "alien", "object", "vehicle", "landscape", "building"]) {
      expect(describer, `describer: ${word}`).toContain(word);
      expect(wall, `wall: ${word}`).toContain(word);
    }
  });

  it("carries the IP rule and the medium rule", async () => {
    const system = (await systemOf()).toLowerCase();
    expect(system).toContain("recognizable character");
    expect(system).toContain("never its name");
    expect(system).toContain("franchise");
    expect(system).toContain("never the medium");
    expect(system).toContain("never name a real person or character");
  });

  it("names fitted hardware as a FEATURE of the being — his reply 28", async () => {
    const rule = sliceFrom((await systemOf()).toLowerCase(), "- hardware:", 300);
    expect(rule).toContain("fitted into the body is a feature");
    expect(rule).toContain("where it sits");
  });

  it("keeps the four refused words WITH the refusal reason, in the rule's own neighbourhood", async () => {
    const rule = sliceFrom((await systemOf()).toLowerCase(), "never use the words spiked", 260);
    for (const word of ["spiked", "studded", "buckled", "chained"]) expect(rule, word).toContain(word);
    expect(rule).toContain("refused outright by the image engine");
    expect(rule).toContain("metal accents");
  });

  it("never mentions the light, the set, the frame or the camera, and never states an absence", async () => {
    const system = (await systemOf()).toLowerCase();
    for (const category of ["lighting", "background", "framing", "camera", "resembles"]) {
      expect(system, category).toContain(category);
    }
    expect(system).toContain("does not have");
    expect(system).toContain("no \"no tattoos\"");
  });

  it("keeps the build rule: only where it is the type, the closed list, never a size", async () => {
    const system = (await systemOf()).toLowerCase();
    expect(system).toContain("the build only where it is part of the type");
    for (const word of BUILD_FAMILIES) expect(system, word).toContain(word);
    expect(system).toContain("never a body size");
  });

  it("keeps the surface and creature rules — #231's 'never invent fur' and 'if it is in the frame'", async () => {
    const rule = sliceFrom((await systemOf()).toLowerCase(), "- species facts first:", 520);
    expect(rule).toContain("if it is in the frame, write it");
    expect(rule).toContain("hairless");
    expect(rule).toContain("never invent fur");
    for (const part of ["tail", "ears", "horns", "wings", "scales", "whiskers"]) expect(rule, part).toContain(part);
  });

  it("keeps the species-over-styling precedence beside its own target", async () => {
    const system = (await systemOf()).toLowerCase();
    const at = system.indexOf("a visible species fact outranks everything else");
    const target = system.indexOf(`${CONCEPT_RICH_LOOK_TARGET.low}–${CONCEPT_RICH_LOOK_TARGET.high} characters`);
    expect(at).toBeGreaterThan(-1);
    expect(target, "the rich look's own target is announced").toBeGreaterThan(-1);
    expect(system.slice(at, at + 300)).toContain("cut the styling and keep the anatomy");
    expect(Math.abs(target - at)).toBeLessThan(400);
  });

  it("asks for the JSON envelope, with the explicit null for no being", async () => {
    const system = await systemOf();
    expect(system).toContain('{"description": "..."}');
    expect(system).toContain('{"description": null}');
  });
});

describe("the rich look's bounds — 700 in, 800 on the re-ask, ~400–650 asked for", () => {
  it("pins the numbers the card read at the code", () => {
    expect(CONCEPT_RICH_LOOK_MAX).toBe(700);
    expect(CONCEPT_RICH_LOOK_MAX_RETRY).toBe(800);
    expect(CONCEPT_RICH_LOOK_TARGET).toEqual({ low: 400, high: 650 });
    /* Still a fifth of the entrance's author-road cap, so a description alone never reaches it. */
    expect(CONCEPT_RICH_LOOK_MAX_RETRY).toBeLessThan(4000 / 4);
  });

  it("takes the reading he picked on the FIRST read — the length today's bounds refuse", async () => {
    expect(HIS_PICK.length).toBe(602);
    expect(await describeConcept({ ...PICTURE, engine: engineSaying(said(HIS_PICK)), richLook: true }))
      .toEqual({ ok: true, description: HIS_PICK, attempts: 1 });
  });

  it("CONTROL — today's reader sends the same reading back and then refuses it", async () => {
    const engine = engineSaying(said(HIS_PICK), said(HIS_PICK));
    expect(await describeConcept({ ...PICTURE, engine }))
      .toEqual({ ok: false, reason: "ran_long", attempts: 2 });
  });

  it("sends a 750 back once on the way in, naming its own target, and takes it on the re-ask", async () => {
    const long = richOf(750);
    expect(long.length).toBe(750);
    expect(notAboutThePersonIn(long)).toBeNull();
    const engine = engineSaying(said(long), said(long));
    expect(await describeConcept({ ...PICTURE, engine, richLook: true }))
      .toEqual({ ok: true, description: long, attempts: 2 });
    const reask = engine.sent[1]!.user;
    expect(reask).toContain("750");
    expect(reask).toContain(`${CONCEPT_RICH_LOOK_TARGET.low}–${CONCEPT_RICH_LOOK_TARGET.high}`);
    /* Prose is never called a list (#1067), and the two silences are restated. */
    expect(reask.toLowerCase()).not.toContain("inventory");
    expect(reask.toLowerCase()).toContain("nothing about the face or the hair");
    expect(reask.toLowerCase()).toContain("cut the least defining styling first, never the anatomy");
  });

  it("still refuses a re-ask that runs over 800", async () => {
    const wayOver = richOf(850);
    expect(await describeConcept({ ...PICTURE, engine: engineSaying(said(wayOver), said(wayOver)), richLook: true }))
      .toEqual({ ok: false, reason: "ran_long", attempts: 2 });
  });

  it("names its own target on a too-short read, too", async () => {
    const engine = engineSaying(said("A woman."), said(RICH_LOOK_NOTES.right));
    expect(await describeConcept({ ...PICTURE, engine, richLook: true }))
      .toEqual({ ok: true, description: RICH_LOOK_NOTES.right, attempts: 2 });
    expect(engine.sent[1]!.user).toContain("8 characters");
    expect(engine.sent[1]!.user).toContain(`${CONCEPT_RICH_LOOK_TARGET.low}–${CONCEPT_RICH_LOOK_TARGET.high}`);
  });

  it("restates the JSON envelope on every re-ask, whatever the fault", async () => {
    const faults: ReadonlyArray<readonly [string, string]> = [
      ["long", said(richOf(760))],
      ["brief", said("too short")],
      ["picture", said(`${RICH_LOOK_NOTES.right} Soft studio lighting.`)],
      ["absence", said(`${RICH_LOOK_NOTES.right} No tattoos.`)],
    ];
    for (const [name, first] of faults) {
      const engine = engineSaying(first, said(RICH_LOOK_NOTES.right));
      await describeConcept({ ...PICTURE, engine, richLook: true });
      expect(engine.sent.length, `${name}: it was sent back`).toBe(2);
      expect(engine.sent[1]!.user, `${name}: the envelope`).toContain('{"description": "..."}');
    }
  });
});

describe("the sweeps run on the rich look exactly as on today's", () => {
  it("refuses a rich look that keeps describing the picture", async () => {
    const dirty = said(`${RICH_LOOK_NOTES.right} Soft studio lighting.`);
    expect(await describeConcept({ ...PICTURE, engine: engineSaying(dirty, dirty), richLook: true }))
      .toEqual({ ok: false, reason: "not_about_the_person", attempts: 2 });
  });

  it("refuses a rich look that keeps stating an absence", async () => {
    const dirty = said(`${RICH_LOOK_NOTES.right} No tattoos on the hands.`);
    expect(await describeConcept({ ...PICTURE, engine: engineSaying(dirty, dirty), richLook: true }))
      .toEqual({ ok: false, reason: "not_a_casting_note", attempts: 2 });
  });

  it("still tells 'no being here' apart from a read that failed, and never re-asks it", async () => {
    const engine = engineSaying(said(null), said(RICH_LOOK_NOTES.right));
    expect(await describeConcept({ ...PICTURE, engine, richLook: true }))
      .toEqual({ ok: false, reason: "no_being", attempts: 1 });
    expect(engine.sent).toHaveLength(1);
  });

  it.each([
    ["RIGHT", RICH_LOOK_NOTES.right],
    ["WRONG", RICH_LOOK_NOTES.faceAndHair],
  ] as const)("its %s specimen passes both sweeps and sits inside the bounds and the target", (_name, note) => {
    expect(notAboutThePersonIn(note)).toBeNull();
    expect(absenceClaimIn(note)).toBeNull();
    expect(note.length).toBeGreaterThanOrEqual(CONCEPT_DESCRIPTION_MIN);
    expect(note.length).toBeLessThanOrEqual(CONCEPT_RICH_LOOK_MAX);
    expect(note.length).toBeGreaterThanOrEqual(CONCEPT_RICH_LOOK_TARGET.low);
    expect(note.length).toBeLessThanOrEqual(CONCEPT_RICH_LOOK_TARGET.high);
  });

  /*
    ⚠ SAID OUT LOUD, as `conceptDescribe.test.ts` says it of the old failing
    box: NOTHING ENFORCED AT RUNTIME CAN TELL THE WRONG SPECIMEN FROM THE RIGHT
    ONE. A face and a haircut are not swept, on the same ground every word ban
    in this file was refused on. The acceptance is the read and the renders,
    and a green suite here is not evidence the model leaves the face alone.
  */
  it("CANNOT catch the face-and-hair specimen at runtime — the acceptance is the read, not a bound", async () => {
    expect(await describeConcept({
      ...PICTURE,
      engine: engineSaying(said(RICH_LOOK_NOTES.faceAndHair)),
      richLook: true,
    })).toEqual({ ok: true, description: RICH_LOOK_NOTES.faceAndHair, attempts: 1 });
  });
});
