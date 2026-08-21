import { useEffect, useRef, useState } from "react";
import { Plus, RotateCw, X } from "lucide-react";

import type { InkProvenance } from "@shared/inkProvenance";

import { Button } from "@/foundation";
import {
  ATTACHED_PICTURE_LABEL,
  ATTACHED_PICTURE_NOTE,
  ATTACH_ACTION_LABEL,
  ATTACH_BUSY_LABEL,
  ATTACH_CLAIM_QUESTION,
  ATTACH_FAILED_FALLBACK,
  ATTACH_REMOVE_LABEL,
  SHOWN_CUT_LABEL,
  attachClaimChips,
} from "../referenceAttachCopy";
import { asBase64 } from "../pictureBytes";
import { READ_CAPTION, READ_USE, droppedNote } from "../referenceReadCopy";
import { SegmentsOnFace, type FaceRow } from "./SegmentsOnFace";
import { VersionRail } from "./VersionRail";
import type { PendingStage } from "../refineBusy";
import { waitExceeds } from "../waitNotice";

/**
 * Refining one face — the panel under the expanded picture (M8).
 *
 * **It lives in the viewer and nowhere else, on purpose.** Refining is a
 * judgement about ONE face made at a size where a face can actually be judged;
 * a refine control on a 178px tile would be asking people to adjust eyes they
 * cannot see. It is also why the viewer is the only place the stack of
 * variants appears.
 *
 * **The stack is linear, and there is no visualizer.** §14's tree is emergent
 * from prefix-sharing — every row is "this face plus these instructions" — and
 * a graph UI would be a picture of the data model rather than a thing anyone
 * needs. Selecting an earlier version and refining again branches from there;
 * that is the whole interaction.
 *
 * **The price is stated once, quietly, and never on the button** (D-15, D-109).
 * The literal never lives here — it arrives from the server's config, the same
 * way the roll and Sign prices do, so a price change is a deploy rather than a
 * client edit that gets missed.
 */
export type RefineVariant = {
  variantId: string;
  imageUrl: string | null;
  instructions: string[];
  /**
   * Where each instruction was FILED — subject headings only (D-149, as amended
   * by D-162).
   *
   * It shipped printed under every chip, moved to a hover tooltip when the
   * founder said filing is the SYSTEM explaining itself, and is now shown
   * NOWHERE on this surface (fable-753 §2a): *"when i hover over a thumbnail it
   * shows me filed as teeth and the prompt — can we remove this."* A misfile
   * still corrupts the record and not just one picture, so filing stays
   * inspectable — in the record, not hovered over the customer's own picture.
   *
   * The field stays on the type because the rail still receives it and the next
   * inspection surface will want it; nothing renders it today.
   */
  filedAs?: string[];
  /**
   * WHAT SHE ASKED FOR, in her own words — and on a removal this is NOT the
   * last instruction, because a removal deletes steps rather than appending
   * one. The composer chip reads it exactly as the rail's label does.
   */
  requestText?: string | null;
  /**
   * THE PICTURES THIS VERSION WAS MADE FROM (his ask, 1264 §1).
   *
   * Three fields and no more — the server's `referencesOf` lifts exactly these
   * out of the recipe the render was actually sent, and the prompt, the digest
   * and the geometry stay on the inside. Optional because every paste-road row
   * and every row landed before the recipe was stored has none, and the panel
   * reads that as nothing to show.
   */
  references?: Array<{ url: string; kind: string; slot: string | null }>;
};

/**
 * A refinement that is still running, read from the SERVER (D-161).
 *
 * The panel used to know this only from its own mutation state, so closing the
 * sheet erased it — and the founder, seeing nothing in flight, bought the same
 * edit again. Both renders arrived and both charges stand; the defect was the
 * false belief, so the fix is that the fact outlives the component.
 */
