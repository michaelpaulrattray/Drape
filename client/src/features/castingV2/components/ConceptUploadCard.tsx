import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";

import { ACCEPTED_PICTURE_FILES, asBase64 } from "../pictureBytes";
import { logRawFailure } from "@/lib/failureSentence";
import { readableGatedFailure } from "../failureCopy";
import {
  CONCEPT_CARD_COMING,
  CONCEPT_CARD_LINE,
  CONCEPT_CARD_TITLE,
  CONCEPT_FAILED_FALLBACK,
  CONCEPT_FILE_UNREADABLE,
  CONCEPT_READING_LABEL,
} from "../conceptUpload";
import { ConceptReviewModal } from "./ConceptReviewModal";

/**
 * UPLOAD A CONCEPT — the start page's first entry card (#185 slice two).
 *
 * One card, two states, and which one is drawn is the SERVER's answer:
 *
 *   - `describe` supplied → the live control. Tap, pick a picture, one
 *     describer call, and the words land in the brief box above.
 *   - `describe` absent → the honest coming-state the card has been since F5,
 *     with the copy pointed at the capability that is actually queued.
 *
 * **Absent-or-live, never disabled-and-live** — the page hands it a door or it
 * does not, exactly as the refine panel's attach affordance is handed one. A
 * control that is drawn as functional and can only refuse is D-180's dead end
 * wearing a tap target; a labelled coming-state is not, which is why the inert
 * card keeps its shape and loses its affordances rather than disappearing.
 *
 * # NOTHING IS SPENT AND NOTHING IS KEPT
 *
 * The call costs the house cents and the customer nothing — no credits, no
 * render, no row. The bytes ride the describer inline and are dropped. The
 * DESCRIPTION is the artifact, and it lands where she can read and edit it
 * before she spends anything.
 *
 * ⚠ **THE WORDS NO LONGER LAND IN THE BRIEF BOX ON ARRIVAL — #196, his
 * direction 2026-08-28.** They land in a REVIEW MODAL with the photograph
 * beside them, and reach the box only when she taps *Use this brief*. This
 * paragraph used to end *"never builds an object URL for it: there is no
 * preview here because there is nothing to preview a decision about"* — the
 * decision now exists (use these words, or not), and the promise that sentence
 * was protecting is untouched: an object URL is a handle to bytes already in
 * this browser, created and revoked inside `ConceptReviewModal`, and no byte is
 * uploaded or written anywhere to draw it.
 *
 * # WHO OWNS WHAT, now that there are two pieces
 *
 * This card keeps the picker, the encode, the door call and the pending file;
 * the modal is presentational and hands back the words she settled on. The page
 * keeps `onDescribed` unchanged — it still decides where words go — so the one
 * thing that moved is WHEN it fires. And because the modal is only ever
 * rendered inside this component's live branch, the absent-or-live gate above
 * holds by construction: an account outside the scope cannot reach it at all.
 */
