import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft } from "lucide-react";

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
              THE HEADER, as drawn: name, kind, one-line read, and the two
              actions on the right. Both actions are honest coming-soon — the
              capability projection says `canvas: unsupported`, so they say so
              rather than being controls that refuse.
            */}
            <header className="dpc-room__head">
              <div className="dp-stack" style={{ gap: 6 }}>
                <div className="dp-row" style={{ gap: 10, alignItems: "center" }}>
                  <h1 className="dpc-room__name">{data.name ?? "Unnamed"}</h1>
                  <span className="dpc-room__kind">PERFORMER</span>
                </div>
                <span className="dpc-slot__note">
                  {[data.personaLine, data.provenance].filter(Boolean).join(". ")}
                </span>
              </div>
              <div className="dp-row" style={{ gap: 8, flex: "none" }}>
                <span className="dpc-room__soon" title="Arrives with the canvas milestone">
                  Open in canvas · soon
                </span>
                <span className="dpc-room__soon" title="Arrives with campaigns">
                  Cast in a campaign · soon
                </span>
              </div>
            </header>

            <div className="dpc-room__columns">
              <div className="dp-stack" style={{ gap: 18 }}>
                {/*
                  THE MASTER BLOCK — one large, two small, 1px gutters, exactly
                  as drawn. The founder's fill ruling: master is the signed
                  image; the two companions are the close-up and the
                  three-quarter. Progressive by design — takes replace the
                  companions once takes exist.
                */}
                <section className="dp-stack" style={{ gap: 8 }}>
                  <div className="dpc-master">
                    <div className="dpc-master__main">
                      {data.anchorUrl ? (
                        <img src={data.anchorUrl} alt={data.name ?? "The signed face"} />
                      ) : null}
                      <span className="dpc-master__tag">MASTER</span>
                    </div>
                    <div className="dpc-master__side">
                      {companions.map((slot, index) => (
                        <div className="dpc-master__cell" key={slot?.angle ?? `empty-${index}`}>
                          {slot?.url ? <img src={slot.url} alt={slot.label} /> : null}
                          {!slot?.url ? (
                            <span className="dp-metadata dpc-master__empty">
                              {slot ? slot.label : ""}
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="dpc-room__underline">
                    <span className="dpc-slot__note">
                      {data.status === "building"
                        ? "The package is being built — views appear as they pass their checks."
                        : "Every view here was checked against the face you signed."}
                    </span>
                    <span className="dpc-room__locked">IDENTITY LOCKED</span>
                  </div>
                </section>

                {/*
                  REFINE — drawn, and honestly not built. The copy names what it
                  will do and when, rather than presenting an input that would
                  swallow a sentence and do nothing with it.
                */}
                <section className="dpc-room__card">
                  <div className="dp-stack" style={{ gap: 3 }}>
                    <span className="dpc-room__cardtitle">Refine without recasting</span>
                    <span className="dp-metadata">Face stays locked. Everything else is fair game.</span>
                  </div>
                  <p className="dpc-slot__note">
                    Adjusting light, styling and expression on a signed Cast arrives with
                    refinement. Until then, a new direction means a new sheet.
                  </p>
                </section>

                {/*
                  THE PACKAGE — a quiet strip, deliberately below the fold of
                  attention (founder ruling): it is infrastructure, not the
                  show. The confession still renders in place on any slot that
                  is not coming.
                */}
                <section className="dp-stack" style={{ gap: 10 }}>
                  <span className="dp-label">THE PACKAGE</span>
                  <div className="dpc-strip">
                    {data.slots.map((slot) => (
                      <article className="dpc-strip__item" key={slot.angle}>
                        <div className="dpc-strip__frame">
                          {slot.url ? <img src={slot.url} alt={slot.label} /> : null}
                          {slot.state === "building" && !slot.url ? (
                            <Skeleton
                              style={{ position: "absolute", inset: 0, borderRadius: 8 }}
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
                          <span className="dp-metadata">{slot.note}</span>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </section>
              </div>

              {/* The right column, as drawn. */}
              <aside className="dp-stack" style={{ gap: 14 }}>
                <section className="dpc-room__card">
                  <span className="dp-label">VOICE</span>
                  <p className="dpc-slot__note">
                    A designed voice and an audition clip arrive with voice. This Cast doesn't
                    have one yet.
                  </p>
                </section>

                <section className="dpc-room__card">
                  <span className="dp-label">IN CAMPAIGNS</span>
                  <p className="dpc-slot__note">
                    Campaigns aren't built yet. When they are, the ones she appears in are listed
                    here.
                  </p>
                </section>

                <section className="dpc-room__card">
                  <span className="dp-label">SIBLINGS</span>
                  <p className="dpc-slot__note">
                    Variants cast from the same sheet. Useful when a campaign needs a near-miss
                    rather than a new face.
                  </p>
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
              </aside>
            </div>
          </>
        ) : null}

      </div>
    </AppShell>
  );
}
