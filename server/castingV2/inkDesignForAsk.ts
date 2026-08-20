/**
 * WHICH OF HER DESIGNS THIS ASK IS ABOUT — the one owner of that decision.
 *
 * A customer's sentence names a PLACE ("put it on her neck"), never a design.
 * A Cast may hold up to eight (`INK_DESIGNS_PER_CANDIDATE`). So something has
 * to get from a place to a row, and the whole question is what it does when the
 * place does not name exactly one.
 *
 * # THE ANSWER IS NEVER A DEFAULT (ruled fable-1145 §4)
 *
 * Three roads were weighed and two were refused:
 *
 *   the most recent    a quiet default choosing on her behalf — the
 *                      unowned-axis class with a timestamp for an alibi, and
 *                      the same shape as the earring fallback that was killed
 *   refuse, silently   the honest answer with the honesty left out
 *   REFUSE, NAMED      ← this. She is told the placement, the COUNT, and the
 *                      one road that exists today
 *
 * The refusal is not a wall being polite about itself: the per-design delete
 * shipped this same week, so *"remove the one you don't mean"* is a real move
 * she can make right now. And it promises nothing about a picker, because the
 * ink studio's room does not exist and a sentence hinting at one would be the
 * dead-end-wearing-a-tap-target D-180 forbids.
 *
 * **When the room arrives, the picker supersedes this refusal** — the choice
 * stays on the board rather than being spent now by a default nobody would have
 * chosen deliberately.
 *
 * **And on 2026-08-20 the founder took most of that refusal away**, which is
 * the amendment the rest of this file now reads against: where exactly ONE
 * design lives at an address a row can hold, she is offered the replacement
 * rather than told to go and delete something. The prose above still describes
 * what happens where the offer cannot be shown, and that is now a corner.
 *
 * # AND SHE POINTED AT A PICTURE, WHICH IS THE HALF THE PLACE COULD NOT ANSWER
 *
 * Everything above is about a sentence that names a place and nothing else. On
 * the attach-pointed road she also hands over the DESIGN — so the question this
 * function answers stops being *which of these eight* and becomes *is the one
 * she is pointing at already here* (ruled fable-1148 §3, resolution order ruled
 * fable-1151 §3).
 *
 * The source is REQUIRED rather than optional, and that is the shape of the
 * road rather than a convenience: this decision is only ever made inside the
 * pre-claim branch, which cannot be entered without a resolved attachment. An
 * optional source would have left two outcomes below reachable by nobody, which
 * is how a sentence nobody can read comes to look tested.
 *
 * Three answers, and each is somebody's scar:
 *
 *   RIDE      a design at this address came out of THIS picture — the reuse
 *             rule (fable-1149 §2b). One picture, one row: never a second cut,
 *             never a second charge, and never two rows that then wall her
 *   MINT      nothing is at this address at all, so the picture becomes the
 *             design. That is the whole of road (D)
 *   REPLACE   something IS at this address and it did not come out of this
 *             picture. Riding it would paint a different artwork onto her
 *             because it shares an address — the silent wrong answer, and the
 *             worst outcome this road can produce. So she is ASKED, and the
 *             resident is replaced only on her tap (founder ruling relayed
 *             fable-1158 §1, amending the flat refusal below)
 *   CONFLICT  the same thing where the offer cannot be shown, which is now the
 *             corner rather than the rule: more than one design at one stated
 *             address, a state only the studio upload door can build
 *
 * **The corner where the resident IS the same artwork, uploaded by hand, stays
 * a conflict** (ruled fable-1151 §3). Telling them apart would take a reader's
 * opinion about whether two pictures show the same design, and law 9 forbids a
 * vision verdict that turns a customer away. Honest and rare beats a similarity
 * guess.
 *
 * # WHY IT IS A PURE FUNCTION OVER ROWS ALREADY READ
 *
 * It takes the Cast's designs rather than fetching them, for the reason working
 * law 3 gives: every refusal here is one a suite would otherwise "prove" by
 * never triggering it. Driven directly, a planted two-design placement is one
 * line instead of a database.
 *
 * The read itself stays where it belongs — `listInkDesigns`, owner-scoped on
 * BOTH sides of its join — so nothing here can be handed a row belonging to
 * somebody else by a caller that forgot.
 */