export function ConceptUploadCard({
  describe,
  onDescribed,
}: {
  /** The door, or nothing. See the header — this is the whole gate. */
  describe?: ((imageBase64: string) => Promise<string>) | null;
  /** Called with the words. The page decides where they go. */
  onDescribed: (description: string) => void;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  /** The picture under review, and the words for it — `null` while they are in flight. */
  const [picture, setPicture] = useState<File | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  /*
    WHICH READ IS STILL THE CURRENT ONE. She can Discard mid-read and pick
    another picture immediately; without this, the abandoned call's answer
    arrives later and fills the new modal with the old picture's words — a
    description silently describing something she is not looking at, which is
    the exact defect this modal exists to make impossible.
  */
  const readId = useRef(0);

  const close = () => {
    readId.current += 1;
    setPicture(null);
    setDescription(null);
    /*
      THE CARD IS RELEASED THE MOMENT SHE WALKS AWAY, not when the abandoned
      call settles (review of #196). `reading` disables the entry card and puts
      "Reading the picture…" on it, so leaving it latched meant that after
      Discard the card sat disabled, claiming to be reading a picture she had
      just thrown away, for the rest of the call's life — and the very thing
      `readId` exists for, picking another picture immediately, was unreachable
      because the button was disabled and a re-entrant pick hits the `reading`
      early return. A disabled control describing something untrue is D-180's
      shape wearing a spinner. The `finally` below is staleness-aware for the
      same reason: it must not clear a flag that a NEWER read has since set.
    */
    setReading(false);
  };

  /*
    THE TWO FAILURES ARE CAUGHT SEPARATELY, because they ask her to do
    different things and because the alternative is comparing an error's
    message text to a string another module authored — a coupling that goes
    silently wrong the day that module rewrites its sentence.
  */
  const read = async (file: File, door: (imageBase64: string) => Promise<string>) => {
    const mine = readId.current;
    let imageBase64: string;
    try {
      imageBase64 = await asBase64(file);
    } catch (error) {
      /*
        THE RAW TEXT IS MOVED, NOT LOST — `failureSentence.ts`'s own contract.
        Replacing a message for the screen and keeping it nowhere is what makes
        the next incident unreadable: every customer sees the same sentence and
        no console anywhere can tell a decode failure from a vendor 502.
      */
      logRawFailure("concept-upload/read-file", error);
      /*
        THE SAME STALENESS RULE AS THE DOOR'S FAILURE BELOW, and it was
        half-applied here until the review of #196: the guard covered `close()`
        and not the toast, so a file she had already discarded could still
        speak. The window is small — a decode is fast — and the asymmetry
        between two catch blocks four lines apart is how the next reader learns
        the wrong rule.
      */
      if (readId.current !== mine) return;
      close();
      toast(CONCEPT_FILE_UNREADABLE);
      return;
    }
    try {
      const words = await door(imageBase64);
      /*
        A read she walked away from says nothing to the screen. The toast is
        skipped on the failure path for the same reason: she has already moved
        on, and a sentence about a picture she discarded is noise.
      */
      if (readId.current !== mine) return;
      setDescription(words);
    } catch (error) {
      /*
        OUR SENTENCE, NEVER THE ERROR'S. The door's own refusals are written
        for a reader ("I couldn't find a person in that picture") and pass
        through untouched; a transport or a parser gets the fallback — and its
        own words go to the console rather than into the void. `Gated` because
        this control can be drawn live and then find the scope closed under it:
        the door's flag-first "No such thing." is a probe answer, never copy.

        The modal CLOSES on a refusal rather than holding an empty field with a
        toast over it: there is nothing to review, and an in-modal retry is the
        "extra options" his one-modal-one-confirm order rules out.
      */
      logRawFailure("concept-upload/describe", error);
      if (readId.current !== mine) return;
      close();
      toast(readableGatedFailure(error, CONCEPT_FAILED_FALLBACK));
    }
  };

  if (!describe) {
    return (
      <div className="dpc-entry dpc-entry--inert" aria-disabled="true">
        <span className="dpc-entry__icon">
          <Upload size={14} strokeWidth={1.9} aria-hidden="true" />
        </span>
        <span className="dp-stack" style={{ gap: 4, minWidth: 0 }}>
          <span className="dp-label">{CONCEPT_CARD_TITLE}</span>
          <span className="dp-secondary">{CONCEPT_CARD_COMING}</span>
        </span>
      </div>
    );
  }

  return (
    <>
      <input
        ref={picker}
        type="file"
        accept={ACCEPTED_PICTURE_FILES}
        className="dpc-entry__file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          /*
            Cleared before anything else, so choosing the SAME file twice fires
            again — a picker that ignores a repeat looks broken (the refine
            panel's attach input learned this first).
          */
          event.target.value = "";
          if (!file || reading) return;
          setReading(true);
          /*
            THE MODAL OPENS ON THE PICK, not on the answer — the picture is
            there immediately and the words fill in beside it. Opening only
            once the read returns would mean several silent seconds after the
            file chooser closes, which reads as nothing having happened.
          */
          readId.current += 1;
          const mine = readId.current;
          setDescription(null);
          setPicture(file);
          /*
            STALENESS-AWARE, because `close()` now clears `reading` itself: an
            abandoned call settling later must not switch off a flag that a
            NEWER pick has since switched on, which would leave the second read
            drawn as idle while it is still running.
          */
          void read(file, describe).finally(() => {
            if (readId.current === mine) setReading(false);
          });
        }}
      />
      <button
        type="button"
        className="dpc-entry"
        aria-busy={reading}
        disabled={reading}
        onClick={() => picker.current?.click()}
      >
        <span className="dpc-entry__icon">
          <Upload size={14} strokeWidth={1.9} aria-hidden="true" />
        </span>
        <span className="dp-stack" style={{ gap: 4, minWidth: 0 }}>
          <span className="dp-label">{CONCEPT_CARD_TITLE}</span>
          <span className="dp-secondary">
            {reading ? CONCEPT_READING_LABEL : CONCEPT_CARD_LINE}
          </span>
        </span>
      </button>

      {/*
        THE REVIEW STEP (#196). Rendered inside the live branch, which is what
        makes the gate structural: an account the server did not hand a door to
        never mounts this at all.
      */}
      {picture ? (
        <ConceptReviewModal
          file={picture}
          description={description}
          onUse={(words) => {
            close();
            onDescribed(words);
          }}
          onDismiss={close}
        />
      ) : null}
    </>
  );
}
