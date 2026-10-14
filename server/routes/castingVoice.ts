import { z } from "zod";
import { TRPCError } from "@trpc/server";

import {
  checkRateLimit,
  RATE_LIMITS,
  rateLimitError,
  releaseRateLimitSlot,
} from "../security/rateLimit";
import { withAtomicCredits, type RefundOutcome } from "../casting/atomicCredits";
import {
  CASTING_V2_VOICE_DESIGN_PRICE_CREDITS,
  CASTING_V2_VOICE_KEEP_PRICE_CREDITS,
} from "../casting/castingCreditCosts";
import { captureCastingV2Enabled, captureCastingVoiceEnabled } from "../castingV2/castingV2Scope";
import { getOwnedCastByPublicId } from "../db/castingV2Sign";
import { readCastVoice } from "../db/castVoices";
import {
  designCastVoices,
  keepCastVoice,
  readVoiceKeepability,
  type VoiceRefusal,
} from "../castingV2/voiceService";
import {
  claimVoiceDesignHandle,
  forgetVoiceDesign,
  rememberVoiceDesign,
  restoreVoiceDesign,
} from "../castingV2/voiceDesignStore";
import { voiceClipPath } from "../../shared/voiceClipDelivery";

/**
 * THE VOICE CARD'S THREE PROCEDURES — N4b-2 (#2470), design
 * `docs/specs/N4B_VOICE_DESIGN_2026-10-13.md` §4/§5/§6.
 *
 * Slice 1 built the road and deliberately shipped no procedure: *"a procedure
 * with no caller is a surface that exists without a design pass over it, and
 * the surface is his approved Desk design, which is N4b-2's work"*
 * (`voiceService.ts`). This is that surface's entrance, and nothing more than
 * its entrance — every provider step, every refusal and every spend decision
 * is already in the service, and these three procedures add no rule of their
 * own about the voice.
 *
 * # WHERE THE THREE PROCEDURES ARE DECLARED, AND WHY IT IS NOT HERE
 *
 * They are `castingV2.voice.status`, `.design` and `.keep`, and the
 * `protectedProcedure` declarations sit in `castingV2.ts` beside `inkRouter`,
 * `conceptRouter` and `referenceRouter`. **This file holds the work each one
 * does**, as three plain functions, so the logic stays its own slice.
 *
 * ⚠ **ONE TIDIER SPELLING WAS TRIED FIRST AND IT IS WRONG:
 * `...castingVoiceRouter._def.procedures` spread into `castingV2`** — the
 * attested pattern (`generation/index.ts` is built entirely out of it, and
 * CLAUDE.md's public list notes the consequence for ids). It **loses the
 * procedure types**: the spread widens every member to a union of query and
 * mutation, so `trpc.castingV2.voice.status.useQuery` stops existing on the
 * client. Nothing calls `generation.*` from the client with hooks, which is why
 * that has never bitten there — this surface is a client one, so it cannot use
 * that road.
 *
 * ⚠ **AND A CLAIM THAT STOOD HERE FOR AN HOUR WAS FALSE, SO THE MEASUREMENT
 * REPLACES IT RATHER THAN THE CONCLUSION.** It said `voice: castingVoiceRouter`
 * — the router declared in this file and referenced from `castingV2.ts` — was
 * *"invisible to the capability atlas"*, on the strength of
 * `static.procedures` holding 40 ids with none of the three. **That reading was
 * taken from a capability atlas built on a STALE architecture atlas**: the
 * capability map does not extract procedures at all, it reads them out of
 * `docs/architecture/drape-architecture.json` (`declaredCastingProcedures`), and
 * that file had not been regenerated. Law 1, in the direction it is easiest to
 * fall: a derived artifact read as if it were the tree.
 *
 * **Driven afterwards, both forms, each with the architecture atlas regenerated
 * first: the walker sees BOTH.** An imported router reference resolves to
 * `castingV2.<name>.status|design|keep` exactly as a same-file const does. So
 * the choice between them is style and not visibility, and the shape below is
 * chosen for the plainest reason: it is what `ink`, `concept` and `reference`
 * already do four lines away.
 *      Re-imagine sat off the map for three weeks the same way, green
 *      throughout.
 *
 * # ⚠ A REFUSAL COMES BACK IN THE RESULT, AND INVARIANT 6 IS WHY — read it
 *
 * Invariant 6's words are *"Rate limits return a real `TOO_MANY_REQUESTS`, not
 * a 200 carrying an error field **the client cannot distinguish from a
 * validation failure**"*. The operative clause is the last one, and it is what
 * decides the split here:
 *
 *   · **What throws**: the rate limits (a real `TOO_MANY_REQUESTS`, as
 *     everywhere else in this router), the scope being shut
 *     (`PRECONDITION_FAILED`), and a cast this account cannot touch
 *     (`NOT_FOUND`). None of those is a fact about a voice.
 *   · **What comes back in the result**: every member of {@link VoiceRefusal},
 *     as a discriminated `{ ok: false, refusal }`. A refusal key is strictly
 *     MORE distinguishable than an exception message — the client picks §6's
 *     sentence by the key and never by parsing prose
 *     ([[spelling-not-meaning]]'s class) — and the service's own docblock
 *     already describes its result that way: *"The caller gets a discriminated
 *     result it can tell apart from success and from a validation failure; the
 *     customer-facing words are §6's and are N4b-2's to render."*
 *
 * **The simpler road, named because the fidelity law asks for it**: throwing a
 * `TRPCError` per refusal and letting the client read `error.message`. Declined
 * — it makes the customer's sentence a function of a server string, which is
 * the one thing `shared/voiceCardCopy.ts` exists to prevent, and it would put
 * two mechanisms behind one outcome the client handles identically.
 *
 * # NOTHING IS CHARGED HERE, AND THAT IS THIS SLICE'S SHAPE
 *
 * The card's own bullet is a **placeholder** price, and #2471 is *"the real
 * price"*. So there is no credit spend on either mutation, no `creditSpend`
 * call, and — see the client — **no number on the button**: a price drawn
 * beside a press that charges nothing is a false promise, and a placeholder
 * figure is exactly the *"number nobody can act on"* the
 * disappearing-technology law's third question forbids. What paces the house
 * spend meanwhile is the limiter, which is why both buckets are new and stated.
 *
 * ⚠ **When the price arrives it arrives WITH the charge** (the relay's
 * requirement on this card: *"Make new voices 125 ledger and Keep 500 ledger
 * (#2471), with an atomic charge and a refund on failure"*).
 */

