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
 * ⚠ **THE `Already judged` LIST LEFT THIS SECTION (#292) AND THEN LEFT THE PAGE
 * (#438).** It was the second of three history lists, which he read as *"double
 * ups"*; the three became one, and on 2026-09-02 he deleted the one — by then
 * it held 281 rows and was the fourth telling of *done*. **Nothing he decided
 * is lost**: judged eye items keep their `state` in `crew-briefing.json`, which
 * is in git, and what SHIPPED is in `WORKING NOW` and in `THE PROGRAM`'s steps.
 * What went is a fourth display of it, not the record.
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
 * a pill when kept. This gallery renders what still needs him; #292 moved
 * every judged item into the history block, which was his own ruling. So a kept
 * tile cannot occur here, and styling one would be a dead state that reads as
 * tested. What ships is the other half of the same sentence: dashed while
 * undecided — true of every tile on this surface by construction, the same way
 * `NeedsHuman`'s cards are dashed one surface over.
 */
import { crewCardNeedsHim } from "../../../../../../shared/crewCardState";
import { CrewEyeFrames } from "./CrewEyeFrames";
import { CrewReplyBox } from "./CrewReplyBox";
import { CrewReplyThread } from "./CrewReplyThread";
import { staffDateTime } from "@/foundation/staffDate";
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
  /* ⚠ `crewCardNeedsHim` (#354, review of PR #648 finding 4). Deriving the
     schema's enum from `CREW_CARD_STATES` made `waiting` writable here, and
     the history block was deleted in #438 — so a `waiting` eye item rendered
     NOWHERE, silently. That is "the vanishing the design forbids", in this
     feature's own words, created by the fix for its own class. */
  const open = items.filter((item) => crewCardNeedsHim(item.state));

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
              <span className="dp-chrome dp-crew__ref">
                {item.issueNumber !== null && <>#{item.issueNumber} · </>}
                filed {staffDateTime(item.filedAt)}
              </span>
            </div>

            {/* The question leads — what he is judging, not just the picture. */}
            <p className="dp-crew__body dp-crew__gap">{item.question}</p>

            <CrewEyeFrames frames={item.frames} />

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
    </section>
  );
}
