import { RotateCw } from "lucide-react";

import { Button } from "@/foundation";
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
  onDismissOutcome,
  kept = [],
  keptPossessive = "their",
  draft,
  onDraft,
  stackHoisted = false,
  regenerates = null,
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
  onRefine: (instruction: string, scope?: string, replayOf?: string) => void;
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
}) {
  const instruction = draft;
  const setInstruction = onDraft;
  const trimmed = instruction.trim();
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
              onClick={() => onRefine(option.label)}
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

      <form
        className="dpc-refine__ask"
        onSubmit={(event) => {
          event.preventDefault();
          if (!trimmed || busy) return;
          onRefine(trimmed);
          setInstruction("");
        }}
      >
        <input
          className="dpc-refine__field"
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder="Change something about them…"
          maxLength={200}
          disabled={busy}
          aria-label="What to change about this person"
        />
        <Button type="submit" size="small" disabled={!trimmed || busy}>
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