import { inkDesignWasExamined } from "../../shared/inkCutRoute";
import {
  INK_PLACEMENTS,
  inkPlacementBareNoun,
  isInkPlacement,
  type InkPlacement,
} from "../../shared/inkPlacementVocabulary";
import type { InkSide } from "../../shared/inkReleasedPlacements";
import type { StoredInkDesign } from "../db/castingV2InkDesigns";
import type { InkAskPlacement } from "./referenceSlots";

/**
 * WHERE THE ASK PUTS IT, as the take read it.
 *
 * `side: null` is *she did not say*, which is a real state and never an
 * invented arm: the side is this road's measured failure (300 credits refunded
 * twice for a design on the wrong anatomical side, DECISION_LOG R7-7G), so an
 * unstated side narrows nothing and lets the count below do the talking.
 */
export type InkAskAddress = Omit<InkAskPlacement, "side"> & {
  /**
   * THE ROW'S SIDE VOCABULARY, which is WIDER than the slot grammar's — and
   * saying so by derivation rather than by re-listing the fields.
   *
   * `InkSide` has three members and `Instance` has two: `centre` is the
   * vocabulary's answer for a surface there is ONE of, and the slot grammar
   * says that same thing by having no instance at all. So this is not a second
   * copy of `InkAskPlacement` — it is that type with one field widened, and
   * {@link slotPlacementOf} is the narrowing back.
   *
   * Written as an `Omit` because a re-listed shape is a copy that drifts by
   * losing a field nothing can see, and the Atlas says so mechanically. The
   * `placement` half is inherited here, so the day it gains a member or a
   * constraint this type follows without anybody remembering to.
   */
  side: InkSide | null;
};

export type InkDesignForAsk =
  /** A design from THIS picture is already at this address, and it has been
   *  looked at. The reuse rule's outcome: ride it, cut nothing, charge nothing. */
  | { kind: "ride"; design: StoredInkDesign }
  /**
   * Nothing is at this address, so the picture she pointed at becomes the
   * design. The caller cuts it once and files it — road (D).
   *
   * **The two fields are the proof, not a convenience.** A row needs a measured
   * placement and a side, and this outcome is only returned when the address
   * has both — so the caller cannot reach the mint holding a `string` and a
   * `null` and be tempted to resolve either of them itself. The two answers
   * that are not mintable are outcomes of their own, below.
   */
  | { kind: "mint"; placement: InkPlacement; side: InkSide }
  /**
   * She named a surface nobody has measured — *"on my sleeve"*.
   *
   * ⚠ TEMPORARY, AND IT IS THE ONLY OUTCOME HERE THAT IS. The database column
   * has held any word since migration 0046 and the slot grammar takes one on
   * purpose (`inkSlotKey`), so nothing about the RENDER stands in the way. What
   * stands in the way is that `casting_ink_designs.placement` is still typed to
   * the measured three, and widening it forces an answer on the paid sign road
   * — *does a tattoo at a surface nobody has measured ride into package views*
   * — which is a measurement rather than a judgement (opus-855 §2).
   *
   * It is not fable-1078's wall being rebuilt: that ruling removed the DOCUMENT
   * wall, and this is a capability said plainly, with the three surfaces that
   * work today named so she has a road in the next message.
   */
  | { kind: "placementUnserved"; say: string }
  /**
   * A paired surface, and she never said which one.
   *
   * The one thing this road may never do is pick (DECISION_LOG R7-7G: 300
   * credits refunded twice for a design on the wrong anatomical side). So it
   * asks — and asking is only allowed because the road behind the answer now
   * exists (fable-1120 §4 released the side question on exactly that
   * condition). Re-asking with the word works immediately.
   */
  | { kind: "sideUnstated"; say: string }
  /**
   * ONE other design lives at this address, and she may replace it (founder
   * ruling relayed fable-1158 §1).
   *
   * Not an answer — an OFFER the caller has to raise. The resident is carried
   * whole rather than by name because the offer's own question and its adopt
   * both need it, and re-reading it on the answer path would be a second look
   * at an unstable thing immediately before a deletion.
   *
   * The two address fields are here for {@link mint}'s reason: this outcome is
   * only returned for an address a row can actually hold, so a caller cannot
   * reach the mint holding a `string` and a `null`.
   */
  | {
    kind: "replace";
    placement: InkPlacement;
    side: InkSide;
    resident: StoredInkDesign;
  }
  /**
   * Something else lives at this address and the offer cannot be shown —
   * refused, and nothing is written.
   *
   * ⚠ THIS IS NOW THE CORNER RATHER THAN THE RULE (fable-1158 §1: *"(iii)'s
   * refusal sentence survives only for the corner where the offer cannot be
   * shown"*). It is reached when MORE THAN ONE design sits at a stated address,
   * which the offer cannot name a single resident for — a state only the studio
   * upload door can produce, since this road never mints a second row where one
   * already lives.
   */
  | { kind: "conflict"; count: number; say: string }
  /** Her design, stored before anybody looked at what is in its picture. */
  | { kind: "unexamined"; say: string };

