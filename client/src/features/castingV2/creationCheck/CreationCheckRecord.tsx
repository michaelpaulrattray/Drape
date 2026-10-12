import {
  NO_PUBLIC_RECORD_BODY,
  NO_PUBLIC_RECORD_TEXT,
  PUBLIC_CHECK_FOOTNOTE,
  PUBLIC_CHECK_HEADING,
  PUBLIC_CHECK_LABELS,
  PUBLIC_CHECK_REAL_LINE,
  publicCheckDate,
  recordedLine,
} from "@shared/creationCheckCopy";

import "./creationCheck.css";

/**
 * THE RECORD, AS A STRANGER SEES IT — N2d-3 (#2313).
 *
 * ONE COMPONENT FOR TWO PLACES, ON PURPOSE: the public page at `/check/:id`
 * and the owner's preview in the casting room both draw this, from the same
 * server projector (`server/castingV2/creationCheck.ts`). So what the owner is
 * shown before turning the page on is exactly what anyone will see (design §2
 * Q2: "shows the page before it goes on") — a second rendering for the preview
 * would be a copy free to drift from the page it promises.
 *
 * Six facts and no picture, the Klieg ID as the heading. The fingerprint is drawn the way a passport
 * number is (design §2 Q1): a fact to quote, in the mono face, and nothing
 * explaining what a hash is.
 */
export type CreationCheckRecordData = {
  kliegId: string;
  makerName: string | null;
  createdAt: string;
  recordedAt: string;
  stampedAt: string | null;
  fingerprint: string;
};

export function CreationCheckRecordView({
  record,
  headingLevel = 1,
}: {
  record: CreationCheckRecordData;
  /** 1 on the page itself; lower inside the casting room's preview, which has its own heading. */
  headingLevel?: 1 | 3;
}) {
  const Title = headingLevel === 1 ? "h1" : "h3";
  const recorded = recordedLine(
    publicCheckDate(record.stampedAt ?? record.recordedAt),
    record.stampedAt !== null,
  );
  return (
    <article className="dpx-check" aria-label={PUBLIC_CHECK_HEADING}>
      <header className="dpx-check__head">
        <span className="dpx-check__eyebrow">{PUBLIC_CHECK_HEADING}</span>
        {/* THE KLIEG ID IS THE HEADING. The cast's name is not on this page (the
            relay's finding 1 on PR #2325): it is unsigned and customer-written,
            and it waits on #2323. The ID is the one thing a visitor came with. */}
        <Title className="dpx-check__title dpx-check__title--id">{record.kliegId}</Title>
        <p className="dpx-check__real">{PUBLIC_CHECK_REAL_LINE}</p>
      </header>
      <dl className="dpx-check__facts">
        {record.makerName ? (
          <div className="dpx-check__row">
            <dt>{PUBLIC_CHECK_LABELS.madeBy}</dt>
            <dd>{record.makerName}</dd>
          </div>
        ) : null}
        <div className="dpx-check__row">
          <dt>{PUBLIC_CHECK_LABELS.created}</dt>
          <dd>{publicCheckDate(record.createdAt)}</dd>
        </div>
        <div className="dpx-check__row">
          <dt>{PUBLIC_CHECK_LABELS.recorded}</dt>
          <dd>{recorded}</dd>
        </div>
        <div className="dpx-check__row dpx-check__row--stack">
          <dt>{PUBLIC_CHECK_LABELS.fingerprint}</dt>
          <dd className="dpx-check__mono dpx-check__fingerprint">{record.fingerprint}</dd>
        </div>
      </dl>
      <p className="dpx-check__foot">{PUBLIC_CHECK_FOOTNOTE}</p>
    </article>
  );
}

/** The one answer for every ID with no public page — unknown, private and deleted alike. */
export function NoPublicRecordView() {
  return (
    <article className="dpx-check dpx-check--none" aria-label={NO_PUBLIC_RECORD_TEXT}>
      <header className="dpx-check__head">
        <span className="dpx-check__eyebrow">{PUBLIC_CHECK_HEADING}</span>
        <h1 className="dpx-check__title">{NO_PUBLIC_RECORD_TEXT}</h1>
        <p className="dpx-check__real">{NO_PUBLIC_RECORD_BODY}</p>
      </header>
    </article>
  );
}
