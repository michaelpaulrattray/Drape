/* Aliased, because the WINDOW listener below takes the DOM DragEvent and this
   module also handles React's synthetic one — same name, different objects, and
   the shadowing is exactly what made the first form of the Files filter fail to
   compile in a way that reads like a type quibble rather than a real difference. */
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
} from "react";
import { Upload } from "lucide-react";

import { asBase64, firstPictureFrom } from "../pictureBytes";
import { logRawFailure } from "@/lib/failureSentence";
import { readableGatedFailure } from "../failureCopy";
import {
  CONCEPT_CARD_COMING,
  CONCEPT_CARD_DROP,
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
 *   - `describe` supplied → the live control. Drop a picture on it or tap it,
 *     one describer call, and the words arrive in a modal she reads and casts.
 *   - `describe` absent → the honest coming-state the card has been since F5,
 *     with the copy pointed at the capability that is actually queued.
 *
 * **Absent-or-live, never disabled-and-live** — the page hands it a door or it
 * does not, exactly as the refine panel's attach affordance is handed one. A
 * control that is drawn as functional and can only refuse is D-180's dead end
 * wearing a tap target; a labelled coming-state is not, which is why the inert
 * card keeps its shape and loses its affordances rather than disappearing.
 *
 * # NOTHING IS SPENT BY THE READ, AND NOTHING IS KEPT
 *
 * The describer call costs the house cents and the customer nothing — no
 * credits, no render, no row. The bytes ride it inline and are dropped. The
 * DESCRIPTION is the artifact, and it lands where she can read and edit it
 * before she spends anything.
 *
 * ⚠ **A ROLL CAN NOW BE BOUGHT FROM THE MODAL — his first amendment on #196**
 * (*"the button should be cast it and it automatically casts the prompt the
 * same flow the original prompt and casting takes just through the modal"*).
 * Nothing about the money moves: `onCast` goes to the PAGE's one roll flow —
 * same entrance, same gear settings, same charge, same sheet — so there is
 * exactly one dispatch implementation and one double-submit latch in the
 * product, and this card holds neither.
 *
 * # THREE ENTRANCES, ONE READ — his second amendment
 *
 * *"i want to be able to drag and drop the image into the upload concept card
 * and it will auto open up the modal with the reference image in it
 * alternatively i can click the card and it opens up the modal and then i can
 * upload or drag and drop the reference image in"*. So:
 *
 *   1. a DROP on this card — the modal opens with the picture in it and the
 *      read already running (the drop IS the upload; there is no second
 *      gesture);
 *   2. a TAP on this card — the modal opens EMPTY on its drop zone;
 *   3. a drop or a pick INSIDE the modal.
 *
 * All three land on `beginRead`, and the picker now lives in the modal rather
 * than here, because entrance 2 must be able to open a dialog with no file at
 * all — a card that opened the OS file chooser first could never do that.
 *
 * # WHO OWNS WHAT
 *
 * This card owns every piece of STATE — the picture, the words, the refusal,
 * the staleness counter — and the one `beginRead`. The modal is presentational:
 * it draws what it is handed, hands back a file, and hands back the words she
 * settled on. The page keeps `onDescribed` and gains `onCast`; it still decides
 * where words go and it alone starts rolls. And because the modal is only ever
 * rendered inside this component's live branch, the absent-or-live gate above
 * holds by construction: an account outside the scope cannot reach it at all.
 */
/**
 * THE SECOND DOOR TO THIS FLOW (#435 §2e) — his brief puts `Start from photos`
 * in the hero's actions row, beside the settings control, because *"the
 * explainer already promises photos, and the flow already exists — but the only
 * way in was a card further down the page"*.
 *
 * A handle rather than a lifted `open` flag: the dialog's state is four pieces
 * (the flag, the picture, the words, the refusal) and they belong together
 * here, where every entrance already drives them. Lifting one of the four to
 * the page would put the page in charge of a machine it does not otherwise
 * touch, and entrance 2's whole point is that a tap opens the modal EMPTY —
 * which is exactly what this exposes and nothing more.
 *
 * ⚠ **The hero draws its link only where the server opened this door** — the
 * same `conceptUploadEnabled` answer that decides whether this card is live.
 * Off the scope the card renders inert, this handle does nothing, and a link
 * that opened nothing would be D-180's dead control on the busiest surface in
 * the product.
 */
export type ConceptUploadHandle = { openEmpty: () => void };

export const ConceptUploadCard = forwardRef<ConceptUploadHandle, {
  /** The door, or nothing. See the header — this is the whole gate. */
  describe?: ((imageBase64: string) => Promise<string>) | null;
  /** Server-derived, straight through to the modal's cost line (D-15). */
  priceCredits: number;
  /** Called with the words. The page decides where they go. */
  onDescribed: (description: string) => void;
  /** Called with the words to CAST. The page owns the one roll flow. */
  onCast: (description: string) => void;
}>(function ConceptUploadCard({ describe, priceCredits, onDescribed, onCast }, ref) {
  /** Whether the dialog is up. Its own flag, because a tap opens it with no file. */
  const [open, setOpen] = useState(false);
  /*
    Entrance 2, reached from the hero instead of from this card. Identical to
    the card's own tap — the modal opens on its drop zone with no file — so the
    two doors cannot drift into two behaviours.
  */
  useImperativeHandle(ref, () => ({ openEmpty: () => setOpen(true) }), []);
  /** The picture under review, and the words for it — `null` while they are in flight. */
  const [picture, setPicture] = useState<File | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  /** The refusal to show HER, already passed through `readableGatedFailure`. */
  const [failure, setFailure] = useState<string | null>(null);
  /**
   * WHETHER THE LAST FILE OFFERED WAS NOT A PICTURE.
   *
   * ⚠ It lived in the MODAL first, and that was a silent failure on one of the
   * three entrances: a PDF dropped on the CARD opened the dialog with nothing
   * said, because the modal's own copy of this could not know about a file the
   * card had judged. The card owns every piece of state on this road — that is
   * what its header claims — and this was the one piece it did not.
   */
  const [notAPicture, setNotAPicture] = useState(false);
  /** Whether a file is being dragged over the card. Depth-counted; see below. */
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  /*
    WHICH READ IS STILL THE CURRENT ONE. She can cancel mid-read and drop
    another picture immediately; without this, the abandoned call's answer
    arrives later and fills the new modal with the old picture's words — a
    description silently describing something she is not looking at, which is
    the exact defect this modal exists to make impossible.
  */
  const readId = useRef(0);

  /*
    ⚠ A MISSED DROP NAVIGATES THE TAB TO THE FILE, and takes her typed brief
    with it. That is the browser's default for a drop anywhere the page has not
    claimed, and it is the single worst outcome on this page — a 160-credit
    brief replaced by a JPEG in a viewer, with no undo.

    Swallowing it at the window is also the whole of his build note *"a drop
    anywhere else on the page does NOT trigger it (no accidental uploads)"*:
    nothing is uploaded and nothing is navigated to. Mounted with the LIVE card
    only, so an account outside the scope keeps the browser's own behaviour.
  */
  useEffect(() => {
    if (!describe) return;
    /*
      ⚠ FILES ONLY — the gate review's finding 1, and it was a real regression
      for everyone inside the flag. A bare `preventDefault` here cancels EVERY
      drop on the page, so dragging selected TEXT into the brief textarea did
      nothing at all, silently, with no sentence anywhere. His build note is
      about files ("no accidental uploads") and so is the hazard; the same
      `Files` test the card's own handlers apply four functions below is the
      whole of the fix.
    */
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
  }, [describe]);

  const close = () => {
    readId.current += 1;
    setOpen(false);
    setPicture(null);
    setDescription(null);
    setFailure(null);
    setNotAPicture(false);
  };

  /*
    THE TWO FAILURES ARE CAUGHT SEPARATELY, because they ask her to do
    different things and because the alternative is comparing an error's
    message text to a string another module authored — a coupling that goes
    silently wrong the day that module rewrites its sentence.

    ⚠ **BOTH NOW SPEAK IN THE DIALOG RATHER THAN IN A TOAST, and that reverses
    what PR #197 shipped** — his build note: *"a failed read gets a plain retry
    inside the modal, nothing charged"*. Closing the dialog on a refusal threw
    her picture away, so recovering from a transport blip meant finding the file
    again; and a toast behind a scrim is the product talking past the thing it
    is talking about.
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
      /* A read she walked away from says nothing to the screen. */
      if (readId.current !== mine) return;
      setFailure(CONCEPT_FILE_UNREADABLE);
      return;
    }
    try {
      const words = await door(imageBase64);
      if (readId.current !== mine) return;
      setDescription(words);
    } catch (error) {
      /*
        OUR SENTENCE, NEVER THE ERROR'S. The door's own refusals are written
        for a reader ("I couldn't find anyone in that picture") and pass
        through untouched; a transport or a parser gets the fallback — and its
        own words go to the console rather than into the void. `Gated` because
        this control can be drawn live and then find the scope closed under it:
        the door's flag-first "No such thing." is a probe answer, never copy.
      */
      logRawFailure("concept-upload/describe", error);
      if (readId.current !== mine) return;
      setFailure(readableGatedFailure(error, CONCEPT_FAILED_FALLBACK));
    }
  };

  /*
    THE ONE ROAD IN, for all three entrances. A read that starts here always
    opens the dialog: the picture is on screen immediately and the words fill in
    beside it, because several silent seconds after a drop or a file chooser
    reads as nothing having happened.
  */
  const beginRead = (file: File) => {
    if (!describe) return;
    readId.current += 1;
    setOpen(true);
    setNotAPicture(false);
    setPicture(file);
    setDescription(null);
    setFailure(null);
    void read(file, describe);
  };

  /*
    THE ONE PLACE A FILE IS JUDGED, for all three entrances — the card's drop,
    the dialog's drop, and the dialog's picker. `firstPictureFrom` is called
    here and nowhere else, so the three cannot disagree about what a picture is,
    and a file that is not one always OPENS THE DIALOG AND SAYS SO: the dialog
    is where the drop zone, the sentence and the picker all are, so she lands on
    the surface that can take her next act.
  */
  const offerFile = (files: FileList | null) => {
    const picture = firstPictureFrom(files);
    if (picture) {
      beginRead(picture);
      return;
    }
    setNotAPicture(true);
    setOpen(true);
  };

  /*
    DEPTH-COUNTED, because `dragleave` fires every time the pointer crosses into
    a CHILD element — the icon, the title, the line — so a naive enter/leave
    pair flickers the card's drop state on and off as the cursor moves across
    its own text.
  */
  const onDragEnter = (event: ReactDragEvent) => {
    if (!event.dataTransfer?.types?.includes("Files")) return;
    dragDepth.current += 1;
    setDragging(true);
  };
  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };
  /*
    `preventDefault` on dragover is what MAKES an element a drop target. Without
    it the browser refuses the drop, and the window guard above then swallows
    it — so the card would look like a drop target and silently eat every file.
  */
  const onDragOver = (event: ReactDragEvent) => {
    if (!event.dataTransfer?.types?.includes("Files")) return;
    event.preventDefault();
  };
  const onDrop = (event: ReactDragEvent) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (open) return;
    offerFile(event.dataTransfer?.files ?? null);
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

  const reading = picture !== null && description === null && failure === null;

  return (
    <>
      <button
        type="button"
        className={dragging ? "dpc-entry dpc-entry--drop" : "dpc-entry"}
        aria-busy={reading}
        /*
          NOT TAPPABLE WHILE ITS OWN DIALOG IS UP — it is behind a scrim, and
          leaving it in the tab order gives the focus trap somewhere to leak to.
          It is released the moment she walks away, because `close()` clears
          `open` itself: the earlier shape latched the card to the abandoned
          CALL, so after a discard it sat disabled describing a picture she had
          just thrown away.
        */
        disabled={open}
        onClick={() => setOpen(true)}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <span className="dpc-entry__icon">
          <Upload size={14} strokeWidth={1.9} aria-hidden="true" />
        </span>
        <span className="dp-stack" style={{ gap: 4, minWidth: 0 }}>
          <span className="dp-label">{CONCEPT_CARD_TITLE}</span>
          <span className="dp-secondary">
            {dragging ? CONCEPT_CARD_DROP : reading ? CONCEPT_READING_LABEL : CONCEPT_CARD_LINE}
          </span>
        </span>
      </button>

      {/*
        THE REVIEW STEP (#196). Rendered inside the live branch, which is what
        makes the gate structural: an account the server did not hand a door to
        never mounts this at all.
      */}
      {open ? (
        <ConceptReviewModal
          file={picture}
          description={description}
          failure={failure}
          notAPicture={notAPicture}
          priceCredits={priceCredits}
          onFiles={offerFile}
          onRetry={() => {
            if (picture) beginRead(picture);
          }}
          onUse={(words) => {
            close();
            onDescribed(words);
          }}
          onCast={(words) => {
            close();
            onCast(words);
          }}
          onDismiss={close}
        />
      ) : null}
    </>
  );
});
