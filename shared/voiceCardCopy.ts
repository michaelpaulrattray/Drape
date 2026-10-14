/**
 * WHAT THE VOICE CARD SAYS — N4b-2 (#2470), design
 * `docs/specs/N4B_VOICE_DESIGN_2026-10-13.md` §6.
 *
 * Every customer-facing string on the voice card lives here, and that is a
 * control rather than tidiness. The card's own done-when is *"a test reads
 * every string on the card for vendor and pipeline words"*, and a test can only
 * read a population it can enumerate — strings scattered through a component
 * are a population nothing can be derived from (working law 4's shape: a guard
 * over a hand-listed sample drifts from the surface it is guarding).
 * `client/src/features/castingV2/voice/voiceCardCopy.test.ts` walks THIS
 * module's exported values. ⚠ This said `shared/` until 2026-10-14 and the
 * suite has never been there — the pointer guard resolves a BASENAME, by its own
 * stated scope, so a wrong directory is invisible to it.
 *
 * # THE DISAPPEARING-TECHNOLOGY LAW IS THE WHOLE SPECIFICATION HERE
 *
 * Clause 5: **no engine name on a path someone must walk** to reach their
 * picture — or here, their voice. The three places it most easily leaks, and
 * what each one says instead:
 *
 *   · **The loader** names what is happening to their CAST, never what is
 *     doing it (#55's honest-loader line): *"Making voices from your words"*,
 *     *"Recording Pigman's audition"*.
 *   · **A refusal** says what was refused and what to do. It never says
 *     "quota", "slot", "voice limit", "operation" or "clone" — those are the
 *     house's accounting, and a customer has no basis to act on any of them.
 *     {@link VOICE_CANNOT_KEEP} is the worked example: the thing a customer
 *     needs to know is that the voices they made are still there and that Keep
 *     is worth pressing later.
 *   · **The labels** are Voice 1–3. Never a provider id, never "preview",
 *     never "generated voice".
 *
 * ⚠ **AND "VOICE", NEVER "TAKE"** — his written design, to keep it clear of
 * film takes (#2140). A later card adding a fourth label here is adding a
 * second design call per press, which is the design's §1 reading rather than a
 * preference: every design call the spike made returned exactly three.
 *
 * # NOBODY IS GENDERED, AND THE NAMELESS CASE IS A REAL CASE
 *
 * His word, 2026-10-09: *"i dont want my crew being gender specific about
 * anything"*. A cast may also have no name at all, so every sentence that
 * would name one has a fallback that neither genders nor invents
 * ({@link voiceAuditionLoader}, {@link voiceKeptFoot}). The fallback is
 * *"this character"* — the room's own word for a cast with no name
 * (`CastCampaignsCard` passes exactly that string).
 */

import { displayPrice, formatCredits } from "./creditDisplay";

/** The label a customer reads for the nth voice. One-based, as it is spoken. */
export function voiceLabel(index: number): string {
  return `Voice ${index + 1}`;
}

/** The play control's accessible name — a button must say what it plays. */
export function voicePlayLabel(index: number): string {
  return `Play ${voiceLabel(index)}`;
}

/** Keep, naming the one being kept, so the press cannot be ambiguous. */
export function voiceKeepLabel(index: number): string {
  return `Keep "${voiceLabel(index)}"`;
}

/**
 * The card's own heading for the three.
 *
 * It says what they ARE rather than what made them: three readings of the
 * customer's own line, which is also why the heading sits under that line.
 */
export const VOICE_CHOICES_LABEL = "LISTEN AND PICK";

/**
 * The press that makes a fresh three from the words as they read now.
 *
 * ⚠ **IT CARRIES ITS PRICE SINCE #2471, AND THE BARE CONSTANT IS KEPT ONLY AS
 * THE PREFIX.** The design's own wording is *"Make new voices from this text ·
 * <credits>"*, and N4b-2 deliberately shipped it WITHOUT a number: the price was
 * a placeholder then and the press charged nothing, so a figure beside it would
 * have been both a false promise and the *"number nobody can act on"* the
 * disappearing-technology law's third question forbids. The press charges now,
 * so the number is owed — **the prices-on-paid-buttons law**: a customer must
 * never learn what something cost by being charged for it.
 */
export const VOICE_MAKE_AGAIN = "Make new voices from this text";

/**
 * That press with its price — `Make new voices from this text · 25 credits`.
 *
 * Takes the LEDGER number the server served and does the one conversion, so no
 * surface divides by five itself ({@link displayPrice} rounds UP, which is the
 * whole reason it is the only road).
 */
