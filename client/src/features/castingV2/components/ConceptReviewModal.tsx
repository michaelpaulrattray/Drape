import { useEffect, useRef, useState, type DragEvent } from "react";

import {
  CONCEPT_DROP_CHOOSE,
  CONCEPT_DROP_LINE,
  CONCEPT_NOT_A_PICTURE,
  CONCEPT_REVIEW_ANOTHER,
  CONCEPT_REVIEW_CANCEL,
  CONCEPT_REVIEW_CAST,
  CONCEPT_REVIEW_DISCARD,
  CONCEPT_REVIEW_EMPTY_EXPLAINER,
  CONCEPT_REVIEW_EMPTY_TITLE,
  CONCEPT_REVIEW_EXPLAINER,
  CONCEPT_REVIEW_EYEBROW,
  CONCEPT_REVIEW_LABEL,
  CONCEPT_REVIEW_READING,
  CONCEPT_REVIEW_REFUSED_TITLE,
  CONCEPT_REVIEW_RETRY,
  CONCEPT_REVIEW_TITLE,
  CONCEPT_REVIEW_USE,
  conceptCountLabel,
} from "../conceptUpload";
import { ACCEPTED_PICTURE_FILES } from "../pictureBytes";
import { CastingModal } from "./CastingModal";

/**
 * THE REVIEW STEP — the photograph beside the words, and the cast (#196).
 *
 * His direction, verbatim: *"when you go to upload a concept image to be casted
 * it opens in a popout modal instead of putting it into the small prompt box?"*
 * Before this, the description appeared in the brief box on arrival — correct,
 * cheap, and it asked her to check a read against a photograph she could no
 * longer see.
 *
 * ⚠ **AND THEN HIS TWO AMENDMENTS, which is what this file is now.** Both are
 * verbatim on #196 and both were filed before PR #197 merged without them:
 *
 * > *"the button should be cast it and it automatically casts the prompt the
 * > same flow the original prompt and casting takes just through the modal"*
 *
 * > *"i want to be able to drag and drop the image into the upload concept card
 * > and it will auto open up the modal with the reference image in it
 * > alternatively i can click the card and it opens up the modal and then i can
 * > upload or drag and drop the reference image in"*
 *
 * # It is still a REVIEW, not a wizard — but it has four states now
 *
 * `file === null` is the EMPTY state, which only his second amendment can reach:
 * she tapped the card and there is nothing to review yet, so the portrait slot
 * becomes the drop zone and the body says what will happen. Then READING (the
 * picture with a progress line), REFUSED (the door's own sentence with two ways
 * on), and READ (the words, the count, the price, the cast).
 *
 * One primary action in every one of them, no second page, no options — the
 * settings stay in the gear, exactly as his one-modal order says.
 *
 * # Where the price is, and why it is not on the button
 *
 * The primary now SPENDS, which is the whole of his first amendment. **D-109
 * names "Cast it" by name** as an immediate-fire action, rules that *cost is
 * metadata and never button text*, and records that a price inside a confirm's
 * button was tried and reversed the same day. So the number sits in the cost
 * line directly above — the sign modal's shape — and she cannot tap the button
 * without it in her eye.
 *
 * # Nothing is stored, and the preview does not weaken that
 *
 * An object URL is a handle to bytes already in this browser's memory. Nothing
 * is uploaded to draw it, nothing is written server-side, and the bytes that DID
 * leave (inline on one describer call) were dropped when that call returned. The
 * URL is created and revoked by one effect keyed on the file, so every exit —
 * cast, confirm, Discard, Esc, scrim, unmount, and a SECOND picture replacing
 * the first — revokes through the same line.
 *
 * # The empty edit is not a dead button
 *
 * She can delete every character, and then both confirms would appear to do
 * nothing (D-180). They are disabled at zero instead, which is
 * `CastSettingsModal`'s Reset rule applied to a confirm.
 */