/**
 * THE PICTURE THIS ASK POINTS AT, reduced to the one thing this decision needs.
 *
 * Byte identity of what she POINTED AT, and never of the cut taken out of it: a
 * cutout is a segmenter's output, so the same picture cut twice is not the same
 * bytes, and keying on the cut would make two different pictures that happened
 * to cut alike collide — a claim about her intent nobody measured
 * (fable-1149 §2b).
 *
 * Narrowed to `digest` rather than taking the whole `AskReference` so nothing
 * here can reach for a storage key: this function decides, and the road that
 * spends is somewhere else.
 */
export type InkAskSource = { readonly digest: string };

/**
 * How the place is spoken back to her — the vocabulary's own noun for a surface
 * it has measured, and her exact phrase for one it has not.
 *
 * Through `inkPlacementBareNoun` rather than a second strip of the possessive:
 * the take's own spoken-back place comes from that owner too, so a customer who
 * meets both sentences hears one product rather than two.
 *
 * EXPORTED because the replace offer's question names the same place — *"her
 * left upper arm already has a design"* — and a second speller would be a
 * second product's worth of nouns for one surface (law 4). It is also why that
 * question's handle carries the ADDRESS rather than the finished sentence: the
 * two tokens are closed, so the rebuild composes the identical phrase here
 * instead of keeping a copy of it.
 */
export function inkAddressPhrase(address: InkAskAddress): string {
  const surface = isInkPlacement(address.placement)
    ? inkPlacementBareNoun(address.placement)
    : address.placement;
  if (address.side !== "left" && address.side !== "right") return `her ${surface}`;
  /*
    AND HER SIDE WORD IS NEVER SAID TWICE (the class, killed 2026-08-20; ruled
    fable-1163 §3).

    The instance was **"her left left upper arm is more than I can place yet"**,
    read off the running app: her phrasing put the side inside the place name,
    the take captured it as the side as well, and this line prepended it to a
    phrase that already carried it. Decomposition fixes that ask — `upper arm`
    is measured, so the address is now (upperArm, left) and the surface here is
    a bare noun.

    It does NOT fix the class. An OPEN phrase keeps her exact words, by ruling —
    the tally's evidence is never edited — so *"left sleeve"* with the side
    `left` still arrives here, and `sleeve` is not something the vocabulary can
    reduce. So the repeat is refused at the sentence rather than at the address:
    if the phrase already opens with her word, it is not added again.
  */
  const alreadySaid = new RegExp(`^${address.side}\\b`, "i").test(surface.trim());
  return alreadySaid ? `her ${surface}` : `her ${address.side} ${surface}`;
}

