import { useRef, useState } from "react";

import {
  MAKEUP_READ_ACTION,
  MAKEUP_READ_BUSY,
  MAKEUP_READ_CAPTION,
  MAKEUP_READ_USE,
  makeupDroppedNote,
} from "../referenceReadCopy";

/**
 * TAKING A LOOK FROM A PHOTOGRAPH — the customer-facing half of the makeup read
 * (fable-940 bounds 3 and 4; the position pinned by fable-957 §2).
 *
 * She hands us a picture, we look at it once and describe the makeup in words,
 * and those words appear HERE as a sentence she may adopt or edit. Nothing is
 * kept: the reference is read and dropped — no object, no row, no digest, no
 * purge path — which is the strongest form of the real-person fence this
 * program has, because there is no artifact that could be wrong.
 *
 * # PREFILL ONLY, NEVER SEND — and it is the same promise the chip above makes
 *
 * `Use` fills the ask box and stops. Spending her credits is a deliberate act
 * and stays one, and if she sends the sentence unchanged it travels as an
 * ordinary makeup ask at the ordinary price, through the same duplicate warning
 * and the same doors as anything she typed by hand.
 *
 * That is also the only shape in which this road is legal: `refineDelta` has
 * required since D-172 that a makeup value appear in the CUSTOMER'S OWN
 * instruction, so a sentence routed silently from reader to render would be
 * refused by a guard that has stood there for months. The chip is the door
 * through which a reader's words become hers.
 *
 * # WHY THE READ IS A PROP AND NOT A HOOK IN HERE
 *
 * So the whole surface can be driven without a server: the panel is handed a
 * function that answers, and every state below — reading, read, refused —
 * appears in a test by resolving or rejecting it. A component that reached for
 * `trpc` itself could only be exercised through the network it is supposed to be
 * independent of.
 */
export type MakeupReadResult = {
  sentence: string;
  surfacesRead: readonly string[];
  surfacesDropped: readonly string[];
};

export function ReferenceMakeupChip({
  busy = false,
  onRead,
  onUse,
}: {
  /** A refine is in flight — the door closes while her credits are moving. */
  busy?: boolean;
  /** Base64 of the picture she chose; throws with a spoken message on refusal. */
  onRead: (imageBase64: string) => Promise<MakeupReadResult>;
  /** Fills the ask box. It never sends — see the header. */
  onUse: (sentence: string) => void;
}) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [reading, setReading] = useState(false);
  const [result, setResult] = useState<MakeupReadResult | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  async function readChosenFile(file: File): Promise<void> {
    setReading(true);
    /*
      THE PREVIOUS ANSWER GOES FIRST. A second read that left the first
      sentence on screen while it worked would show her words about a
      photograph she has already replaced — the stale-caption shape, one
      surface along.
    */
    setResult(null);
    setRefusal(null);
    try {
      const base64 = await asBase64(file);
      setResult(await onRead(base64));
    } catch (error) {
      /* The server's sentence, unchanged. A client that re-worded a refusal is
         how two surfaces come to say different things about one wall. */
      setRefusal(error instanceof Error && error.message ? error.message : "That photo couldn't be read.");
    } finally {
      setReading(false);
    }
  }

  const shut = busy || reading;

  return (
    <div className="dpc-refine__read">
      <input
        ref={fileInput}
        type="file"
        /* The three the door accepts. The BYTES are judged server-side either
           way — this only spares her choosing a file that will be refused. */
        accept="image/png,image/jpeg,image/webp"
        className="dpc-refine__readInput"
        onChange={(event) => {
          const file = event.target.files?.[0];
          /* Cleared before the await, so choosing the SAME file twice fires
             again — a picker that silently ignores a repeat looks broken. */
          event.target.value = "";
          if (file) void readChosenFile(file);
        }}
      />
      <button
        type="button"
        className="dpc-refine__readAction"
        disabled={shut}
        onClick={() => fileInput.current?.click()}
      >
        {reading ? MAKEUP_READ_BUSY : MAKEUP_READ_ACTION}
      </button>

      {refusal ? <p className="dpc-refine__readNote">{refusal}</p> : null}

      {result ? (
        <div className="dpc-refine__readResult">
          {/* WHAT THIS IS, before the sentence — past tense, about the PICTURE,
              and it says outright that nothing has changed. */}
          <p className="dpc-refine__readCaption">{MAKEUP_READ_CAPTION}</p>
          <div className="dpc-refine__made">
            <span className="dpc-refine__madeText">{result.sentence}</span>
            <button
              type="button"
              className="dpc-refine__madeUse"
              disabled={busy}
              onClick={() => onUse(result.sentence)}
            >
              {MAKEUP_READ_USE}
            </button>
          </div>
          {/* NAMED, never counted: the only useful thing she can do with this
              is type the missing surface herself. */}
          {makeupDroppedNote([...result.surfacesDropped]) ? (
            <p className="dpc-refine__readNote">
              {makeupDroppedNote([...result.surfacesDropped])}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The picture as base64, without its data-URL prefix.
 *
 * `FileReader` rather than `arrayBuffer()` + a manual encode: the manual loop
 * blows the stack on a large image through `String.fromCharCode(...bytes)`, and
 * a customer's photograph is exactly the size that finds it.
 */
function asBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That photo couldn't be read."));
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      const comma = value.indexOf(",");
      resolve(comma >= 0 ? value.slice(comma + 1) : value);
    };
    reader.readAsDataURL(file);
  });
}