export function voiceMakeAgainLabel(ledgerPrice: number): string {
  return `${VOICE_MAKE_AGAIN} · ${formatCredits(displayPrice(ledgerPrice))} credits`;
}

/** Keep, naming the one being kept AND what it costs. */
export function voiceKeepPricedLabel(index: number, ledgerPrice: number): string {
  return `${voiceKeepLabel(index)} · ${formatCredits(displayPrice(ledgerPrice))} credits`;
}

/**
 * A press the balance could not pay for.
 *
 * ⚠ **The house's own shape for this sentence, matched deliberately**: every
 * other paid casting road writes *"Not enough credits. A roll costs N
 * credits."* at its own call site, beside the price it quotes
 * (`server/lib/chargeRefusal.ts`'s stated rule). It is rendered HERE rather
 * than shown from the server's reply so this module stays the one place every
 * string on the card can be enumerated from — which is what the card's
 * no-vendor-words reader walks.
 */
export function voiceNotEnoughCreditsText(ledgerPrice: number, during: "make" | "keep"): string {
  const what = during === "keep" ? "Keeping a voice" : "Making new voices";
  return `Not enough credits. ${what} costs ${formatCredits(displayPrice(ledgerPrice))} credits.`;
}

/**
 * The first-open loader. About 7–10 seconds, measured (design §3).
 *
 * "Your words" rather than "the voice line": the line is the customer's own
 * writing, and saying so is the honest description of what is being read.
 */
export const VOICE_MAKING_LOADER = "Making voices from your words";

/** The Keep loader. Names the cast, never the recording machinery. */
export function voiceAuditionLoader(name: string | null): string {
  const who = name && name.trim().length > 0 ? `${name.trim()}'s` : "this character's";
  return `Recording ${who} audition`;
}

/** The foot under the player once a voice is kept — it replaces "No voice yet". */
export function voiceKeptFoot(name: string | null): string {
  const who = name && name.trim().length > 0 ? `${name.trim()}'s` : "This character's";
  return `${who} voice`;
}

/** The hint beside that foot: what the clip IS, in a casting director's words. */
export const VOICE_KEPT_HINT = "An audition in their own voice.";

/**
 * A full account or a spent month, in the customer's terms (design §6).
 *
 * The house's reason — no slot free, or no operations left this period — is two
 * different accounting facts the customer can do nothing about and would have to
 * be taught to read, so it says neither.
 *
 * ⚠ **IT USED TO PROMISE *"The ones you made will still be here"* AND THAT WAS
 * FALSE (#2470's finding, item 5).** The handles live in an in-process store a
 * deploy empties, and a preview is only known saveable for about fifty seconds —
 * so *later* they are reliably gone. It now says the one thing that is true and
 * actionable: make them again. **The card no longer designs three voices on
 * house money when nothing can be kept at all** (`voice.status` answers
 * `canKeep`), so this sentence is what a customer sees after a Keep was refused
 * rather than before they ever press.
 */
export const VOICE_CANNOT_KEEP =
  "Voices can't be kept right now. Make them again in a little while and keep one then.";

/**
 * The design limit, in the customer's terms.
 *
 * ⚠ **"In a little while", never a bare "try again"** — the limit is per hour,
 * so *try again* invites the press that fails the same way, which is what the
 * generic failure sentence did until #2470's finding (item 4). It names no
 * number: twelve an hour is our pacing of house money, not a fact a customer has
 * any use for.
 */
export const VOICE_TOO_SOON =
  "That's a lot of voices in one go. Try again in a little while.";

/**
 * A kept clip that would not play.
 *
 * ⚠ **The press used to just stop** (#2470's finding, item 6) — the button
 * released and nothing was said, which reads as a product that ignored you. It
 * says what happened and the one thing worth trying, and it never blames the
 * network or names a bucket.
 */
export const VOICE_CLIP_WONT_PLAY =
  "That recording wouldn't play just now. Try again in a moment.";

/**
 * A design that did not come through. Says the money part out loud.
 *
 * ⚠ **"NOTHING WAS CHARGED" WAS A FREE TRUTH UNTIL #2471 AND IS NOW A CLAIM
 * ABOUT THE LEDGER.** When this sentence was written the press charged nothing
 * at all, so it could not be wrong. The press charges now, and the claim is
 * only true because the refusal road refunds — so it may be said ONLY when the
 * refund is known to have recorded. {@link voiceMakeFailedText} is the road
 * that decides; this constant is the sentence for the case where it did.
 *
 * `server/casting/atomicCredits.ts` states the law this guards in its own
 * words: a refund that failed to record is **never** reported as "you weren't
 * charged".
 */