/** One cast's public KI id, the same shape every other cast procedure takes. */
const castIdInput = z.string().min(1).max(32);

/** A handle out of {@link rememberVoiceDesign} — `randomUUID`'s own shape. */
const designHandle = z.string().uuid();

/**
 * One limiter bucket, enforced for this account.
 *
 * `scope` narrows the identifier WITHIN the account — `cast:<id>` for the
 * per-cast daily bound. It is a suffix on the identifier rather than a second
 * `keyPrefix`, so a bucket cannot be made to collide with another bucket by
 * choosing a scope: the prefix still names the limit and the scope only ever
 * divides that limit’s own keyspace.
 */
function bucketIdentifier(userId: number, scope?: string): string {
  return scope === undefined ? `user:${userId}` : `user:${userId}:${scope}`;
}

function enforce(
  userId: number,
  config: (typeof RATE_LIMITS)[keyof typeof RATE_LIMITS],
  scope?: string,
): void {
  const check = checkRateLimit(bucketIdentifier(userId, scope), config);
  if (!check.allowed) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: rateLimitError(check.resetIn) });
  }
}

/**
 * Hand back one slot this request spent, when what it was spent ON never
 * happened.
 *
 * ⚠ **IT DERIVES THE IDENTIFIER FROM {@link bucketIdentifier}, THE SAME
 * FUNCTION {@link enforce} SPENDS THROUGH, AND THAT IS THE WHOLE POINT OF ITS
 * EXISTING.** `releaseRateLimitSlot` must be called with the identifier the
 * check used or it silently hands back nothing — it reads a key that is not
 * there and returns. A second copy of `user:<id>:cast:<id>` beside the first is
 * exactly working law 4's shape, and the failure mode is the quiet one: no
 * error, no red test, just a free design nobody got back.
 */
function release(
  userId: number,
  config: (typeof RATE_LIMITS)[keyof typeof RATE_LIMITS],
  scope?: string,
): void {
  releaseRateLimitSlot(bucketIdentifier(userId, scope), config);
}

