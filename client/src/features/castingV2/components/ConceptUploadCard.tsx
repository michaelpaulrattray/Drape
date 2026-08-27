import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";

import { asBase64 } from "../pictureBytes";
import { readableFailure } from "@/lib/failureSentence";
import {
  CONCEPT_ACCEPTED_FILES,
  CONCEPT_CARD_COMING,
  CONCEPT_CARD_LINE,
  CONCEPT_CARD_TITLE,
  CONCEPT_FAILED_FALLBACK,
  CONCEPT_FILE_UNREADABLE,
  CONCEPT_READING_LABEL,
} from "../conceptUpload";

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
 * render, no row. The bytes ride the describer inline and are dropped, so this
 * component holds the chosen file only long enough to encode it and never
 * builds an object URL for it: there is no preview here because there is
 * nothing to preview a decision about. The DESCRIPTION is the artifact, and it
 * lands where she can read and edit it before she spends anything.
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

  /*
    THE TWO FAILURES ARE CAUGHT SEPARATELY, because they ask her to do
    different things and because the alternative is comparing an error's
    message text to a string another module authored — a coupling that goes
    silently wrong the day that module rewrites its sentence.
  */
  const read = async (file: File, door: (imageBase64: string) => Promise<string>) => {
    let imageBase64: string;
    try {
      imageBase64 = await asBase64(file);
    } catch {
      toast(CONCEPT_FILE_UNREADABLE);
      return;
    }
    try {
      onDescribed(await door(imageBase64));
    } catch (error) {
      /*
        OUR SENTENCE, NEVER THE ERROR'S. The door's own refusals are written
        for a reader ("I couldn't find a person in that picture") and pass
        through untouched; a transport or a parser gets the fallback.
      */
      toast(readableFailure(error, CONCEPT_FAILED_FALLBACK));
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
        accept={CONCEPT_ACCEPTED_FILES}
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
          void read(file, describe).finally(() => setReading(false));
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
    </>
  );
}