export type PendingRefine = {
  variantId: string;
  instruction: string;
  startedAt: string | Date;
  /**
   * How long it has waited, subtracted on the side that owns the clock
   * (fable-670).
   *
   * `startedAt` stays because the caption and the rail want the moment; the
   * DECISION below wants a duration, and a duration this side derived from
   * `startedAt` would be the server's clock minus the browser's. Optional
   * because a payload from before the field is not a long wait, it is an
   * unknown one — see `waitNotice.ts`.
   */
  waitedMs?: number;
  /**
   * How far along it is, from the row rather than from a guess (D-169).
   *
   * `queued` is claimed-not-yet-sent, `dispatched` is the image model has it.
   * After that there is silence until the picture lands, which is the whole
   * reason this surface shows no percentage — and there is still no third
   * point on that line.
   *
   * `settling` is a different question answered: the operation's lease has
   * passed, nobody is rendering the row, and the recovery sweep is refunding
   * it (fable-467). It is not progress; it is who holds the row.
   */
  stage?: PendingStage;
  /**
   * The version this one is REDRAWING, when it is redrawing one (fable-703).
   *
   * A fresh take replaces a version rather than adding one, so there is no new
   * chip for a ghost to stand in for — the wait belongs on the chip already
   * there. Null on an ordinary edit, which is the ghost's own case.
   */
  regenerating?: string | null;
};

/**
 * A question the panel is waiting on an answer to (D-178/179/180).
 *
 * The chips are the fast path and never the only one: each carries the exact
 * label the server resolves, so tapping one and typing it are the same request.
 */
export type RefineReask = {
  question: string;
  options: ReadonlyArray<{ label: string; resolves: string }>;
};

/**
 * When a wait stops being ordinary and starts needing a sentence.
 *
 * The roll's own number, and the same reasoning: past this point the honest
 * thing is to say the wait is long and name the outcome, so it reads as
 * supervised rather than broken.
 *
 * Compared against `waitedMs`, which the server subtracts off its own clock —
 * never against this browser's `Date.now()` minus a server timestamp. That was
 * the defect fable-670 closed; `waitNotice.ts` carries the whole story.
 */
/*
  MOVED 2 min → 5 min, 2026-08-16 (founder: *"yes make it honest"*).

  At two minutes this note fired inside the ORDINARY case: the census reads the
  median edit at 204 s dev / 209 s prod, so "taking longer than usual" was the
  usual, printed under a viewer line that said "usually a minute or two". Both
  halves were wrong in opposite directions and they shared a screen.

  Five minutes is past the p90 of the measured distribution, so the note now
  means what it says. Its PAIR is `TYPICAL_WAIT` in `CandidateViewer.tsx`; they
  moved in one commit and are re-measured together whenever the speed changes.
*/
const LONG_WAIT_MS = 5 * 60 * 1000;