/**
 * THE CODE A SHUT ROAD REFUSES WITH, AND IT IS `FORBIDDEN` FOR ONE REASON.
 *
 * ⚠ **IT WAS `PRECONDITION_FAILED` UNTIL 2026-10-14 AND THAT COLLIDED WITH THE
 * MONEY** (the relay's finding on PR #2499, item 2). `withAtomicCredits`
 * refuses a short balance through `chargeRefusal`, which answers
 * `PRECONDITION_FAILED` *deliberately* so a surface can tell *"you need more
 * credits"* apart from every other refusal without parsing prose. The voice
 * card's `isShortOfCredits` reads exactly that code — so while this function
 * threw it too, **narrowing `CASTING_VOICE_SCOPE` while a card was open and
 * then pressing told the customer they could not afford it.** A lie about
 * their money, produced by two unrelated refusals sharing one code.
 *
 * `FORBIDDEN` is also the honester of the two on its own terms: a flag that is
 * off for this account is *not permitted*, not a failed precondition on the
 * request. It is in `failureSentence`'s `OURS` set, so the sentence below still
 * reaches the customer as written; it is the code `withAtomicCredits` already
 * uses for a frozen account, which is the same KIND of fact; and the casting
 * sheet's own mapping has always read the two identically
 * (`client/src/features/castingV2/dispatchFailure.ts`), so nothing downstream
 * changes shape.
 *
 * ⚠ **DO NOT GIVE THIS BACK `PRECONDITION_FAILED`** without reading
 * `isShortOfCredits` first — the two are one contract now, and
 * `server/routes/castingVoiceRoad.test.ts` drives the pair.
 */
const VOICE_ROAD_SHUT_CODE = "FORBIDDEN" as const;

/**
 * The two gates every voice procedure passes, in this order.
 *
 * `CASTING_VOICE_SCOPE` is a child of `CASTING_V2_SCOPE` and the boot fence
 * already refuses a child reaching past its parent, so checking both here is
 * not belt-and-braces about configuration — it is that a customer outside
 * casting altogether should meet casting's own sentence rather than a voice
 * one.
 */
function requireVoiceRoad(userId: number): void {
  if (!captureCastingV2Enabled(userId)) {
    throw new TRPCError({
      code: VOICE_ROAD_SHUT_CODE,
      message: "Casting is not available for this account yet.",
    });
  }
  if (!captureCastingVoiceEnabled(userId)) {
    /*
      Dark. `voiceStatus` answers `available: false` instead of throwing, so the
      card draws nothing at all (the `PublicCheckCard` precedent); the two
      MUTATIONS throw, because reaching one while dark means a client built
      against a surface that is not open, not a customer meeting a state.
    */
    throw new TRPCError({
      code: VOICE_ROAD_SHUT_CODE,
      message: "Voice is not available for this account yet.",
    });
  }
}

/* ------------------------------------------------------------------ the money.

   WHAT A VOICE COSTS, AND THE ONE THING `withAtomicCredits` DOES NOT COVER.

   The charge itself is not this road's invention: `withAtomicCredits`
   (`server/casting/atomicCredits.ts`) is the product's audited shape — it
   deducts BEFORE the provider is called, so five simultaneous presses cannot
   each pass a balance check; it refunds under a derived idempotent reference if
   the operation throws; and it refuses a frozen account and an insufficient
   balance with sentences written for a person.

   ⚠ **BUT IT REFUNDS ON A THROW, AND THIS ROAD DOES NOT THROW ITS REFUSALS.**
   Every voice refusal comes back in the RESULT as `{ ok: false, refusal }` —
   that is deliberate and invariant 6's reasoning is in this file's header. So a
   design the provider refused, or a Keep a spent month refused, would have
   returned `ok: false` through a helper that saw a perfectly successful
   operation and **kept the customer's credits for a voice they never got.**
   That is the defect this wrapper exists to prevent, and it is the reason the
   charge is not simply `withAtomicCredits(...)` at each call site.

   The shape: the refusal is thrown so the audited refund path runs, and it is
   carried out in a closure rather than on the error — `withAtomicCredits`
   rebuilds the outgoing error (it has its own reasons, #2058's spoken marker
   among them), so the thrown object's identity cannot survive the trip and
   nothing may be read off it.
*/

/** What a charged voice step gives back: the value, or the refusal AND what the
 *  money did — the facts a customer-facing sentence needs together. */
type ChargedVoiceResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      refusal: VoiceRefusal;
      refunded: boolean;
      /**
       * The refund's own reference, for the rare case where it did NOT record.
       *
       * ⚠ **CARRIED SINCE 2026-10-14 BECAUSE THE CUSTOMER WAS BEING TOLD TO
       * "GET IN TOUCH" WITH NOTHING TO QUOTE** (the relay's finding on PR
       * #2499, item 4). `recordRefund` logs this reference at ERROR, so support
       * *could* reach it from the account alone — which is what the first
       * version of this road reasoned from, and it is why the sentence shipped
       * without one. The better argument is the house's own: `refundTruth`
       * (`server/casting/atomicCredits.ts`) hands the customer the reference on
       * **every other money surface in the product**, so a voice card that
       * withheld it was the one surface asking its customer to be the lookup
       * key (working law 4 — a second answer to a question the product had
       * already answered).
       *
       * `null` whenever the refund recorded, which is the ordinary case: there
       * is nothing to reconcile and nothing to quote.
       */
      refundReference: string | null;
    };

async function withVoiceCharge<T>(input: {
  userId: number;
  amount: number;
  description: string;
  run: () => Promise<{ ok: true; value: T } | { ok: false; refusal: VoiceRefusal }>;
}): Promise<ChargedVoiceResult<T>> {
  /* The carriers. Assigned inside the operation closure and read after it, so
     neither may be narrowed away by a reader that only sees the declaration. */
  const carried: { refusal: VoiceRefusal | null; refund: RefundOutcome | null } = {
    refusal: null,
    refund: null,
  };
  try {
    const value = await withAtomicCredits(
      {
        userId: input.userId,
        amount: input.amount,
        description: input.description,
        /* AUDIO — the first charge in the product that is not an image. The set
           grew for this road, under its own rule (`server/db/credits.ts`). */
        toolKind: "audio",
        engineUsed: "castingV2",
        onRefunded: (outcome) => {
          carried.refund = outcome;
        },
      },
      async () => {
        const result = await input.run();
        if (!result.ok) {
          carried.refusal = result.refusal;
          /* Thrown ONLY to reach the audited refund. The message never reaches a
             customer: a refusal is answered from `carried.refusal` below, and the
             card picks its own sentence by the key. */
          throw new Error(`voice refused: ${result.refusal}`);
        }
        return result.value;
      },
    );
    return { ok: true, value };
  } catch (error) {
    if (carried.refusal !== null) {
      /*
        ⚠ **`refunded` IS READ FROM THE LEDGER'S OWN ANSWER, NEVER ASSUMED.**
        `recordRefund` logs and reports a refund it could not write, and
        `atomicCredits`' own law is that such a case is *never* reported as "you
        weren't charged". The card's sentence turns on this boolean, so a refund
        that did not record cannot be dressed up as one that did.
      */
      const refunded = carried.refund?.recorded === true;
      return {
        ok: false,
        refusal: carried.refusal,
        refunded,
        /* Only when it did NOT record. A reference quoted beside credits that
           came back is machinery with nothing to do. */
        refundReference: refunded ? null : carried.refund?.reference ?? null,
      };
    }
    /* A genuine failure. `withAtomicCredits` has already refunded and appended
       the truth about the money to the message it is throwing. */
    throw error;
  }
}

/** The owned, live, signed cast behind a public id, or the same 404 for all. */
async function requireCast(userId: number, castId: string) {
  const model = await getOwnedCastByPublicId(userId, castId);
  if (!model) throw new TRPCError({ code: "NOT_FOUND", message: "That character isn't here." });
  return model;
}


/* ---------------------------------------------------------------- the inputs.

   Exported so the procedure declarations in `castingV2.ts` are thin — the
   shape a caller must send is a fact about this road, and it belongs beside
   the function that reads it rather than being written out again at the
   mounting point (working law 4). Every one is `.strict()` (invariant 4). */

export const voiceCastInput = z.object({ castId: castIdInput }).strict();

/**
 * The design's input — the cast, and whether this was a PRESS or the card
 * opening.
 *
 * ⚠ **`automatic` is OPTIONAL, and that is a deploy-skew rule rather than
 * convenience** (`CLAUDE.md`'s removal contract, read the other way): `.strict()`
 * rejects an UNKNOWN key and says nothing about a MISSING optional one, so a
 * bundle loaded before this ships and omitting it still works against the new
 * server. It defaults to a PRESS, which is the stricter bucket of the two — a
 * caller that does not say gets the twelve-an-hour limit, never the thirty.
 */
