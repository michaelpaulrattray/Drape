/**
 * The reply box — the one control on this page that writes anything.
 *
 * It is the same component under every needs-you card and at the top of the
 * General box; the only difference is `cardId`, which is `null` for a general
 * note.
 * One writer, one shape, so the two cannot drift in what they send or in how
 * they behave when the send fails.
 *
 * No dead controls: the button is disabled while the body is empty or in
 * flight, and it says what it will do rather than "Submit".
 *
 * ⚠ **IT IS THE FOUNDATION'S FIELD AND BUTTON NOW (brief 08 §6)**, not shadcn's
 * `Textarea` and `Button`. That change deletes a comment as well as a class
 * list, and the deleted comment is the interesting part:
 *
 *   > *"`dark:bg-white` is load-bearing, not a tic: the admin panel is
 *   > light-fixed (every neighbour hardcodes white cards), but the shadcn
 *   > Textarea base carries `dark:bg-input/30`…"*
 *
 * It was load-bearing, and the thing it was bearing was the assumption that
 * this page is light-fixed. Brief 08 makes Crew themed like everything else, so
 * a box forced white would be the ONLY white rectangle on a dark page —
 * precisely the defect that comment was written to prevent, one theme over.
 * `.dp-field` paints on `--surface` and needs no override in either theme.
 *
 * `.dp-field` is built around a single-line input, so the textarea inside it
 * takes one modifier (`align-items: flex-start`) rather than a foundation
 * change made for one consumer.
 */
import { useState } from "react";
import { Send } from "lucide-react";

import { Button, Field } from "@/foundation";

/** The wire's own bound, restated here so the counter and the server agree. */
export const CREW_REPLY_MAX = 4000;

export function CrewReplyBox({
  cardId,
  placeholder,
  sending,
  onSend,
}: {
  cardId: string | null;
  placeholder: string;
  sending: boolean;
  onSend: (input: { cardId: string | null; body: string }) => Promise<unknown>;
}) {
  const [body, setBody] = useState("");
  const trimmed = body.trim();
  const tooLong = trimmed.length > CREW_REPLY_MAX;
  const canSend = trimmed.length > 0 && !tooLong && !sending;

  async function send() {
    if (!canSend) return;
    try {
      await onSend({ cardId, body: trimmed });
      /* Cleared only on success. A failed send that emptied the box would lose
         what he typed, which on this surface is a ruling. */
      setBody("");
    } catch {
      /* The page raises the toast; the text stays where he can see it. */
    }
  }

  return (
    <div className="dp-crew__replybox">
      {/* `invalid` past the bound: the field is the house's own error state,
          and the sentence under it still says the number. */}
      <Field className="dp-crew__replyfield" invalid={tooLong}>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={placeholder}
          rows={3}
          className="dp-crew__replyinput"
          onKeyDown={(event) => {
            /* Ctrl/⌘+Enter sends, because a multi-line ruling needs plain Enter
               for what plain Enter does everywhere else. */
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void send();
            }
          }}
        />
      </Field>
      <div className="dp-crew__replyfoot">
        <span className="dp-crew__mono">
          {tooLong
            ? `${trimmed.length.toLocaleString()} characters — the limit is ${CREW_REPLY_MAX.toLocaleString()}`
            : "⌘/Ctrl + Enter to send"}
        </span>
        <Button variant="primary" size="small" onClick={() => void send()} disabled={!canSend}>
          <Send className="w-3.5 h-3.5" />
          {sending ? "Sending…" : "Send to the crew"}
        </Button>
      </div>
    </div>
  );
}
