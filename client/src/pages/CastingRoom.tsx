import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Lock, Play, Plus } from "lucide-react";

import { AppShell, Button, EmptyState, Skeleton } from "@/foundation";
import { trpc } from "@/lib/trpc";
import "@/features/castingV2/castingV2.css";

/**
 * The casting room (plan §F, §J; handoff chapter 07).
 *
 * It opens on the signed master and the views arrive underneath it. That is
 * the ratified shape rather than a loading screen: the moment the Cast exists
 * the customer has what they paid the promotion for — a locked face with an id
 * — and making them watch a spinner for six 2K generations would hide the one
 * thing that already happened.
 *
 * **A slot that is never coming confesses in its own place.** That is a gate
 * condition, not polish (D-92, founder ruling 2026-08-02): a shimmer promises
 * arrival and a blank promises nothing, and both leave someone waiting for
 * something that will never arrive. The sentence and the refund figure come
 * from the server, so every surface confesses identically and no client can
 * invent a friendlier version of a refund.
 *
 * Everything here is server truth. There is no room store: the projection is
 * polled while the package builds and the poll stops when it is terminal.
 */

const POLL_MS = 2_500;

/**
 * The drawn placeholders, kept as structure with honest captions.
 *
 * F5: the prototype's page anatomy ships as drawn even where the feature does
 * not exist yet — that is future development, not hallucination. What gets
 * stripped is only the false claims: the drawing's "18 frames on file" and its
 * take durations are fiction, so they are gone; the grid that holds them is
 * not.
 */
const TAKE_PLACEHOLDERS = [
  "to camera, mid-sentence",
  "side profile, window light",
  "holding product",
  "wide, in a kitchen",
  "laughing, unposed",
  "walk-and-talk",
];

/** The drawn refine chips. Inert until refinement ships. */
const REFINE_CHIPS = ["Softer light", "Plain styling", "Outdoors", "Closer crop", "Tired, end of day"];

/** The voice card's waveform, at rest. Fixed heights: no fake audio. */
const WAVE = [30, 55, 40, 70, 45, 85, 35, 60, 50, 75, 40, 65, 30, 80, 45, 55, 70, 35, 60, 40, 75, 50, 65, 30, 55, 45, 70, 40, 60, 35];

/** What the two companion cells show, before either has landed. */
const COMPANION_LABELS = ["Close-up", "Three-quarter"];