export const voiceDesignInput = z.object({
  castId: castIdInput,
  automatic: z.boolean().optional(),
}).strict();
export const voiceKeepInput = z.object({
  castId: castIdInput,
  designId: z.string().uuid(),
  handle: designHandle,
}).strict();

/**
 * THE TWO PRICES THE CARD PUTS ON ITS PAID BUTTONS.
 *
 * ⚠ **SERVED, NEVER A CLIENT LITERAL** — the Sign button's own road
 * (`CastingSheet` reads `signPriceCredits` off its config and renders it with
 * `displayPrice`), and the reason is working law 4 on the one subject this
 * repository has been bitten by most: a price written twice is a price that
 * will one day disagree with what the ledger takes. These are LEDGER numbers;
 * `shared/creditDisplay.ts` is the only thing that turns one into what a
 * customer reads.
 *
 * ⚠ **THE DESIGN PRICE IS THE PRESS'S, AND THE AUTOMATIC THREE ARE FREE** (his
 * word, 2026-10-14: *"2 real cost is neglible we absorb it"*). So this number
 * belongs beside *"Make new voices from this text"* and must never be drawn as
 * the cost of opening the card.
 *
 * They ride the status read rather than a second procedure because the card
 * already waits on this one before it draws anything, so a price costs no extra
 * round trip and cannot arrive after the button it belongs on.
 */
const VOICE_PRICES = {
  designPriceCredits: CASTING_V2_VOICE_DESIGN_PRICE_CREDITS,
  keepPriceCredits: CASTING_V2_VOICE_KEEP_PRICE_CREDITS,
} as const;

/**
 * WHAT THE VOICE CARD DRAWS BEFORE ANYTHING IS PRESSED.
 *
 * Three facts and no creative content: whether this road is open at all,
 * whether there is a line to make voices from, and whether a voice is already
 * kept. The voice LINE itself is not returned — the room already has it from
 * `getCast`, and a second copy is the drift working law 4 names.
 *
 * ⚠ **It returns the clip's PATH and never a storage URL.** The path is an
 * authenticated app address (`shared/voiceClipDelivery.ts`); the storage key
 * stays on the server, because on a public bucket that key is the credential.
 */
export async function readVoiceCardStatus(input: { userId: number; castId: string }) {
  if (!captureCastingV2Enabled(input.userId) || !captureCastingVoiceEnabled(input.userId)) {
    /* Dark: the card draws nothing at all rather than an empty voice panel
       (the `PublicCheckCard` precedent). */
    return {
      available: false as const,
      hasLine: false,
      canKeep: false,
      kept: null,
      ...VOICE_PRICES,
    };
  }
  enforce(input.userId, RATE_LIMITS.castingRead);
  const model = await requireCast(input.userId, input.castId);
  const kept = await readCastVoice(input.userId, model.id);
  /*
    ⚠ **`canKeep` IS WHY THE CARD NO LONGER DESIGNS VOICES NOBODY CAN KEEP**
    (#2470's finding, item 5). It is a cached, fail-open hint about the HOUSE
    account's allowance — never the gate, which stays a live read inside Keep —
    and it is read only for a cast that could actually design: a cast with a
    kept voice already has what it needs, and one with no line has nothing to
    make from, so neither spends a provider round trip on this.
  */
  const needsKeepability = !kept && Boolean(model.voice && model.voice.trim().length > 0);
  const canKeep = needsKeepability ? (await readVoiceKeepability()).canKeep : true;
  return {
    available: true as const,
    hasLine: Boolean(model.voice && model.voice.trim().length > 0),
    canKeep,
    ...VOICE_PRICES,
    kept: kept
      ? {
          clipPath: voiceClipPath(input.castId),
          byteSize: kept.clipBytes,
          keptAt: kept.keptAt,
        }
      : null,
  };
}

/**
 * THE CAST'S WORDS BECOME THREE VOICES TO LISTEN TO.
 *
 * ⚠ **The audio comes back in the result and gets no address at all.** The
 * three MP3s are base64 here; there is no key, no object, no route and no row
 * for a preview, which is strictly more private than an owner-only address and
 * is why the owner-only route this card adds serves the kept clip alone.
 * `server/castingV2/voiceDesignStore.ts` carries the full reading, including
 * what is lost on a reload and why that was chosen.
 *
 * ⚠ **The provider's own preview id is NOT in this result.** It is internal
 * (`VoicePreview`'s own rule), so each voice answers to an opaque handle and
 * only the server can turn one back into a provider id.
 */
