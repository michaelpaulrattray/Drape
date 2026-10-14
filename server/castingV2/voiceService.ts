/**
 * THE VOICE ROAD — N4b-1 (#2469), design
 * `docs/specs/N4B_VOICE_DESIGN_2026-10-13.md` §4/§5.
 *
 * The entrances:
 *
 *   · {@link designCastVoices} — the cast's written voice line becomes three
 *     voices to listen to. Spends no voice operation.
 *   · {@link keepCastVoice} — the chosen one becomes the cast's voice: saved,
 *     recorded reading the house passage, and the clip stored beside the line
 *     it was made from. **One voice operation and one slot.** On a cast that
 *     already has a voice it REPLACES that voice (#2497), the old one changing
 *     only once the new one is fully kept.
 *   · {@link removeCastVoiceForCast} (#2497) — the cast has no voice again: the
 *     clip is queued for deletion and the slot released. Charges and refunds
 *     nothing.
 *   · {@link ensureCastVoiceResident} (#2472) — the door anything that is about
 *     to SPEAK with a kept voice walks first: it answers the voice's slot, and
 *     re-mints it from the stored clip if the cache evicted it.
 *
 * # THE SLOT IS A CACHE, AND THE CLIP IS THE VOICE (N4b-4, #2472)
 *
 * His ear passed the re-mint court on 2026-10-13, verbatim: *"remint actually
 * sounds better in some cases both 90s clips were great though."* So a Keep on
 * a plan whose slots are all occupied no longer refuses: it EVICTS the
 * least-recently-used voice ({@link makeRoomForOneVoice}) — the row and its clip
 * stay, only the provider slot is given back — and the evicted voice is cloned
 * back from its clip the next time something is about to speak with it. Three
 * rules hold all of it:
 *
 *   · **Nothing is evicted on a plan that cannot clone**, read LIVE
 *     (`instantCloning`). An evicted voice there could never come back, so a
 *     full plan refuses exactly as it did before this card.
 *   · **A re-mint spends a voice operation, so it happens only on a real use**
 *     (design §5: *"never to keep a slot warm"*), never on a clip play — the
 *     clip plays from storage and never touches the provider.
 *   · **Neither costs the customer anything.** Eviction and re-mint are the
 *     house managing its own plan; no credit moves on either.
 *
 * **No UI reaches either of them yet.** Slice 1 is the road; N4b-2 is the Voice
 * card that walks it. There is no tRPC procedure here on purpose — a procedure
 * with no caller is a surface that exists without a design pass over it, and
 * the surface is his approved Desk design, which is N4b-2's work.
 *
 * # EVERY REFUSAL IS A MEMBER OF A CLOSED SET, AND EVERY ONE REFUSES
 *
 * {@link VoiceRefusal} is the whole vocabulary. Two rules it exists to keep:
 *
 *   · **It is never a 200 carrying a message** (invariant 6). The caller gets a
 *     discriminated result it can tell apart from success and from a validation
 *     failure; the customer-facing words are §6's and are N4b-2's to render.
 *   · ⚠ **It refuses when the quota read FAILS, and that is the arm most worth
 *     having** (invariant 7: a control that cannot answer must not wave the
 *     request through). A Keep that could not read the allowance has no idea
 *     whether a save would be the one that exceeds the account's month, and in
 *     slice 2 that press carries a price.
 *
 * # NOTHING HERE IS HARD-CODED ABOUT THE PLAN
 *
 * Neither ceiling is a constant anywhere in this product, and #2469's own
 * correction is why: the card was filed against a 3-slot account and told a
 * builder to refuse *"when three slots are full"*. His plan was upgraded the
 * same day to 30 slots, so that refusal would have shipped refusing a Keep with
 * 27 free. The allowance is read live, immediately before the spend.
 */
import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";

import { ProviderError } from "../providers/types";
import {
  voiceOperationsAvailable,
  voiceSlotsAvailable,
  type VoiceAllowance,
  type VoiceEngine,
} from "../providers/voiceTypes";
import {
  ELEVENLABS_API_KEY_VARIABLE,
  createElevenLabsVoiceEngine,
} from "../providers/elevenlabsVoice";
import { captureCastingVoiceEnabled } from "./castingV2Scope";
import {
  VOICE_AUDITION_PASSAGE,
  VOICE_AUDITION_PASSAGE_VERSION,
} from "./voiceAuditionPassage";
import {
  evictCastVoiceSlot,
  insertCastVoice,
  readCastVoiceForUse,
  readCastVoiceLine,
  readEvictionCandidates,
  recordRemintedCastVoice,
  removeCastVoice,
  restoreCastVoiceSlot,
  touchCastVoiceUsed,
} from "../db/castVoices";
import {
  readCastVoiceCard,
  readCastVoiceCardSources,
  saveCastVoiceCard,
} from "../db/castVoiceCards";
import { readCastOriginalAnchorKey } from "../db/castingV2Sign";
import type { ReferenceImage, TextEngine } from "../providers/types";
import {
  voiceCardSourceHash,
  voiceCardWriterEngine,
  writeVoiceCard,
} from "./voiceCardWriter";
import { withTransaction } from "../db/connection";
import {
  createStorageCleanupManifestIn,
  storageCleanupManifestHeldUntil,
} from "../db/storageCleanup";
import {
  storageDelete,
  storagePut,
  storageReadAudioBytes,
  storageReadBytes,
} from "../storage";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("castingV2/voiceService");

/**
 * The closed refusal set. Each is a different thing to say to a customer and a
 * different thing for the house to do about it.
 */
export type VoiceRefusal =
  /** The voice road is not open for this account. */
  | "voice_off"
  /** Not this owner's, not live, or not signed — one answer for all three. */
  | "cast_not_available"
  /** The cast has no written voice line to make a voice from. */
  | "no_voice_line"
  /** The line is shorter than the engine can design from. */
  | "voice_line_too_short"
  /** The allowance could not be read, so nothing is spent. Invariant 7. */
  | "allowance_unreadable"
  /** The account's voice operations for this period are spent. */
  | "no_operations_left"
  /** Every saved-voice slot the plan allows is occupied. */
  | "no_slots_left"
  /** The provider failed. The class is internal; the customer gets §6's words. */
  | "provider_failed"
  /** N4b-4: the cast has no kept voice to speak with. */
  | "no_kept_voice"
  /**
   * N4b-4: the voice is not resident and the plan cannot clone (read live), so
   * it cannot be re-minted. The kept voice itself is untouched.
   */
  | "remint_unavailable"
  /**
   * N4b-4: the stored clip could not be read, or its bytes disagree with the
   * sha256 the row recorded. Nothing is cloned from bytes we cannot vouch for.
   */
  | "clip_unreadable";

export type VoiceDesignResult =
  | {
      ok: true;
      /** Three, measured — the engine settles the count (design §1). */
      previews: Array<{ previewId: string; bytes: Buffer; contentType: string; durationSeconds?: number }>;
      /** The line these were made from, to be stored verbatim by a later Keep. */
      designSentence: string;
      latencyMs: number;
    }
  | { ok: false; refusal: VoiceRefusal; failureClass?: string };

export type VoiceKeepResult =
  | {
      ok: true;
      clipStorageKey: string;
      clipSha256: string;
      clipBytes: number;
      clipContentType: string;
      passageVersion: number;
      /** The allowance BEFORE the save and AFTER it — the receipt's two reads. */
      allowanceBefore: VoiceAllowance;
      saveLatencyMs: number;
      speakLatencyMs: number;
      /**
       * Whether this Keep REPLACED a voice the cast already had (#2497), and
       * if so whether the old provider slot came back. `null` = nothing was
       * replaced. A slot that would not release is logged by
       * {@link releaseSlotQuietly}; the customer's voice is the new one either way.
       */
      replaced: { slotReleased: boolean } | null;
      /**
       * How many other voices this Keep evicted from their slots to make room
       * (#2472). Their rows and clips are untouched; each is re-minted on its
       * next use. `0` when the plan had room.
       */
      evicted: number;
    }
  | { ok: false; refusal: VoiceRefusal; failureClass?: string };

