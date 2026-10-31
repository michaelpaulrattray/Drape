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
 * so neither may be shown to this reader).
 *
 * # AND THE FOLLOW-UP: THE BENCH'S EXAMPLES, AND NO SPECIMEN
 *
 * The founder on the first shipping: *"okay nope quality bar dropped we need to
 * bring it to the ruleset that gets us this type of result"*. The first
 * shipping had dropped the concrete examples from the bench's ingredient
 * bullets and shown the reader a specimen whose wardrobe was a
 * materials-and-mood line, and the readings came back at that level. So two
 * arms below hold the shape that fixed it: the ingredient bullets carry the
 * bench's examples word for word, and the instruction shows no specimen.
 * {@link RICH_NOTE} and {@link FACE_AND_HAIR_NOTE} were those specimens; they
 * survive here only as replies for the fake transport.
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

/**
 * A clean rich look for the fake transport: rich in pieces, nothing about the
 * face or the hair. It was the instruction's RIGHT specimen in #2915 and is a
 * test reply only now (an arm below holds it out of the instruction).
 */
const RICH_NOTE =
  "A woman in her twenties, dark-fashion / cyber-goth model type with pale skin. A fitted "
  + "mechanical eye is set into the face as part of the being, not as a prop. Facial piercings "
  + "and fine-line markings across the face, with script tattoos running down both arms. "
  + "Signature pieces are a high structured collar at the throat and long lace gloves. The "
  + "wardrobe is black lace, leather and metal accents in a fitted, layered silhouette that "
  + "sweeps to the floor.";

/** The same woman with the face and the hair fixed — #2915's WRONG specimen, a test reply only now. */
const FACE_AND_HAIR_NOTE =
  "A woman in her twenties, dark-fashion / cyber-goth model type with pale skin, pale green "
  + "eyes, heavy winged eyeliner, dark plum lips and sharply arched brows, and long straight "
  + "platinum hair with blunt bangs. A fitted mechanical eye is set into the face. Facial "
  + "piercings and fine-line markings across the face, with script tattoos running down both "
  + "arms. The wardrobe is black lace, leather and metal accents in a fitted, layered silhouette.";

/**
 * THE BENCH'S INGREDIENT BULLETS, word for word as he picked them
 * (`_concept-bench-facefree-disposable.mts`, a local disposable, read
 * 2026-10-31). A pinned DECISION, not a mirror of a tracked source: the bench
 * file is not in the repository, and these lines are what his pick was read
 * with. One declared repair: the hardware example said "an implant plate in
 * the abdomen", two lines above the rule that bans naming the abdomen.
 */
const BENCH_BULLETS = [
  "- SIGNATURE PIECES: name up to four defining pieces worn or carried (goggles pushed up on the "
    + "forehead, armoured gauntlets, a utility harness), described by look and material, never by brand.",
  "- MARKINGS AND MOTIFS: what they are and roughly where they live (fine-line tattoos tracing the "
    + "cheekbones and jaw, script and floral pieces down the arms), and their style.",
  "- HARDWARE AND ANATOMY: anything fitted into the body is a FEATURE and is described with where it "
    + "sits (a sleek metal collar fused at the throat, an implant plate fitted at the waist); species facts",
  "- WARDROBE: its materials, palette and silhouette (black leather, fishnet mesh, matte armour, "
    + "cropped and strapped), as a look rather than a packing list.",
] as const;

/** Whitespace folded, so a re-wrapped line still reads as the same words. */
const flat = (text: string) => text.replace(/\s+/g, " ");

/** A rich look of `length` characters, clean through both sweeps. */
function richOf(length: number): string {
  const sentence = "Dark graphic tattoos run down both arms and a mechanical core plate is fitted at the waist. ";
  return `A young adult woman, a cyberpunk operative type. ${sentence.repeat(20)}`.slice(0, length - 1) + ".";
}

const systemOf = async () => {
  const engine = engineSaying(said(RICH_NOTE));
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
    /* The bench's own sentence: "Never describe eye colour, eyeliner or makeup, lips, brows, face shape or features". */
    expect(rule, "the rule forbids, not invites").toContain("never describe eye colour");
    for (const part of ["eyeliner or makeup", "lips", "brows", "face shape"]) {
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
      /* And the BENCH's own hair line, the one line of his pick his later ruling replaced. */
      "give the hair only as a world", "long dark hair",
    ]) {
      expect(flat(system), todays).not.toContain(todays);
    }
    /* Positive control: the same phrases ARE in today's instruction, so this arm can fail. */
    const today = (await todaySystemOf()).toLowerCase();
    for (const todays of ["hair world", "sculpted platinum", "never the cut"]) {
      expect(today, `control: ${todays}`).toContain(todays);
    }
  });

  it("its test replies are what they say: the rich one names no face or hair, the other does", () => {
    expect(RICH_NOTE).not.toMatch(FACE_OR_HAIR);
    /* Control: the regex can see a face and a haircut. */
    expect(FACE_AND_HAIR_NOTE).toMatch(FACE_OR_HAIR);
  });
});