export async function designVoicesForCard(input: {
  userId: number;
  castId: string;
  automatic?: boolean;
}) {
  requireVoiceRoad(input.userId);
  /*
    ⚠ **TWO BUCKETS, AND BROWSING MAY NOT SPEND A PRESS** (#2470's finding,
    item 4). The card designs three voices when it opens, so the press limit was
    being spent by OPENING casts: a thirteenth signed cast in an hour refused,
    and the refusal read as *"try again"* on a road where trying again failed
    identically. The automatic road has its own, larger bucket; house money
    stays bounded by both.
  */
  enforce(
    input.userId,
    input.automatic ? RATE_LIMITS.castingVoiceAutoDesign : RATE_LIMITS.castingVoiceDesign,
  );
  const model = await requireCast(input.userId, input.castId);

  /*
    ⚠ **WHETHER THIS DESIGN IS FREE IS THE SERVER'S ANSWER, NOT THE CLIENT'S
    CLAIM** — his order, 2026-10-14 (#2471): *"the automatic road honoured only
    when it is genuinely automatic … so a reload or a scripted `automatic: true`
    cannot farm free designs"*.

    `automatic` still arrives from the client, because only the client knows
    whether a person pressed anything. What changed is that it is no longer a
    FREE PASS: the free road is granted by the two daily buckets below, and a
    caller asserting `automatic: true` past them is refused rather than served.
    Before this, the only thing standing between a reload and another three
    voices on house money was a module-level `Set` in the client's own page
    session, which a reload empties by definition.

    ⚠ **A SPENT FREE BUCKET REFUSES; IT NEVER FALLS THROUGH TO THE CHARGE.**
    Nobody pressed anything, so charging would bill a customer for an arrival.
    The refusal is a real `TOO_MANY_REQUESTS` (invariant 6) and the card already
    swallows it silently on the automatic road — *"an automatic design says
    nothing on a refusal it did not ask for"* — leaving the resting state with
    the priced press available, which is the honest shape.
  */
  if (input.automatic) {
    const castScope = `cast:${model.id}`;
    /* Keyed on the CAST, so forty signed casts still get a free three each —
       the bound is per cast, not per account. The internal id is the key: one
       canonical row per cast, whatever spelling of the public id arrived. */
    enforce(input.userId, RATE_LIMITS.castingVoiceAutoDesignDaily, castScope);
    /*
      ⚠ **A FREE DESIGN THAT DELIVERED NOTHING IS HANDED BACK** (the relay's
      finding on PR #2499, item 3; the shape is #2491's, where an invite that
      never left the building returns both of its budgets).

      The entitlement these two buckets hold is *one free three per cast per
      day*. They are spent the moment they admit the request — before it is
      known whether any voice will come back — so without the releases below a
      provider wobble costs the customer that cast's free three **until
      tomorrow**, having given them nothing. Worse on the second line: if the
      ACCOUNT's day refuses, the per-cast token above is already spent, so a
      customer who hit their daily account ceiling would find one of their casts
      silently out of free voices as well.

      ⚠ **WHAT IS NOT HANDED BACK IS THE HOURLY BUCKET AT THE TOP OF THIS
      FUNCTION, AND THAT IS DELIBERATE.** `castingVoiceAutoDesign` is the flood
      bound — it is what stops a scripted caller provoking refusals in a loop on
      house money — and a refusal still costs us the provider call. So the
      ceiling that protects the HOUSE keeps its slot, and only the buckets that
      grant the CUSTOMER something they did not receive give theirs back.
      `releaseRateLimitSlot` never takes a count below zero and never reaches
      into a window that has already rolled over, so a late hand-back cannot
      mint a free design in a new day.
    */
    try {
      /* Keyed on the ACCOUNT, so a scripted walk across a whole library cannot
         turn that per-cast allowance into an unbounded one. */
      enforce(input.userId, RATE_LIMITS.castingVoiceAutoDesignDay);
    } catch (error) {
      /* ONLY the per-cast token: a REFUSED check never incremented its own
         count (`checkRateLimit` returns before the `entry.count++`), so
         releasing the account's day here would hand back a slot this request
         never spent. */
      release(input.userId, RATE_LIMITS.castingVoiceAutoDesignDaily, castScope);
      throw error;
    }
    /*
      ⚠ **THE TWO BUCKETS ARE HANDED BACK ON DIFFERENT TERMS, AND THE
      ASYMMETRY IS THE WHOLE CONTROL.**

      The relay's finding asks for both back when no voices came back. Handing
      back the ACCOUNT's day unconditionally does something it did not intend:
      a refusal the PROVIDER produced has already cost us a call, so a caller
      who can provoke one would no longer be bounded by the twenty-a-day
      ceiling at all — only by the hourly thirty, which is **30 an hour instead
      of 20 a day**. That is a thirty-six-fold rise in what the free road can
      spend of the house's money, and it would arrive wearing a customer
      repair's clothes.

      So:

      · **The per-cast token always comes back.** It is the entitlement the
        finding is actually about — *"a provider failure leaves that cast
        without its free three until tomorrow"* — and giving it back cannot
        amplify anything, because the account's day still bounds the total.
      · **The account's day comes back only when no provider call was made.**
        Then nothing was spent and there is nothing to bound.

      ⚠ **AND THE CLASSIFICATION FAILS TOWARD KEEPING THE SLOT**: a refusal
      this list does not recognise is treated as having reached the provider,
      because the cost of being wrong that way is one of a customer's twenty,
      and the cost of being wrong the other way is unbounded house spend.
    */
    const SPENT_NO_PROVIDER_CALL: ReadonlySet<VoiceRefusal> = new Set<VoiceRefusal>([
      "voice_off",
      "cast_not_available",
      "no_voice_line",
    ]);

    const releaseFreeDesign = (refusal: VoiceRefusal | null) => {
      release(input.userId, RATE_LIMITS.castingVoiceAutoDesignDaily, castScope);
      if (refusal !== null && SPENT_NO_PROVIDER_CALL.has(refusal)) {
        release(input.userId, RATE_LIMITS.castingVoiceAutoDesignDay);
      }
    };
    let result: Awaited<ReturnType<typeof designCastVoices>>;
    try {
      result = await designCastVoices({ userId: input.userId, modelId: model.id });
    } catch (error) {
      /* A throw is a genuine failure, not a refusal we can classify — the call
         was attempted, so the account's day stays spent. */
      releaseFreeDesign(null);
      throw error;
    }
    if (!result.ok) {
      releaseFreeDesign(result.refusal);
      /* Nothing was charged on this road at all, so there is no refund to
         report and nothing for support to reconcile. */
      return {
        ok: false as const,
        refusal: result.refusal,
        refunded: true,
        refundReference: null,
      };
    }
    return rememberedDesign(input.userId, model.id, result);
  }

  /* A PRESS. The daily ceiling runs BEFORE the charge, so a refused press
     costs nothing — a limiter that charged first would be selling refusals. */
  enforce(input.userId, RATE_LIMITS.castingVoiceDesignDay);

  const charged = await withVoiceCharge({
    userId: input.userId,
    amount: CASTING_V2_VOICE_DESIGN_PRICE_CREDITS,
    description: "Voice design (three voices)",
    run: async () => {
      const result = await designCastVoices({ userId: input.userId, modelId: model.id });
      return result.ok
        ? { ok: true as const, value: result }
        : { ok: false as const, refusal: result.refusal };
    },
  });
  if (!charged.ok) {
    return {
      ok: false as const,
      refusal: charged.refusal,
      refunded: charged.refunded,
      refundReference: charged.refundReference,
    };
  }
  return rememberedDesign(input.userId, model.id, charged.value);
}