export default function CastingRoom() {
  const [, params] = useRoute("/casting/cast/:castId");
  const [, navigate] = useLocation();
  const castId = params?.castId ?? "";

  const config = trpc.castingV2.config.useQuery({});
  const cast = trpc.castingV2.getCast.useQuery(
    { castId },
    {
      enabled: Boolean(castId) && config.data?.enabled === true,
      // The poll stops itself. A room whose package is terminal has nothing
      // left to learn, and a permanent 2.5s heartbeat on a finished Cast is a
      // cost with no reader.
      refetchInterval: (query) => (query.state.data?.status === "building" ? POLL_MS : false),
    },
  );

  useEffect(() => {
    if (config.data && config.data.enabled === false) navigate("/casting");
  }, [config.data, navigate]);

  const data = cast.data;

  /*
    THE TWO COMPANION SLOTS (founder ruling on hero fill): the close-up and the
    three-quarter, in that order, whichever of them has actually landed.

    Progressive by design — when Takes exist they replace these, because a Take
    says more about a Cast than a second angle of the same studio frame does.
    Until then the package's own best two fill the space rather than leaving a
    drawn block half empty.
  */
  const companions = ["frontClose", "threeQuarter"].map(
    (angle) => data?.slots.find((slot) => slot.angle === angle && slot.url) ?? null,
  );

  return (
    <AppShell breadcrumb="Casting / Room" current="casting" width="working">
      <div className="dp-stack" style={{ gap: 22 }}>
        <div className="dp-row" style={{ justifyContent: "space-between" }}>
          <Button variant="quiet" size="small" onClick={() => navigate("/casting")}>
            <ArrowLeft size={12} strokeWidth={2} aria-hidden="true" />
            Casting
          </Button>
          {data?.lineage.fromSessionPublicId ? (
            <Button
              variant="quiet"
              size="small"
              onClick={() => navigate(`/casting/s/${data.lineage.fromSessionPublicId}`)}
            >
              Back to the sheet
            </Button>
          ) : null}
        </div>

        {cast.isError ? (
          <EmptyState
            title="That Cast isn't here"
            body="It may have been deleted, or the link may belong to another account."
          />
        ) : null}

        {!data && !cast.isError ? (
          <div className="dpc-room__hero">
            <Skeleton style={{ aspectRatio: "4 / 5" }} label="OPENING" />
            <div className="dp-stack" style={{ gap: 10 }}>
              <Skeleton style={{ height: 26 }} />
              <Skeleton style={{ height: 14, width: "60%" }} />
            </div>
          </div>
        ) : null}

        {data ? (
          <>
            {/*
              THE HEADER, as drawn: name + kind pill, the one-line read beneath,
              and two actions on the right whose WEIGHTS carry the drawing's
              hierarchy — outline, then filled. Both are inert because neither
              capability exists; the honest-capability law changes the state,
              never the hierarchy.
            */}
            <header className="dpc-room__head">
              <div className="dp-stack" style={{ gap: 7 }}>
                <div className="dpc-room__nameline">
                  <h1 className="dpc-room__name">{data.name ?? "Unnamed"}</h1>
                  <span className="dpc-room__kind">PERFORMER</span>
                </div>
                <p className="dpc-room__read">
                  {[data.personaLine, data.provenance].filter(Boolean).join(". ")}
                </p>
              </div>
              <div className="dpc-room__actions">
                <button type="button" className="dpc-room__cta" disabled>
                  Open in canvas · soon
                </button>
                <button type="button" className="dpc-room__cta dpc-room__cta--primary" disabled>
                  Cast in a campaign · soon
                </button>
              </div>
            </header>

            <div className="dpc-room__columns">
              <div className="dpc-room__left">
                {/*
                  THE MASTER BLOCK — one card: a 58/42 media split with 1px
                  gutters, and the status bar ATTACHED inside its border. The
                  first build detached that bar and inflated the media into a
                  page-filling collage; both are fixed against the measured
                  drawing rather than against a description of it.
                */}
                <section className="dpc-master">
                  <div className="dpc-master__media">
                    <div className="dpc-master__main">
                      {data.anchorUrl ? (
                        <img src={data.anchorUrl} alt={data.name ?? "The signed face"} />
                      ) : null}
                      <span className="dpc-master__tag">MASTER</span>
                    </div>
                    <div className="dpc-master__side">
                      {companions.map((slot, index) => (
                        <div className="dpc-master__cell" key={slot?.angle ?? `companion-${index}`}>
                          {slot?.url ? (
                            <img src={slot.url} alt={slot.label} />
                          ) : (
                            <span className="dpc-master__empty">
                              {slot ? slot.label : COMPANION_LABELS[index]}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="dpc-master__foot">
                    {/*
                      The drawing reads "99.4% identity retention across 18
                      frames". That number is fiction, and F5 strips false
                      claims while keeping designed structure — so the bar, its
                      geometry and its position stay, and only the sentence
                      changes to something true.
                    */}
                    <span className="dpc-master__retention">
                      {data.status === "building"
                        ? "Building the package — views appear as they pass their checks."
                        : "Every view here was checked against the face you signed."}
                    </span>
                    <span className="dpc-master__locked">
                      <Lock size={11} strokeWidth={2} aria-hidden="true" />
                      IDENTITY LOCKED
                    </span>
                  </div>
                </section>

                {/*
                  REFINE — the drawn anatomy, inert. Input, button and chips all
                  render and are all disabled, following the F5 Upload-a-real-
                  person precedent: present with an honest coming-soon state,
                  never omitted, never a control that pretends to work.
                */}
                <section className="dpc-rcard dpc-refine">
                  <div className="dpc-rcard__head">
                    <span className="dpc-rcard__title">Refine without recasting</span>
                    <span className="dpc-rcard__hint">
                      Face stays locked. Everything else is fair game.
                    </span>
                  </div>
                  <div className="dpc-refine__shell">
                    <input
                      className="dpc-refine__input"
                      placeholder="softer light, less styled hair, plain grey tee"
                      disabled
                      aria-label="Refine this Cast (not available yet)"
                    />
                    <button type="button" className="dpc-refine__go" disabled>
                      New takes
                    </button>
                  </div>
                  <div className="dpc-refine__chips">
                    {REFINE_CHIPS.map((chip) => (
                      <button type="button" className="dpc-refine__chip" key={chip} disabled>
                        {chip}
                      </button>
                    ))}
                  </div>
                  <p className="dpc-rcard__body">
                    Refining a signed Cast arrives with refinement. Until then, a new direction
                    means a new sheet.
                  </p>
                </section>

                {/* TAKES — drawn placeholder grid. It was absent entirely. */}
                <section className="dpc-takes">
                  <div className="dpc-takes__head">
                    <span className="dpc-rcard__title">Takes</span>
                    <span className="dpc-rcard__hint">No takes yet</span>
                  </div>
                  <div className="dpc-takes__grid">
                    {TAKE_PLACEHOLDERS.map((caption) => (
                      <div className="dpc-takes__tile" key={caption}>
                        <span className="dpc-takes__caption">{caption}</span>
                      </div>
                    ))}
                    <div className="dpc-takes__tile dpc-takes__tile--add">
                      <Plus size={15} strokeWidth={1.7} aria-hidden="true" />
                    </div>
                  </div>
                </section>

                {/*
                  THE PACKAGE — not in the drawing. Added below the drawn
                  sections by founder ruling (2026-08-02): it is infrastructure,
                  not the show. The confession still renders in place on any
                  slot that is not coming (D-92's gate condition).
                */}
                <section className="dpc-takes">
                  <div className="dpc-takes__head">
                    <span className="dpc-rcard__label">THE PACKAGE</span>
                    <span className="dpc-rcard__hint">
                      {data.slots.filter((slot) => slot.state === "ready").length} of{" "}
                      {data.slots.length} views
                    </span>
                  </div>
                  <div className="dpc-strip">
                    {data.slots.map((slot) => (
                      <article className="dpc-strip__item" key={slot.angle}>
                        <div className="dpc-strip__frame">
                          {slot.url ? <img src={slot.url} alt={slot.label} /> : null}
                          {slot.state === "building" && !slot.url ? (
                            <Skeleton
                              style={{ position: "absolute", inset: 0, borderRadius: 9 }}
                              label=""
                            />
                          ) : null}
                          {slot.state === "failed-refunded" ? (
                            <div className="dpc-slot__confession">
                              <p>{slot.note}</p>
                              {typeof slot.refundedCredits === "number" && slot.refundedCredits > 0 ? (
                                <span className="dpc-slot__refund">{slot.refundedCredits} CR BACK</span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        <span className="dpc-slot__label">{slot.label}</span>
                        {slot.state !== "failed-refunded" && slot.note ? (
                          <span className="dpc-takes__caption">{slot.note}</span>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </section>
              </div>

              <div className="dpc-room__right">
                {/* VOICE — the drawn card with its player skeleton at rest. */}
                <section className="dpc-rcard" style={{ gap: 13 }}>
                  <div className="dpc-rcard__head">
                    <span className="dpc-rcard__label">VOICE</span>
                    <button type="button" className="dpc-rcard__quiet" disabled>
                      Change
                    </button>
                  </div>
                  <div className="dpc-voice__player">
                    <span className="dpc-voice__play">
                      <Play size={13} strokeWidth={2} aria-hidden="true" />
                    </span>
                    <span className="dpc-voice__wave" aria-hidden="true">
                      {WAVE.map((height, index) => (
                        <span key={index} style={{ height: `${height}%` }} />
                      ))}
                    </span>
                  </div>
                  <div className="dpc-voice__foot">
                    <span className="dpc-voice__name">No voice yet</span>
                    <span className="dpc-rcard__hint">
                      A designed voice and an audition clip arrive with voice.
                    </span>
                  </div>
                </section>

                {/* IN CAMPAIGNS — flush card; its rows own their padding. */}
                <section className="dpc-rcard dpc-rcard--flush">
                  <div className="dpc-camp__head">
                    <span className="dpc-rcard__label">IN CAMPAIGNS</span>
                    <span className="dpc-camp__count">0</span>
                  </div>
                  <p className="dpc-camp__empty">
                    Campaigns aren't built yet. When they are, the ones she appears in are listed
                    here.
                  </p>
                  <button type="button" className="dpc-camp__add" disabled>
                    <Plus size={12} strokeWidth={1.9} aria-hidden="true" />
                    Cast into a new campaign
                  </button>
                </section>

                {/* SIBLINGS — drawn sentence verbatim, tiles unlabelled. */}
                <section className="dpc-rcard">
                  <span className="dpc-rcard__label">SIBLINGS</span>
                  <p className="dpc-rcard__body">
                    Variants cast from the same sheet. Useful when a campaign needs a near-miss
                    rather than a new face.
                  </p>
                  <div className="dpc-sib__tiles">
                    <span className="dpc-sib__tile" />
                    <span className="dpc-sib__tile" />
                    <span className="dpc-sib__tile" />
                    <span className="dpc-sib__tile dpc-sib__tile--add">
                      <Plus size={13} strokeWidth={1.7} aria-hidden="true" />
                    </span>
                  </div>
                  {data.lineage.fromSessionPublicId ? (
                    <Button
                      variant="quiet"
                      size="small"
                      onClick={() => navigate(`/casting/s/${data.lineage.fromSessionPublicId}`)}
                    >
                      Open the sheet she came from
                    </Button>
                  ) : null}
                </section>
              </div>
            </div>
          </>
        ) : null}

      </div>
    </AppShell>
  );
}