export function RefinePanel({
  variants,
  pending = [],
  selectedVariantId,
  originalImageUrl,
  originalThumbUrl,
  priceCredits,
  busy,
  onRefine,
  onSelect,
  onRemove,
  outcome,
  reask,
  shownCut,
  onDismissOutcome,
  kept = [],
  keptPossessive = "their",
  draft,
  onDraft,
  stackHoisted = false,
  regenerates = null,
  offer = null,
  onAdopt,
  attachPicture = null,
}: {
  variants: readonly RefineVariant[];
  /** Refinements still running, from server truth — survives remount (D-161). */
  pending?: readonly PendingRefine[];
  /** Null means the original is the face. */
  selectedVariantId: string | null;
  originalImageUrl: string | null;
  /** The master's small copy — the rail draws it where a version has one. */
  originalThumbUrl?: string | null;
  priceCredits: number;
  /** A refine is in flight — for this face or any other on the sheet. */
  busy: boolean;
  /**
   * `scope` is the one instance the ask is about, and only a REPLAY sends one
   * from here — the box below is a typed sentence, which scopes nothing
   * (fable-444 ruling C). The picture's rectangles are the other door onto it.
   *
   * `replayOf` is the third thing a fresh take carries, and it travels for the
   * same reason the scope does: a replay is not the sentence, it is the
   * sentence PLUS what it is a replay of. Absent on every typed ask.
   */
  /*
    AND THE PICTURE SHE ATTACHED TO THIS ASK — the handle, fourth and last
    (`UNIVERSAL_REFERENCE_ROAD_DESIGN.md` §10).

    It travels with the SENTENCE because the sentence is the instruction: the
    road reads what she typed and decides what her picture contributes. Absent
    on every ask with no picture on it, which is most of them — and absent, not
    null, for the same reason `scope` is: the wire has no field for "no
    reference", and sending one would be a handle naming nothing.
  */
  onRefine: (instruction: string, scope?: string, replayOf?: string, referenceId?: string) => void;
  onSelect: (variantId: string | null) => void;
  /**
   * Remove one instruction from the middle of the stack — a PAID re-render.
   *
   * D-121 requires that this and backing-up never look alike, and the founder
   * could not find it at all: back-up is free navigation between pictures that
   * already exist, while removing a mid-stack instruction is a new combination
   * and therefore a new generation. Two different things must look like two
   * different things, and the price is what says which is which.
   */
  onRemove?: (variantId: string) => void;
  /**
   * The last failure or refusal, owned BY THIS PANEL (D-154).
   *
   * D-110's own law applied here: a live surface owns its outcomes. The
   * founder's first failed refine arrived as a long unreadable toast and was
   * gone before it could be read — and refusal copy that carefully names its
   * wall is worthless at 2.1 seconds. This stays until dismissed.
   */
  outcome?: string | null;
  /**
   * The answers to the outstanding question, as chips (D-180).
   *
   * Present only while a question is open. The sentence itself arrives through
   * `outcome`, because a question is an outcome that happens to end in a
   * question mark — same frame, same voice, same dismiss.
   */
  reask?: RefineReask | null;
  /**
   * THE CUT SHE IS BEING SHOWN, when the answer is about one (ruled fable-1127
   * §2, brought to road (D) by fable-1156).
   *
   * The cutter takes the artwork out of the photograph she attached, and the
   * reader that judges what it took CANNOT SEE fine sparse detail — so her eyes
   * are the only check between the cut and her money. The question above it
   * asks *"use it?"*, and a question about a picture nobody can see is not a
   * question.
   *
   * An APP path, not an image URL: the bytes sit at a permanently public
   * storage key and what keeps them private is that the key is never handed
   * out, so this is an authenticated route the browser fetches with her own
   * cookie. The server builds it — this only draws it.
   */
  shownCut?: string | null;
  onDismissOutcome?: () => void;
  /**
   * What this version is keeping — read-only, and empty until the segment store
   * is armed for this account. Absent or empty renders nothing at all.
   */
  kept?: readonly FaceRow[];
  /**
   * The selected version's OWN request, or null on the original — what a fresh
   * take would ask for again. The server owns it; this only carries it back.
   *
   * The words AND the rectangle they were said at, together, because a pointed
   * ask is both (fable-704): re-sending the sentence on its own is how
   * Regenerate came to hand the sentence lane a side named with nothing pointed
   * at, and be refused for it. `scope` is null on every typed ask, which is
   * most of them, and on every version landed before the record existed.
   */
  regenerates?: { instruction: string; scope: string | null; variantId: string } | null;
  /**
   * This face's own possessive, from the server — see `SegmentsOnFace`.
   *
   * Defaults to "their", which is the honest word for a face whose record
   * cannot say, and is never seen anyway: with no kept rows the panel does not
   * render at all.
   */
  keptPossessive?: string;
  /**
   * THE ASK BOX'S TEXT, HELD ABOVE THIS PANEL — because it now has three doors.
   *
   * Typing here is one; tapping a row in the face panel is another, and that
   * panel no longer lives inside this component (it stands beside the picture,
   * where the founder's mock puts it and where its length cannot starve the
   * photograph); clicking the feature on the picture is the third. A draft owned
   * by one of the three doors is a draft the other two cannot open.
   */
  draft: string;
  onDraft: (value: string) => void;
  /**
   * The versions are drawn ELSEWHERE — the rail beside the picture.
   *
   * True whenever the viewer is in the three-column shape the founder specified.
   * The stack is not duplicated and not deleted: it is the same component,
   * rendered by whoever owns the column it stands in.
   */
  stackHoisted?: boolean;
  /**
   * A SENTENCE READ OFF THE PICTURE SHE ATTACHED — free, and nothing has
   * happened yet (the words lane, ruled fable-1103 §1).
   *
   * It arrives on the refine's own answer rather than through a control of its
   * own, which is the whole re-skin: there is no *"take the makeup from a
   * photo"* link any more, because the SENTENCE is the instruction and the road
   * decides what her picture contributes. She attached a picture and asked for
   * a colour or a look; a reader spoke for it; this is what it said.
   *
   * PREFILL ONLY, NEVER SEND — see {@link onAdopt}.
   */
  offer?: {
    sentence: string;
    /** What the reading could not fit, NAMED — she can type it herself. */
    dropped: string[];
  } | null;
  /**
   * She picked the sentence up. It FILLS THE BOX AND STOPS.
   *
   * Spending her credits is a deliberate act and stays one, and if she sends
   * the sentence unchanged it travels as an ordinary ask at the ordinary price
   * through the same doors as anything she typed by hand. That is also the only
   * shape in which the road is legal: `refineDelta` has required since D-171
   * that the value appear in the CUSTOMER'S OWN instruction, so a sentence
   * routed silently from a reader into a render would be refused by a guard
   * that has stood there for months.
   *
   * The page owns it rather than this panel, because adopting also arms the
   * provenance the next ask carries — the panel writes words, not facts.
   */
  onAdopt?: (sentence: string) => void;

  /**
   * ATTACHING A PICTURE — the one universal door (founder ruling, fable-1051).
   *
   * ABSENT rather than disabled outside the scope, like every other capability
   * on this panel: `reference.attach` answers NOT_FOUND there, so a drawn `+`
   * would be a control that refuses. The server owns the gate; the client asks.
   *
   * A FUNCTION rather than a flag, so the panel stays presentational — the page
   * owns the mutation, this owns where the picture appears and what rides with
   * the sentence.
   */
  attachPicture?: ((input: {
    imageBase64: string;
    provenance: InkProvenance;
  }) => Promise<{ referenceId: string }>) | null;
}) {
  const instruction = draft;
  const setInstruction = onDraft;
  const trimmed = instruction.trim();

  /*
    THE PICTURE ON THIS ASK (design §10; founder ruling fable-1051).

    Held HERE rather than above the panel, unlike the draft, because it has ONE
    door: the `+` in the box's own row. The draft is lifted because three
    surfaces write to it and a draft owned by one of them is a draft the other
    two cannot open — no such thing is true of the picture.

    It is keyed to the face by the panel's own `key`, so walking the viewer with
    ←/→ cannot carry one person's reference onto the next person's ask.
  */
  const pictureInput = useRef<HTMLInputElement | null>(null);
  const [picture, setPicture] = useState<{
    /** For the eye only — an object URL, never sent anywhere. */
    url: string;
    imageBase64: string;
    /**
     * The handle, once the door has taken it. **Null while she has not yet said
     * where the picture came from**, which is the whole reason this is one
     * state rather than two: the chip is on screen the moment she picks a file
     * (his Grok reference), and it is not yet a reference anybody can ask
     * against.
     */
    referenceId: string | null;
  } | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [attachRefusal, setAttachRefusal] = useState<string | null>(null);
  /*
    THE PREVIEW IS A LIVE OBJECT URL, so it is released — on replacement and on
    removal below, and here for the case neither of those happens: she closes
    the viewer, or walks to the next face, with a photograph still attached.
    A ref rather than the state itself, because an effect that depended on the
    picture would revoke the URL the moment she claimed it.
  */
  const liveUrl = useRef<string | null>(null);
  liveUrl.current = picture?.url ?? null;
  useEffect(() => () => {
    if (liveUrl.current) URL.revokeObjectURL(liveUrl.current);
  }, []);

  function dropPicture(): void {
    if (picture) URL.revokeObjectURL(picture.url);
    setPicture(null);
    setAttachRefusal(null);
  }

  async function claimPicture(provenance: InkProvenance): Promise<void> {
    if (!picture || !attachPicture) return;
    setAttaching(true);
    setAttachRefusal(null);
    try {
      const { referenceId } = await attachPicture({ imageBase64: picture.imageBase64, provenance });
      setPicture((held) => (held ? { ...held, referenceId } : held));
    } catch (error) {
      /* The server's own sentence, unchanged — every refusal this door has is
         spoken (too large, too small, not an image, the cap). A client that
         re-worded one is how two surfaces come to say different things about
         one wall. */
      setAttachRefusal(
        error instanceof Error && error.message ? error.message : ATTACH_FAILED_FALLBACK,
      );
    } finally {
      setAttaching(false);
    }
  }

  /*
    A CHOSEN PICTURE THAT IS NOT YET A REFERENCE HOLDS THE ASK.

    The alternative is worse than a disabled button: sending anyway would drop
    her picture in silence and answer about a sentence she did not think she was
    asking alone. The question that unblocks it is two taps away, directly above
    the box, which is why nothing else has to be said here.
  */
  const pictureUnclaimed = picture !== null && picture.referenceId === null;
  /*
    ARE THEY ABOUT TO BUY THE SAME EDIT TWICE? (D-161)

    This is exactly what happened: a slow "copper hair", a closed sheet, no
    visible pending state, and the founder typed it again. The ghost chip is the
    main fix; this is the one that speaks up at the moment the money would move.
    It WARNS and never blocks — asking for the same thing twice is a legitimate
    thing to want, and a product that refuses it is guessing at intent.
  */
  const duplicateOf = pending.find(
    (entry) => entry.instruction.trim().toLowerCase() === trimmed.toLowerCase() && trimmed,
  );
  /*
    THE SENTENCE THAT MADE THE SELECTED VERSION (fable-753 §2b).

    Read the way the rail's own label reads it — `requestText` first, then the
    last surviving instruction — because those two differ on a REMOVAL and two
    spellings of "what she asked for" is exactly the drift D-162 is made of.
  */
  const selected = variants.find((variant) => variant.variantId === selectedVariantId);
  const selectedRequest = selected
    ? (selected.requestText ?? selected.instructions.at(-1) ?? null)
    : null;
  /*
    AND THE PICTURES IT WAS MADE FROM (his ask, 1264 §1 — the Grok layout he
    pointed at, chips above the ask).

    Read off the SAME selected version as the sentence beside them, so the two
    halves of "what made this" can never describe different rows. Empty is the
    ordinary answer for a paste-road version and for anything landed before the
    recipe was stored, and an empty list draws nothing rather than an empty
    frame.
  */
  const selectedReferences = selected?.references ?? [];
  return (
    <div className="dpc-refine" onClick={(event) => event.stopPropagation()}>
      {/*
        THE STACK, unless the caller has hoisted it to the rail beside the
        picture (fable-206, on the founder's own sentence: thumbnails left,
        segments right, only the chatbox at the bottom). Same component either
        way — a second copy laid out differently is two answers to "which
        version am I looking at".
      */}
      {stackHoisted ? null : (
        <VersionRail
          variants={variants}
          pending={pending}
          selectedVariantId={selectedVariantId}
          originalImageUrl={originalImageUrl}
          originalThumbUrl={originalThumbUrl ?? null}
          onSelect={onSelect}
          layout="row"
        />
      )}

      {/*
        A LONG WAIT SAYS SO, AND NAMES THE OUTCOME.

        The roll's own law, on a refine's own clock: past `LONG_WAIT_MS` the
        honest thing is to admit the wait is unusual and say what happens if it
        never lands, so it reads as supervised rather than broken. Credits
        genuinely do come back.

        The number is NOT repeated here. This sentence said "past about two
        minutes" and went on saying it after the constant moved to five
        (2026-08-16) — a second copy of a fact drifting from the first, which is
        law 4 at the scale of a comment. It names the constant instead.
      */}
      {/*
        AND IT GOES WHEN NOTHING IS COMING (fable-460's sibling, found by
        photographing the settling frame).

        A settling row is old by construction — its lease is five minutes long —
        so this note fired over it and promised *"it'll appear here when it
        lands"* directly under a picture saying "this one didn't make it". Two
        sentences about one row, disagreeing. The picture is the one that knows,
        and it is on screen either way, so this stands down rather than being
        rewritten into a second copy of it.
      */}
      {pending.some((entry) => waitExceeds(entry.waitedMs, LONG_WAIT_MS))
        && !pending.every((entry) => entry.stage === "settling") ? (
        <p className="dpc-refine__note">
          This one is taking longer than usual. It'll appear here when it lands, and if it
          doesn't arrive your credits come back on their own.
        </p>
      ) : null}

      {outcome ? (
        <div className="dpc-refine__outcome" role="status">
          <span>{outcome}</span>
          <button
            type="button"
            className="dpc-refine__dismiss"
            aria-label="Dismiss"
            onClick={onDismissOutcome}
          >
            ×
          </button>
        </div>
      ) : null}

      {/*
        THE CUT, ABOVE THE ANSWERS IT IS ABOUT (ruled fable-1127 §2; road (D)'s
        instance fable-1156 §2).

        It sits between the question and its chips because that is the order the
        decision is made in — read the sentence, look at the design, tap. A
        picture below its own answers would be a picture nobody looked at before
        answering.

        `no-store` on the route and no thumbnail cache here: it is one person's
        design, fetched with her own session, and drawn at the size of the chip
        row rather than the size of the file. The route refuses to serve bytes
        whose sha256 is not the one the row records, so what she is looking at
        is the object we would paint from — a viewer is an instrument too.
      */}
      {shownCut ? (
        <div className="dpc-refine__shownCut">
          <img src={shownCut} alt={SHOWN_CUT_LABEL} />
        </div>
      ) : null}

      {/*
        THE ANSWERS, AND THEY ARE THE TYPED PATH (D-180).

        A chip submits its own LABEL, which is exactly what someone typing the
        answer would send — so the two routes are one code path on the server
        and neither can drift from the other. The box stays live beside them:
        chips are the fast way to answer, never the only way.
      */}
      {reask && reask.options.length > 0 ? (
        <div className="dpc-refine__answers">
          {reask.options.map((option) => (
            <button
              key={option.label}
              type="button"
              className="dpc-refine__answer"
              disabled={busy}
              /*
                AND THE PICTURE RIDES WITH THE ANSWER, exactly as it rides with
                a typed one (found at the client 2026-08-20, opus-857).

                The comment above says a chip sends what someone typing the
                answer would send. That was FALSE for the one thing a question
                can be about: the form below passes `picture?.referenceId` and
                this button passed nothing — so a question raised ABOUT an
                attached picture could not be answered by tapping it. The answer
                arrived with no reference, the branch that asked it did not fire,
                and the sentence carried on as an ordinary ask.

                It is D-180's dead end wearing a tap target, and it arrived the
                moment a question was raised about a reference — the side
                question is the first, and every later one inherits the fix.
              */
              onClick={() => onRefine(option.label, undefined, undefined, picture?.referenceId ?? undefined)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      {/*
        WHAT SHE IS KEEPING — panel v1, immediately above the box it writes into
        (fable-113). Tapping a row prefills the ask, so the row and the field it
        fills are adjacent and the cause of the text appearing is visible in one
        glance.

        Panel v2 is NOT here. It is the whole catalogue rather than a short list
        of what one version keeps, and at that length it belongs beside the
        picture instead of under it — `CandidateViewer`'s `beside`. The caller
        hands this one an empty list whenever v2 is armed, so the two are never
        two answers to one question.
      */}
      <SegmentsOnFace
        rows={kept}
        possessive={keptPossessive}
        onPrefill={(prefill) => setInstruction(prefill)}
      />

      {/*
        WHAT MADE THE VERSION SHE IS LOOKING AT (founder, screenshots #317–319,
        fable-753 §2b — the Grok pattern he pointed at).

        The rail's captions and its hover tooltip both said this, in 10.5px at
        72% opacity under a thumbnail and in a browser tooltip over her picture.
        Both are gone. The sentence has one home now, next to the box it can be
        typed back into — which is the difference between a label and a
        capability: reading "give her vampire fangs" under a thumbnail is a
        caption; having it beside the composer with a way to pick it up again is
        the thing she actually wants to do with it.

        PREFILL ONLY, NEVER SEND. Spending her credits is a deliberate act and
        stays one — `Use` fills the box and stops, so the sentence is hers to
        edit, and if she sends it unchanged the duplicate warning below still
        fires exactly as it does for anything typed by hand.

        Absent on the original, which nobody asked for and which has no sentence
        to show.
      */}
      {selectedRequest ? (
        <div className="dpc-refine__made">
          {/*
            THE PICTURES, BEFORE THE SENTENCE — his own layout (1264 §1).

            They sit at the head of the line the way the attached picture sits
            at the head of the box, because both answer the same question: what
            is the product looking at. Same 32px square as that one, from the
            same class, so there is one size for a thumbnail in this panel
            rather than two that drift (fable-1101 §3 pinned it).

            The title is the slot when there is one and the kind otherwise —
            *what this picture was FOR* — which is the only thing we can say
            without a catalogue the client does not have.
          */}
          {selectedReferences.map((reference) => (
            <span
              key={reference.url}
              className="dpc-refine__thumb dpc-refine__madeRef"
              title={reference.slot ?? reference.kind}
            >
              <img src={reference.url} alt="" />
            </span>
          ))}
          <span className="dpc-refine__madeText">{selectedRequest}</span>
          <button
            type="button"
            className="dpc-refine__madeUse"
            disabled={busy}
            onClick={() => setInstruction(selectedRequest)}
          >
            Use
          </button>
        </div>
      ) : null}

      {/*
        THE PICTURE, ABOVE THE INPUT AND INSIDE THE BOX (his Grok reference,
        fable-1051 §1; the size pinned at 32px by fable-1101 §3).

        It appears the instant she picks a file, before the door has taken it —
        because a picker that swallows a photograph for a second and then shows
        it reads as a hang. What arrives with it is the fence's own question.
      */}
      {picture ? (
        <div className="dpc-refine__attached">
          <div className="dpc-refine__attachedRow">
            <span className="dpc-refine__thumb">
              <img src={picture.url} alt={ATTACHED_PICTURE_LABEL} />
            </span>
            <button
              type="button"
              className="dpc-refine__attachedOff"
              aria-label={ATTACH_REMOVE_LABEL}
              title={ATTACH_REMOVE_LABEL}
              disabled={attaching}
              onClick={dropPicture}
            >
              <X size={12} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>

          {/*
            WHERE IT CAME FROM — asked once per picture and never remembered.

            `attach` takes `synthetic | consented` and has no default by ruling:
            a guessed provenance is the one value the real-person fence cannot
            carry. An answer inherited from her last attach would be a claim
            about THIS picture that nobody made, so this row appears every time
            and the chips are derived from the enum rather than typed beside it.
          */}
          {picture.referenceId === null ? (
            <div className="dpc-refine__claim">
              <span className="dpc-refine__claimAsk">{ATTACH_CLAIM_QUESTION}</span>
              {attachClaimChips().map((chip) => (
                <button
                  key={chip.provenance}
                  type="button"
                  className="dpc-refine__answer"
                  disabled={attaching || busy}
                  onClick={() => void claimPicture(chip.provenance)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="dpc-refine__note">{ATTACHED_PICTURE_NOTE}</p>
          )}

          {attachRefusal ? (
            <p className="dpc-refine__readNote">{attachRefusal}</p>
          ) : null}
        </div>
      ) : null}

      <form
        className="dpc-refine__ask"
        onSubmit={(event) => {
          event.preventDefault();
          if (!trimmed || busy || pictureUnclaimed) return;
          /* The handle rides with the sentence, and only when there is one:
             `undefined` rather than null, because the wire has no field for
             "no reference". */
          onRefine(trimmed, undefined, undefined, picture?.referenceId ?? undefined);
          setInstruction("");
        }}
      >
        {/*
          THE ONE ATTACH AFFORDANCE — a `+` at the left of the box's own row,
          where a stylist's hands already are (design §6).

          No label, no tooltip chrome, no toolbar, and NO FEATURE IN ITS NAME:
          the sentence is the instruction, and a control that said what to
          attach a picture FOR would rebuild the per-feature entry point the
          founder deleted.

          Absent unless the page hands it a door, like the Regenerate button and
          the photograph read below it — outside the scope the procedure answers
          NOT_FOUND, and a drawn control that can only refuse is not a control.
        */}
        {attachPicture ? (
          <>
            <input
              ref={pictureInput}
              type="file"
              /* The three the door accepts. The BYTES are judged server-side
                 either way — this only spares her choosing a file that will be
                 refused. */
              accept="image/png,image/jpeg,image/webp"
              className="dpc-refine__readInput"
              onChange={(event) => {
                const file = event.target.files?.[0];
                /* Cleared before anything else, so choosing the SAME file twice
                   fires again — a picker that ignores a repeat looks broken. */
                event.target.value = "";
                if (!file) return;
                if (picture) URL.revokeObjectURL(picture.url);
                setAttachRefusal(null);
                void asBase64(file).then((imageBase64) => {
                  setPicture({ url: URL.createObjectURL(file), imageBase64, referenceId: null });
                }).catch(() => setAttachRefusal(ATTACH_FAILED_FALLBACK));
              }}
            />
            <button
              type="button"
              className="dpc-refine__attach"
              aria-label={attaching ? ATTACH_BUSY_LABEL : ATTACH_ACTION_LABEL}
              title={ATTACH_ACTION_LABEL}
              disabled={busy || attaching}
              onClick={() => pictureInput.current?.click()}
            >
              <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </>
        ) : null}
        <input
          className="dpc-refine__field"
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder="Change something about them…"
          maxLength={200}
          disabled={busy}
          aria-label="What to change about this person"
        />
        <Button type="submit" size="small" disabled={!trimmed || busy || pictureUnclaimed}>
          {busy ? "Refining…" : "Refine"}
        </Button>
        {/*
          REGENERATE — the founder's own ask (2026-08-15), after Grok's
          dedicated action.

          It is a SECOND DOOR ONTO ONE MACHINERY (law 4), not a second
          implementation: it submits this version's own words, which the service
          recognises as a repeat and answers with the offer — the same question,
          the same price, the same confirm as typing it again. Nothing about
          money or replacement is decided here.

          So the label carries no price (D-109): the price is in the question
          this raises, before anything is claimed.

          It is absent on the ORIGINAL, because there is no edit to re-roll —
          absent rather than disabled, since a control that can never apply to
          the thing on screen is not a control that is temporarily unavailable.
        */}
        {regenerates ? (
          <Button
            type="button"
            /*
              SECONDARY, NOT QUIET — the first version was a ghost.

              Photographed in the running app, "Refine" read clearly and
              "Regenerate" was barely legible: a quiet button sits on the
              viewer's dimmed dock, where quiet means invisible. The founder
              asked for the DIRECTNESS of a dedicated action, and a control
              nobody can see is not one.
            */
            variant="secondary"
            size="small"
            disabled={busy}
            /* The request, replayed — the sentence, the instance it was said
               at, and WHICH VERSION it is a fresh take of. `?? undefined`
               because the wire has no field for "no rectangle": absent IS the
               whole-feature ask (fable-444 ruling C), and sending null would be
               a scope naming nothing.

               The version id is the replay marker (fable-733 §2). Without it
               the server cannot tell this press from somebody typing the same
               sentence, and the doors that refuse because she already has the
               thing fire on the one control whose whole meaning is asking
               again. It is named, not asserted: the server checks it against
               the row before any door listens to it. */
            onClick={() => onRefine(
              regenerates.instruction,
              regenerates.scope ?? undefined,
              regenerates.variantId,
            )}
            title={`A fresh take of "${regenerates.instruction}"`}
          >
            <RotateCw size={12} strokeWidth={2} aria-hidden="true" />
            Regenerate
          </Button>
        ) : null}
      </form>

      {/*
        THE SENTENCE READ OFF HER PICTURE — and it is an OFFER, not an outcome.

        It sits BELOW the box, where the makeup link's answer used to sit and
        for the same reason: the chip above is about the version already on
        screen, and this is about a picture she attached to the ask she has not
        sent yet. Same promise either way — it fills the box and stops.

        Nothing here is a control that could be absent outside a scope: the
        offer arrives on the road's own answer, so a road that does not serve
        this account simply never sends one.
      */}
      {offer ? (
        <div className="dpc-refine__readResult">
          {/* WHAT THIS IS, before the sentence — past tense, about the PICTURE,
              and it says outright that nothing has changed. */}
          <p className="dpc-refine__readCaption">{READ_CAPTION}</p>
          <div className="dpc-refine__made">
            <span className="dpc-refine__madeText">{offer.sentence}</span>
            <button
              type="button"
              className="dpc-refine__madeUse"
              disabled={busy}
              onClick={() => (onAdopt ?? setInstruction)(offer.sentence)}
            >
              {READ_USE}
            </button>
          </div>
          {/* NAMED, never counted: the only useful thing she can do with this
              is type the missing one herself. */}
          {droppedNote(offer.dropped) ? (
            <p className="dpc-refine__readNote">{droppedNote(offer.dropped)}</p>
          ) : null}
        </div>
      ) : null}

      {/*
        The quiet meta line. It says what refining can do BEFORE someone types
        something it cannot, which is worth more than a refusal after the fact —
        and it carries the price where a price belongs.
      */}
      {/* Said BEFORE the money moves, not after — the one moment it helps. */}
      {duplicateOf ? (
        <p className="dpc-refine__note dpc-refine__note--warn">
          You already have this one running. Refining again buys a second version of it.
        </p>
      ) : null}

      {/*
        It says what the box can do BEFORE someone types something it cannot,
        which is worth more than a refusal after the fact — and taking something
        back belongs here, because Remove has no other home (D-163). Undoing is
        free and the line says so, or nobody types it.
      */}
      <p className="dpc-refine__note">
        Anything about them — not their clothes or the room · {priceCredits} credits each
      </p>
      <p className="dpc-refine__note">
        Or take something back — "undo", "remove the earrings" · free when you already have it
      </p>
    </div>
  );
}