/** The three voices, remembered and handed back — the shape both roads return. */
function rememberedDesign(
  userId: number,
  modelId: number,
  result: { designSentence: string; previews: readonly { previewId: string; bytes: Buffer; contentType: string; durationSeconds?: number | null }[] },
) {
  const { designId, handles } = rememberVoiceDesign({
    userId,
    modelId,
    designSentence: result.designSentence,
    previewIds: result.previews.map((preview) => preview.previewId),
  });

  return {
    ok: true as const,
    designId,
    voices: result.previews.map((preview, index) => ({
      handle: handles[index],
      /* Base64 rather than a binary body: this is a tRPC result, and the client
         turns it straight into a blob to play. ~250 KB a voice, measured
         (design §3). */
      audioBase64: preview.bytes.toString("base64"),
      contentType: preview.contentType,
      durationSeconds: preview.durationSeconds ?? null,
    })),
  };
}

/**
 * KEEP — this one is the cast's voice from now on.
 *
 * The three provider steps, the live allowance read before any spend, and the
 * owned-live-signed proof inside the INSERT are all the service's
 * (`keepCastVoice`). What this adds is only the handle→provider-id resolution,
 * and it adds one rule with it:
 *
 * ⚠ **THE DESIGN SENTENCE COMES FROM THE STORE, NEVER FROM THE CLIENT.** It is
 * stored beside the clip as the words the voice was made from (design §4), so a
 * client-supplied sentence could make that record say the voice came from words
 * it did not come from. The line can also have been edited between the design
 * and this press — and the design's §9 is explicit that editing the line does
 * not change a kept voice.
 */
