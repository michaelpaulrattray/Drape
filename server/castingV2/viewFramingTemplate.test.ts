/**
 * THE STORED FRAMING REFERENCE, DRIVEN — #1612 part 3.
 *
 * Two kinds of arm live here and they answer different questions:
 *
 *   THE ARTIFACT ARMS read the TRACKED PNGs in `assets/views/` and hold the
 *   table's claims against them. A digest typed into a constant is a claim
 *   (working law 1); the file is the fact. These are also what stop the
 *   `__PENDING__` placeholder the table was written with from ever shipping.
 *
 *   THE READ ARMS drive `readViewFramingTemplate` through every way it can
 *   fail. Its whole contract is that it NEVER throws — its caller is inside the
 *   paid render loop of a Sign — so each failure arm asserts `null` AND that
 *   nothing propagated.
 *
 * ⚠ **THE DIGEST-MISMATCH ARM IS THE ONE WORTH KEEPING.** Everything else here
 * would still pass with the sha256 check deleted: a missing object throws, an
 * absent angle returns early, the happy path returns bytes. Only that arm fails
 * when the check goes, and it is the whole reason the digest is in the table —
 * a bucket object replaced under a measured money surface, with no error
 * anywhere and no customer-visible symptom but a worse crop.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("../logging/logger", () => {
  const shape = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
  return { logger: shape, createModuleLogger: () => shape };
});

const {
  VIEW_FRAMING_TEMPLATES,
  VIEW_FRAMING_TEMPLATE_PREFIX,
  framingTemplateClause,
  readViewFramingTemplate,
} = await import("./viewFramingTemplate");
type ViewFramingTemplate = import("./viewFramingTemplate").ViewFramingTemplate;
const { pronounsForSex } = await import("./castPronouns");
const { CAST_PACKAGE_VIEWS } = await import("./castViewPackage");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const angles = Object.keys(VIEW_FRAMING_TEMPLATES) as Array<keyof typeof VIEW_FRAMING_TEMPLATES>;

/*
  ⚠ **THE TRACKED SOURCE IS THE STORAGE KEY READ FROM THE REPOSITORY ROOT, and
  that is deliberately not a second string.** `assets/ink/arm-left-template.png`
  is tracked at that path and served from that key; this follows the same
  convention, so there is exactly one place the filename is written down and a
  rename cannot leave the table pointing at one file and the digest at another.
*/
const sourceOf = (angle: keyof typeof VIEW_FRAMING_TEMPLATES) =>
  path.join(REPO_ROOT, VIEW_FRAMING_TEMPLATES[angle]!.file);

/* Each arm owns its own store rather than clearing a shared one — see the
   module's note on why there is no reset export. */
const freshCache = () => new Map<string, ViewFramingTemplate>() as never;

describe("the table and the tracked pictures agree", () => {
  it("declares at least one template, so an emptied table cannot pass as 'nothing to check'", () => {
    /*
      THE POPULATION ARM. Every arm below iterates `angles`, and an empty table
      would make all of them vacuously green — the shape `instrument-discipline`
      is about. This is the floor under them.
    */
    expect(angles.length).toBeGreaterThan(0);
  });

  it.each(angles)("%s — the declared sha256 is the tracked file's own digest", (angle) => {
    const record = VIEW_FRAMING_TEMPLATES[angle]!;
    const bytes = readFileSync(sourceOf(angle));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(record.sha256);
  });

  it.each(angles)("%s — the tracked path is the prefix and the view's own name", (angle) => {
    const record = VIEW_FRAMING_TEMPLATES[angle]!;
    expect(record.file).toBe(`${VIEW_FRAMING_TEMPLATE_PREFIX}/${angle}-framing-template.png`);
    /* And the repository really does carry a file at that key, which is the
       half that makes the key-is-the-path convention a fact rather than a note. */
    expect(existsSync(sourceOf(angle))).toBe(true);
  });

  it.each(angles)("%s — is 1024x1536, the anchor's own shape", async (angle) => {
    /*
      ⚠ **THIS ARM IS WHY THE ASPECT PIN WAS NOT WIDENED, AND IT IS THE ONLY
      THING HOLDING THAT DECISION.** The engine reads its output shape off its
      references: #1278 measured a view at 1696x2528 with the anchor alone and
      1792x2400 once a 3:4 plate joined it. Part 3's shape check then drove nine
      renders and found 1696x2528 on all three arms of all three views —
      BECAUSE the anchor is 1024x1536 and these templates are cut to the same
      shape, so there is no second ratio in the request to drag toward.

      A template re-cut to some other shape silently re-opens that, and the
      symptom is a package whose five views are different shapes — which a
      customer sees at a glance and no other test would catch. So the shape is
      pinned here, beside the digest, and the number is the ANCHOR's rather than
      a taste.
    */
    const bytes = readFileSync(sourceOf(angle));
    const meta = await sharp(bytes).metadata();
    expect({ width: meta.width, height: meta.height }).toEqual({ width: 1024, height: 1536 });
  });

  it("names only angles the package actually renders", () => {
    for (const angle of angles) {
      expect(CAST_PACKAGE_VIEWS).toContain(angle);
    }
  });

  it("leaves the two reader-only views out, which is a decision and not an omission", () => {
    /*
      `threeQuarter` and `sideClose` declare an EMPTY geometric band: their whole
      framing test is a head's TURN and a profile's CONCEALMENT, which
      `viewFramingGeometry.ts` says in as many words no silhouette can answer. A
      template for either could not be judged by the measured checker, so one
      would be an unmeasured change to a paid render. The file's header carries
      the reasoning; this holds the decision so that adding one is a deliberate
      act that reddens here first and has to answer the comment.
    */
    expect(VIEW_FRAMING_TEMPLATES).not.toHaveProperty("threeQuarter");
    expect(VIEW_FRAMING_TEMPLATES).not.toHaveProperty("sideClose");
  });
});

