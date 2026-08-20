/**
 * ATTACHING A PICTURE — the words on the one universal door, apart from the
 * component that draws them.
 *
 * # The ruling these sentences serve (founder, fable-1051)
 *
 * > *"you put a small link take makeup from a photo???? this is stupid, you
 * > should be able to upload any image like grok and use it as a reference for
 * > anything"*
 *
 * One attach affordance in the ask box, any picture, any ask — and **the
 * SENTENCE is the instruction**. So nothing here may name a feature: a string
 * that said *"attach a hair photo"* would rebuild, in words, the per-feature
 * entry point the ruling deleted. What the road can do with a picture is said
 * in the REPLY, when she has asked (§10.3), which is why this module is short.
 *
 * # Why the copy is a module with a suite
 *
 * The UI milestone contract (founder, 2026-08-01): every user-visible string is
 * re-derived against current capability before it ships, and the mechanizable
 * half of that is assertions rather than review memory — the same shape as
 * `referenceReadCopy.ts` next door.
 */
import { INK_PROVENANCES, type InkProvenance } from "@shared/inkProvenance";

/**
 * The door itself carries NO VISIBLE LABEL — it is a `+` beside the box (design
 * §6: no label, no tooltip chrome, no second row of icons). This is what a
 * screen reader is told, and it names the ACT rather than a feature, because
 * the picture is not for anything until she says so.
 */
export const ATTACH_ACTION_LABEL = "Attach a picture";

/** While her picture is going up. Present tense, because it is happening. */
export const ATTACH_BUSY_LABEL = "Attaching your picture…";

/** The chip above the input, for the people who cannot see it. */
export const ATTACHED_PICTURE_LABEL = "The picture you attached";

/**
 * The one `×` on the chip — and it says OFF YOUR ASK rather than "remove",
 * because that is what it does.
 *
 * There is no detach door and there deliberately isn't one: our copy lives
 * under the Cast's own purge path and is swept with it, which is what makes a
 * crop re-derivable without asking her for the same photograph twice. So a
 * label promising deletion would be a claim this product does not keep. What
 * she is taking back is the picture's ride on the next sentence, which is
 * immediate and free.
 */
export const ATTACH_REMOVE_LABEL = "Take this picture off your ask";

/**
 * When the door refuses and says nothing we can read — OUR sentence, never the
 * error's (the panel's own law, and the reason a gateway's plain-text 502 no
 * longer reaches anybody as a JSON parse failure).
 *
 * Every refusal this door has of its own — too large, too small, not an image
 * we can read, the cap — arrives spoken from the server and is shown unchanged.
 * A client that re-worded one of those is how two surfaces come to say
 * different things about one wall.
 */
export const ATTACH_FAILED_FALLBACK = "That picture couldn't be attached.";

/**
 * WHAT THE PICTURE IS FOR, said once and only while one is attached.
 *
 * Not a tooltip and not a label on the control: it is the same quiet meta line
 * the box already uses to say what refining can do before somebody types
 * something it cannot. It points at the SENTENCE, because the sentence is the
 * instruction — and it promises nothing about what can be taken, which is the
 * reply's job and not the door's.
 */
export const ATTACHED_PICTURE_NOTE = "Now say what to take from it — this picture rides with your next ask.";

/**
 * WHERE THE PICTURE CAME FROM — the fence's own question, in her words.
 *
 * `attach` takes `synthetic | consented` and **has no default, by ruling**: a
 * guessed provenance is precisely the value the real-person fence cannot carry
 * (`shared/inkProvenance.ts`). So the surface has to ask, and a click-through
 * *"by attaching you confirm…"* that sent a constant would be the guess wearing
 * a sentence — the same value, arrived at without her.
 *
 * Two chips, one tap, on every picture and never remembered from the last one:
 * an answer inherited from the previous attach is a claim about THIS picture
 * that nobody made.
 *
 * The record is TOTAL over the enum rather than a list beside it. A third
 * provenance added server-side reddens {@link attachClaimChips}'s suite instead
 * of shipping a chip row that silently cannot express it.
 */
export const ATTACH_CLAIM_QUESTION = "Where's this from?";

const CLAIM_WORDS: Readonly<Record<InkProvenance, string>> = Object.freeze({
  synthetic: "I made it",
  consented: "I have permission",
});

export type AttachClaimChip = {
  readonly provenance: InkProvenance;
  readonly label: string;
};

/**
 * The chips, derived from the shared enum in its own order.
 *
 * A missing word throws rather than describing itself by its key: `referenceClassGate`'s
 * idiom, because a phrase somebody guessed at reads as chosen to the next person.
 */
export function attachClaimChips(): readonly AttachClaimChip[] {
  return INK_PROVENANCES.map((provenance) => {
    const label = CLAIM_WORDS[provenance];
    if (!label) {
      throw new Error(`[referenceAttachCopy] no words for the provenance "${provenance}"`);
    }
    return { provenance, label };
  });
}

/**
 * THE SHOWN CUT — what a screen reader is told about the picture beside the
 * question (ruled fable-1127 §2, brought to this road fable-1156).
 *
 * The question itself is the SERVER'S sentence and is drawn like every other
 * one — this is only the alt text, and it says what the picture IS rather than
 * what to do about it, because the chips below already say that.
 *
 * It says "taken out of" rather than "cropped from": the customer's own framing
 * of this act is a design lifted off a photograph, and a word from the cutter's
 * implementation would be the maths class talking (working law 8).
 */
export const SHOWN_CUT_LABEL = "The design taken out of your picture";