describe("the bench he picked — the regression he caught on the first shipping", () => {
  it("keeps every ingredient bullet the bench carried, WITH its examples, word for word", async () => {
    const system = flat(await systemOf());
    for (const bullet of BENCH_BULLETS) expect(system, bullet.slice(0, 40)).toContain(bullet);
    /* The one that set the level: the wardrobe's examples are garments and textures, not a mood. */
    expect(system).toContain("(black leather, fishnet mesh, matte armour, cropped and strapped)");
  });

  it("shows the reader NO specimen — the bench had none, and a specimen set the wardrobe's level", async () => {
    const system = await systemOf();
    for (const absent of [
      "A note that is RIGHT", "written WRONG", RICH_NOTE, FACE_AND_HAIR_NOTE,
      /* #2915's specimen wardrobe, the materials-and-mood line the readings came back at. */
      "black lace, leather and metal accents in a fitted, layered silhouette",
    ]) {
      expect(flat(system), absent.slice(0, 40)).not.toContain(absent);
    }
    /* Positive control: that wardrobe line is a real string the arm can find, not a typo. */
    expect(RICH_NOTE).toContain("black lace, leather and metal accents in a fitted, layered silhouette");
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
    const note = `${RICH_NOTE.slice(0, -1)}, over a chrome torso.`;
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
    const system = flat((await systemOf()).toLowerCase());
    expect(system).toContain("recognizable character");
    expect(system).toContain("never its name");
    expect(system).toContain("franchise");
    expect(system).toContain("never the medium");
    expect(system).toContain("never name a real person or character");
  });

  it("names fitted hardware as a FEATURE of the being — his reply 28", async () => {
    const rule = sliceFrom((await systemOf()).toLowerCase(), "- hardware and anatomy:", 300);
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
    /* Folded into the bench's own hardware-and-anatomy bullet, which already said species facts come first. */
    const rule = sliceFrom((await systemOf()).toLowerCase(), "- hardware and anatomy:", 720);
    expect(rule).toContain("species facts");
    expect(rule).toContain("always come first");
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
    const engine = engineSaying(said("A woman."), said(RICH_NOTE));
    expect(await describeConcept({ ...PICTURE, engine, richLook: true }))
      .toEqual({ ok: true, description: RICH_NOTE, attempts: 2 });
    expect(engine.sent[1]!.user).toContain("8 characters");
    expect(engine.sent[1]!.user).toContain(`${CONCEPT_RICH_LOOK_TARGET.low}–${CONCEPT_RICH_LOOK_TARGET.high}`);
  });

  it("restates the JSON envelope on every re-ask, whatever the fault", async () => {
    const faults: ReadonlyArray<readonly [string, string]> = [
      ["long", said(richOf(760))],
      ["brief", said("too short")],
      ["picture", said(`${RICH_NOTE} Soft studio lighting.`)],
      ["absence", said(`${RICH_NOTE} No tattoos.`)],
    ];
    for (const [name, first] of faults) {
      const engine = engineSaying(first, said(RICH_NOTE));
      await describeConcept({ ...PICTURE, engine, richLook: true });
      expect(engine.sent.length, `${name}: it was sent back`).toBe(2);
      expect(engine.sent[1]!.user, `${name}: the envelope`).toContain('{"description": "..."}');
    }
  });
});

describe("the sweeps run on the rich look exactly as on today's", () => {
  it("refuses a rich look that keeps describing the picture", async () => {
    const dirty = said(`${RICH_NOTE} Soft studio lighting.`);
    expect(await describeConcept({ ...PICTURE, engine: engineSaying(dirty, dirty), richLook: true }))
      .toEqual({ ok: false, reason: "not_about_the_person", attempts: 2 });
  });

  it("refuses a rich look that keeps stating an absence", async () => {
    const dirty = said(`${RICH_NOTE} No tattoos on the hands.`);
    expect(await describeConcept({ ...PICTURE, engine: engineSaying(dirty, dirty), richLook: true }))
      .toEqual({ ok: false, reason: "not_a_casting_note", attempts: 2 });
  });

  it("still tells 'no being here' apart from a read that failed, and never re-asks it", async () => {
    const engine = engineSaying(said(null), said(RICH_NOTE));
    expect(await describeConcept({ ...PICTURE, engine, richLook: true }))
      .toEqual({ ok: false, reason: "no_being", attempts: 1 });
    expect(engine.sent).toHaveLength(1);
  });

  it.each([
    ["rich", RICH_NOTE],
    ["face-and-hair", FACE_AND_HAIR_NOTE],
  ] as const)("its %s test reply passes both sweeps and sits inside the bounds and the target", (_name, note) => {
    expect(notAboutThePersonIn(note)).toBeNull();
    expect(absenceClaimIn(note)).toBeNull();
    expect(note.length).toBeGreaterThanOrEqual(CONCEPT_DESCRIPTION_MIN);
    expect(note.length).toBeLessThanOrEqual(CONCEPT_RICH_LOOK_MAX);
    expect(note.length).toBeGreaterThanOrEqual(CONCEPT_RICH_LOOK_TARGET.low);
    expect(note.length).toBeLessThanOrEqual(CONCEPT_RICH_LOOK_TARGET.high);
  });

  /*
    ⚠ SAID OUT LOUD, as `conceptDescribe.test.ts` says it of the old failing
    box: NOTHING ENFORCED AT RUNTIME CAN TELL A READING THAT FIXES THE FACE AND
    THE HAIR FROM ONE THAT LEAVES THEM FREE. A face and a haircut are not swept,
    on the same ground every word ban in this file was refused on. The
    acceptance is the read, and a green suite here is not evidence the model
    leaves the face alone.
  */
  it("CANNOT catch a face-and-hair reading at runtime — the acceptance is the read, not a bound", async () => {
    expect(await describeConcept({
      ...PICTURE,
      engine: engineSaying(said(FACE_AND_HAIR_NOTE)),
      richLook: true,
    })).toEqual({ ok: true, description: FACE_AND_HAIR_NOTE, attempts: 1 });
  });
});