/**
 * The designs this address could mean.
 *
 * A stated side NARROWS; an unstated one does not. That asymmetry is the whole
 * of the side rule here: narrowing on a side she never said would be the road
 * choosing an arm for her, and widening on one she did say would be ignoring
 * the only word that stops a design landing on the wrong one.
 *
 * `centre` is the vocabulary's answer for a surface there is one of, so it is
 * never something a sentence states and never something this filter matches
 * against a stated side — a `centre` row at the named placement is simply a row
 * at that placement, which it is.
 */
function matching(
  designs: readonly StoredInkDesign[],
  address: InkAskAddress,
): readonly StoredInkDesign[] {
  const here = designs.filter((design) => design.placement === address.placement);
  if (address.side === null) return here;
  return here.filter((design) => design.side === address.side);
}

/**
 * WHICH DESIGN RIDES, or the sentence she reads instead.
 *
 * Every non-`ride` answer carries its own finished sentence rather than a code
 * for the caller to phrase. That is deliberate: these sentences differ in what
 * they hand her to DO, and a caller composing them from a reason would be the
 * second author of a distinction this function exists to make.
 */
export function inkDesignForAsk(
  designs: readonly StoredInkDesign[],
  address: InkAskAddress,
  source: InkAskSource,
): InkDesignForAsk {
  const place = inkAddressPhrase(address);
  const here = matching(designs, address);
  /*
    THE ROWS THAT CAME OUT OF THIS PICTURE.

    `sourceDigest` is `null` for every design a customer uploaded through the
    studio door — she did not take that one out of anything — and no digest can
    equal a null. So a hand-uploaded design can never be silently reused for a
    picture it did not come from, and that safety is a property of the column's
    own emptiness rather than of a branch somebody remembered to write
    (migration 0048).

    At most one row can match by the reuse key itself, since the key is
    (source digest, placement, side) and those are exactly the three things
    filtered on here. More than one would mean the key was not enforced, which
    is why the answer below is `here.length` rather than an assumption.
  */
  const mine = here.filter((design) => design.sourceDigest === source.digest);

  if (mine.length > 1) {
    /*
      HER PICTURE IS AT THIS PLACEMENT ON MORE THAN ONE SIDE OF HER, AND SHE
      NAMED NEITHER — found by an arm rather than by reasoning, and the version
      of this function without it rode the LEFT arm.

      The reuse key is (source digest, placement, side), so two rows from one
      picture at one placement differ by SIDE and nothing else. An address with
      no stated side spans both of them, and picking is the 300-credit refund
      with a new author (R7-7G). So it asks — the same question the mint asks,
      through the same sentence, because it is the same missing word.

      A stated side cannot reach here, since `matching` has already filtered to
      it: more than one row then would mean the key was not enforced, and the
      honest answer to that is the count rather than a choice.
    */
    return address.side === null ? unstatedSide(place) : conflict(mine.length, place);
  }

  if (mine.length === 0) {
    if (here.length === 0) {
      /* NOTHING IS HERE AND SHE HANDED US THE DESIGN. Road (D)'s whole
         purpose: the caller cuts this picture once and files it — once the
         address is one a row can actually hold. */
      return mintable(address, place);
    }
    /*
      SOMETHING ELSE LIVES AT THIS ADDRESS — AND SHE MAY REPLACE IT (founder
      ruling relayed fable-1158 §1, amending fable-1151 §3).

      1151 §3 weighed three roads and refused two of them: riding the resident
      is a different artwork painted onto her for sharing an address — the
      silent wrong answer — and minting alongside builds the ambiguity out of
      its own row and then walls her with it. So it refused, and told her to
      remove the resident and send the picture again.

      His answer to that dance was *"cant is just paint over the original rather
      than you hving to remopve it just replace the reference image provided?"*.
      So the third road is now an OFFER: the resident is named, she taps, and
      the replacement happens in one consented act. What survives of 1151 §3
      unchanged is the thing it was protecting — nothing rides silently, and no
      row is destroyed without her word for it.

      TWO GATES IN FRONT OF THE OFFER, and each is a corner rather than a
      hedge:

        the address must be one a ROW CAN HOLD, because an adopt ends in a mint
        and a mint needs a measured placement and a stated side. On a paired
        surface with no word this asks WHICH ARM before it asks anything about
        the resident — she cannot consent to replacing a design on an arm
        nobody has named, and after she says the word this offer is what she
        meets. (Before today that ask met the refusal below, which is the dance
        his ruling deleted.)

        more than ONE design here keeps the refusal, because the offer's whole
        content is naming what it is about to destroy and there is no sentence
        that names two. Only the studio upload door can build that state: this
        road never mints a second row where one already lives.
    */
    const room = mintable(address, place);
    if (room.kind !== "mint") return room;
    if (here.length > 1) return conflict(here.length, place);
    return {
      kind: "replace",
      placement: room.placement,
      side: room.side,
      resident: here[0]!,
    };
  }

  const design = mine[0]!;
  if (!inkDesignWasExamined(design.cutRoute)) {
    /*
      NOBODY LOOKED AT WHAT IS IN THIS PICTURE.

      `cutRoute: null` is not "unset" — it is the recorded fact that
      `CASTING_INK_CUT_SCOPE` was off when those bytes were stored, so what sits
      at `storageKey` is the picture she uploaded rather than the design cut out
      of it. On this road unexamined means POSSIBLY A PHOTOGRAPH OF A PERSON,
      which is the exposure the cutter exists to close, and it is the exact set
      of rows the flag's off-period created.

      Refused FREE here rather than only at the assembler (ruled fable-1146 §3):
      a charge raised and reversed for a fact known before the claim is the
      wrong shape. The assembler keeps its own arm as the backstop — it is the
      last door before an engine sees bytes, and a guard whose only test runs
      through a door that usually behaves is not a tested guard.

      Her sentence says nothing about flags or cutters. It says the one true
      thing she can act on: this one needs sending again.
    */
    return {
      kind: "unexamined",
      say: `The design I have for ${place} was saved before I could check what was in it, `
        + "so I can't use it yet. Send it again and I'll take it from there. "
        + "Nothing was charged.",
    };
  }

  return { kind: "ride", design };
}

