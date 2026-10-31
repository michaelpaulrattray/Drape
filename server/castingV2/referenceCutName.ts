/**
 * WHAT IS THIS PIECE? — naming the tapped cut (#14 slice 3a's last read).
 *
 * The spotlight's shape is *split once to light, cut on every tap, then NAME
 * that cut* — and the naming is not a nicety. A SAM 3 point returns whatever
 * part is under the finger: the spotlight court's belt tap came back with the
 * belt's KEEPER alone, and the reader named it *"leather strap"*, which is
 * accurate for what was cut and wrong for "belt". **So the chip carries the
 * cut's own name rather than an assumed one, and the customer sees that name
 * before any money moves** — which is how §1's law-9 property survives the move
 * from markers to a spotlight: the noun arrives at tap time instead of attach
 * time, and it is still shown before the spend.
 *
 * # THE PROMPT IS THE COURT'S, COPIED AND NOT PARAPHRASED
 *
 * Measured in the spotlight court (2026-10-30) at **8 of 8 on every tap cut
 * that held the whole thing**, 7 of 7 on the split's garment-level pieces, and
 * 8 of 9 over all tap cuts — the one miss being the keeper above. 1.5–4.1 s and
 * 0.05–0.23¢ a call.
 *
 * ⚠ **A PARAPHRASE OF {@link CUT_NAME_PROMPT} INVALIDATES THAT MEASUREMENT.**
 * It is the house rule already written on `faceDiscovery.ts`'s own prompt, and
 * it binds here for the same reason: the number above is a fact about these
 * words. The examples in it (hat, glove, wristwatch) are deliberately NOT
 * things in any fixture, so they cannot be read as a list to choose from —
 * which is his 2026-10-28 word, *"nothing should be confined to a set list"*.
 *
 * # WHAT IT REFUSES, AND WHY A REFUSAL COSTS THE CUSTOMER NOTHING
 *
 * A name is kept only if it passes {@link isBareNoun} — the same shape rules
 * every other name on this road obeys (no list, no positional clause, no
 * caption), because a name here becomes a chip and later a prompt. Anything
 * else answers `null`, and `null` means *the chip shows no name*, never a
 * failure: the cut is still the customer's to use, and the words road is
 * untouched. A provider's bad minute must never make a tap look broken.
 *
 * ⚠ **The WORD bound is this road's own and is not shared — corrected here
 * 2026-10-31 (#2877), because the sentence above read as though it were.** It
 * is {@link CUT_NAME_MAX_WORDS} (three), which is what {@link CUT_NAME_PROMPT}
 * asks for; the discovery roads pass two, which is what theirs ask for. While
 * the cap lived inside `isBareNoun` as a single hard two, this road's prompt
 * invited a third word and the gate threw the answer away — **8 of 300
 * measured readings showed no name, 7 of them correct.**
 */
import { isBareNoun } from "./faceDiscovery";
import { boundForJudge } from "./judgeFrame";
import type { Mask } from "./maskedComposite";
import type { TextEngine } from "../providers/types";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("castingV2/referenceCutName");

/**
 * THE GREY EVERYTHING-ELSE BECOMES — and it is the court's, measured.
 *
 * Mid grey, so neither a dark nor a light garment is the only thing with
 * contrast against it. ~~The court's own backdrop.~~ ~~IT IS NOT THE COURT'S
 * BACKDROP (#2875): `cutFor` paints `150, 150, 150`.~~
 *
 * ✅ **IT IS NOW, AND IT WAS MOVED BY MEASUREMENT RATHER THAN BY TIDINESS
 * (#2875, 2026-10-31).** It read `128, 128, 128` while its own docblock called
 * it the court's. The bench below settled all three of this road's departures
 * from the court at once, so **this value was measured as part of a BUNDLE and
 * no claim is made about the grey on its own** — what is claimed is that the
 * configuration now shipping is the configuration that was measured.
 */
export const CUT_NAME_BACKDROP = { r: 150, g: 150, b: 150 };

