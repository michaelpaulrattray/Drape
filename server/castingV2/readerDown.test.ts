/**
 * OUR ACCOUNT IS NOT THEIR PICTURE — the four picture roads, driven (#2688).
 *
 * # The defect, measured on production rather than supposed
 *
 * From 03:09Z on 2026-10-27 the text provider's account key was disabled and
 * every call answered `401`. Four roads that read a picture the customer
 * attached then said, in their own words:
 *
 *   > *"I couldn't read that picture just now — try again in a moment."*
 *
 * Wrong twice over. The bytes were never looked at, so naming *that picture*
 * points at the one thing that was not the problem; and a disabled key is not
 * weather, so the retry it invites fails identically until somebody pays a
 * bill. The customer swaps the photograph, it fails again, and we blame them
 * twice.
 *
 * # Why this file exists when `readerOutageRefusal.test.ts` already drives two
 * # of these roads with the same double
 *
 * ⚠ **BECAUSE ITS ARMS PASS EITHER WAY, AND AN ARM THAT CANNOT FAIL IS NOT
 * COVERAGE.** That suite asserts the hair and makeup readers say `"just now"`
 * and not `"try another one"` on an overdrawn account — both of which are true
 * of the OLD sentence and of the new one. It was measuring the attribution the
 * #126 sweep fixed, and it was right about it; it has nothing to say about the
 * advice, which is this card. Every arm below is written so that reverting the
 * change reddens it.
 *
 * # The shape of every arm here
 *
 * A SPLIT, never a blanket reword — so each road is driven twice on the same
 * picture and the same script, with one difference: whether the failure was our
 * account or the weather. The weather arm is the control that proves the
 * transient sentence survived, and without it a change that simply replaced
 * every reader sentence would pass this file completely.
 */
import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";

import { ProviderError } from "../providers/types";
import { classifyFalHttp } from "../providers/falTransport";
import { classifyOpenRouterTextHttp } from "../providers/openrouterText";
import { MaskError } from "./maskGeometry";
import type { Mask } from "./maskedComposite";
import {
  PICTURE_READER_DOWN_MESSAGE,
  readerAccountRefused,
  segmenterAccountRefused,
} from "./readerDown";
import { createFalRegionReader } from "./falRegionReader";
import { HAIR_REGION, SCALE_REGION, cutHairCarrier } from "./hairReferenceCutter";
import { cutInkDesign } from "./inkReferenceCutter";
import { readHairColourFromReference } from "./hairColourFromReference";
import { readMakeupFromReference } from "./makeupFromReference";

/** A real 1×1 PNG — the readers size things with sharp, so a stub will not do. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** The exact error an account refusal produces on each transport. */
const TEXT_401 = () => new ProviderError("provider_account", "openrouter 401 disabled key", { status: 401 });
const SEGMENTER_401 = () => new MaskError("fal-ai/sam-3: 401 disabled key", { accountRefused: true });

/** And the weather each road must go on treating as weather. */
const TEXT_WEATHER = () => new ProviderError("transport", "socket hang up");
const SEGMENTER_WEATHER = () => new MaskError("fal-ai/sam-3: 503", { retryable: true });