export async function keepVoiceForCard(input: {
  userId: number;
  castId: string;
  designId: string;
  handle: string;
}) {
  requireVoiceRoad(input.userId);
  enforce(input.userId, RATE_LIMITS.castingVoiceKeep);
  const model = await requireCast(input.userId, input.castId);

  /*
    ⚠ **THE CHARGE IS OUTSIDE THE CLAIM, AND THE ORDER IS THE WHOLE POINT.**

    A Keep costs 500 ledger and the claim below consumes the design — so the two
    possible orders are not equivalent and only one of them is safe:

      · **charge, then claim** (this one): a customer who is short of credits is
        refused by the ledger before anything is consumed, and still has their
        three voices to keep later. A claim that then fails refunds, because the
        refusal travels out through {@link withVoiceCharge}.
      · claim, then charge: a short balance would consume the design and give
        nothing back — the customer loses the three voices they were choosing
        between AND is told they cannot afford the one they picked. Nothing in
        the ledger would look wrong, which is what makes it the dangerous order.

    Every refusal inside the run therefore gives the money back: a provider
    outage, a spent month, an expired handle. A customer who has no voice has
    not bought one.
  */
  const charged = await withVoiceCharge({
    userId: input.userId,
    amount: CASTING_V2_VOICE_KEEP_PRICE_CREDITS,
    description: "Voice kept for a cast",
    run: async () => {
      /*
        ⚠ **CLAIMED, NOT RESOLVED — AND THE DIFFERENCE IS ONE OF THE ACCOUNT'S
        MONTHLY VOICE OPERATIONS.** The claim takes the design out of reach in
        the same indivisible step that reads it, so a double-press, a retry or a
        second tab cannot both reach the provider's save. It is put back below if
        the Keep does not land.
      */
      const resolved = claimVoiceDesignHandle({
        userId: input.userId,
        modelId: model.id,
        designId: input.designId,
        handle: input.handle,
      });
      if (!resolved) {
        /*
          The handle expired, was never ours, belongs to another cast, or a press
          that got here first is still in flight. The customer-facing answer is
          the same as a failed design — make them again — because that is the
          only thing that can be done about it, and the cases must not be told
          apart to a caller holding a handle it should not have.
        */
        return { ok: false as const, refusal: "provider_failed" as VoiceRefusal };
      }

      let result: Awaited<ReturnType<typeof keepCastVoice>>;
      try {
        result = await keepCastVoice({
          userId: input.userId,
          modelId: model.id,
          previewId: resolved.previewId,
          designSentence: resolved.designSentence,
        });
      } catch (error) {
        /* A throw is not a refusal and the voices may still be keepable — the
           design goes back before the error travels. The charge is refunded by
           `withAtomicCredits`' own catch, which this throw passes through. */
        restoreVoiceDesign(input.designId);
        throw error;
      }
      if (!result.ok) {
        /*
          A REFUSED Keep gives the design back, so a provider outage or a spent
          month does not also cost the customer three voices they could keep a
          minute later. The one exception is a cast that is no longer there to
          keep a voice for — nothing can ever be kept against it, so the handles
          stay gone.
        */
        if (result.refusal !== "cast_not_available") restoreVoiceDesign(input.designId);
        return { ok: false as const, refusal: result.refusal };
      }

      /* The other two voices of this design can never be kept now — one voice
         per cast — so the claim is made permanent rather than left restorable. */
      forgetVoiceDesign(input.designId);
      return { ok: true as const, value: { clipBytes: result.clipBytes } };
    },
  });

  if (!charged.ok) {
    return {
      ok: false as const,
      refusal: charged.refusal,
      refunded: charged.refunded,
      refundReference: charged.refundReference,
    };
  }

  return {
    ok: true as const,
    clipPath: voiceClipPath(input.castId),
    byteSize: charged.value.clipBytes,
  };
}