describe("the clause says what the picture is for and what may not be taken from it", () => {
  const pronouns = pronounsForSex("female");

  it("names the ordinal it is given, everywhere it refers to the reference", () => {
    /*
      ⚠ **#1480 IS THE WORKED EXAMPLE.** The references are
      `[anchor, ...inkCrops, outfitReference, framingTemplate]`, so a Cast with
      three tattoos and a plate carries her template at reference 6. A constant
      anywhere in this sentence would point a paid render at a picture of her
      elbow. Asserted as "6 appears and no other ordinal does" rather than as a
      substring, so a half-converted sentence cannot pass.
    */
    const clause = framingTemplateClause({ ordinal: 6, pronouns });
    expect(clause).toContain("reference 6");
    for (const wrong of [2, 3, 4, 5, 7]) {
      expect(clause).not.toContain(`reference ${wrong}`);
    }
  });

  it("tells the engine the picture is not a person and is not part of the photograph", () => {
    const clause = framingTemplateClause({ ordinal: 2, pronouns });
    expect(clause).toMatch(/not a person/i);
    expect(clause).toMatch(/not part of this\s+photograph/i);
  });

  it("forbids taking identity, and names the reference that does carry it", () => {
    /*
      The identity axis is the one axis that still refuses and refunds, so the
      sentence protecting it is held by name rather than by sentiment.
    */
    const clause = framingTemplateClause({ ordinal: 2, pronouns });
    expect(clause).toMatch(/Take NOTHING else/);
    for (const forbidden of ["face", "skin", "hair", "build", "clothing", "pose", "background"]) {
      expect(clause).toContain(forbidden);
    }
    expect(clause).toContain("reference 1");
  });
});

describe("reading one — and it never throws, because its caller is a paid render", () => {
  const angle = angles[0]!;
  const record = VIEW_FRAMING_TEMPLATES[angle]!;
  const realBytes = () => readFileSync(sourceOf(angle));

  it("answers null for an angle with no template, without reading anything", () => {
    const readFile = vi.fn();
    expect(readViewFramingTemplate("threeQuarter", { readFile, cache: freshCache() })).toBeNull();
    expect(readFile).not.toHaveBeenCalled();
  });

  it("returns the bytes when the digest matches, asking for the declared file", () => {
    const bytes = realBytes();
    const readFile = vi.fn(() => bytes);
    const template = readViewFramingTemplate(angle, { readFile, cache: freshCache() });
    expect(template?.bytes).toBe(bytes);
    expect(template?.contentType).toBe("image/png");
    expect(readFile).toHaveBeenCalledWith(record.file);
  });

  it("answers null when the stored bytes are not the ones this build measured", () => {
    /*
      ⚠ THE ARM THE DIGEST EXISTS FOR — see this file's header. The read SUCCEEDS
      and returns a perfectly valid PNG; what is wrong is that it is not the
      picture the court measured.
    */
    const readFile = vi.fn(() => Buffer.from("some other picture"));
    expect(readViewFramingTemplate(angle, { readFile, cache: freshCache() })).toBeNull();
  });

  it("answers null rather than throwing when the read itself fails", () => {
    const readFile = vi.fn(() => { throw new Error("no such file"); });
    expect(readViewFramingTemplate(angle, { readFile, cache: freshCache() })).toBeNull();
  });

  it("caches a success, so five views of one Sign do not read the file five times", () => {
    const bytes = realBytes();
    const readFile = vi.fn(() => bytes);
    const cache = freshCache();
    readViewFramingTemplate(angle, { readFile, cache });
    readViewFramingTemplate(angle, { readFile, cache });
    readViewFramingTemplate(angle, { readFile, cache });
    expect(readFile).toHaveBeenCalledTimes(1);
  });

  it("does NOT cache a failure, so one blip is not a whole process without templates", () => {
    /*
      The asymmetry is deliberate and is in the module's header. A miss cached
      for the life of a process would turn a one-second storage hiccup into a
      deploy's worth of untemplated Signs, with nothing to see.
    */
    const bytes = realBytes();
    let calls = 0;
    const readFile = vi.fn(() => {
      calls += 1;
      if (calls === 1) throw new Error("the file was not there, once");
      return bytes;
    });
    const cache = freshCache();
    expect(readViewFramingTemplate(angle, { readFile, cache })).toBeNull();
    expect(readViewFramingTemplate(angle, { readFile, cache })).not.toBeNull();
    expect(readFile).toHaveBeenCalledTimes(2);
  });
});