/**
 * MORE THAN ONE THING LIVES HERE — the sentence, spelled once.
 *
 * The count is said because *"you have two there"* and *"you have four there"*
 * ask different amounts of thinking from her, and she cannot see the list. Both
 * moves that exist TODAY are named — the per-design delete, and simply naming a
 * place with room. Nothing is said about a picker, because the ink studio's
 * room does not exist and a hint at one is the tap target with nothing behind
 * it (D-180).
 *
 * # IT IS ALWAYS PLURAL NOW, AND THAT IS DERIVED RATHER THAN HOPED
 *
 * This sentence used to have a singular arm. Since the replace offer landed,
 * both call sites are guarded by a count of at least two — a single resident at
 * an address a row can hold is an OFFER, not a refusal. So the singular wording
 * would be a branch nothing could reach, which in this codebase is a branch
 * with no test rather than a kindness (`corner declared synthetic`).
 *
 * It is not left to a comment: `inkDesignForAsk.test.ts` sweeps the outcomes
 * this function is reachable through and proves none of them carries a count
 * below two. A future path that reaches it with one reddens that arm on the day
 * it is written, instead of shipping *"You've got 1 designs"*.
 */
function conflict(count: number, place: string): InkDesignForAsk {
  return {
    kind: "conflict",
    count,
    say: `You've got ${count} designs for ${place} already, and this picture isn't one `
      + "of them. Remove the one you don't want and send this again, or put this one "
      + "somewhere she's got room. Nothing was charged.",
  };
}