/**
 * HOW MUCH ROOM THE PIECE IS GIVEN, AND HOW SMALL IT IS ALLOWED TO ARRIVE.
 *
 * All three are `relay-14spot/name.mjs`'s `cutFor`, which is the framing the
 * naming figure in this header was measured on. The pad is a FRACTION of the
 * piece plus a floor, so a hand-sized piece and a thumbnail both arrive with
 * margin rather than welded to the edge; the floor alone would vanish on a
 * large piece and the fraction alone would vanish on a tiny one.
 */
export const CUT_NAME_CROP_PAD_FRACTION = 0.08;
export const CUT_NAME_CROP_PAD_FLOOR_PX = 4;
/** A piece under this on its longer side is enlarged to it — never shrunk to it. */
export const CUT_NAME_CROP_MIN_LONG_EDGE = 384;

/** ⚠ COPIED FROM THE COURT, NOT PARAPHRASED — see the header. */
export const CUT_NAME_PROMPT =
  "This image is ONE piece cut out of a photograph; everything else was removed "
  + "and replaced with flat grey. What is the piece? Answer with a bare noun "
  + "phrase of one to three words (for example: hat, glove, wristwatch). Answer "
  + "with the name only.";

/**
 * THE WORD BOUND {@link CUT_NAME_PROMPT} ITSELF ASKS FOR — three (#2877).
 *
 * It sits here, under the prompt whose own sentence says *"one to three
 * words"*, because the gate that enforces it lives in another module and the
 * two had drifted: `isBareNoun` capped every name at TWO, so the prompt's own
 * upper bound was refused and the customer was shown **no name at all**.
 *
 * Measured before it moved (#2875, 300 reader calls on the court's nine tap
 * cuts): 8 readings showed no name, 7 of them had named the piece correctly,
 * and all 8 were exactly three words — *"Gold hoop earring"* five times of
 * twelve on the hoop earring alone. No other rejection fired in 300 readings.
 *
 * ⚠ **The prompt was NOT re-worded to say two, and that is this header's own
 * rule rather than a preference**: it is copied byte-for-byte from the court
 * and a paraphrase invalidates the 8-of-8 figure above. The bound moved to the
 * caller instead; `isBareNoun`'s docblock carries the full argument, and
 * `faceDiscovery`'s own two-word roads are untouched.
 *
 * `referenceCutName.test.ts` holds this number to the prompt's own words, so a
 * re-worded prompt or a moved cap reddens rather than drifting quietly.
 */
export const CUT_NAME_MAX_WORDS = 3;

/** How long one naming read may take. 4.1 s was the court's slowest; this is ~4x it. */
export const CUT_NAME_TIMEOUT_MS = 16_000;

