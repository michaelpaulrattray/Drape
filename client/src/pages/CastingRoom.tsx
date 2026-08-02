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
            <section className="dpc-room__hero">
              <div className="dpc-room__anchor">
                {data.anchorUrl ? (
                  <img src={data.anchorUrl} alt={data.name ? `${data.name}` : "The signed face"} />
                ) : null}
              </div>
              <div className="dp-stack" style={{ gap: 8 }}>
                <h1 className="dpc-room__name">{data.name ?? "Unnamed"}</h1>
                <span className="dpc-room__id">{data.castId}</span>
                {data.personaLine ? <p className="dpc-slot__note">{data.personaLine}</p> : null}
                {data.provenance ? <p className="dpc-slot__note">{data.provenance}</p> : null}
                <p className="dpc-slot__note">
                  {data.status === "building"
                    ? "Identity locked. The rest of the package is being built — views appear as they pass their checks."
                    : "Identity locked."}
                </p>
              </div>
            </section>

            <section className="dp-stack" style={{ gap: 12 }}>
              <h2 className="dpc-room__name" style={{ fontSize: 15 }}>
                The package
              </h2>
              <div className="dpc-room__slots">
                {data.slots.map((slot) => (
                  <article className="dpc-slot" key={slot.angle}>
                    <div className="dpc-slot__frame">
                      {slot.url ? <img src={slot.url} alt={slot.label} /> : null}
                      {slot.state === "building" && !slot.url ? (
                        <Skeleton
                          style={{ position: "absolute", inset: 0, borderRadius: 12 }}
                          label={slot.label.toUpperCase()}
                        />
                      ) : null}
                      {slot.state === "failed-refunded" ? (
                        /*
                          The confession, in place. Not a toast, not a footnote
                          at the bottom of the room: the answer belongs where the
                          person is looking for the thing that is missing.
                        */
                        <div className="dpc-slot__confession">
                          <p>{slot.note}</p>
                          {typeof slot.refundedCredits === "number" && slot.refundedCredits > 0 ? (
                            <span className="dpc-slot__refund">
                              {slot.refundedCredits} CR BACK
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="dpc-slot__caption">
                      <span className="dpc-slot__label">{slot.label}</span>
                    </div>
                    {slot.state !== "failed-refunded" && slot.note ? (
                      <p className="dpc-slot__note">{slot.note}</p>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