/**
 * Where a clip's bytes live. A random UUID under a voice prefix, so the key is
 * unguessable — every `storagePut` writer in this product uses
 * `crypto.randomUUID()` and a repository-wide guard refuses `Math.random()` in
 * one.
 *
 * ⚠ **THE KEY IS NOT A PERMISSION, AND THIS CLIP IS WHY THAT MATTERS MORE HERE
 * THAN FOR A PICTURE.** `server/storage.ts` writes to a PUBLIC bucket and its
 * URLs never expire, so anything there is protected only by its key being hard
 * to guess — and ninety seconds of a voice is a cloning source.
 *
 * ⚠ **BOTH QUESTIONS THIS PARAGRAPH LEFT OPEN ARE ANSWERED — N4b-2 (#2470),
 * and the answer is kept here because this is where the key is minted.** It
 * read *"the owner-only route and the decision on whether these bytes belong in
 * the private evidence bucket instead both ride N4b-2"*:
 *
 *   · **The bytes stay in this public bucket**, because the private evidence
 *     store cannot hold them — its `putCanonical` refuses anything that is not
 *     `image/webp` by mime AND by byte sniff, under its own parsed key grammar
 *     (`server/casting/evidence/privateEvidenceStorage.ts`). Read at the code,
 *     not preferred. `shared/voiceClipDelivery.ts` carries the full reading and
 *     what follows from it.
 *   · **The owner-only route exists**: `/api/cast/:castId/voice-clip`
 *     (`server/routes/voiceClipDelivery.ts`), on CLAUDE.md's enumerated
 *     authenticated-Express list in the commit that created it.
 *
 * **So the key is still never projected and still never logged**, and the only
 * things that can read a clip are this server and the owner's own authenticated
 * request. The deletion roads are unaffected and that is a consequence of not
 * moving the bucket rather than a thing to remember: both file the clip as a
 * PUBLIC item, which is what it is.
 */