/**
 * THE PIECE ON FLAT GREY, PERSON-FREE IN THE BYTES.
 *
 * ⚠ **The pixels outside the cut are REPLACED, never covered.** That is the
 * `cutOutPixels` lesson (fable-1216 §1) and it is load-bearing here rather than
 * stylistic: what leaves this function goes to a third-party text provider, so
 * a mask laid over a photograph would be sending the whole photograph. Only the
 * cut's own pixels survive the composite.
 *
 * ⚠ ~~**The frame is NOT cropped to the cut, and that is faithfulness rather than
 * laziness.** The court's measurement was taken on the piece in its own frame;
 * cropping would change the scale cues the reader sees, and cropping is
 * unmeasured. A slice that wants to crop measures it first.~~
 *
 * ⚠ ~~**THE FRAME IS STILL NOT CROPPED, AND THE SENTENCE ABOVE HAD THE COURT
 * BACKWARDS** (#2875) — nothing is changed here on that reading.~~
 *
 * ✅ **IT IS CROPPED NOW, AND THE SLICE THAT WANTED TO CROP MEASURED IT FIRST,
 * WHICH IS WHAT THE STRUCK SENTENCE ASKED FOR (#2875, 2026-10-31).** The piece
 * is cut to its own bounding box padded by {@link CUT_NAME_CROP_PAD_FRACTION}
 * of its longer side plus {@link CUT_NAME_CROP_PAD_FLOOR_PX}, and enlarged to
 * {@link CUT_NAME_CROP_MIN_LONG_EDGE} when it is smaller — `cutFor`'s three
 * steps, which is the framing this header's naming figure was measured on.
 *
 * **What the bench found, and the score is NOT why this moved.** 192 reader
 * calls on the court's own nine tap cuts, 12 an arm, today's engine both
 * sides, $0.31 of house money: **the crop scored 82 of 96 and the whole frame
 * 80 of 96 — a tie, so the score decides nothing.** What decides it is the
 * shape underneath:
 *
 *   - **Seven of the nine pieces scored 12 of 12 in BOTH arms.** Every one of
 *     them is 9.6% of the frame or more. For anything a customer would call a
 *     garment, the framing is irrelevant and always was.
 *   - **The two sub-1% pieces are where the roads differ, and the crop is the
 *     STABLE one.** On the hoop earring (0.1% of the frame) the crop said
 *     *"hoop earring"* in 10 of 12 and the whole frame said *"Horseshoe"* in 8
 *     of 12. On the belt keeper (0.2%) the crop said *"leather strap"* in 11 of
 *     12 — **wrong for the belt and right for what was actually cut**, which is
 *     this header's own opening paragraph — while the whole frame produced SIX
 *     different answers including *"Table leg"* and *"leaf"*, landing on
 *     *"belt"* 5 times.
 *   - ⚠ **So the whole frame's one win is the reader GUESSING PAST THE CUT,
 *     which is the single thing this road exists to prevent.** A chip must
 *     carry the cut's own name; a chip that says *"Table leg"* is worse than
 *     one that says *"leather strap"*, and the belt's real defect is the
 *     segmentation that cut a keeper (#2838), not the naming.
 *   - **And the crop is 2.2x cheaper a name** — $0.00099 against $0.00220 over
 *     96 calls an arm, because the reader is billed on pixels and a cropped
 *     piece has far fewer. Clause 3 of the disappearing-technology law.
 *
 * ⚠ **The pad, the floor and the grey were measured as ONE BUNDLE and not
 * one at a time.** The arm is `cutFor` entire. Nothing here claims a figure
 * for any of the three alone, and a later slice moving one of them owes its
 * own measurement.
 *
 * Receipts: `drape-scratch/_2875/` — `readings-2875-*.json` (192 readings),
 * `accept-2875.json` (the head-noun sets, frozen from the photographs before
 * the bench ran), `controls-2875.mjs` (the scorer's positive and negative
 * controls, both green before a cent was spent — the positive one reproduces
 * the court's published 8 of 9 with the same miss).
 */
export async function pieceOnGrey(input: {
  frame: Buffer;
  mask: Mask;
}): Promise<{ bytes: Buffer; contentType: string }> {
  const sharp = (await import("sharp")).default;
  const { mask } = input;
  const raw = await sharp(input.frame).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = raw.info;
  if (width !== mask.width || height !== mask.height) {
    throw new Error(
      `the cut is ${mask.width}x${mask.height} but the picture is ${width}x${height} — refusing rather than resampling`,
    );
  }
  if (channels !== 4) throw new Error(`expected RGBA, got ${channels} channels`);

  /* The piece's own extent. A mask with nothing in it would otherwise crop to
     a negative box and post an unbroken grey rectangle — a picture of nothing,
     bought and named. `nameTheCut` turns this throw into no name at all. */
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let at = 0; at < width * height; at += 1) {
    if (mask.data[at]! <= 127) continue;
    const x = at % width;
    const y = (at / width) | 0;
    if (x < left) left = x;
    if (x > right) right = x;
    if (y < top) top = y;
    if (y > bottom) bottom = y;
  }
  if (right < 0) throw new Error("the cut is empty — refusing to post a blank grey field");

  const pad =
    Math.round(Math.max(right - left, bottom - top) * CUT_NAME_CROP_PAD_FRACTION) + CUT_NAME_CROP_PAD_FLOOR_PX;
  const x0 = Math.max(0, left - pad);
  const y0 = Math.max(0, top - pad);
  const x1 = Math.min(width - 1, right + pad);
  const y1 = Math.min(height - 1, bottom + pad);
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;

  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const from = ((y + y0) * width + (x + x0)) * 4;
      const to = (y * w + x) * 4;
      if (mask.data[(y + y0) * width + (x + x0)]! > 127) {
        out[to] = raw.data[from]!;
        out[to + 1] = raw.data[from + 1]!;
        out[to + 2] = raw.data[from + 2]!;
        out[to + 3] = raw.data[from + 3]!;
      } else {
        out[to] = CUT_NAME_BACKDROP.r;
        out[to + 1] = CUT_NAME_BACKDROP.g;
        out[to + 2] = CUT_NAME_BACKDROP.b;
        out[to + 3] = 255;
      }
    }
  }

  let piece = sharp(out, { raw: { width: w, height: h, channels: 4 } });
  if (Math.max(w, h) < CUT_NAME_CROP_MIN_LONG_EDGE) {
    piece = piece.resize(
      w >= h
        ? { width: CUT_NAME_CROP_MIN_LONG_EDGE }
        : { height: CUT_NAME_CROP_MIN_LONG_EDGE },
    );
  }
  const bytes = await piece.png().toBuffer();
  return { bytes, contentType: "image/png" };
}