export const VOICE_MAKE_FAILED =
  "Those voices didn't come through. Nothing was charged — try again.";

/** A Keep that did not come through. The same claim, under the same rule. */
export const VOICE_KEEP_FAILED =
  "That voice couldn't be kept. Nothing was charged — try again.";

/**
 * THE SAME TWO FAILURES WHEN THE MONEY HAS NOT COME BACK YET.
 *
 * The rare case: the charge committed, the voice was refused, and the refund
 * write itself did not land. The customer is genuinely out of pocket, so the
 * sentence says so and names the one thing that fixes it.
 *
 * ⚠ **It quotes no reference, and that is a decision rather than an
 * oversight.** `atomicCredits`' own `refundTruth` hands the customer a
 * reference id for support to reconcile against, and the simpler road here was
 * to do the same. Declined: a reference is machinery on a card whose whole
 * design is that none shows, and it is not needed — `recordRefund` already
 * logs the failure at ERROR with the account, the amount and that reference, so
 * support can find it from the account alone. What the customer needs is to
 * know they are owed and that saying so is enough.
 */
export const VOICE_REFUND_OWED =
  "Those credits haven't come back yet. Get in touch and we'll put it right.";

/** The design-failure sentence, chosen on what the money actually did. */
export function voiceMakeFailedText(refunded: boolean): string {
  return refunded ? VOICE_MAKE_FAILED : `That didn't come through. ${VOICE_REFUND_OWED}`;
}

/** The Keep-failure sentence, chosen on what the money actually did. */
export function voiceKeepFailedText(refunded: boolean): string {
  return refunded ? VOICE_KEEP_FAILED : `That voice couldn't be kept. ${VOICE_REFUND_OWED}`;
}

/**
 * The line is too short for a voice to be made from it.
 *
 * The engine has its own floor on a description, and it is the one refusal in
 * the set a customer can genuinely fix — so it says what to do rather than that
 * something failed.
 */
export const VOICE_LINE_TOO_SHORT =
  "There aren't enough words here yet to make a voice from. Say a little more about how they sound.";

/**
 * The empty state when the cast has no written voice line at all.
 *
 * It points at the thing above it rather than offering a press that cannot
 * work: the line is what voices are made FROM, so a card with no line has
 * nothing to offer and says which door to open.
 */
export const VOICE_NEEDS_A_LINE =
  "Write how they sound first, and voices can be made from those words.";

/** Every fixed string on the card, for the no-vendor-words reader. */
export const VOICE_CARD_FIXED_STRINGS: readonly string[] = [
  VOICE_CHOICES_LABEL,
  VOICE_MAKE_AGAIN,
  VOICE_MAKING_LOADER,
  VOICE_KEPT_HINT,
  VOICE_CANNOT_KEEP,
  VOICE_TOO_SOON,
  VOICE_CLIP_WONT_PLAY,
  VOICE_MAKE_FAILED,
  VOICE_KEEP_FAILED,
  VOICE_REFUND_OWED,
  VOICE_LINE_TOO_SHORT,
  VOICE_NEEDS_A_LINE,
];

/**
 * Every string the card can draw, fixed and composed alike.
 *
 * ⚠ **The composed ones are rendered with real arguments rather than listed as
 * templates**, including the nameless fallback, because that is where a
 * gendered pronoun or an invented noun would hide. A template read as a
 * template passes a reader that the rendered sentence would fail.
 */
export function voiceCardEveryString(): readonly string[] {
  const names: readonly (string | null)[] = ["Pigman", null, "   "];
  const composed: string[] = [];
  for (const name of names) {
    composed.push(voiceAuditionLoader(name), voiceKeptFoot(name));
  }
  for (let index = 0; index < 3; index += 1) {
    composed.push(voiceLabel(index), voicePlayLabel(index), voiceKeepLabel(index));
    /* The priced Keep, with a real ledger figure — a template read as a
       template passes a reader the rendered sentence would fail. */
    composed.push(voiceKeepPricedLabel(index, 500));
  }
  /* The priced press and both money refusals, rendered rather than described,
     and BOTH sides of each boolean — the sentence for a refund that did not
     record is the one most likely to leak accounting words. */
  composed.push(voiceMakeAgainLabel(125));
  for (const refunded of [true, false]) {
    composed.push(voiceMakeFailedText(refunded), voiceKeepFailedText(refunded));
  }
  for (const during of ["make", "keep"] as const) {
    composed.push(voiceNotEnoughCreditsText(during === "keep" ? 500 : 125, during));
  }
  return [...VOICE_CARD_FIXED_STRINGS, ...composed];
}