function voiceClipKey(userId: number, modelId: number): string {
  return `casting/voices/${userId}/${modelId}/${randomUUID()}.mp3`;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Injectable for the drivers; production always gets the real transports. */
export type VoiceServiceDeps = {
  engine?: VoiceEngine;
  /** The hidden voice card's writer (#2498). `null` = no writer configured. */
  cardWriter?: TextEngine | null;
  /** The master picture's bytes, by its storage key. */
  readPicture?: (key: string) => Promise<ReferenceImage>;
};

function engineFor(deps: VoiceServiceDeps | undefined): VoiceEngine {
  return deps?.engine ?? createElevenLabsVoiceEngine();
}

/**
 * THE HOLD ON BYTES THAT DO NOT YET HAVE A ROW.
 *
 * The same write-ahead manifest every other casting writer uses
 * (`referenceAttachService`, `keptFaceScan`, `signService`), and the two
 * decisions inside it are theirs rather than new ones:
 *
 * - **a synthetic operation id**, because the column is unique and NOT NULL and
 *   a Keep is not a generation operation;
 * - **BORN HELD**, because the cleanup worker's in-flight fence tests a batch
 *   against a live operation row and a synthetic id matches none — so without
 *   the hold this manifest is claimable the instant it is written, while the
 *   clip is still uploading. That race really fired once, mid-mint;
 *   `createStorageCleanupManifestIn` carries the full reading.
 *
 * ⚠ **`casting_candidate_cleanup` IS THE RIGHT KIND AND IT WAS READ RATHER THAN
 * ASSUMED.** The enum's own comment reserves a new value for a different
 * RETENTION POLICY, and this clip's policy is the one every other write-ahead
 * hold in the casting domain has — discharged by its row, collected by the
 * worker if the row never lands. Reference attachments (a customer's own
 * photograph), kept face scans, ink designs and Sign's plates all sit under
 * this value for exactly that reason; only the DIAGNOSTIC family, which is
 * swept on a schedule instead, earned its own.
 */
async function holdClipForWrite(input: {
  id: string;
  userId: number;
  storageKey: string;
}): Promise<void> {
  await withTransaction((tx) => createStorageCleanupManifestIn(tx, {
    id: input.id,
    userId: input.userId,
    operationId: randomUUID(),
    heldUntil: storageCleanupManifestHeldUntil(),
    kind: "casting_candidate_cleanup",
    storageItems: [{ storageKey: input.storageKey, storageBackend: "public_r2" as const }],
  }));
}

/**
 * THE HIDDEN VOICE CARD — written once, kept, re-written only when its sources
 * change (card #2498; `voiceCardWriter.ts` carries the rules and why).
 *
 * The sources are hashed (`voiceCardSourceHash`): the customer's words, both
 * lines, the description paragraph, the master picture's key and the writer's
 * version. A kept card with the same hash is reused and costs nothing; any
 * change — the customer rewrites the voice line, the personality, anything —
 * re-writes it on the next design.
 *
 * ⚠ **A WRITER THAT CANNOT ANSWER REFUSES THE DESIGN.** The fallback to the
 * visible line is exactly the road that gave a cast written as female three male voices,
 * so it is not taken silently; the customer meets the card's existing
 * "trouble" sentence and nothing is designed or spent at the voice provider.
 *
 * Nothing here logs the words, the card or the line — only that a card was
 * written, how long it took, and what it cost in tokens.
 */
type VoiceCardResult =
  | { ok: true; voiceCard: string; previewLine: string }
  | { ok: false; refusal: VoiceRefusal; failureClass?: string };

/**
 * ONE WRITER CALL PER CAST PER SET OF WORDS, IN THIS PROCESS — the relay's
 * finding 1 on PR #2500. A card now takes about thirty seconds to write, and
 * two designs of one cast arrive inside that window as a matter of course: the
 * automatic design when the Voice card opens, and a press or a second tab while
 * it is still thinking. Each used to pay the writer, and then the two writes
 * collided on the unique `modelId`. **The second caller awaits the first
 * instead**, so the house pays once and both get the same card.
 *
 * ⚠ **THE KEY CARRIES THE SOURCE HASH, NOT ONLY THE CAST.** Keyed on the cast
 * alone, a customer who rewrites their voice line mid-design would be handed
 * the card written from the OLD wording — the collapse has to be of identical
 * work, not merely of concurrent work.
 *
 * Two limits, both stated rather than left to be found. **A joiner inherits the
 * leader's cancellation**: were the leader's request abandoned, the joiner
 * would meet the writer's refusal. No production call site passes a signal
 * today (`routes/castingVoice.ts` calls `designCastVoices` with none), so this
 * is a shape to know about and not a live hazard. And **one process's Map is
 * not a house-wide fact** — two processes across a deploy can still both write,
 * which is exactly why the statement underneath is an upsert and not a lock.
 */
const voiceCardWritesInFlight = new Map<string, Promise<VoiceCardResult>>();

async function ensureVoiceCard(
  input: { userId: number; modelId: number; signal?: AbortSignal },
  deps: VoiceServiceDeps | undefined,
): Promise<VoiceCardResult> {
  const sources = await readCastVoiceCardSources(input.userId, input.modelId);
  if (!sources) return { ok: false, refusal: "cast_not_available" };

  let pictureKey: string | null = null;
  try {
    pictureKey = await readCastOriginalAnchorKey(input.userId, input.modelId);
  } catch (error) {
    log.warn({ errName: (error as Error)?.name, modelId: input.modelId }, "[Voice] master picture unreadable — card written from the words");
  }

  const sourceHash = voiceCardSourceHash(sources, pictureKey);
  const kept = await readCastVoiceCard(input.userId, input.modelId);
  if (kept && kept.sourceHash === sourceHash) {
    return { ok: true, voiceCard: kept.voiceCard, previewLine: kept.previewLine };
  }

  const key = `${input.userId}:${input.modelId}:${sourceHash}`;
  const alreadyWriting = voiceCardWritesInFlight.get(key);
  if (alreadyWriting) {
    log.info({ modelId: input.modelId }, "[Voice] a card for these words is already being written — waiting on it");
    return alreadyWriting;
  }
  const writing = writeAndKeepVoiceCard(
    { ...input, sources, pictureKey, sourceHash, rewriting: Boolean(kept) },
    deps,
  ).finally(() => {
    voiceCardWritesInFlight.delete(key);
  });
  voiceCardWritesInFlight.set(key, writing);
  return writing;
}

/** The expensive half, behind {@link voiceCardWritesInFlight}. */
async function writeAndKeepVoiceCard(
  input: {
    userId: number;
    modelId: number;
    signal?: AbortSignal;
    sources: Awaited<ReturnType<typeof readCastVoiceCardSources>> & object;
    pictureKey: string | null;
    sourceHash: string;
    rewriting: boolean;
  },
  deps: VoiceServiceDeps | undefined,
): Promise<VoiceCardResult> {
  const writer = deps && "cardWriter" in deps ? deps.cardWriter ?? null : voiceCardWriterEngine();
  if (!writer) {
    log.error("[Voice] no voice card writer on this deployment — design refused before any spend");
    return { ok: false, refusal: "provider_failed", failureClass: "provider_account" };
  }

  let picture: ReferenceImage | null = null;
  if (input.pictureKey) {
    try {
      picture = await (deps?.readPicture ?? storageReadBytes)(input.pictureKey);
    } catch (error) {
      /* The key is not logged: on the public bucket it is the credential. */
      log.warn({ errName: (error as Error)?.name, modelId: input.modelId }, "[Voice] master picture bytes unreadable — card written from the words");
    }
  }

  let written: Awaited<ReturnType<typeof writeVoiceCard>>;
  try {
    written = await writeVoiceCard({ sources: input.sources, picture, engine: writer, signal: input.signal });
  } catch (error) {
    if (error instanceof ProviderError) {
      log.warn({ failureClass: error.failureClass, status: error.status }, "[Voice] card writer refused");
      return { ok: false, refusal: "provider_failed", failureClass: error.failureClass };
    }
    throw error;
  }

  /*
    THE CARD IS KEPT UNDER THE HASH OF WHAT IT WAS ACTUALLY WRITTEN FROM — the
    relay's finding 2 on PR #2500. The picture can fall away twice between the
    hash and the ask: its bytes may not read (just above), or `boundForJudge`
    may throw inside the writer. Keyed on the picture's storage key regardless,
    a words-only card was filed under the with-picture hash and then reused for
    the life of the cast — the picture bought and never read, with nothing left
    that would ever try again. Keyed honestly, the NEXT design re-writes it with
    the picture.

    Its cost, named: a cast whose picture is permanently unreadable re-writes on
    every design instead of once. That is bounded by the design ration (one free
    set per cast a day), it is the honest consequence of a broken picture, and
    the other way round is a cast whose voices never see its face.
  */
  const keptUnder = written.withPicture ? input.sourceHash : voiceCardSourceHash(input.sources, null);

  let saved: Awaited<ReturnType<typeof saveCastVoiceCard>>;
  try {
    saved = await saveCastVoiceCard({
      userId: input.userId,
      modelId: input.modelId,
      sourceHash: keptUnder,
      voiceCard: written.voiceCard,
      previewLine: written.previewLine,
      writerModel: written.writerModel,
    });
  } catch (error) {
    /*
      THE WRITER IS ALREADY PAID, SO A FAILED KEEP DOES NOT REFUSE THE DESIGN —
      the other half of finding 1. The statement is an upsert now and cannot
      collide on itself, but a dropped connection or a deadlock elsewhere in the
      transaction would once have left this unhandled and answered a 500. The
      card is in hand: the voices are designed from it and it is simply not
      kept, so the only cost is that the next design writes another one.
      `written: false` below is the different answer and stays a refusal — it
      means the cast itself is gone, and designing voices for a deleted cast is
      not a kindness.
    */
    log.error(
      { errName: (error as Error)?.name, modelId: input.modelId },
      "[Voice] the voice card could not be kept — designing from it anyway, unkept",
    );
    return { ok: true, voiceCard: written.voiceCard, previewLine: written.previewLine };
  }
  if (!saved.written) return { ok: false, refusal: "cast_not_available" };

  log.info(
    {
      modelId: input.modelId,
      latencyMs: written.latencyMs,
      tokens: written.tokens,
      withPicture: written.withPicture,
      rewritten: input.rewriting,
    },
    "[Voice] voice card written",
  );
  return { ok: true, voiceCard: written.voiceCard, previewLine: written.previewLine };
}

/**
 * The cast's words → three voices.
 *
 * ⚠ **THE VOICE PROVIDER NEVER READS THE VISIBLE LINE ANY MORE (#2498).** It
 * reads the cast's hidden voice card and an in-character line
 * ({@link ensureVoiceCard}). `designSentence` is still the visible line,
 * returned verbatim, because a Keep stores what the customer's line read when
 * the voice was made.
 *
 * ⚠ **The previews are returned in process and nothing stores them.** The
 * design asks for the three to be held under the cleanup-manifest pattern so a
 * RELOAD does not lose a paid design — a reload is a browser event, so that
 * belongs with the surface that can have one (N4b-2). Stated rather than
 * silently skipped: in slice 1 a design's previews live exactly as long as the
 * call that made them.
 */
export async function designCastVoices(
  input: { userId: number; modelId: number; signal?: AbortSignal },
  deps?: VoiceServiceDeps,
): Promise<VoiceDesignResult> {
  if (!captureCastingVoiceEnabled(input.userId)) return { ok: false, refusal: "voice_off" };

  const cast = await readCastVoiceLine(input.userId, input.modelId);
  if (!cast) return { ok: false, refusal: "cast_not_available" };
  const designSentence = (cast.voice ?? "").trim();
  if (designSentence.length === 0) return { ok: false, refusal: "no_voice_line" };

  const card = await ensureVoiceCard(input, deps);
  if (!card.ok) return card;

  try {
    const { previews, latencyMs } = await engineFor(deps).designVoices({
      description: card.voiceCard,
      previewText: card.previewLine,
      signal: input.signal,
    });
    return { ok: true, previews, designSentence, latencyMs };
  } catch (error) {
    if (error instanceof ProviderError) {
      /*
        The engine's own floor on a description is a refusal the CUSTOMER can
        act on ("your words are too short"), which is a different thing to say
        from "the voice studio is having trouble" — so it is separated here
        rather than folded into `provider_failed`.
      */
      if (error.failureClass === "capability" && /characters to design from/.test(error.message)) {
        return { ok: false, refusal: "voice_line_too_short" };
      }
      log.warn({ failureClass: error.failureClass, status: error.status }, "[Voice] design refused");
      return { ok: false, refusal: "provider_failed", failureClass: error.failureClass };
    }
    throw error;
  }
}

/**
 * KEEP — the three provider steps of the design's §4, in its order, and Keep is
 * not done until all three are.
 *
 *   1. **Save** the chosen preview to a slot (one voice operation).
 *   2. **Record** the audition: the saved voice reads the house passage.
 *   3. **Store** the clip with its sha256 beside the line it was made from.
 *
 * ⚠ **THE ALLOWANCE IS READ BEFORE STEP 1 AND NOTHING IS SPENT BEFORE IT
 * ANSWERS.** Read before, and again after, so a receipt can show the counter
 * actually moving — which is how this road proves it spends what it says it
 * spends rather than asserting it.
 *
 * ⚠ **AND THE LAST ACT IS THE WRITE, WHICH CAN STILL LOSE.** The insert proves
 * the cast is the owner's live signed cast in the statement itself, because
 * steps 1–3 take tens of seconds and the cast can be deleted inside them. When
 * the write loses, the slot is RELEASED and the stored object DELETED before
 * returning: a Keep that did not land must not leave a slot occupied out of the
 * account's plan nor bytes nothing will ever collect. The voice OPERATION is
 * not refundable (measured), and that is reported rather than hidden.
 */
export async function keepCastVoice(
  input: {
    userId: number;
    modelId: number;
    previewId: string;
    /** The line the previews were designed from, as it read then. */
    designSentence: string;
    signal?: AbortSignal;
  },
  deps?: VoiceServiceDeps,
): Promise<VoiceKeepResult> {
  if (!captureCastingVoiceEnabled(input.userId)) return { ok: false, refusal: "voice_off" };

  const cast = await readCastVoiceLine(input.userId, input.modelId);
  if (!cast) return { ok: false, refusal: "cast_not_available" };

  /*
    ⚠ **A CAST THAT ALREADY HAS A VOICE IS NOT REFUSED ANY MORE — #2497.** It
    was refused here as `already_kept` (slice-1 scaffolding, declared as such)
    because nothing could yet collect a replaced clip. A Keep now REPLACES:
    every step below runs for the NEW voice while the old one stays exactly as
    it is, and the old voice changes only inside `insertCastVoice`'s one
    transaction, after the new slot is saved and the new clip stored. Any
    refusal or throw before that leaves the old voice untouched.

    ⚠ **A REPLACE NEEDS A FREE SLOT FOR A MOMENT**: the new voice is saved
    before the old one is released, because the other order loses the old
    voice when the new save fails. On a full plan that slot is made by
    eviction (#2472) exactly as for a first Keep — and a replace gives up its
    OWN current slot first, since that slot is going back anyway once the new
    voice lands. If the replace then fails, the old voice is still the cast's:
    evicted, not removed, and re-minted from its clip on its next use.
  */
  const engine = engineFor(deps);

  let allowanceBefore: VoiceAllowance;
  try {
    allowanceBefore = await engine.readAllowance({ signal: input.signal });
  } catch (error) {
    /*
      ⚠ A FAILED READ REFUSES. It is tempting to let the save through and let the
      provider's own 4xx be the ceiling — that is the shape invariant 7 forbids,
      and here it would also charge a customer in slice 2 for a press we already
      knew we could not honour.
    */
    const failureClass = error instanceof ProviderError ? error.failureClass : "unknown";
    log.warn({ failureClass }, "[Voice] allowance unreadable — Keep refused before any spend");
    return { ok: false, refusal: "allowance_unreadable", failureClass };
  }

  if (!voiceOperationsAvailable(allowanceBefore)) {
    return { ok: false, refusal: "no_operations_left" };
  }
  let evicted = 0;
  if (!voiceSlotsAvailable(allowanceBefore)) {
    /*
      ⚠ **THIS WAS A REFUSAL UNTIL #2472, AND ITS COMMENT SAID THE RE-MINT
      COURT STILL HAD TO DECIDE WHETHER EVICTION WAS ALLOWED AT ALL.** The court
      passed by his ear on 2026-10-13 (*"remint actually sounds better in some
      cases both 90s clips were great though"*), so a full plan now evicts the
      least-recently-used voice. It still REFUSES when nothing may be evicted:
      a plan that cannot clone (an evicted voice could never come back), no
      resident voice of ours to give up, or a provider that will not release.
      Nothing has been spent at that point.
    */
    const own = await readCastVoiceForUse(input.userId, input.modelId);
    const room = await makeRoomForOneVoice(engine, allowanceBefore, {
      preferFirst: own?.voiceId
        ? { id: own.id, voiceId: own.voiceId, clipSha256: own.clipSha256 }
        : undefined,
    });
    if (!room.ok) return { ok: false, refusal: "no_slots_left" };
    evicted = room.evicted;
  }

  let voiceId: string;
  let saveLatencyMs: number;
  /* OUR name, internal, and deliberately not the cast's: a provider-side
     label is one more place a customer's naming could travel. Named for this
     ATTEMPT, so a save whose answer never came back can be found and released
     without touching anyone else's voice (see `releaseUnansweredVoice`). */
  const saveName = voiceAttemptName(input.userId, input.modelId);
  try {
    const saved = await engine.saveVoice({
      previewId: input.previewId,
      name: saveName,
      description: input.designSentence,
      signal: input.signal,
    });
    voiceId = saved.voiceId;
    saveLatencyMs = saved.latencyMs;
  } catch (error) {
    const failureClass = error instanceof ProviderError ? error.failureClass : "unknown";
    const billed = error instanceof ProviderError && error.completed;
    log.warn({ failureClass, billed }, "[Voice] save refused");
    await releaseUnansweredVoice(engine, error, saveName);
    return { ok: false, refusal: "provider_failed", failureClass };
  }

  let clipBytes: Buffer;
  let clipContentType: string;
  let speakLatencyMs: number;
  try {
    const spoken = await engine.speak({
      voiceId,
      text: VOICE_AUDITION_PASSAGE,
      signal: input.signal,
    });
    clipBytes = spoken.bytes;
    clipContentType = spoken.contentType;
    speakLatencyMs = spoken.latencyMs;
  } catch (error) {
    /* The save already spent an operation; the SLOT is at least recoverable. */
    await releaseSlotQuietly(engine, voiceId);
    const failureClass = error instanceof ProviderError ? error.failureClass : "unknown";
    log.warn({ failureClass }, "[Voice] audition refused — slot released");
    return { ok: false, refusal: "provider_failed", failureClass };
  }

  const clipStorageKey = voiceClipKey(input.userId, input.modelId);
  const clipSha256 = sha256(clipBytes);

  /*
    THE HOLD GOES ON BEFORE THE BYTES DO, which is what covers the gap no
    try/catch can reach: a process death between the `storagePut` below and the
    row write would otherwise leave ninety seconds of a voice in the PUBLIC
    bucket under a key no row names — and both deletion roads find clips THROUGH
    the rows, so neither could ever remove it (#2470's finding, item 2).

    `holdClipForWrite` carries the two decisions inside it; `insertCastVoice`
    discharges it in the SAME transaction as the row.
  */
  const cleanupBatchId = randomUUID();
  try {
    await holdClipForWrite({
      id: cleanupBatchId,
      userId: input.userId,
      storageKey: clipStorageKey,
    });
  } catch (error) {
    /* Nothing is in the bucket yet, so there is nothing to collect — only the
       slot the save spent, which is recoverable. */
    await releaseSlotQuietly(engine, voiceId);
    log.error({ err: error }, "[Voice] clip hold could not be written — slot released, nothing stored");
    return { ok: false, refusal: "provider_failed", failureClass: "transport" };
  }

  try {
    await storagePut(clipStorageKey, clipBytes, clipContentType);
  } catch (error) {
    await releaseSlotQuietly(engine, voiceId);
    log.error({ err: error }, "[Voice] clip storage failed — slot released");
    return { ok: false, refusal: "provider_failed", failureClass: "transport" };
  }

  /*
    ⚠ **A THROW HERE IS THE ORPHAN THIS GUARD EXISTS FOR.** A dropped connection
    or a timeout at the INSERT leaves the provider voice held and the clip
    stored, and the manifest above only collects it after its hold lapses — so
    the slot is released and the bytes deleted on the spot, and the error is
    rethrown rather than being turned into a refusal, because a Keep that failed
    for an unknown reason is not the same fact as one the provider refused.
  */
  let written: Awaited<ReturnType<typeof insertCastVoice>>;
  try {
    written = await insertCastVoice({
      userId: input.userId,
      modelId: input.modelId,
      designSentence: input.designSentence,
      voiceId,
      clipStorageKey,
      clipSha256,
      clipBytes: clipBytes.byteLength,
      clipContentType,
      passageVersion: VOICE_AUDITION_PASSAGE_VERSION,
      cleanupBatchId,
    });
  } catch (error) {
    await releaseSlotQuietly(engine, voiceId);
    await deleteClipQuietly(clipStorageKey, { userId: input.userId, modelId: input.modelId });
    log.error(
      { err: error, userId: input.userId, modelId: input.modelId },
      "[Voice] the kept voice's row could not be written — slot and clip released",
    );
    throw error;
  }
  if (!written.inserted) {
    /*
      The cast went away inside the three provider steps, or a second Keep won
      the unique index. Either way this Keep owns nothing: release the slot and
      delete the bytes. The voice OPERATION stays spent — a delete refunds none
      (measured) — which is a real cost of a lost race and is logged as one
      rather than being quietly absorbed.

      The insert's transaction rolled back, so the hold above is STILL STANDING:
      the delete here is the prompt road and the worker is the backstop if this
      process dies between the two. Belt and braces on purpose — the bytes are a
      cloning source, and the slower road is measured in minutes.
    */
    await releaseSlotQuietly(engine, voiceId);
    await deleteClipQuietly(clipStorageKey, { userId: input.userId, modelId: input.modelId });
    log.warn(
      { modelId: input.modelId },
      "[Voice] Keep lost its write — slot and clip released, one voice operation spent",
    );
    return { ok: false, refusal: "cast_not_available" };
  }

  /*
    THE OLD SLOT GOES ONLY NOW — after the transaction that made the new voice
    the cast's has committed (his *"only after the new one is fully kept"*).
    Its clip is already queued for the cleanup worker inside that transaction.
    Best effort, as on the deletion road: the customer's voice is the new one
    whatever the vendor answers, and a slot that will not release is logged
    with its id so it can be swept by hand.
  */
  let replaced: { slotReleased: boolean } | null = null;
  if (written.replaced) {
    const oldVoiceId = written.replaced.voiceId;
    replaced = {
      slotReleased: oldVoiceId ? await releaseSlotQuietly(engine, oldVoiceId) : true,
    };
    log.info({ modelId: input.modelId, slotReleased: replaced.slotReleased }, "[Voice] a kept voice was replaced");
  }

  return {
    ok: true,
    clipStorageKey,
    clipSha256,
    clipBytes: clipBytes.byteLength,
    clipContentType,
    passageVersion: VOICE_AUDITION_PASSAGE_VERSION,
    allowanceBefore,
    saveLatencyMs,
    speakLatencyMs,
    replaced,
    evicted,
  };
}

/**
 * REMOVE — the cast has no voice from now on (#2497).
 *
 * His word on the card: *"Remove voice: back to 'No voice yet', slot released,
 * clip deleted. **No refund** — the customer had the voice."* So nothing here
 * touches money, and nothing here calls the provider except to give the slot
 * back.
 *
 * The row and the clip's manifest change in one transaction
 * (`removeCastVoice`); the slot is released after it commits, best effort —
 * the cast-deletion road's order and its reasoning.
 */
export async function removeCastVoiceForCast(
  input: { userId: number; modelId: number },
  deps?: VoiceServiceDeps,
): Promise<
  | { ok: true; removed: boolean; slotReleased: boolean | null }
  | { ok: false; refusal: "voice_off" }
> {
  if (!captureCastingVoiceEnabled(input.userId)) return { ok: false, refusal: "voice_off" };

  const removed = await removeCastVoice(input.userId, input.modelId);
  if (!removed) return { ok: true, removed: false, slotReleased: null };

  const slotReleased = removed.voiceId
    ? await releaseSlotQuietly(engineFor(deps), removed.voiceId)
    : true;
  log.info({ modelId: input.modelId, slotReleased }, "[Voice] a kept voice was removed");
  return { ok: true, removed: true, slotReleased };
}

/**
 * CAN ANYTHING BE KEPT AT ALL — the card's own question, answered cheaply.
 *
 * ⚠ **THIS IS A HINT AND NEVER A GATE, AND THE DISTINCTION IS THE WHOLE
 * DOCBLOCK.** The spend decision stays exactly where it was: `keepCastVoice`
 * reads the allowance LIVE immediately before it saves, for the reason this
 * module's header records — a hard-coded *"three slots"* would have refused a
 * Keep with 27 free the day the plan was upgraded. What this answers is the
 * cheaper question the CARD needs: should three voices be designed on house
 * money at all, when nothing could be kept from them (#2470's finding, item 5)?
 *
 * ⚠ **IT IS CACHED FOR A MINUTE, PER PROCESS, BECAUSE IT IS ONE HOUSE ACCOUNT
 * AND NOT ONE PER CUSTOMER.** The allowance is a property of our provider plan,
 * so there is nothing to key it by; without the cache every signed cast's page
 * open would be a provider round trip. A minute is short against the only two
 * things that move it — a Keep, and the month turning.
 *
 * ⚠ **IT FAILS OPEN, DELIBERATELY, AND THAT IS THE SAFE DIRECTION HERE** — the
 * opposite of what the Keep does. An unreadable allowance returns `true`, so a
 * provider blip leaves the card working; the money is still protected, because
 * the live read inside Keep refuses before any spend (`allowance_unreadable`).
 * Failing closed would hide a working feature on a transient read, and nothing
 * would be saved by it.
 */
const KEEPABILITY_TTL_MS = 60 * 1000;
let keepabilityCache: { atMs: number; canKeep: boolean } | null = null;

export async function readVoiceKeepability(
  deps?: VoiceServiceDeps,
): Promise<{ canKeep: boolean }> {
  const atMs = Date.now();
  if (keepabilityCache && atMs - keepabilityCache.atMs < KEEPABILITY_TTL_MS) {
    return { canKeep: keepabilityCache.canKeep };
  }
  try {
    const allowance = await engineFor(deps).readAllowance({});
    /* #2507 item 4: a FULL plan that can clone is still keepable — Keep makes
       room by eviction — so the hint asks the eviction's own question rather
       than "is a slot free", or the card stops designing on a plan where every
       Keep would in fact succeed. */
    const canKeep = voiceOperationsAvailable(allowance) && roomForOneVoiceObtainable(allowance);
    keepabilityCache = { atMs, canKeep };
    return { canKeep };
  } catch (error) {
    const failureClass = error instanceof ProviderError ? error.failureClass : "unknown";
    log.warn({ failureClass }, "[Voice] allowance unreadable for the card's hint — answering yes");
    /* NOT cached: a blip must not pin an optimistic answer for a minute. */
    return { canKeep: true };
  }
}

/** For the drivers: forget the cached allowance between arms. */
export function resetVoiceKeepabilityCache(): void {
  keepabilityCache = null;
}

/**
 * MAKE ROOM FOR ONE MORE VOICE — least-recently-used eviction (#2472).
 *
 * Frees as many slots as the LIVE reading says are missing for one more voice
 * (normally one; more only if the plan was cut below what is held), by giving
 * back the slots of the voices used longest ago. Each eviction is:
 *
 *   1. the row stops naming the slot — a compare-and-set on the slot it saw,
 *      so a voice replaced, removed or evicted in the meantime is skipped;
 *   2. THEN the provider slot is deleted. A delete refunds no operation and
 *      costs none (measured), so eviction is free.
 *
 * In that order on purpose: the other order leaves, for a moment, a row naming
 * a slot that no longer exists, which a road about to speak would trust.
 *
 * ⚠ **A DELETE THE PROVIDER REFUSED PUTS THE ROW BACK** (`restoreCastVoiceSlot`),
 * because the slot is still occupied and a row that says otherwise would
 * re-mint a voice that was never gone, one operation spent on nothing. Only a
 * clean 4xx proves that ({@link providerProvablyRefused}); a delete that did
 * not ANSWER (timeout, transport, 5xx) may have happened, so its row stays
 * evicted rather than resurrect a deleted voice (#2507 item 1), and the restore
 * is keyed on the clip seen at eviction so it can never land on a replaced row
 * (#2507 item 2). A 404 is the other exception: the provider says the slot is
 * ALREADY free, so the row is right to be empty and stays so, but nothing was
 * freed by it either.
 *
 * ⚠ **NOTHING IS EVICTED ON A PLAN THAT CANNOT CLONE**, read off the same live
 * allowance the caller just read. An evicted voice must be able to come back,
 * or eviction is deletion with a nicer name.
 *
 * It never touches money. It never removes a voice from a cast.
 */
const EVICTION_MAX_SLOTS_TO_FREE = 3;
const EVICTION_SPARE_CANDIDATES = 4;

/**
 * The wording every "nothing will ever give this slot back" log carries, so an
 * operator searching the logs for orphaned slots finds every road that can
 * leave one, each with the provider voice id beside it (#2507 item 5).
 */
const SLOT_ORPHANED = "this slot is now orphaned on the account";
const SLOT_POSSIBLY_ORPHANED = "this slot is possibly orphaned on the account";

/**
 * CAN ONE MORE VOICE BE GIVEN A SLOT on this live reading — a free slot, or
 * one {@link makeRoomForOneVoice} would make by eviction. The same arithmetic
 * and the same two refusals as that function's own guard (no instant cloning;
 * over the limit by more than one press may clear), read from here by both, so
 * the card's hint and the Keep cannot disagree (#2507 item 4).
 */
function roomForOneVoiceObtainable(allowance: VoiceAllowance): boolean {
  const needed = allowance.slotsUsed - allowance.slotsTotal + 1;
  if (needed <= 0) return true;
  return allowance.instantCloning && needed <= EVICTION_MAX_SLOTS_TO_FREE;
}

/**
 * DID THE PROVIDER PROVABLY NOT DO IT? True only for a clean refusal: an HTTP
 * 4xx the provider sent back (404 is answered by its own branch at each
 * caller; 408 is the provider saying IT timed out, which proves nothing). A
 * timeout, a transport fault, a 5xx, a cancel or a non-provider throw all leave
 * the question open: the provider may have finished the job and only the
 * answer was lost (#2507, the relay's finding, item 1).
 */
export function providerProvablyRefused(error: unknown): boolean {
  if (!(error instanceof ProviderError)) return false;
  if (error.completed) return false;
  const status = error.status;
  return typeof status === "number" && status >= 400 && status < 500 && status !== 408;
}

/**
 * The internal provider-side name for ONE save or clone attempt: the ids
 * (never the cast's name) and a fresh suffix, so the orphan sweep's exact-name
 * lookup can only ever find this attempt's voice.
 */
function voiceAttemptName(userId: number, modelId: number): string {
  return `klieg-${userId}-${modelId}-${randomUUID().slice(0, 8)}`;
}

/**
 * A SAVE OR CLONE THAT DID NOT ANSWER MAY STILL HAVE TAKEN A SLOT. Find it by
 * its attempt name and give it back (#2507, the relay's finding, item 3).
 *
 * Without this, a timed-out clone that the provider in fact completed leaves a
 * slot that no row names: it can never be chosen for eviction, it raises the
 * live `slotsUsed` for good, and enough of them switch eviction off, so every
 * Keep on a full plan then refuses forever. A clean 4xx refusal made nothing
 * and is skipped. Best effort, and stated: a voice the provider finishes AFTER
 * this lookup is still missed, and is logged as a possible orphan by name.
 */
async function releaseUnansweredVoice(engine: VoiceEngine, error: unknown, name: string): Promise<void> {
  if (providerProvablyRefused(error)) return;
  let found: string[];
  try {
    found = await engine.findVoicesByName({ name });
  } catch (lookupError) {
    const failureClass = lookupError instanceof ProviderError ? lookupError.failureClass : "unknown";
    log.error(
      { failureClass, attemptName: name },
      "[Voice] an unanswered voice call could not be looked up; a slot may be orphaned under this name",
    );
    return;
  }
  if (found.length === 0) {
    log.warn({ attemptName: name }, "[Voice] an unanswered voice call left no voice behind (yet)");
    return;
  }
  for (const voiceId of found) await releaseSlotQuietly(engine, voiceId);
  log.warn(
    { attemptName: name, released: found.length },
    "[Voice] an unanswered voice call HAD made a voice; its slot was released",
  );
}

async function makeRoomForOneVoice(
  engine: VoiceEngine,
  allowance: VoiceAllowance,
  options: { preferFirst?: { id: number; voiceId: string; clipSha256: string }; excludeId?: number },
): Promise<{ ok: true; evicted: number } | { ok: false }> {
  const needed = allowance.slotsUsed - allowance.slotsTotal + 1;
  if (needed <= 0) return { ok: true, evicted: 0 };
  /* The guard the card's hint reads too (`roomForOneVoiceObtainable`), so the
     two cannot disagree; the branches below only name WHICH refusal it was. */
  if (!roomForOneVoiceObtainable(allowance)) {
    if (!allowance.instantCloning) {
      log.warn("[Voice] every slot is full and this plan cannot re-mint — nothing evicted");
    } else {
      /* The plan holds far more than it allows — a downgrade, or slots this
         product does not own. Not something to clear out on one press. */
      log.error({ needed }, "[Voice] the plan is over its slot limit by more than eviction will clear");
    }
    return { ok: false };
  }

  const ranked = await readEvictionCandidates({
    limit: needed + EVICTION_SPARE_CANDIDATES,
    excludeId: options.excludeId,
  });
  const preferred = options.preferFirst;
  const candidates = preferred
    ? [preferred, ...ranked.filter((one) => one.id !== preferred.id)]
    : ranked;

  let freed = 0;
  for (const candidate of candidates) {
    if (freed >= needed) break;
    if (!(await evictCastVoiceSlot({ id: candidate.id, voiceId: candidate.voiceId }))) continue;
    try {
      await engine.deleteVoice({ voiceId: candidate.voiceId });
      freed += 1;
      log.info(
        { evictedRowId: candidate.id },
        "[Voice] a voice was evicted from its slot — still kept, re-minted on its next use",
      );
    } catch (error) {
      if (error instanceof ProviderError && error.status === 404) {
        log.warn({ evictedRowId: candidate.id }, "[Voice] an evicted slot was already gone at the provider");
        continue;
      }
      const failureClass = error instanceof ProviderError ? error.failureClass : "unknown";
      if (!providerProvablyRefused(error)) {
        /*
          ⚠ **A DELETE THAT DID NOT ANSWER IS NOT PUT BACK** (#2507, the relay's
          finding, item 1). A timeout or a 5xx may have deleted the voice, and a
          row restored onto a deleted voice is a resurrection: the cache would
          answer it as resident, its first line would fail, and nothing heals
          it. Left evicted, the worst case is one spare re-mint (one voice
          operation) on its next use, plus a slot that may still be held, so it
          is not counted as freed and is logged.
        */
        /* #2507 item 5: the voice id is NAMED, so an operator can find the
           slot and release it by hand; an unnamed orphan is unfindable. */
        log.error(
          { failureClass, evictedRowId: candidate.id, voiceId: candidate.voiceId },
          `[Voice] an eviction's delete did not answer; the row stays evicted (re-minted on next use) — ${SLOT_POSSIBLY_ORPHANED}`,
        );
        break;
      }
      const restored = await restoreCastVoiceSlot({
        id: candidate.id,
        voiceId: candidate.voiceId,
        clipSha256: candidate.clipSha256,
      }).catch(() => false);
      if (restored) {
        log.error(
          { failureClass, evictedRowId: candidate.id },
          "[Voice] an eviction's slot was refused release; the row was put back and eviction stopped",
        );
      } else {
        /* #2507 item 5: refused release AND no row names it any more (the row
           was replaced, re-minted or removed meanwhile, or the write failed).
           Nothing in the product will ever release it, so the id is NAMED. */
        log.error(
          { failureClass, evictedRowId: candidate.id, voiceId: candidate.voiceId },
          `[Voice] an eviction's slot was refused release and could not be put back — ${SLOT_ORPHANED}`,
        );
      }
      /* A provider that refused one delete will refuse the next; stop here. */
      break;
    }
  }
  return freed >= needed ? { ok: true, evicted: freed } : { ok: false };
}

export type VoiceUseResult =
  | {
      ok: true;
      /** The provider slot to speak with. Internal — never a client field. */
      voiceId: string;
      /** Whether this call cloned the voice back from its clip. */
      reminted: boolean;
      /** Other voices evicted to make room for the re-mint. */
      evicted: number;
    }
  | { ok: false; refusal: VoiceRefusal; failureClass?: string };

/**
 * One re-mint per kept voice at a time, in this process — the voice card
 * writer's single-flight shape (`voiceCardWritesInFlight`). Two things about to
 * speak with one evicted voice at once must spend ONE voice operation, not two;
 * keyed on the row AND its clip, so a replaced voice is never collapsed into
 * its predecessor's re-mint. One process's Map is not a house-wide fact, which
 * is why the write underneath is a compare-and-set that releases a losing clone.
 */
const remintsInFlight = new Map<string, Promise<VoiceUseResult>>();

/**
 * THE DOOR TO SPEAK WITH A KEPT VOICE — #2472.
 *
 * Anything about to speak with a cast's kept voice asks here first and gets the
 * slot to speak with. A resident voice is answered at once and marked used, so
 * the cache knows it is warm. An EVICTED voice is cloned back from its stored
 * audition clip — one voice operation, house-paid, never the customer's — with
 * the clip's bytes proved against the sha256 the row recorded before a byte is
 * sent.
 *
 * ⚠ **NO ROAD IN THE PRODUCT SPEAKS WITH A KEPT VOICE YET**, so nothing calls
 * this today: Keep records the audition itself, and the clip route plays the
 * stored bytes without the provider. The first road that speaks a line in a
 * cast's voice walks this door; until then an evicted voice simply stays
 * evicted, which costs nothing. Stated rather than left to be found.
 *
 * Every refusal leaves the kept voice exactly as it was — the row, the clip and
 * the cast's voice are never touched by a failed re-mint.
 */
export async function ensureCastVoiceResident(
  input: { userId: number; modelId: number; signal?: AbortSignal },
  deps?: VoiceServiceDeps,
): Promise<VoiceUseResult> {
  if (!captureCastingVoiceEnabled(input.userId)) return { ok: false, refusal: "voice_off" };

  const cast = await readCastVoiceLine(input.userId, input.modelId);
  if (!cast) return { ok: false, refusal: "cast_not_available" };
  const kept = await readCastVoiceForUse(input.userId, input.modelId);
  if (!kept) return { ok: false, refusal: "no_kept_voice" };

  if (kept.voiceId) {
    await markUsedQuietly(input);
    return { ok: true, voiceId: kept.voiceId, reminted: false, evicted: 0 };
  }

  const key = `${kept.id}:${kept.clipSha256}`;
  const already = remintsInFlight.get(key);
  if (already) return already;
  const reminting = remintCastVoice(input, kept, deps).finally(() => {
    remintsInFlight.delete(key);
  });
  remintsInFlight.set(key, reminting);
  return reminting;
}

async function remintCastVoice(
  input: { userId: number; modelId: number; signal?: AbortSignal },
  kept: NonNullable<Awaited<ReturnType<typeof readCastVoiceForUse>>>,
  deps: VoiceServiceDeps | undefined,
): Promise<VoiceUseResult> {
  const engine = engineFor(deps);

  let allowance: VoiceAllowance;
  try {
    allowance = await engine.readAllowance({ signal: input.signal });
  } catch (error) {
    /* Invariant 7, as at Keep: a re-mint is a spend, and an unread ration refuses it. */
    const failureClass = error instanceof ProviderError ? error.failureClass : "unknown";
    log.warn({ failureClass }, "[Voice] allowance unreadable — re-mint refused before any spend");
    return { ok: false, refusal: "allowance_unreadable", failureClass };
  }
  if (!allowance.instantCloning) return { ok: false, refusal: "remint_unavailable" };
  if (!voiceOperationsAvailable(allowance)) return { ok: false, refusal: "no_operations_left" };

  /*
    THE CLIP IS READ AND PROVED BEFORE ANYTHING IS EVICTED FOR IT — a bad clip
    must not cost another customer their slot. The key is never logged: on the
    public bucket it is the credential, and ninety seconds of a voice is a
    cloning source (`deleteClipQuietly`'s docblock).
  */
  let clip: { bytes: Buffer; contentType: string };
  try {
    clip = await storageReadAudioBytes(kept.clipStorageKey);
  } catch (error) {
    log.error(
      { errName: (error as Error)?.name, modelId: input.modelId },
      "[Voice] the kept clip could not be read — no re-mint",
    );
    return { ok: false, refusal: "clip_unreadable" };
  }
  if (sha256(clip.bytes) !== kept.clipSha256) {
    log.error(
      { modelId: input.modelId },
      "[Voice] the kept clip's bytes disagree with its recorded sha256 — no re-mint",
    );
    return { ok: false, refusal: "clip_unreadable" };
  }

  let evicted = 0;
  if (!voiceSlotsAvailable(allowance)) {
    const room = await makeRoomForOneVoice(engine, allowance, { excludeId: kept.id });
    if (!room.ok) return { ok: false, refusal: "no_slots_left" };
    evicted = room.evicted;
  }

  let voiceId: string;
  /* OUR name, internal, as at Keep: never the cast's, and this attempt's own. */
  const cloneName = voiceAttemptName(input.userId, input.modelId);
  try {
    const cloned = await engine.cloneVoice({
      name: cloneName,
      bytes: clip.bytes,
      contentType: kept.clipContentType,
      signal: input.signal,
    });
    voiceId = cloned.voiceId;
  } catch (error) {
    const failureClass = error instanceof ProviderError ? error.failureClass : "unknown";
    const billed = error instanceof ProviderError && error.completed;
    log.warn({ failureClass, billed }, "[Voice] re-mint refused — the kept voice is unchanged");
    await releaseUnansweredVoice(engine, error, cloneName);
    return { ok: false, refusal: "provider_failed", failureClass };
  }

  let recorded: boolean;
  try {
    recorded = await recordRemintedCastVoice({
      id: kept.id,
      userId: input.userId,
      modelId: input.modelId,
      clipSha256: kept.clipSha256,
      voiceId,
    });
  } catch (error) {
    await releaseSlotQuietly(engine, voiceId);
    log.error(
      { err: error, modelId: input.modelId },
      "[Voice] a re-mint could not be recorded — its slot released",
    );
    throw error;
  }
  if (!recorded) {
    /*
      Another road moved the row while the clone ran: a re-mint in another
      process filled it, a Keep replaced it, or the cast went away. This clone
      belongs to nobody, so its slot goes back. If the row is resident now,
      that voice is the one to speak with.
    */
    await releaseSlotQuietly(engine, voiceId);
    log.warn(
      { modelId: input.modelId },
      "[Voice] a re-mint lost its write — its slot released, one voice operation spent",
    );
    const now = await readCastVoiceForUse(input.userId, input.modelId);
    if (now?.voiceId) return { ok: true, voiceId: now.voiceId, reminted: false, evicted };
    return { ok: false, refusal: "cast_not_available" };
  }

  log.info({ modelId: input.modelId, evicted }, "[Voice] a kept voice was re-minted from its clip");
  return { ok: true, voiceId, reminted: true, evicted };
}

/** The cache's `lastUsedAt`, best effort — a missed mark only ages a warm voice. */
async function markUsedQuietly(input: { userId: number; modelId: number }): Promise<void> {
  try {
    await touchCastVoiceUsed(input);
  } catch (error) {
    log.warn(
      { errName: (error as Error)?.name, modelId: input.modelId },
      "[Voice] lastUsedAt was not written",
    );
  }
}

/**
 * WHAT THE HOUSE HAS LEFT — the staff reading (N4b-3, #2471).
 *
 * His card: *"the house can see the month's ration before a customer meets its
 * end"*. The allowance is a property of OUR provider plan, so this is one
 * house-wide fact and never a per-customer one — there is nothing to key it by
 * and no customer id in this road at all.
 *
 * # BOTH NUMBERS, BECAUSE EITHER ONE ENDS A KEEP
 *
 * The card asks for *"a count"*, and it ships TWO. `keepCastVoice` refuses on
 * `voiceOperationsAvailable` **or** `voiceSlotsAvailable` (two separate
 * refusals, `no_operations_left` and the slot road), so a panel showing
 * operations alone would hide half the cliff: an account with 40 operations
 * left and every slot full cannot keep a voice, and the page would read
 * healthy. Showing one number would have been obeying the card's letter while
 * failing the thing it was filed for.
 *
 * # IT RETURNS A VERDICT AND NEVER THROWS
 *
 * An unreadable allowance is a {@link StaffVoiceAllowance} state, not an
 * exception — the panel must be able to say *"not readable"* in the row, where
 * a throw would take the whole card to an error boundary and tell a staff
 * member nothing about which half is quiet. This is neither of the other two
 * roads' answers on purpose: the Keep fails CLOSED (money), the card's hint
 * fails OPEN (a blip must not hide a working feature), and a staff reading
 * does neither, because it is a measurement and reports what it measured.
 *
 * # `not_configured` IS A THIRD STATE AND NOT A FAILURE, AND IT IS READ RATHER
 * # THAN INFERRED
 *
 * ⚠ **Without it this panel cries wolf on every machine where voice is off.**
 * `requireKey()` throws `provider_account` for an absent key, and that class
 * also means no credit, a bad key or a suspended account — so a developer
 * machine with no voice transport would show the same *"not readable"* as a
 * dead production account, which is the silence direction wearing an alarm's
 * clothes. The variable is checked FIRST, before any call, and the two are
 * reported apart.
 *
 * It is an honest distinction rather than a convenience, because the absence
 * means something exact: `validateCastingVoiceEnvironment` REFUSES BOOT when
 * `CASTING_VOICE_SCOPE` names anyone and this variable is missing, so a
 * running process with no key is a process where **no account has a voice
 * road at all** — there is no ration to show, not a ration we failed to read.
 * This is `SENTRY_DSN`'s posture: say there is no tracker rather than imply
 * one is watching.
 *
 * # CACHED, SUCCESSES ONLY
 *
 * One house account again, so the cache is the keepability hint's reasoning
 * exactly: without it, every open staff tab is its own provider round trip on
 * every poll. The TTL matches the staff panel's own 30s cadence, so however
 * many tabs are open the provider sees at most one call per cadence.
 * ⚠ **A FAILURE IS NEVER CACHED** — the same rule the hint carries one
 * function up: pinning "not readable" for a cadence after one blip is how a
 * recovered provider keeps reading as broken.
 *
 * # WHAT IS DELIBERATELY NOT PROJECTED (invariant 8)
 *
 * {@link VoiceAllowance} also carries `tier` and `instantCloning`, and neither
 * crosses this boundary. `tier` is the VENDOR's plan name — naming a vendor on
 * a rendered surface serves nothing a staff member can act on, and the
 * disappearing-technology law's line about engine names is not one to walk up
 * to for decoration; `instantCloning` is a capability flag N4b-4's receipt
 * reads, not a ration. The projection is explicit so a later field added to
 * the allowance cannot arrive here by being spread.
 */
export type StaffVoiceAllowance =
  | {
      state: "read";
      /** Saves and clones left this period, and the period's whole ration. */
      operationsLeft: number;
      operationsTotal: number;
      /** Saved-voice slots free right now, and the plan's whole set. */
      slotsLeft: number;
      slotsTotal: number;
    }
  /** No transport, so no voice road for anyone — nothing to ration. */
  | { state: "not_configured" }
  /** There is a transport and it did not answer. */
  | { state: "unreadable"; failureClass: string };

const STAFF_ALLOWANCE_TTL_MS = 30 * 1000;
let staffAllowanceCache: { atMs: number; value: StaffVoiceAllowance } | null = null;

export async function readVoiceAllowanceForStaff(
  deps?: VoiceServiceDeps,
): Promise<StaffVoiceAllowance> {
  /* Asked BEFORE the cache, so a key set or unset mid-process is never
     answered from a reading taken under the other configuration. It is a bare
     env read, so asking every time costs nothing.

     `!deps?.engine` first because an INJECTED engine is the question's own
     answer: a driver handing in a stub is not asking whether this machine has
     a transport, and without this clause every arm below would need the real
     variable set to reach the code it is driving. */
  if (!deps?.engine && !process.env[ELEVENLABS_API_KEY_VARIABLE]) {
    return { state: "not_configured" };
  }
  const atMs = Date.now();
  if (staffAllowanceCache && atMs - staffAllowanceCache.atMs < STAFF_ALLOWANCE_TTL_MS) {
    return staffAllowanceCache.value;
  }
  try {
    const allowance = await engineFor(deps).readAllowance({});
    /* `Math.max(0, …)` because the provider reports a counter and a ceiling
       independently: a ration lowered mid-period, or a counter past its
       ceiling, must read as none left rather than as a negative count. */
    const value: StaffVoiceAllowance = {
      state: "read",
      operationsLeft: Math.max(0, allowance.operationsTotal - allowance.operationsUsed),
      operationsTotal: allowance.operationsTotal,
      slotsLeft: Math.max(0, allowance.slotsTotal - allowance.slotsUsed),
      slotsTotal: allowance.slotsTotal,
    };
    staffAllowanceCache = { atMs, value };
    return value;
  } catch (error) {
    const failureClass = error instanceof ProviderError ? error.failureClass : "unknown";
    log.warn({ failureClass }, "[Voice] allowance unreadable for the staff panel");
    /* NOT cached — see the docblock. */
    return { state: "unreadable", failureClass };
  }
}

/** For the drivers: forget the cached staff reading between arms. */
export function resetVoiceAllowanceStaffCache(): void {
  staffAllowanceCache = null;
}

/**
 * Release a provider slot, best effort.
 *
 * ⚠ **A FAILURE HERE NEVER FAILS THE CALLER**, and the reasoning is the same on
 * every road that uses it: the thing at stake is one slot of OUR plan, and the
 * caller is either already refusing (where a second error would hide the first)
 * or deleting a customer's cast (where a vendor outage must not block an
 * erasure). An orphaned slot is logged with its id so it can be swept by hand;
 * silence is what this must not do.
 */
export async function releaseSlotQuietly(engine: VoiceEngine, voiceId: string): Promise<boolean> {
  try {
    await engine.deleteVoice({ voiceId });
    return true;
  } catch (error) {
    const failureClass = error instanceof ProviderError ? error.failureClass : "unknown";
    log.error(
      { failureClass, voiceId },
      `[Voice] a saved voice could not be released — ${SLOT_ORPHANED}`,
    );
    return false;
  }
}

/**
 * Delete an unclaimed clip's bytes, best effort.
 *
 * ⚠ **THE KEY IS NOT LOGGED, AND ON THIS BUCKET THAT IS A SECURITY RULE RATHER
 * THAN TIDINESS — N4b-2 (#2470).** `server/storage.ts` writes to a permanently
 * PUBLIC bucket, so CLAUDE.md's sentence about what protects an object there is
 * the whole of it: *"protected only by the URL being hard to guess"*. The key IS
 * the credential, and ninety seconds of a voice is a cloning source — so
 * printing the key here widened a cloning source's address to wherever logs
 * travel.
 *
 * **It was left deliberately unfixed by slice 1's review, because its right
 * form depended on a decision this card owns** (the relay's third requirement
 * on #2470): move the bytes to a private bucket and the key stops being a
 * credential, so logging it is ordinary diagnostics; keep them public and serve
 * them owner-only, and the key must never be logged at all. This card read the
 * private evidence store at the code and found it **accepts `image/webp`
 * only** — an MP3 is `invalid_payload` there — so the bytes stay public behind
 * an owner-only route (`shared/voiceClipDelivery.ts` carries that reading), and
 * this is the second road.
 *
 * ⚠ **`REFUSING_KEYS` is the wrong tool for it and was measured to be**: this
 * was the ONLY log call in the server carrying `storageKey`, and
 * `shared/errorEventScrub.ts`'s own docblock records what a refusing key for a
 * field that cannot appear costs — *"it is a list nobody can trust"*. The fix
 * is the log line.
 *
 * What a diagnosis actually needs is which cast lost a clip; the key is one
 * row away for anyone who may read it.
 */
async function deleteClipQuietly(
  storageKey: string,
  cast: { userId: number; modelId: number },
): Promise<void> {
  try {
    await storageDelete(storageKey);
  } catch (error) {
    log.error(
      { err: error, userId: cast.userId, modelId: cast.modelId },
      "[Voice] an unclaimed clip could not be deleted — its key is on the cast's voice row",
    );
  }
}

/**
 * THE DELETION'S PROVIDER HALF — release every slot a cast's voices hold.
 *
 * Called by the deletion road with facts it read BEFORE its transaction, since
 * the transaction is about to remove the rows that name them. Returns what
 * happened per voice so a receipt can say it; never throws.
 */
export async function releaseVoiceSlots(
  voices: ReadonlyArray<{ voiceId: string | null }>,
  deps?: VoiceServiceDeps,
): Promise<{ attempted: number; released: number; orphaned: number }> {
  const resident = voices.filter((voice): voice is { voiceId: string } => Boolean(voice.voiceId));
  if (resident.length === 0) return { attempted: 0, released: 0, orphaned: 0 };
  const engine = engineFor(deps);
  let released = 0;
  for (const voice of resident) {
    if (await releaseSlotQuietly(engine, voice.voiceId)) released += 1;
  }
  return { attempted: resident.length, released, orphaned: resident.length - released };
}
