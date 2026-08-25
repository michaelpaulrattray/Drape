/**
 * FOR YOUR EYES — the gallery (#75). His verbatim ask: *"when these things run
 * and require my eyes is there a gallery built into this page so i can
 * genuinely view the tests with an explaination about what im looking at?"*
 *
 * Each item leads with the QUESTION he is judging — his card law, the meaning
 * before the mechanics — then the frames, each with a plain-English caption
 * and its arm label. Images load only through `/api/crew/eye-frame/…`
 * (admin-gated; the deployed briefing is the allowlist), never a bucket URL.
 *
 * His verdict is a reply on the item, exactly like a card: the thread renders
 * under open items, and "Seen by the crew" follows the same deployed-edition
 * honesty rule. The section renders NOTHING when no items exist — an empty
 * gallery frame would be furniture.
 */
import { cn } from "@/lib/utils";
import { CrewReplyBox } from "./CrewReplyBox";
import { CrewReplyThread } from "./CrewReplyThread";
import { shortDate } from "./CrewProgramBanner";
import type { CrewEyeItem, CrewReplyView } from "./crewTypes";

/** The only address frames load from — the briefing key's basename. */
export function eyeFrameSrc(key: string): string {
  return `/api/crew/eye-frame/${key.split("/").pop() ?? ""}`;
}

export function CrewEyeGallery({
  items,
  replies,
  acknowledgedReplyIds,
  sending,
  onSend,
}: {
  items: readonly CrewEyeItem[];
  replies: readonly CrewReplyView[];
  acknowledgedReplyIds: readonly number[];
  sending: boolean;
  onSend: (input: { cardId: string | null; body: string }) => Promise<unknown>;
}) {
  if (items.length === 0) return null;

  const open = items.filter((item) => item.state === "open");
  const closed = items.filter((item) => item.state !== "open");

  return (
    <section>
      <h2 className="text-[11px] uppercase tracking-[0.12em] text-[#999] mb-3">
        For your eyes {open.length > 0 && <span className="text-[#0A0A0A]">· {open.length}</span>}
      </h2>

      <div className="space-y-4">
        {open.map((item) => (
          <article key={item.id} className="bg-white rounded-2xl border border-[#E5E5E5] p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3 className="text-base font-semibold text-[#0A0A0A]">{item.title}</h3>
              <span className="text-[11px] text-[#BBB] shrink-0">
                {item.issueNumber !== null && <>#{item.issueNumber} · </>}
                filed {shortDate(item.filedAt)}
              </span>
            </div>

            {/* The question leads — what he is judging, not just the picture. */}
            <p className="mt-3 text-sm leading-relaxed text-[#0A0A0A]">{item.question}</p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {item.frames.map((frame) => (
                <figure key={frame.key}>
                  <div className="rounded-lg overflow-hidden border border-[#E5E5E5] bg-[#F6F6F6]">
                    <img
                      src={eyeFrameSrc(frame.key)}
                      alt={frame.caption}
                      loading="lazy"
                      className="w-full h-auto block"
                    />
                  </div>
                  <figcaption className="mt-1.5 text-[12px] leading-snug text-[#666]">
                    {frame.arm && (
                      <span className="font-medium text-[#0A0A0A] mr-1.5">{frame.arm}</span>
                    )}
                    {frame.caption}
                  </figcaption>
                </figure>
              ))}
            </div>

            <div className="mt-5 pt-4 border-t border-[#EFEFEF]">
              <CrewReplyThread
                replies={replies.filter((reply) => reply.cardId === item.id)}
                acknowledgedReplyIds={acknowledgedReplyIds}
              />
              <CrewReplyBox
                cardId={item.id}
                placeholder="Your verdict — what your eye says, in your words."
                sending={sending}
                onSend={onSend}
              />
            </div>
          </article>
        ))}
      </div>

      {closed.length > 0 && (
        <div className={cn("bg-white rounded-2xl border border-[#E5E5E5] p-5 sm:p-6", open.length > 0 && "mt-4")}>
          <h3 className="text-[11px] uppercase tracking-[0.12em] text-[#999] mb-3">
            Already judged
          </h3>
          <ul className="space-y-2">
            {closed.map((item) => (
              <li key={item.id} className="flex items-baseline gap-3 text-sm">
                <span className="text-[11px] shrink-0 w-16 text-[#999]">
                  {item.state === "done" ? "Done" : "Answered"}
                </span>
                <span className="flex-1 leading-relaxed text-[#666]">{item.title}</span>
                {item.issueNumber !== null && (
                  <span className="text-[11px] text-[#BBB] shrink-0">#{item.issueNumber}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
