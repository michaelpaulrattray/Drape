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
 *
 * ⚠ **THE `Already judged` LIST LEFT THIS SECTION (#292).** It was the second
 * of three history lists on one page, which he read as *"double ups"*. Judged
 * items are still on the page — tagged *You judged* in the one
 * `CrewRecentHistory` block — so nothing he decided has been dropped; there is
 * simply one place for the past instead of three.
 *
 * # ⚠ THIS IS THE ONE SECTION THAT BREAKS THE READING COLUMN (brief 08 §2)
 *
 * Crew is a 790px column. This section — and only this section — goes to the
 * 1240px working measure, because its whole job is judging pictures and *"at
 * 790px a four-up grid gives 180px tiles — too small to see what you are being
 * asked to decide."* It is a full-bleed wrapper on the section, never a wider
 * page: everything above and below it stays at the reading measure.
 *
 * # ⚠ AND THERE IS NO KEPT TILE, BECAUSE THERE IS NO KEPT ITEM
 *
 * §6 asks for the casting keeper grammar — a `3px --accentSolid` underline plus
 * a pill when kept. This gallery renders `state === "open"` only; #292 moved
 * every judged item into the history block, which was his own ruling. So a kept
 * tile cannot occur here, and styling one would be a dead state that reads as
 * tested. What ships is the other half of the same sentence: dashed while
 * undecided — true of every tile on this surface by construction, the same way
 * `NeedsHuman`'s cards are dashed one surface over.
 */
import { useState } from "react";
import { CrewEyeViewer } from "./CrewEyeViewer";
import { CrewReplyBox } from "./CrewReplyBox";
import { CrewReplyThread } from "./CrewReplyThread";
import { shortDate } from "./CrewProgramBanner";
import { eyeFrameSrc } from "./eyeFrameSrc";
import { TableHead } from "@/foundation";
import type { CrewEyeItem, CrewReplyView } from "./crewTypes";

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
  /* Which frame is under his eye: (item id, frame index), or null. Keyed by
     item so the viewer's arrows page WITHIN one judgement — a court's arms
     are compared against each other, never against another item's. */
  const [viewing, setViewing] = useState<{ itemId: string; index: number } | null>(null);

  const open = items.filter((item) => item.state === "open");
  const viewedItem = viewing ? items.find((item) => item.id === viewing.itemId) : undefined;

  /* Nothing OPEN means nothing to judge: an empty gallery frame would be
     furniture, and the judged ones are in the history block now. */
  if (open.length === 0) return null;

  return (
    <section className="dp-crew__section dp-crew__bleed">
      <TableHead eyebrow="For your eyes">
        <span className="dp-crew__meta">{open.length} open</span>
      </TableHead>

      <div className="dp-crew__stack">
        {open.map((item) => (
          <article key={item.id} className="dp-crew__card">
            <div className="dp-crew__cardhead">
              <h3 className="dp-crew__title">{item.title}</h3>
              <span className="dp-crew__ref">
                {item.issueNumber !== null && <>#{item.issueNumber} · </>}
                filed {shortDate(item.filedAt)}
              </span>
            </div>

            {/* The question leads — what he is judging, not just the picture. */}
            <p className="dp-crew__body dp-crew__gap">{item.question}</p>

            <div className="dp-crew__frames">
              {item.frames.map((frame, frameIndex) => (
                <figure key={frame.key}>
                  {/* The thumbnail is the overview; the click opens the
                      judging surface (#75's viewer ask, his verbatim). */}
                  <button
                    type="button"
                    onClick={() => setViewing({ itemId: item.id, index: frameIndex })}
                    aria-label={`View full size: ${frame.caption}`}
                    className="dp-crew__frame"
                  >
                    <img
                      src={eyeFrameSrc(frame.key)}
                      alt={frame.caption}
                      loading="lazy"
                      className="dp-crew__frameimg"
                    />
                  </button>
                  <figcaption className="dp-crew__caption">
                    {frame.arm && <span className="dp-crew__arm">{frame.arm}</span>}
                    {frame.caption}
                  </figcaption>
                </figure>
              ))}
            </div>

            <div className="dp-crew__rule dp-crew__rule--tight">
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

      {viewing && viewedItem && (
        <CrewEyeViewer
          frames={viewedItem.frames}
          index={Math.min(viewing.index, viewedItem.frames.length - 1)}
          onNavigate={(index) => setViewing({ itemId: viewedItem.id, index })}
          onClose={() => setViewing(null)}
        />
      )}
    </section>
  );
}