describe("the sentence itself", () => {
  it("names the studio and never the customer's picture", () => {
    /* The whole misattribution, as one pair. "your picture" appears only in the
       clause that says it is NOT the problem, so the negative is written
       against the sentence that was replaced rather than against the noun. */
    expect(PICTURE_READER_DOWN_MESSAGE).toContain("The studio");
    expect(PICTURE_READER_DOWN_MESSAGE).toContain("not your picture");
    expect(PICTURE_READER_DOWN_MESSAGE).not.toMatch(/I couldn't read that picture/i);
  });

  it("says LATER, and never 'in a moment'", () => {
    /* The second half of the card: the one failure a retry cannot reach must
       not be answered with an instruction to retry. */
    expect(PICTURE_READER_DOWN_MESSAGE).toMatch(/try again later/i);
    expect(PICTURE_READER_DOWN_MESSAGE).not.toMatch(/in a moment/i);
  });

  it("says the money is safe, as every sentence it replaces did", () => {
    /* All four roads are pre-claim refusals on paid surfaces. Nothing about the
       money moves in this change, and the sentence must not imply it did. */
    expect(PICTURE_READER_DOWN_MESSAGE).toMatch(/[Nn]othing was charged/);
  });

  it("NAMES NO ENGINE, NO VENDOR AND NO STATUS CODE", () => {
    /*
      The disappearing-technology law's one hard line (clause 5): no engine name
      on a path someone must walk to reach their picture. A status code is the
      same failure wearing a number — it is a fact about our plumbing that the
      customer has no basis to act on.
    */
    expect(PICTURE_READER_DOWN_MESSAGE)
      .not.toMatch(/openrouter|openai|anthropic|gemini|nano banana|sunburst|fal|sam ?3|gpt/i);
    expect(PICTURE_READER_DOWN_MESSAGE).not.toMatch(/\b40[123]\b|\b5\d\d\b/);
  });
});

describe("the line between our account and the weather", () => {
  it("TEXT: the fixture is the product's own mapping, so it cannot drift", () => {
    /*
      Law 2 pointed at the fixture. If `classifyOpenRouterTextHttp` ever stopped
      calling a 401 an account failure, every arm below would still pass while
      the product had stopped working — so the mapping is asserted here rather
      than assumed by the doubles.
    */
    for (const status of [401, 402, 403]) {
      expect(classifyOpenRouterTextHttp(status, "")).toBe("provider_account");
    }
    expect(readerAccountRefused(TEXT_401())).toBe(true);
  });

  it("TEXT: weather, a plain Error and null are all NOT the account", () => {
    /* The negative controls. A predicate that answered true for everything
       would pass every positive arm in this file. */
    expect(readerAccountRefused(TEXT_WEATHER())).toBe(false);
    expect(readerAccountRefused(new ProviderError("timeout", "deadline"))).toBe(false);
    expect(readerAccountRefused(new ProviderError("rate_limit", "429"))).toBe(false);
    expect(readerAccountRefused(new ProviderError("capability", "malformed"))).toBe(false);
    expect(readerAccountRefused(new Error("something else"))).toBe(false);
    expect(readerAccountRefused(null)).toBe(false);
  });

  it("SEGMENTER: the same question, and `retryable` is NOT the answer to it", () => {
    /*
      ⚠ THE ARM THAT MATTERS MOST HERE. A 400, a 404 and a 422 are
      non-retryable too, and every one of them IS plausibly about the request —
      so a cutter keying on `!retryable` would tell a customer the studio was
      down when we had in fact sent something malformed. `accountRefused` is
      narrower than `!retryable` on purpose, and this arm is what holds it there.
    */
    expect(segmenterAccountRefused(SEGMENTER_401())).toBe(true);
    expect(segmenterAccountRefused(SEGMENTER_WEATHER())).toBe(false);

    const malformed = new MaskError("fal-ai/sam-3: 422 bad prompt");
    expect(malformed.retryable, "a 422 is not retryable").toBe(false);
    expect(segmenterAccountRefused(malformed), "and it is not the account either").toBe(false);

    expect(segmenterAccountRefused(new Error("not a MaskError"))).toBe(false);
    expect(segmenterAccountRefused(undefined)).toBe(false);
  });
});

/**
 * ASSERT AT THE WIRE (invariant 5). The two arms above prove the predicate
 * reads a flag; these prove the flag is actually SET by a real 401 coming back
 * from a real `fetch`, which is the only thing that makes the predicate worth
 * anything on production.
 */
describe("the segmenter's own failure carries the class", () => {
  function answering(status: number, body = "") {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status })));
    return createFalRegionReader({ apiKey: "test-key" });
  }

  it("a 401 from fal arrives as a MaskError that knows it was our account", async () => {
    const reader = answering(401, "unauthorized");
    await expect(reader.region({ image: PNG, name: "hair", absentIsAnswer: true }))
      .rejects.toSatisfy((error: unknown) => segmenterAccountRefused(error));
  });

  it("a 403 does too — the classifier's set, not a status this file picked", () => {
    /* Read off the product's own fal classifier rather than restated, so the
       two cannot disagree about which statuses mean our account. */
    expect(classifyFalHttp(401, "")).toBe("provider_account");
    expect(classifyFalHttp(403, "")).toBe("provider_account");
  });

  it("NEGATIVE CONTROL: a 500 and a 429 do NOT, and keep their weather flag", async () => {
    for (const status of [500, 429]) {
      const reader = answering(status, "upstream");
      await expect(reader.region({ image: PNG, name: "hair", absentIsAnswer: true }))
        .rejects.toSatisfy((error: unknown) => (
          !segmenterAccountRefused(error) && error instanceof MaskError && error.retryable
        ));
    }
  });

  it("NEGATIVE CONTROL: a 422 is neither — non-retryable AND not the account", async () => {
    const reader = answering(422, "bad request");
    await expect(reader.region({ image: PNG, name: "hair", absentIsAnswer: true }))
      .rejects.toSatisfy((error: unknown) => (
        !segmenterAccountRefused(error) && error instanceof MaskError && !error.retryable
      ));
  });

  it("the body still reaches the message — reading it twice would have emptied it", async () => {
    /*
      `response.text()` on an already-consumed body answers with the EMPTY
      STRING rather than throwing, so a second read would have classified every
      fal failure against "" and silently lost the diagnosis in the message with
      nothing going red. One read, used twice.
    */
    const reader = answering(401, "account suspended");
    await expect(reader.region({ image: PNG, name: "hair", absentIsAnswer: true }))
      .rejects.toThrow(/account suspended/);
  });
});