/**
 * WHICH OF HER — the sentence, spelled once, for the two roads that need it.
 *
 * A mint has no value to put in a NOT NULL column, and a ride would have to
 * pick between her arms. Both are the same missing word and she reads the same
 * question, because two sentences for one gap is how a customer meets two
 * products.
 */
function unstatedSide(place: string): InkDesignForAsk {
  return {
    kind: "sideUnstated",
    say: `I've got the design from your picture for ${place}, but I need to know which `
      + "one — her left or her right. Say which and I'll put it there. Nothing was charged.",
  };
}

/**
 * WHETHER THIS ADDRESS IS ONE A ROW CAN HOLD — and the sentence when it is not.
 *
 * Two questions, and neither is a formality:
 *
 *   the PLACEMENT must be one the vocabulary has measured, because the row's
 *   column is still typed to those three and widening it is a decision on the
 *   paid sign road rather than here (see `placementUnserved` above);
 *
 *   the SIDE must be stated, because `casting_ink_designs.side` is NOT NULL and
 *   there is no value for *she did not say*. `centre` is not a spare: it is the
 *   vocabulary's answer for a surface there is ONE of, and `sidesForInkPlacement`
 *   has already supplied it before this point for `neck` and `upperChest`. So a
 *   null side here means a PAIRED surface with no word — the one case where a
 *   value would have to be invented, and inventing it is this road's proven
 *   refund.
 *
 * The served list is derived from the vocabulary rather than typed out, so a
 * fourth measured surface joins the sentence the day it is measured (law 4).
 */
function mintable(address: InkAskAddress, place: string): InkDesignForAsk {
  if (!isInkPlacement(address.placement)) {
    const served = INK_PLACEMENTS.map((key) => `her ${inkPlacementBareNoun(key)}`);
    const list = `${served.slice(0, -1).join(", ")} or ${served[served.length - 1]}`;
    return {
      kind: "placementUnserved",
      say: `I can put a design on ${list} right now — ${place} is more than I can `
        + "place yet. Nothing was charged.",
    };
  }
  if (address.side === null) return unstatedSide(place);
  return { kind: "mint", placement: address.placement, side: address.side };
}

/**
 * THE SAME ADDRESS, IN THE SLOT GRAMMAR'S WORDS — and the two vocabularies do
 * not agree, which is why this is a function rather than a cast.
 *
 * A design ROW's side is `InkSide`: `left`, `right`, or **`centre`**. A library
 * SLOT's instance is `Instance`: `left`, `right`, or nothing at all. `centre`
 * is the vocabulary's answer for a surface there is ONE of (`neck`,
 * `upperChest`), and the slot grammar says that same thing by having no
 * instance suffix — `ink:neck`, never `ink:neck@centre`, which
 * `inkPlacementOfSlot` refuses outright because the suffix list is closed.
 *
 * So `centre` maps to `null`, and it is a TRANSLATION rather than a loss: both
 * spellings mean *this surface is one place*. Written here, once, because the
 * alternative is a call site coercing it — and a call site that got it backwards
 * would ask for `ink:neck@centre`, which resolves to nothing, and the design
 * would be dropped one door later by a slot the catalogue never heard of.
 *
 * The two real sides pass through untouched. That is the half worth protecting:
 * this road's measured failure is a design on the wrong arm, so a mapping that
 * ever moved `left` would be the R7-7G refund with a new author.
 */
export function slotPlacementOf(address: InkAskAddress): InkAskPlacement {
  return {
    placement: address.placement,
    side: address.side === "centre" ? null : address.side,
  };
}