export function ConceptReviewModal({
  file,
  description,
  failure,
  notAPicture,
  priceCredits,
  onFiles,
  onRetry,
  onUse,
  onCast,
  onDismiss,
}: {
  /** The chosen picture, or `null` before she has chosen one. */
  file: File | null;
  /** The read, or `null` while it is still in flight (and on a refusal). */
  description: string | null;
  /** The door's own refusal sentence, or `null`. Never an error object's text. */
  failure: string | null;
  /**
   * WHETHER THE LAST FILE OFFERED WAS NOT A PICTURE.
   *
   * Handed down rather than decided here: the card judges every file for all
   * three entrances, so a PDF dropped on the CARD reaches this dialog with its
   * sentence already true. Owned locally, it could not — and that was a silent
   * open with nothing said.
   */
  notAPicture: boolean;
  /** Server-derived, passed down — never a constant on this side (D-15). */
  priceCredits: number;
  /** Files arrived here rather than at the card. The card judges and reads them. */
  onFiles: (files: FileList | null) => void;
  /** Read the SAME picture again — the plain retry his build notes ask for. */
  onRetry: () => void;
  /** Put the words in the brief box and stop. The card decides where they go. */
  onUse: (description: string) => void;
  /** Cast them, through the page's one roll flow. His first amendment. */
  onCast: (description: string) => void;
  onDismiss: () => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  /** Whether a drag is currently over the dialog. Depth-counted; see `onDragEnter`. */
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const picker = useRef<HTMLInputElement>(null);
  const firstAction = useRef<HTMLButtonElement>(null);

  /*
    SOMETHING INSIDE THE CARD TAKES FOCUS ON MOUNT — the house pattern
    (`ConfirmDialog`, `SignConfirm`, `DeleteCastConfirm`, `RenameCastDialog`,
    `CandidateViewer` all do it), and the second review of #196 found this modal
    was the first consumer without it. The shell's trap only engages once focus
    is INSIDE the card, and this dialog's opener disables itself when it opens,
    so the browser drops focus to `body` and the first Tab left the page.

    THE SECONDARY rather than the field: in the two states where this matters
    most — empty and reading — the textarea does not exist or is disabled, and
    the secondary is always the safe option, the same reasoning that puts focus
    on Cancel in the delete dialog.
  */
  useEffect(() => {
    firstAction.current?.focus();
  }, []);

  /*
    CREATED AND REVOKED BY ONE EFFECT — never in render, which leaks a handle
    per re-render, and never on a confirm path alone, which leaks every
    abandoned upload. Keyed on the file, so swapping pictures inside the dialog
    (his "choose another picture") revokes the first one through this same line.
  */
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => {
      URL.revokeObjectURL(url);
      setPreview(null);
    };
  }, [file]);

  /*
    Seeded ONCE, when the read arrives — the card never sends a second
    description for the same file, so this cannot overwrite her edits. A retry
    or another picture clears it back to null first, which resets the field.
  */
  useEffect(() => {
    setText(description ?? "");
  }, [description]);

  /*
    DEPTH-COUNTED, because `dragleave` fires every time the pointer crosses into
    a CHILD element — a naive pair of enter/leave handlers flickers the drop
    state on and off as the cursor moves over the text inside the zone.
  */
  const onDragEnter = (event: DragEvent) => {
    if (!event.dataTransfer?.types?.includes("Files")) return;
    dragDepth.current += 1;
    setDragging(true);
  };
  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };
  /*
    `preventDefault` on dragover is what MAKES an element a drop target — without
    it the browser refuses the drop and then navigates the tab to the file,
    which would take her whole brief with it.
  */
  const onDragOver = (event: DragEvent) => {
    if (!event.dataTransfer?.types?.includes("Files")) return;
    event.preventDefault();
  };
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = 0;
    setDragging(false);
    onFiles(event.dataTransfer?.files ?? null);
  };
  const dropHandlers = { onDragEnter, onDragOver, onDragLeave, onDrop };

  const reading = file !== null && description === null && failure === null;
  const refused = failure !== null;
  const ready = text.trim().length > 0 && description !== null;
  const empty = file === null;

  /* The one primary, whichever state we are in — never two, never none. */
  const primary = empty
    ? { label: CONCEPT_DROP_CHOOSE, disabled: false, act: () => picker.current?.click() }
    : refused
      ? { label: CONCEPT_REVIEW_RETRY, disabled: false, act: onRetry }
      : { label: CONCEPT_REVIEW_CAST, disabled: !ready, act: () => onCast(text.trim()) };

  return (
    <CastingModal
      /* The accessible name follows the heading, or a screen reader is told the
         dialog is about to cast something it has just refused to read. */
      label={
        empty
          ? CONCEPT_REVIEW_EMPTY_TITLE
          : refused
            ? CONCEPT_REVIEW_REFUSED_TITLE
            : CONCEPT_REVIEW_TITLE
      }
      portrait={preview}
      /*
        THE WHOLE PICTURE. She is checking words against a photograph she chose,
        of unknown proportions — a 4:5 crop can take away the thing the
        description is about, which is this dialog failing at its one job.
      */
      portraitWhole
      /*
        THE DROP ZONE STANDS IN THE PICTURE'S OWN SLOT while there is no picture
        — it is the picture-shaped hole the picture is about to fill, so the
        dialog does not change shape when one arrives.
      */
      portraitFallback={
        <span
          className={dragging ? "dpc-modal__drop dpc-modal__drop--over" : "dpc-modal__drop"}
          {...dropHandlers}
        >
          {CONCEPT_DROP_LINE}
        </span>
      }
      /*
        NEVER busy. The shell blocks Esc while busy, which is right for a
        dialog that is spending credits and wrong here: his order says the
        modal abandons cleanly. The read in flight is house money that was
        already spent when she picked the file, and the CAST closes this dialog
        before it dispatches — so there is no moment where this is the surface
        in front of a charge in flight.
      */
      busy={false}
      onDismiss={onDismiss}
    >
      {/*
        The body accepts a drop too, so aiming at the middle of the dialog works
        — which is where a hand actually aims. Same handler, same state; the two
        attachments are one target between them.
      */}
      <div className="dpc-modal__bodydrop" {...dropHandlers}>
        <input
          ref={picker}
          type="file"
          accept={ACCEPTED_PICTURE_FILES}
          className="dpc-entry__file"
          onChange={(event) => {
            const files = event.target.files;
            /* Cleared AFTER the hand-off, so choosing the SAME file twice fires
               again — a picker that ignores a repeat looks broken. */
            onFiles(files);
            event.target.value = "";
          }}
        />

        <span className="dpc-modal__eyebrow">{CONCEPT_REVIEW_EYEBROW}</span>

        {/*
          ⚠ THE TITLE AND THE EXPLAINER BOTH TRACK THE STATE, and the refused
          case was caught by LOOKING at the frame rather than by reading this
          file: the refusal shipped under "This is what we'll cast", with "Edit
          anything. We cast from these words…" above it — two claims about words
          that do not exist, on the one surface whose job is saying what will be
          cast. The door's own sentence is the explainer in that state.
        */}
        <h2 className="dpc-modal__title">
          {empty
            ? CONCEPT_REVIEW_EMPTY_TITLE
            : refused
              ? CONCEPT_REVIEW_REFUSED_TITLE
              : CONCEPT_REVIEW_TITLE}
        </h2>

        {refused ? null : (
          <p className="dpc-modal__explainer">
            {empty ? CONCEPT_REVIEW_EMPTY_EXPLAINER : CONCEPT_REVIEW_EXPLAINER}
          </p>
        )}

        {/*
          THE DOOR'S OWN SENTENCE, WHERE THE FIELD WOULD BE. His build note:
          *"a failed read gets a plain retry inside the modal, nothing charged"*.
          The picture stays on screen beside it, which is what makes the two
          exits below mean different things — the same picture again, or another
          one — and it is why closing the dialog on a refusal was the wrong
          answer: it threw her picture away to recover from a transport blip.
        */}
        {refused ? (
          <p className="dpc-modal__note" role="status">
            {failure}
          </p>
        ) : null}

        {/* Nothing to review yet, and nothing to say about a field that is not there. */}
        {empty || refused ? null : (
          <>
            <label className="dpc-modal__label" htmlFor="dpc-concept-description">
              {CONCEPT_REVIEW_LABEL}
            </label>
            {/* The house field box; the textarea inside it carries its own height. */}
            <div className="dpc-modal__field">
              <textarea
                id="dpc-concept-description"
                value={text}
                placeholder={reading ? CONCEPT_REVIEW_READING : undefined}
                disabled={reading}
                rows={6}
                aria-label={CONCEPT_REVIEW_LABEL}
                aria-busy={reading}
                onChange={(event) => setText(event.target.value)}
              />
            </div>
          </>
        )}

        {/*
          Said inline, next to the zone she dropped on — never a toast: she is
          looking at a dialog, the dialog is where the answer belongs, and a
          toast behind a scrim is the product talking past the thing it is
          talking about.
        */}
        {notAPicture ? (
          <p className="dpc-modal__note" role="status">
            {CONCEPT_NOT_A_PICTURE}
          </p>
        ) : null}

        {/*
          THE COUNT AND THE PRICE, one row (D-109: cost is metadata, right,
          muted, mono). The count is bare — see `conceptCountLabel` for why there
          is no denominator. Both are EMPTY until there are words: a price under
          a dialog that cannot yet spend is a claim about an action that does not
          exist. The row stays so the actions do not jump when they arrive.
        */}
        <span className="dpc-modal__costrow">
          <span className="dpc-modal__count">
            {ready || description !== null ? conceptCountLabel(text.length) : ""}
          </span>
          <span className="dpc-modal__cost">
            {description !== null ? (
              <>
                <span className="dpc-modal__tilde">~</span> {priceCredits} credits
              </>
            ) : null}
          </span>
        </span>

        <div className="dpc-modal__actions">
          {/*
            The way out, always in the same place. Its LABEL tracks what the tap
            actually does, which is the third state on this dialog caught saying
            something untrue about itself: there is nothing to DISCARD before a
            picture exists, and nothing yet while the read is still running —
            his build note asks for the progress line to come "with cancel". It
            says Discard only where there is something to throw away: a picture,
            or a picture and the words read off it.
          */}
          <button
            ref={firstAction}
            type="button"
            className="dpc-modal__ghost"
            onClick={onDismiss}
          >
            {empty || reading ? CONCEPT_REVIEW_CANCEL : CONCEPT_REVIEW_DISCARD}
          </button>

          {/*
            THE SECOND WAY ON FROM A REFUSAL. It is the honest answer to the
            honest wall — *"I couldn't find anyone in that picture"* is
            deterministic, and a bare retry on the same file would spend house
            money to be told the same thing.
          */}
          {refused ? (
            <button
              type="button"
              className="dpc-modal__secondary"
              onClick={() => picker.current?.click()}
            >
              {CONCEPT_REVIEW_ANOTHER}
            </button>
          ) : null}

          {/*
            HIS "MAY STAY" — the words go to the brief box and nothing is spent,
            for someone who wants to keep editing there. It is drawn only where
            it can act, so it is never a control that does nothing (D-180).
          */}
          {empty || refused ? null : (
            <button
              type="button"
              className="dpc-modal__secondary"
              disabled={!ready}
              onClick={() => onUse(text.trim())}
            >
              {CONCEPT_REVIEW_USE}
            </button>
          )}

          <button
            type="button"
            className="dpc-modal__primary"
            disabled={primary.disabled}
            onClick={primary.act}
          >
            {primary.label}
          </button>
        </div>
      </div>
    </CastingModal>
  );
}