/** A reader that answers a script, as the cutters' own suites build one. */
function reader(answer: (input: { name: string; width: number; height: number }) => Mask | Error) {
  return {
    async region({ image, name }: { image: Buffer; name: string; absentIsAnswer?: boolean }) {
      const meta = await sharp(image).metadata();
      const given = answer({ name, width: meta.width ?? 0, height: meta.height ?? 0 });
      if (given instanceof Error) throw given;
      return given;
    },
  };
}

function box(width: number, height: number, rect: { x: number; y: number; w: number; h: number }): Mask {
  const data = Buffer.alloc(width * height, 0);
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) data[y * width + x] = 255;
  }
  return { data, width, height };
}

/** A plain photograph with no seam — one panel, so the script is simple. */
async function onePhotograph(width = 120, height = 100): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = (y * width + x) * 3;
      raw[at] = Math.round(60 + (x / width) * 60);
      raw[at + 1] = Math.round(70 + (y / height) * 60);
      raw[at + 2] = 90;
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

describe("the hair carrier cutter", () => {
  it("refuses readerDown when the segmenter refused OUR ACCOUNT", async () => {
    const result = await cutHairCarrier({
      bytes: await onePhotograph(),
      reader: reader(() => SEGMENTER_401()),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.code).toBe("readerDown");
    expect(result.refusal.message).toBe(PICTURE_READER_DOWN_MESSAGE);
  });

  it("CONTROL: the same failure as weather keeps couldNotRead and 'in a moment'", async () => {
    /* Same picture, same script, one difference — the proof that this is a
       split and not a blanket reword. */
    const result = await cutHairCarrier({
      bytes: await onePhotograph(),
      reader: reader(() => SEGMENTER_WEATHER()),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.code).toBe("couldNotRead");
    expect(result.refusal.message).toMatch(/in a moment/i);
  });

  it("the SCALE question is the second door and it answers the same way", async () => {
    /* This file raises the pair twice, and a fix applied to one of them is the
       half-swept class this program keeps paying for. */
    const result = await cutHairCarrier({
      bytes: await onePhotograph(),
      reader: reader(({ name, width, height }) => (
        name === HAIR_REGION
          ? box(width, height, { x: 10, y: 10, w: 40, h: 40 })
          : SEGMENTER_401()
      )),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.code).toBe("readerDown");
  });

  it("CONTROL: and the scale door still knows weather from the account", async () => {
    const result = await cutHairCarrier({
      bytes: await onePhotograph(),
      reader: reader(({ name, width, height }) => (
        name === SCALE_REGION ? SEGMENTER_WEATHER() : box(width, height, { x: 10, y: 10, w: 40, h: 40 })
      )),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.code).toBe("couldNotRead");
  });
});

describe("the ink design cutter", () => {
  async function cut(answer: (input: { name: string }) => Mask | Error) {
    return cutInkDesign({
      bytes: await onePhotograph(),
      reader: reader(answer) as Parameters<typeof cutInkDesign>[0]["reader"],
    } as Parameters<typeof cutInkDesign>[0]);
  }

  it("refuses readerDown when the segmenter refused OUR ACCOUNT", async () => {
    const result = await cut(() => SEGMENTER_401());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.code).toBe("readerDown");
    expect(result.refusal.message).toBe(PICTURE_READER_DOWN_MESSAGE);
  });

  it("CONTROL: weather keeps couldNotRead and 'in a moment'", async () => {
    const result = await cut(() => SEGMENTER_WEATHER());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.code).toBe("couldNotRead");
    expect(result.refusal.message).toMatch(/in a moment/i);
  });

  it("reads BOTH settled reads, so the account is seen whichever one hit it", async () => {
    /*
      ⚠ THE ARM THE OBVIOUS FIX WOULD HAVE FAILED. These two reads are settled
      together with `allSettled`, and the pre-existing log line picks the INK
      side whenever it failed. Reading only that one would have said "try again
      in a moment" every time the PERSON read was the one that met the 401 —
      a bug that only ever shows up when the ink read fails for its own reason
      at the same moment, which is exactly what a sustained outage produces.
    */
    const result = await cut(({ name }) => (
      name === "tattoo" ? new MaskError("fal 503", { retryable: true }) : SEGMENTER_401()
    ));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.code).toBe("readerDown");
  });
});

describe("the two reference readers — the roads the card did not name", () => {
  /*
    FOUND BY THE LAW-7 SWEEP ON #2688, which named three surfaces and missed
    these two. Both say *"I couldn't read that picture just now"* on a catch
    whose own comment already lists "the text account being overdrawn" as one of
    the things it catches — so the module knew, and the sentence did not.
  */
  const PICTURE = { bytes: PNG, contentType: "image/png" };

  function engineThrowing(error: () => Error) {
    return { id: "test:throwing", complete: async () => { throw error(); } };
  }

  type Engine = Parameters<typeof readHairColourFromReference>[0]["engine"];

  it("hair colour: an account refusal says the studio is down, not 'that picture'", async () => {
    const outcome = await readHairColourFromReference({
      ...PICTURE,
      engine: engineThrowing(TEXT_401) as Engine,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.refusal.message).toBe(PICTURE_READER_DOWN_MESSAGE);
  });

  it("CONTROL: hair colour keeps the transient sentence for weather", async () => {
    const outcome = await readHairColourFromReference({
      ...PICTURE,
      engine: engineThrowing(TEXT_WEATHER) as Engine,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.refusal.message).toMatch(/in a moment/i);
    expect(outcome.refusal.message).not.toBe(PICTURE_READER_DOWN_MESSAGE);
  });

  it("makeup: the same, on the sibling road that shares the sentence", async () => {
    const outcome = await readMakeupFromReference({
      ...PICTURE,
      engine: engineThrowing(TEXT_401) as Parameters<typeof readMakeupFromReference>[0]["engine"],
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.refusal.message).toBe(PICTURE_READER_DOWN_MESSAGE);
  });

  it("CONTROL: makeup keeps the transient sentence for weather", async () => {
    const outcome = await readMakeupFromReference({
      ...PICTURE,
      engine: engineThrowing(TEXT_WEATHER) as Parameters<typeof readMakeupFromReference>[0]["engine"],
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.refusal.message).toMatch(/in a moment/i);
  });

  it("⚠ THE TALLY BUCKET DOES NOT SPLIT, AND THAT IS DECLARED RATHER THAN HIDDEN", async () => {
    /*
      Both readers keep `code: "unreadable"` on this branch. The code is
      snake-cased straight into `casting_reference_reads.outcome`, a MySQL
      ENUM — and MySQL writes the EMPTY STRING for a value outside an enum
      rather than refusing the insert, so a new code without a migration fills
      the demand table with blanks. `referenceReadDemand.test.ts` is the guard
      that would catch it, and widening the enum is `ALTER TABLE … MODIFY
      COLUMN`, which `ceremonyAutoApply.mts` refuses to apply unattended.

      So the customer's sentence is fixed and the internal tally still counts an
      account refusal beside a timeout under one word. This arm exists so that
      the limit is a pinned fact rather than a paragraph: the day somebody does
      ship the migration, this is what tells them the bucket was the thing left
      behind. Carried on #2688.
    */
    const outcome = await readHairColourFromReference({
      ...PICTURE,
      engine: engineThrowing(TEXT_401) as Engine,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.refusal.code).toBe("unreadable");
  });
});
