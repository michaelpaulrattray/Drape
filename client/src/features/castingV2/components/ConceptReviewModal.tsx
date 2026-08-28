import { useEffect, useRef, useState } from "react";

import {
  CONCEPT_REVIEW_DISCARD,
  CONCEPT_REVIEW_EXPLAINER,
  CONCEPT_REVIEW_EYEBROW,
  CONCEPT_REVIEW_LABEL,
  CONCEPT_REVIEW_READING,
  CONCEPT_REVIEW_TITLE,
  CONCEPT_REVIEW_USE,
  conceptCountLabel,
} from "../conceptUpload";
import { CastingModal } from "./CastingModal";

/**
 * THE REVIEW STEP — the photograph beside the words, one confirm (#196).
 *
 * His direction, verbatim: *"when you go to upload a concept image to be casted
 * it opens in a popout modal instead of putting it into the small prompt box?
 * thoughts?"* Before this, the description appeared in the brief box on
 * arrival — correct, cheap, and it asked her to check a read against a
 * photograph she could no longer see.
 *
 * **It is a REVIEW, not a wizard**: one modal, one primary action, no second
 * page, no options. Settings stay in the gear.
 *
 * # It opens on the PICK, not on the answer
 *
 * The describer takes a few seconds. Opening only when the words arrive would
 * mean a silent wait after a file chooser closes — which reads as nothing
 * having happened — and then a dialog appearing unbidden. So the modal opens
 * with the picture already in it and says what it is doing; the words fill in
 * beside it. The wait acquires a subject.
 *
 * # Nothing is stored, and the preview does not weaken that
 *
 * The card's header used to say it "never builds an object URL … there is
 * nothing to preview a decision about". There is now — the decision is *use
 * these words or not* — and the promise it was protecting is untouched: an
 * object URL is a handle to bytes already in this browser's memory. Nothing is
 * uploaded to draw it, nothing is written server-side, and the bytes that DID
 * leave (inline on one describer call) were dropped when that call returned.
 * The URL is created and revoked by one effect keyed on the file, so every exit
 * — confirm, Discard, Esc, scrim, unmount — revokes through the same line.
 *
 * # The empty edit is not a dead button
 *
 * She can delete every character. `briefWithDescription` would then return her
 * existing brief unchanged, so *Use this brief* would appear to do nothing —
 * the no-dead-controls ruling's own shape (D-180). It is disabled at zero
 * instead, which is `CastSettingsModal`'s Reset rule applied to a confirm.
 */
export function ConceptReviewModal({
  file,
  description,
  onUse,
  onDismiss,
}: {
  /** The chosen picture. Previewed here and nowhere else. */
  file: File;
  /** The read, or `null` while it is still in flight. */
  description: string | null;
  /** Called with the words as she has them. The card decides where they go. */
  onUse: (description: string) => void;
  onDismiss: () => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  const discardRef = useRef<HTMLButtonElement>(null);

  /*
    SOMETHING INSIDE THE CARD TAKES FOCUS ON MOUNT — the house pattern
    (`ConfirmDialog`, `SignConfirm`, `DeleteCastConfirm`, `RenameCastDialog`,
    `CandidateViewer` all do it), and the second review of #196 found this modal
    was the first consumer without it. The shell's trap only engages once focus
    is INSIDE the card, and this dialog's opener disables itself on the pick, so
    the browser drops focus to `body` and the first Tab left the page entirely.

    DISCARD rather than the field: the textarea is disabled while the read runs,
    which is exactly when this matters, and Discard is the safe option — the
    same reasoning that puts focus on Cancel in the delete dialog.
  */
  useEffect(() => {
    discardRef.current?.focus();
  }, []);

  /*
    CREATED AND REVOKED BY ONE EFFECT — never in render, which leaks a handle
    per re-render, and never on the confirm path alone, which leaks every
    abandoned upload.
  */
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => {
      URL.revokeObjectURL(url);
      setPreview(null);
    };
  }, [file]);

  /*
    Seeded ONCE, when the read arrives — the card never sends a second
    description for the same file, so this cannot overwrite her edits.
  */
  useEffect(() => {
    if (description !== null) setText(description);
  }, [description]);

  const reading = description === null;
  const ready = text.trim().length > 0;

  return (
    <CastingModal
      label={CONCEPT_REVIEW_TITLE}
      portrait={preview}
      /*
        THE WHOLE PICTURE. She is checking words against a photograph she chose,
        of unknown proportions — a 4:5 crop can take away the thing the
        description is about, which is this dialog failing at its one job.
      */
      portraitWhole
      /*
        NEVER busy. The shell blocks Esc while busy, which is right for a
        dialog that is spending credits and wrong here: his order says the
        modal abandons cleanly, and the read in flight is house money that was
        already spent when she picked the file.
      */
      busy={false}
      onDismiss={onDismiss}
    >
      <span className="dpc-signm__eyebrow">{CONCEPT_REVIEW_EYEBROW}</span>

      <h2 className="dpc-signm__title">{CONCEPT_REVIEW_TITLE}</h2>

      <p className="dpc-signm__explainer">{CONCEPT_REVIEW_EXPLAINER}</p>

      <label className="dpc-signm__label" htmlFor="dpc-concept-description">
        {CONCEPT_REVIEW_LABEL}
      </label>
      {/* The house field box; the textarea inside it carries its own height. */}
      <div className="dpc-signm__field">
        <textarea
          id="dpc-concept-description"
          value={reading ? "" : text}
          placeholder={reading ? CONCEPT_REVIEW_READING : undefined}
          disabled={reading}
          rows={6}
          aria-label={CONCEPT_REVIEW_LABEL}
          aria-busy={reading}
          onChange={(event) => setText(event.target.value)}
        />
      </div>

      {/*
        The bare count — see `conceptCountLabel` for why there is no
        denominator. It is EMPTY while the read is in flight rather than saying
        "Reading the picture…" a second time: the field's own placeholder
        already says it, six lines above, and the same sentence twice in one
        small dialog reads as a rendering fault. The span stays so the actions
        do not jump when the words arrive.
      */}
      <span className="dpc-signm__cost">
        {reading ? "" : conceptCountLabel(text.length)}
      </span>

      <div className="dpc-signm__actions">
        <button ref={discardRef} type="button" className="dpc-signm__secondary" onClick={onDismiss}>
          {CONCEPT_REVIEW_DISCARD}
        </button>
        <button
          type="button"
          className="dpc-signm__primary"
          disabled={reading || !ready}
          onClick={() => onUse(text.trim())}
        >
          {CONCEPT_REVIEW_USE}
        </button>
      </div>
    </CastingModal>
  );
}
