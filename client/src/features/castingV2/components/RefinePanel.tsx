import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { displayPrice, formatCredits } from "@shared/creditDisplay";
import { Plus, RotateCw, X } from "lucide-react";

import type { InkProvenance } from "@shared/inkProvenance";
import { REFINE_INSTRUCTION_MAX_LENGTH } from "@shared/refineLimits";

import { Button } from "@/foundation";
import { useFileDropTarget } from "@/foundation/useFileDropTarget";
import {
  ATTACHED_PICTURE_LABEL,
  ATTACHED_PICTURE_NOTE,
  ATTACH_ACTION_LABEL,
  ATTACH_BUSY_LABEL,
  ATTACH_CLAIM_QUESTION,
  ATTACH_DROP_WORD,
  ATTACH_FAILED_FALLBACK,
  ATTACH_REMOVE_LABEL,
  SHOWN_CUT_LABEL,
  attachClaimChips,
} from "../referenceAttachCopy";
import { ACCEPTED_PICTURE_FILES, asBase64 } from "../pictureBytes";
import { READ_CAPTION, READ_USE, droppedNote } from "../referenceReadCopy";
import {
  SPOTLIGHT_NOTHING_THERE,
  SPOTLIGHT_TAKING_LABEL,
  SPOTLIGHT_UNNAMED_LABEL,
  letGoLabel,
} from "../referenceSpotlightCopy";
import {
  settleOpen,
  settleTap,
  withinStall,
  type SpotlightOpenAnswer,
  type SpotlightTapAnswer,
  type SpotlightView,
  type TakenPiece,
} from "../spotlightSurface";
import { SpotlightStage, cutThumbnail, pictureSize } from "./SpotlightStage";
import { VersionRail } from "./VersionRail";
import type { PendingStage } from "../refineBusy";
import { waitExceeds } from "../waitNotice";