/**
 * NAME THE CUT, OR ANSWER `null` AND COST NOBODY ANYTHING.
 *
 * One text call. `null` for a refusal, an unparseable answer, a name that is
 * not a bare noun, or a provider that fell over — the fail-open property this
 * whole road holds.
 */
export async function nameTheCut(input: {
  frame: Buffer;
  mask: Mask;
  engine: TextEngine;
}): Promise<string | null> {
  let piece: { bytes: Buffer; contentType: string };
  try {
    piece = await pieceOnGrey({ frame: input.frame, mask: input.mask });
  } catch (cause) {
    log.warn({ cause: String(cause) }, "the cut could not be put on grey");
    return null;
  }
  /*
    ⚠ BOUNDED BEFORE IT IS POSTED (#1413's class, and the guard that caught
    this one is `readerFrameBound.test.ts`).

    A customer's attachment is accepted at up to 8 MB by the attach door, and
    ~~this piece keeps the attachment's own dimensions on purpose — the frame
    is deliberately NOT cropped to the cut, because the court's measurement was
    taken on the piece in its own frame.~~

    ⚠ **THE PIECE IS CROPPED NOW (#2875), AND THIS BOUND IS STILL LOAD-BEARING
    — one tap in three on that attachment is a piece big enough to need it.**
    The crop is to the PIECE, not to a thumbnail: somebody who photographs one
    coat filling an 8 MP frame gets a cut nearly as large as the frame, so the
    multi-megabyte post this bound exists to stop is still reachable. What the
    crop removed is the OTHER case — the small piece in a large field — and
    that one the bound never covered, because `boundForJudge` only ever shrinks
    above its own long edge. The two are complementary and neither replaces the
    other. It never enlarges and never throws, so a small piece goes as it is.
  */
  const bound = await boundForJudge(piece);
  try {
    const answer = await input.engine.complete({
      system: CUT_NAME_PROMPT,
      user: "What is this piece?",
      images: [bound.image],
      about: "reference.cutName",
      timeoutMs: CUT_NAME_TIMEOUT_MS,
      retries: 0,
    });
    /*
      ⚠ A REPLY CUT OFF AT THE CEILING IS NOT A SHORTER NAME (#1272's class).

      This read's answer is prose rather than JSON, which makes the failure
      QUIETER here than anywhere else that signal is read: a truncated name
      does not fail a parse, it comes back as `leather jack` — a plausible bare
      noun that would pass `isBareNoun`, reach the chip, and tell the customer
      their jacket is something else. So the flag is read before the text is,
      and a cut-off reply shows NO name, which is the honest answer and costs
      nothing.
    */
    if (answer?.truncated === true) {
      log.warn({}, "the cut's name came back cut off at the ceiling — no name is shown");
      return null;
    }
    const raw = typeof answer?.text === "string" ? answer.text : "";
    /* One line, no quotes, no trailing stop — the provider obeys the "name
       only" instruction loosely and this is the whole of the tidying. The
       BARENESS test is what actually decides, and it is not re-implemented
       here. */
    const name = raw.trim().split(/\r?\n/)[0]?.replace(/^["'`]+|["'`.!]+$/g, "").trim() ?? "";
    if (name.length === 0) return null;
    if (!isBareNoun(name, CUT_NAME_MAX_WORDS)) {
      log.warn({ length: name.length }, "the cut's name was not a bare noun — no name is shown");
      return null;
    }
    return name;
  } catch (cause) {
    log.warn({ cause: String(cause) }, "the cut could not be named");
    return null;
  }
}
