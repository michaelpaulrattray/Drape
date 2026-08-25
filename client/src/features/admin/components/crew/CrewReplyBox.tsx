/**
 * The reply box — the one control on this page that writes anything.
 *
 * It is the same component under every needs-you card and at the top of the
 * journal; the only difference is `cardId`, which is `null` for a journal note.
 * One writer, one shape, so the two cannot drift in what they send or in how
 * they behave when the send fails.
 *
 * No dead controls: the button is disabled while the body is empty or in
 * flight, and it says what it will do rather than "Submit".
 */
import { useState } from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
    <div className="mt-3">
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={placeholder}
        rows={3}
        /* `dark:bg-white` is load-bearing, not a tic: the admin panel is
           light-fixed (every neighbour hardcodes white cards), but the shadcn
           Textarea base carries `dark:bg-input/30`, which painted these boxes
           as grey slabs with unreadable placeholders whenever the app theme —
           dark by default — was active. Measured at the computed style, not
           assumed. */
        className="resize-y bg-white dark:bg-white border-[#D5D5D5] text-sm text-[#0A0A0A] placeholder:text-[#BBB] focus-visible:ring-0 focus-visible:border-[#0A0A0A]"
        onKeyDown={(event) => {
          /* Ctrl/⌘+Enter sends, because a multi-line ruling needs plain Enter
             for what plain Enter does everywhere else. */
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            void send();
          }
        }}
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-[11px] text-[#BBB]">
          {tooLong
            ? `${trimmed.length.toLocaleString()} characters — the limit is ${CREW_REPLY_MAX.toLocaleString()}`
            : "⌘/Ctrl + Enter to send"}
        </span>
        <Button
          size="sm"
          onClick={() => void send()}
          disabled={!canSend}
          className="bg-[#0A0A0A] hover:bg-[#222] text-white text-xs disabled:opacity-40"
        >
          <Send className="w-3.5 h-3.5 mr-1.5" />
          {sending ? "Sending…" : "Send to the crew"}
        </Button>
      </div>
    </div>
  );
}