/** How tall the ask box may grow before it scrolls, in lines. */
const FIELD_MAX_LINES = 3;

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
  /**
   * THE HANDLE THAT BRINGS HER PICTURE BACK (founder ruling fable-1419 §2,
   * ordered fable-1421 §2).
   *
   * His sentence: *"when i press use im essentially regenerating the exact same
   * prompt + reference image i used to generate this image."* The thumbnails
   * above say what she gave this render; this is what lets *Use* give it again.
   *
   * Null on every ask with no picture, and on every row landed before the
   * handle was written down — read as *nothing to bring back*, which is the
   * behaviour those rows have today.
   */
  askReferenceId?: string | null;
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
  median paid edit at 204 s in dev (n=56) and 209 s in production (n=4) —
  `docs/specs/EDIT_LATENCY_READING_2026-08-16.md` — so "taking longer than
  usual" was the usual, printed under a viewer line that said "usually a minute
  or two". Both halves were wrong in opposite directions and they shared a
  screen.

  (The denominators and the document moved here from `CandidateViewer.tsx` on
  2026-09-26, when the viewer's sentence was deleted on his word. The figure is
  what justifies the five minutes below, so it belongs beside the number it
  justifies rather than beside the copy that no longer exists.)

  Five minutes is past the p90 of the measured distribution, so the note now
  means what it says.

  ⚠ IT NO LONGER HAS A PAIR, AND THAT IS THE REPAIR RATHER THAN A LOSS (#55,
  2026-09-26). This block read "its PAIR is `TYPICAL_WAIT` in
  `CandidateViewer.tsx`; they moved in one commit" — two sentences on one screen
  about one wait, kept in step by a rule nobody enforced except by remembering.
  The founder removed the viewer's half outright while drawing the loader
  (*"dont put the excpected time either"*), so the picture now promises no
  duration at all and there is nothing left for this to disagree with.

  THIS IS NOT AN EXPECTED TIME, WHICH IS WHY IT SURVIVED HIS RULING. It says a
  wait has become unusual and names the outcome; it never says how long one
  takes. The reading above is still what justifies the number and is still
  re-measured here when the speed changes — this constant is now the only place
  in the product that holds it.
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
  draft,
  onEditIntent,
  onDraft,
  stackHoisted = false,
  regenerates = null,
  offer = null,
  onAdopt,
  attachPicture = null,
  spotlight = null,
}: {
  variants: readonly RefineVariant[];
  /** Refinements still running, from server truth — survives remount (D-161). */
  pending?: readonly PendingRefine[];
  /** Null means the original is the face. */
  selectedVariantId: string | null;
  originalImageUrl: string | null;
  /** The master's small copy — the rail draws it where a version has one. */
  originalThumbUrl?: string | null;
  /**
   * ⚠ **`null` IS "NOT READ YET", NEVER "FREE" — #1727.** The sheet's settings
   * query races the roll query on mount and can fail outright, so this arrives
   * unread; under `?? 0` the rail's note read **`0 credits each`** beside a box
   * that spends 500 credits a go. Since #1952 the price is on the Refine button
   * alone, and the button reads plain `Refine` while this is `null`.
   */
  priceCredits: number | null;
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
   * THE FIRST SIGN THAT SOMEBODY MEANS TO EDIT THIS FACE — #2525, his word
   * 2026-10-15: *"what if someone had to deliberatly hit edit or refine before
   * it scans the face"*.
   *
   * Called when the ask box takes focus, which is the earliest honest moment:
   * the customer has reached for the field and will spend five or ten seconds
   * typing, which is longer than the read takes. The page uses it to arm the
   * face scan; this component neither knows nor cares what it buys.
   *
   * It is FOCUS rather than the first keystroke on purpose — the whole point is
   * to spend those typing seconds on the read, and a change handler would give
   * them away. **Optional**, so a caller that has nothing to arm passes
   * nothing, and this panel stays presentational.
   */
  onEditIntent?: () => void;
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

  /**
   * THE SPOTLIGHT ON AN ATTACHED PICTURE — #14 slice 3b.
   *
   * ABSENT rather than disabled outside `CASTING_REFERENCE_SELECTOR_SCOPE`,
   * the same doctrine as `attachPicture` above it: both procedures answer
   * NOT_FOUND there, so a picture that opened and waited would be a control
   * that can only refuse. Absent, the attach looks and works exactly as it did
   * before this slice — which is also what it does whenever a picture will not
   * light (§3 item 1's fail-open).
   *
   * Two functions, owned by the page like every other call this panel makes:
   * `open` reads the attached picture into pieces once, `tap` takes what is
   * under a point and names it. Neither spends a credit, and nothing either
   * one answers reaches the ask in this slice — the chip is where it ends
   * (§9: the tap's cut rides the ask in slice 4).
   */
  spotlight?: {
    open: (referenceId: string) => Promise<SpotlightOpenAnswer>;
    tap: (referenceId: string, at: { x: number; y: number }) => Promise<SpotlightTapAnswer>;
  } | null;
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
  /* The chip's pictures that would not load — see the tile below. Kept per
     panel rather than per version: a url that failed once fails again, and
     re-drawing the glyph on every version change is the flicker this exists to
     remove. */
  const [unshowable, setUnshowable] = useState<readonly string[]>([]);
  const [attaching, setAttaching] = useState(false);
  const [attachRefusal, setAttachRefusal] = useState<string | null>(null);
  /*
    THE BOX IS A DROP TARGET (#2912) — one hook call for this one zone, and the
    counting is NOT this file's to own.

    `foundation/useFileDropTarget` already counts enter against leave, which is
    what makes the over-state survive the pointer crossing onto the field, the
    `+` or the priced button — every one of them a CHILD of the box. A
    `useState` boolean here would flicker off over each of them (card 1087's
    finding), and a fourth hand-rolled copy of that counting is exactly the
    drift working law 4 is about: two live copies already sit on the casting
    page, and they are a finding recorded on this card rather than a sweep taken
    inside it.
  */
  const boxZone = useFileDropTarget((files) => acceptFile(files?.[0]));
  /* Is there a door at all? The `+` is ABSENT rather than disabled outside the
     scope, and so is the drop — a box that claimed a file it has nowhere to send
     would eat her photograph in silence. A boolean rather than the function, so
     the guard below is not re-armed by a new closure on every render. */
  const hasAttachDoor = Boolean(attachPicture);
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

  /*
    ⚠ A MISSED DROP NAVIGATES THE TAB TO THE FILE, and takes her typed ask and
    her place in the viewer with it. That is the browser's default for a drop
    anywhere the page has not claimed — and the moment this box invites a
    photograph, a near miss is one hand's width away. Nothing invited one
    before: the sheet page claims no drop at all today.

    It is the same guard the concept card mounts on the casting page, for the
    same reason — `ConceptUploadCard` carries the long version of why, and this
    is the second surface to need it. ⚠ **FILES ONLY**: a bare `preventDefault`
    here cancels EVERY drop on the page, which once took dragging selected TEXT
    into a textarea away from everyone inside that flag. Mounted only where the
    door exists, so an account outside the scope keeps the browser's own
    behaviour exactly.

    The box she aimed at correctly is unaffected: the hook stops that drop
    propagating, so this listener never sees it.
  */
  useEffect(() => {
    if (!hasAttachDoor) return;
    const swallow = (event: Event) => {
      if (!(event as DragEvent).dataTransfer?.types?.includes("Files")) return;
      event.preventDefault();
    };
    window.addEventListener("dragover", swallow);
    window.addEventListener("drop", swallow);
    return () => {
      window.removeEventListener("dragover", swallow);
      window.removeEventListener("drop", swallow);
    };
  }, [hasAttachDoor]);

  /*
    THE SPOTLIGHT ON THAT PICTURE (#14 slice 3b) — held beside the picture it
    is about, because it has the picture's one door and dies with it.

    `spot` is null whenever the picture is not lit: nothing attached, outside
    the scope, a picture brought back by *Use*, or an open that failed or
    stalled. Null draws exactly the attach this panel drew before the slice.

    `spotFor` is the handle the live answers belong to. Every answer is checked
    against it when it lands, so an answer for a picture she has since taken off
    the ask — or swapped for another — is dropped rather than lighting the
    wrong photograph.
  */
  const [spot, setSpot] = useState<{ referenceId: string; view: SpotlightView } | null>(null);
  const [stageOpen, setStageOpen] = useState(true);
  const [taken, setTaken] = useState<ReadonlyArray<TakenPiece & { thumb: string | null }>>([]);
  const [taking, setTaking] = useState(false);
  const [spotNote, setSpotNote] = useState<string | null>(null);
  const spotFor = useRef<string | null>(null);
  const takenCount = useRef(0);

  function resetSpot(): void {
    spotFor.current = null;
    setSpot(null);
    setTaken([]);
    setTaking(false);
    setSpotNote(null);
    setStageOpen(true);
  }

  /*
    OPEN IT — the moment the door has taken it (§3 item 1: *"The picture opens
    large the moment it is attached"*).

    Only for a picture chosen in THIS panel, whose pixels the browser holds: the
    light is drawn from those pixels and the server never sends one back (§6).
    A picture *Use* brought back is a projected address with no such copy, so
    it stays the plain attach it has always been.
  */
  async function openSpot(referenceId: string, url: string): Promise<void> {
    if (!spotlight) return;
    spotFor.current = referenceId;
    setTaken([]);
    setSpotNote(null);
    setStageOpen(true);
    setSpot({ referenceId, view: { state: "reading" } });
    const [answer, size] = await Promise.all([
      withinStall(spotlight.open(referenceId)),
      pictureSize(url),
    ]);
    const view = await settleOpen(answer, size);
    if (spotFor.current !== referenceId) return;
    /* FAIL-OPEN: an unlit picture is no stage at all, and nothing is said. */
    if (view.state === "unlit") {
      spotFor.current = null;
      setSpot(null);
      return;
    }
    setSpot({ referenceId, view });
  }

  /*
    TAKE WHAT IS UNDER THE POINT, AND SHOW ITS CHIP.

    The chip carries what was actually cut and the name read from that cut —
    never the name of the piece that was lit, because a tap can land where
    nothing is lit and a point can return a part of what was lit (§0 hazards
    1 and 3). A null name is a chip with no words, never a guess.
  */
  async function takeAt(at: { x: number; y: number }): Promise<void> {
    if (!spotlight || !spot || spot.view.state !== "lit" || taking) return;
    const { referenceId } = spot;
    const frame = { width: spot.view.map.width, height: spot.view.map.height };
    const url = liveUrl.current;
    setTaking(true);
    setSpotNote(null);
    try {
      const settled = await settleTap(await spotlight.tap(referenceId, at), frame);
      if (spotFor.current !== referenceId) return;
      if (!settled.ok) {
        setSpotNote(settled.note);
        return;
      }
      const thumb = url ? await cutThumbnail(url, settled.taken) : null;
      if (spotFor.current !== referenceId) return;
      takenCount.current += 1;
      const key = `taken-${takenCount.current}`;
      setTaken((held) => [...held, { ...settled.taken, key, thumb }]);
    } catch (error) {
      if (spotFor.current !== referenceId) return;
      /* The server's own sentence when it spoke one (a rate limit says when
         to come back); ours when the failure never reached it. */
      const spoken = typeof (error as { data?: { code?: unknown } } | null)?.data?.code === "string"
        && error instanceof Error && error.message;
      setSpotNote(spoken || SPOTLIGHT_NOTHING_THERE);
    } finally {
      if (spotFor.current === referenceId) setTaking(false);
    }
  }

  function letGo(key: string): void {
    setTaken((held) => held.filter((piece) => piece.key !== key));
    setSpotNote(null);
  }

  /*
    ONE ACCEPTANCE, TWO DOORS ONTO IT — his word, 2026-10-31, verbatim: *"also
    allow drag an drop of reference images into the refine box"* (#2912).

    The `+` picker and a dropped file arrive at the SAME function, so the two
    doors cannot answer differently: the old preview is released, the refusal is
    cleared, what was taken from the LAST picture is forgotten, the bytes are
    read, the picture appears. A second copy of this body under the drop handler
    is working law 4 with a UI accent, and the half that would have drifted
    first is `resetSpot()` — the only reason a piece taken off the previous
    photograph does not ride the next ask.

    It refuses the three states in which the `+` is not there to be pressed —
    no door inside this scope, a render in flight, an attach already going up —
    because a drop door has no `disabled` of its own and a hand holding a file
    cannot read a button's state. The picker could never reach them anyway (its
    button carries `disabled`), so nothing about that road changes.
  */
  function acceptFile(file: File | null | undefined): void {
    if (!file || !attachPicture || busy || attaching) return;
    if (picture) URL.revokeObjectURL(picture.url);
    setAttachRefusal(null);
    /* A new picture is a new reading; nothing taken from the last one carries
       over to it. */
    resetSpot();
    void asBase64(file).then((imageBase64) => {
      setPicture({ url: URL.createObjectURL(file), imageBase64, referenceId: null });
    }).catch(() => setAttachRefusal(ATTACH_FAILED_FALLBACK));
  }

  function dropPicture(): void {
    if (picture) URL.revokeObjectURL(picture.url);
    setPicture(null);
    setAttachRefusal(null);
    resetSpot();
  }

  async function claimPicture(provenance: InkProvenance): Promise<void> {
    if (!picture || !attachPicture) return;
    setAttaching(true);
    setAttachRefusal(null);
    try {
      const { referenceId } = await attachPicture({ imageBase64: picture.imageBase64, provenance });
      setPicture((held) => (held ? { ...held, referenceId } : held));
      void openSpot(referenceId, picture.url);
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
    ONE SEND, TWO KEYS ONTO IT — the button and Enter in the box (#2533). The
    box is a textarea now so a long sentence can be read back whole, and a
    textarea does not submit its form on Enter, so both call this.
  */
  const submitAsk = () => {
    if (!trimmed || busy || pictureUnclaimed) return;
    /* The handle rides with the sentence, and only when there is one:
       `undefined` rather than null, because the wire has no field for
       "no reference". */
    onRefine(trimmed, undefined, undefined, picture?.referenceId ?? undefined);
    setInstruction("");
    /* The choosing is done once the ask is sent, so the open picture folds
       back into its chip and the face they are refining has the room again.
       The chip opens it, with everything taken still lit. */
    setStageOpen(false);
  };
  /*
    THE BOX GROWS WITH THE SENTENCE, up to three lines, and scrolls past that.
    Read off the field's own scroll height, so the line height lives in the
    stylesheet and nowhere here.
  */
  const fieldRef = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    /* Empty, the stylesheet's one line stands — measuring an empty box before
       the type has loaded read a default line height and drew it too tall. */
    if (!instruction) {
      field.style.height = "";
      field.style.overflowY = "";
      return;
    }
    field.style.height = "auto";
    const lineHeight = parseFloat(getComputedStyle(field).lineHeight) || 18;
    const ceiling = lineHeight * FIELD_MAX_LINES;
    field.style.height = `${Math.min(field.scrollHeight, ceiling)}px`;
    field.style.overflowY = field.scrollHeight > ceiling ? "auto" : "hidden";
  }, [instruction]);
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
  /* The handle for those pictures, read off the SAME selected version, so the
     thumbnail Use puts back and the reference it sends can never come from two
     different rows. */
  const selectedAskReferenceId = selected?.askReferenceId ?? null;
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
          {selectedReferences.filter((reference) => !unshowable.includes(reference.url)).map((reference) => (
            <span
              key={reference.url}
              className="dpc-refine__thumb dpc-refine__madeRef"
              title={reference.slot ?? reference.kind}
            >
              {/*
                ⚠ A PICTURE WE CANNOT FETCH IS NOT DRAWN AT ALL (ruled
                fable-1423 §1).

                A customer's attached photograph is DELIBERATELY not at a public
                address — `askReference`'s own rule, *"the address is the only
                thing between a photograph of a person and a stranger, so the
                server fetches the bytes itself"* — and the projection builds a
                public bucket url for every reference kind. Measured on the
                founder's own render: the master and three carries answer 200,
                her attachment and the carrier cut from it answer 404.

                So the chip drew a BROKEN-IMAGE GLYPH for the one picture the
                founder asked it to show. A broken glyph is a worse promise than
                none, so the tile removes itself and the chip is its sentence and
                its Use button until the picture can actually be served.

                **This is INTERIM and it self-heals**: the fifth authenticated
                route (the `ink-design` shape, countersigned fable-1423 §2)
                serves the attachment's bytes, and the day the projected url
                points at it this handler simply stops firing. Nothing here has
                to be undone.

                Scoped to THIS chip on purpose. An `onError` hide over every
                thumbnail in the product would quietly swallow a real breakage
                somewhere it matters.
              */}
              <img
                src={reference.url}
                alt=""
                onError={() => setUnshowable((held) => (
                  held.includes(reference.url) ? held : [...held, reference.url]
                ))}
              />
            </span>
          ))}
          {/*
            HER WHOLE SENTENCE ON HOVER — his word, 2026-09-25 (Crew reply #218
            on `refine-made-row-1187`), verbatim and entire: *"Add a hover
            tooltip"*.

            The row is `nowrap` + `text-overflow: ellipsis` inside a panel that
            is a fixed 701px at 1440, 1920 and 2560 alike — measured, not
            reasoned — so past roughly 150 characters she cannot read back the
            sentence she typed and paid to render. The version rail's thumbnail
            `aria-label` already carries the whole thing, so a screen reader had
            what a sighted customer did not.

            (A) was chosen over wrapping the row to three lines, and the row
            keeps its single line, so the ask box directly below it does not
            move — which was (B)'s cost.

            ⚠ **ITS KNOWN PRICE, STATED RATHER THAN IMPLIED**: `title` is a
            hover affordance, so on a touch surface the sentence is still
            unreadable. The card named that before he picked it, so it is a
            stated tradeoff and not a defect to re-file.
          */}
          <span className="dpc-refine__madeText" title={selectedRequest}>
            {selectedRequest}
          </span>
          <button
            type="button"
            className="dpc-refine__madeUse"
            disabled={busy}
            /*
              THE SENTENCE AND THE PICTURE — his own words for what this button
              is (fable-1419 §2): *"regenerating the exact same prompt +
              reference image i used to generate this image."*

              It used to carry the sentence alone, which made the thumbnails
              beside it a promise the button did not keep. The handle is the
              row's own (`askReferenceId`), so what comes back is the picture
              THAT ask carried and never a picture from a neighbouring version.

              PREFILL ONLY, STILL. Spending her credits stays a deliberate act:
              this fills the box and re-attaches, and she presses Refine. The
              duplicate warning fires for it exactly as it does for anything
              typed by hand.

              The thumbnail is the projected `source` url — the picture she gave
              — and `imageBase64` is empty on purpose: the door has already
              taken this one and `claimPicture` is the path for a picture it has
              not. A non-null `referenceId` is what marks it claimed, so the
              provenance question does not re-open for a picture she already
              answered it for.

              A handle purged with its Cast is refused FREE on send, in the
              server's own sentence — *"That picture isn't attached to this Cast
              any more"* — which is the honest half-replay refusal rather than a
              silent sentence-only ask.
            */
            onClick={() => {
              setInstruction(selectedRequest);
              const supplied = selectedReferences[0];
              if (!selectedAskReferenceId || !supplied) return;
              if (picture) dropPicture();
              /* No spotlight on a picture brought back: there is no local copy
                 of its pixels to light (see `openSpot`). */
              resetSpot();
              setPicture({ url: supplied.url, imageBase64: "", referenceId: selectedAskReferenceId });
            }}
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
          {/*
            THE PICTURE, OPEN (#14 slice 3b) — above its own chip and the box,
            so the picture, what was taken from it and the sentence about it
            read top to bottom as one thing. Only while it is being read or is
            lit; an unlit picture has no stage (fail-open).
          */}
          {spot && stageOpen ? (
            <SpotlightStage
              pictureUrl={picture.url}
              view={spot.view}
              taken={taken}
              taking={taking}
              onTake={(at) => void takeAt(at)}
              onLetGo={letGo}
            />
          ) : null}
          <div className="dpc-refine__attachedRow">
            {/*
              AND THE SAME FOR A REPLAYED ONE. A picture she has just CHOSEN is
              a local object url and always draws; a picture *Use* brought back
              is the projected one, which cannot be fetched until the route
              exists — so the tile is dropped rather than drawn broken, and the
              row still carries its remove button and its sentence.
            */}
            {unshowable.includes(picture.url) ? null : spot ? (
              /* While there is an open picture, its chip is the way back to it
                 once the ask has folded it away — the same picture, so the same
                 name, and its state is whether it is showing. */
              <button
                type="button"
                className="dpc-refine__thumb dpc-refine__thumb--opens"
                aria-expanded={stageOpen}
                onClick={() => setStageOpen((open) => !open)}
              >
                <img src={picture.url} alt={ATTACHED_PICTURE_LABEL} />
              </button>
            ) : (
              <span className="dpc-refine__thumb">
                <img
                  src={picture.url}
                  alt={ATTACHED_PICTURE_LABEL}
                  onError={() => setUnshowable((held) => (
                    held.includes(picture.url) ? held : [...held, picture.url]
                  ))}
                />
              </span>
            )}
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
            {/*
              WHAT WAS TAKEN FROM IT — one chip per tap, in the row the picture's
              own chip lives in (§3 item 3). The picture on each is the cut
              itself, drawn from her own copy; the words are the name read off
              that cut, or none. Slice 3b ends here: nothing in these chips
              rides the ask yet (§9 — slice 4).
            */}
            {taken.map((piece) => (
              <span key={piece.key} className="dpc-refine__taken">
                {piece.thumb ? (
                  <span className="dpc-refine__thumb dpc-refine__takenThumb">
                    <img src={piece.thumb} alt={piece.name ? "" : SPOTLIGHT_UNNAMED_LABEL} />
                  </span>
                ) : null}
                {piece.name ? <span className="dpc-refine__takenName">{piece.name}</span> : null}
                <button
                  type="button"
                  className="dpc-refine__attachedOff"
                  aria-label={letGoLabel(piece.name)}
                  title={letGoLabel(piece.name)}
                  onClick={() => letGo(piece.key)}
                >
                  <X size={12} strokeWidth={2} aria-hidden="true" />
                </button>
              </span>
            ))}
            {taking ? (
              <span
                className="dpc-refine__thumb dpc-refine__taking"
                role="status"
                aria-label={SPOTLIGHT_TAKING_LABEL}
              />
            ) : null}
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
          {spotNote ? (
            <p className="dpc-refine__readNote" role="status">{spotNote}</p>
          ) : null}
        </div>
      ) : null}

      {/*
        ⚠ NO UNDO PILL — #2610, his word 2026-10-17, verbatim: *"remove the
        undo pill we dont need it people can click between versions on the
        left side panel thumbnails"*. It superseded #2533's "Undo · free" chip.
        The way back is the version thumbnails (`VersionRail`), one click and
        free; a typed "undo" is still answered by the server as free
        navigation, but nothing here advertises it.
      */}

      <form
        className="dpc-refine__ask"
        onSubmit={(event) => {
          event.preventDefault();
          submitAsk();
        }}
      >
        {/*
          ONE BOX, THE PICTURE'S WIDTH (#2533). The field's own material is the
          box now — the same fill, border and radius `.dpc-refine__field` always
          had — and the `+` and the priced button sit inside it on one bar, so
          the composer is a single thing under the picture rather than a field
          with controls hung either side of it.
        */}
        <div
          /*
            ⚠ THE OVER-STATE IS A *CHANGE*, NOT A PRESENCE. This box has carried
            a border and a focus border since #2533, so an arm asking only "does
            it have a border while a file is over it" would have passed against
            the state that drew nothing. The class below takes the line past even
            the focused one, and THE FIELD'S OWN WORD changes with it — card
            1118's measured lesson on the ink panel next door: a wash on a
            control that already carries an edge is easy to miss.
          */
          className={boxZone.over ? "dpc-refine__box dpc-refine__box--drop" : "dpc-refine__box"}
          /* Absent where there is no door, exactly like the `+` itself — see
             `hasAttachDoor`. */
          {...(hasAttachDoor ? boxZone.handlers : {})}
        >
        {/*
          THE SENTENCE IS LAID OVER THE BOX, never swapped into the field's
          placeholder — the start page's brief box settled this shape
          (`dpc-hero__dropsay`) and the reason is the ordinary case, not an edge
          one: a placeholder is on screen only while the field is EMPTY, and a
          customer reaching for a photograph has usually already typed what to
          take from it. `aria-hidden` like its sibling: a hand dragging a file is
          a pointer, and the door it is aiming at is announced by the `+`.
        */}
        {hasAttachDoor && boxZone.over ? (
          <span className="dpc-refine__dropsay" aria-hidden="true">{ATTACH_DROP_WORD}</span>
        ) : null}
        <textarea
          ref={fieldRef}
          className="dpc-refine__field"
          rows={1}
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          /* Enter sends, as it did when this was a one-line input; the box only
             grows to show a long sentence, never to take a second paragraph. */
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submitAsk();
            }
          }}
          /* Door 1 of #2525's three. Reaching for the box is edit intent, and
             it is the earliest of the three doors by several seconds. */
          onFocus={onEditIntent}
          placeholder="Change something about them…"
          /*
            THE ROUTER'S OWN NUMBER, not a copy of it (law 4, ruled fable-1613).
            A tapped row prefills this field rather than riding along invisibly,
            so what the browser counts is exactly what the wire carries — which
            is why this one needs no allowance arithmetic and the region
            popover's does.
          */
          maxLength={REFINE_INSTRUCTION_MAX_LENGTH}
          disabled={busy}
          aria-label="What to change about this person"
        />
        <div className="dpc-refine__bar">
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
              /* The three the door accepts, from the one client home that owns
                 the list (`pictureBytes.ts`). The BYTES are judged server-side
                 either way — this only spares her choosing a file that will be
                 refused. */
              accept={ACCEPTED_PICTURE_FILES}
              className="dpc-refine__readInput"
              onChange={(event) => {
                const file = event.target.files?.[0];
                /* Cleared before anything else, so choosing the SAME file twice
                   fires again — a picker that ignores a repeat looks broken. */
                event.target.value = "";
                /* The drop door's own function, never a second copy of it —
                   see `acceptFile`. */
                acceptFile(file);
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
        <span className="dpc-refine__barEnd">
        <Button type="submit" size="small" disabled={!trimmed || busy || pictureUnclaimed}>
          {/* #1952 item 1, his *"yes"* 2026-10-08: every paid button shows its
              served price — `Refine · {served} credits`; plain `Refine` while
              the price is unread (#1727). */}
          {busy
            ? "Refining…"
            : priceCredits === null
              ? "Refine"
              : `Refine · ${formatCredits(displayPrice(priceCredits))} credits`}
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
        </span>
        </div>
        </div>
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
            {/*
              ⚠ THE SECOND CALL SITE, AND ITS TOOLTIP IS BELT-AND-BRACES RATHER
              THAN THE FIX — said plainly because the difference is invisible
              from here.

              Measured in the running app: this row is NOT clipped.
              `.dpc-refine__readResult .dpc-refine__madeText` overrides the
              class to `white-space: normal; overflow: visible; text-overflow:
              clip`, so the sentence wraps and is fully on screen, and the
              tooltip repeats what she can already read.

              It carries one anyway because the rule this panel now holds is
              "her sentence is always recoverable on hover" — one rule, no
              exemption to remember — and because the day that override is
              touched this row starts clipping with nothing behind it.
            */}
            <span className="dpc-refine__madeText" title={offer.sentence}>
              {offer.sentence}
            </span>
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
        ⚠ **NO HINT LINES UNDER THE BOX ANY MORE — #2533, his approved design
        (*"there is no tooltip and no suggestion chips"*, and no hint lines).**

        Two sentences stood here: what a refine may ask for (*"Anything about
        them — not their clothes or the room"*), and that typing "undo" takes
        something back for free. The second became an Undo chip above the box,
        itself removed by #2610 — the version thumbnails are the way back. The first is gone with
        nothing in its place, and that is a real trade, named rather than
        hidden: an outfit ask is now learned at the server's own refusal, which
        says what was refused and what to do, instead of being warned about in
        advance. Whether garments become a real capability is still #1148.
      */}
    </div>
  );
}
