import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Download, Lock, Play, Plus } from "lucide-react";

import { AppShell, Button, EmptyState, Skeleton } from "@/foundation";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { createClientRequestId } from "@shared/clientRequestId";
import "@/features/castingV2/castingV2.css";
import {
  CandidateViewer,
  type ViewerFrame,
} from "@/features/castingV2/components/CandidateViewer";
import { CardMenu } from "@/features/castingV2/components/CardMenu";
import { DeleteCastConfirm } from "@/features/castingV2/components/DeleteCastConfirm";

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
const COMPANION_LABELS = ["Three-quarter", "Side profile"];

/**
 * Save every landed image in the package, one after another.
 *
 * Deliberately not a zip: an archive means a server endpoint, a temp file and a
 * new way for someone else's Cast to be read out of the wrong scope. These are
 * the same public URLs the viewer already serves, saved under the same product
 * filenames, so the control adds an affordance and no attack surface.
 *
 * Staggered because browsers throttle or silently drop a burst of simultaneous
 * downloads, which would look like the button half-working.
 */
function downloadPackage(frames: readonly ViewerFrame[]) {
  frames.forEach((frame, index) => {
    window.setTimeout(() => {
      const link = document.createElement("a");
      link.href = frame.url;
      link.download = `${frame.downloadName}.png`;
      link.rel = "noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
    }, index * 400);
  });
}

export default function CastingRoom() {
  const [, params] = useRoute("/casting/cast/:castId");
  const [, navigate] = useLocation();
  const castId = params?.castId ?? "";

  const config = trpc.castingV2.config.useQuery({});
  const rename = trpc.castingV2.renameCast.useMutation();
  const utils = trpc.useUtils();
  /** Inline rename on the title. Null when not editing. */
  const [draftName, setDraftName] = useState<string | null>(null);
  /** A package or hero image opened in the viewer. */
  const [viewingImage, setViewingImage] = useState<{ url: string; label: string } | null>(null);
  const [headerMenu, setHeaderMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
  /*
    The server owns the door; the client only decides whether to OFFER the
    control. `castingV2.deleteCast` asserts the same flag itself, so a menu that
    guessed wrong would be refused rather than obeyed (invariant 7).
  */
  const deleteDoorOpen = trpc.models.deleteAvailability.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  }).data?.enabled ?? false;
  const deleteCast = trpc.castingV2.deleteCast.useMutation();
  /** The sibling face being looked at, if any. */
  const [viewingSibling, setViewingSibling] = useState<
    // Derived from the projection rather than restated, so a field added
    // server-side cannot silently fail to reach the handler that needs it.
    NonNullable<typeof cast.data>["siblings"][number] | null
  >(null);
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

  /** Save the inline rename, or abandon it if nothing changed. */
  const saveName = () => {
    const next = (draftName ?? "").trim();
    if (!next || next === (data?.name ?? "") || !data) {
      setDraftName(null);
      return;
    }
    rename.mutate(
      { castId: data.castId, name: next },
      {
        onSuccess: () => {
          setDraftName(null);
          void utils.castingV2.getCast.invalidate({ castId: data.castId });
          void utils.castingV2.roster.invalidate();
        },
        onError: (error) => {
          setDraftName(null);
          toast.error(error.message);
        },
      },
    );
  };

  /*
    THE TWO COMPANION SLOTS (founder ruling on hero fill, v3): the close-up and
    the side profile, in that order, whichever of them has landed.

    **The master is always the chest-up image she was signed in** — the face
    chosen on the sheet — and a companion may never be the anchor standing in
    for a view that failed. That would show her twice and label one of them a
    close-up, which is the exact ambiguity the ruling kills. `standIn` is what
    makes the rule mechanical rather than remembered.

    Progressive by design — when Takes exist they replace these, because a Take
    says more about a Cast than a second angle of the same studio frame does.
    Until then the package's own best two fill the space rather than leaving a
    drawn block half empty.
  */
  /*
    THE HERO SHOWS HER AS A PERSON, FROM THREE ANGLES (founder ruling,
    2026-08-02, final): Master large, then the three-quarter and the side
    profile beside it.

    The close-up was here in v3 and it was the wrong companion — a face macro
    next to a chest-up frame is the same view twice at different zooms, and the
    hero's job is to say who she is, not how her skin resolves. It lives one
    click away, in the strip and the viewer, which is where someone goes when
    detail is what they came for.
  */
  const companions = ["threeQuarter", "sideClose"].map(
    (angle) =>
      data?.slots.find((slot) => slot.angle === angle && slot.url && !slot.standIn) ?? null,
  );

  /*
    THE PACKAGE AS ONE SET — master first, then the landed views in strip order.
    Built once here rather than rebuilt at each opening site, which is how the
    three near-identical walks this replaces came to drift apart.

    `castName` rather than the raw id in the filename: someone saving her own
    face should get "Nine-close-up.png", never a UUID.
  */
  const castName = data?.name ?? data?.castId ?? "cast";
  const packageFrames: ViewerFrame[] = [
    ...(data?.anchorUrl
      ? [{
        url: data.anchorUrl,
        label: "Master",
        personaLine: data.name ?? null,
        downloadName: `${castName}-master`,
      }]
      : []),
    ...(data?.slots ?? [])
      .filter((slot) => slot.url)
      .map((slot) => ({
        url: slot.url as string,
        label: slot.label,
        personaLine: data?.name ?? null,
        downloadName: `${castName}-${slot.angle}`,
      })),
  ];

  const siblingFrames: ViewerFrame[] = (data?.siblings ?? [])
    .filter((sibling) => sibling.imageUrl)
    .map((sibling) => ({
      url: sibling.imageUrl as string,
      label: sibling.indexLabel,
      /*
        THE THIRD-CASE CAPTION (founder ruling). When the viewer is where a
        sibling goes, it is because there is nowhere else — her sheet has
        expired or been deleted, and she survives only because this Cast is
        alive to be her sibling. Saying so is the difference between a dead end
        and an explanation: §G.6 is the reason she is still here at all.
      */
      personaLine: sibling.destination === "viewer"
        ? [
          sibling.personaLine,
          `From a sheet that has expired or was deleted — ${
            data?.pronouns.subject ?? "they"} remain${
            data?.pronouns.plural ? "" : "s"} as a sibling of ${data?.name ?? "this Cast"}.`,
        ].filter(Boolean).join(" · ")
        : sibling.personaLine,
      downloadName: `sibling-${sibling.indexLabel}`,
    }));

  return (
    <AppShell breadcrumb="Casting / Room" current="casting" width="working">
      <div className="dp-stack" style={{ gap: 22 }}>
        <div className="dp-row" style={{ justifyContent: "space-between" }}>
          <Button variant="quiet" size="small" onClick={() => navigate("/casting")}>
            <ArrowLeft size={12} strokeWidth={2} aria-hidden="true" />
            Casting
          </Button>
          {/*
            No second escape hatch here (founder, 2026-08-02). The drawing does
            not have one; the breadcrumb to the left already leaves the room;
            and the Siblings card's "Open the sheet she came from" says the same
            thing with the context that makes it worth saying. Three doors out
            of one room is not generosity, it is indecision.
          */}
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
                <div className="dpc-room__nameline dpc-menuhost">
                  {/*
                    INLINE RENAME (founder ruling, 2026-08-02). A name is display
                    metadata (FR-3B) and changing it never touches identity — so
                    it belongs where the name is, not behind a settings screen.
                    The write is the product's existing model-update path,
                    reached through a V2 door that resolves her public id.
                  */}
                  {draftName === null ? (
                    <button
                      type="button"
                      className="dpc-room__namebtn"
                      onClick={() => setDraftName(data.name ?? "")}
                      aria-label="Rename this Cast"
                    >
                      <h1 className="dpc-room__name">{data.name ?? "Unnamed"}</h1>
                    </button>
                  ) : (
                    <input
                      className="dpc-room__nameinput"
                      value={draftName}
                      maxLength={60}
                      autoFocus
                      disabled={rename.isPending}
                      onChange={(event) => setDraftName(event.target.value)}
                      onBlur={() => saveName()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") saveName();
                        if (event.key === "Escape") setDraftName(null);
                      }}
                      aria-label="Cast name"
                      // Invalid, not merely empty-so-far: a blank name is the
                      // one thing `saveName` refuses, so it is the one state
                      // that earns the alarm colour.
                      aria-invalid={draftName.trim().length === 0}
                    />
                  )}
                  <span className="dpc-room__kind">PERFORMER</span>
                  {/*
                    THE SAME MENU AS THE ROSTER CARD (founder ruling,
                    2026-08-03). Deleting a Cast from inside her own room is the
                    place people reach for it — and the ceremony, the gating and
                    the component are identical, so there is nothing here that
                    can drift away from the roster's version.
                  */}
                  <CardMenu
                    label={data.name ?? "this cast"}
                    open={headerMenu}
                    onToggle={() => setHeaderMenu(!headerMenu)}
                    onCancel={() => setHeaderMenu(false)}
                    items={[
                      {
                        label: "Rename",
                        onSelect: () => {
                          setHeaderMenu(false);
                          setDraftName(data.name ?? "");
                        },
                      },
                      ...(deleteDoorOpen && data.status !== "building"
                        ? [{
                          label: "Delete",
                          danger: true,
                          onSelect: () => {
                            setHeaderMenu(false);
                            setDeleting(true);
                          },
                        }]
                        : []),
                    ]}
                  />
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

            {/*
              THE TOTAL-LOSS CONFESSION — server-authored, room-level, and shown
              before the strip rather than inside it.

              The sentence is derived on the server from the Cast's own evidence
              (`castProjection`), never composed here, so what the room says and
              what the ledger did cannot drift apart. It appears only when
              nothing landed; a partial package keeps its base and says nothing.
            */}
            {data.notice ? (
              <p className="dpc-room__notice" role="status">{data.notice}</p>
            ) : null}

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
                    {/*
                      A BUTTON, not a div with a handler. Clicking IS expanding
                      (founder ruling, 2026-08-02), so the affordance must be a
                      real tab stop with a real name — the expand icon that used
                      to say this out loud has been removed everywhere.
                    */}
                    <button
                      type="button"
                      className="dpc-master__main dpc-media"
                      disabled={!data.anchorUrl}
                      aria-label={`View ${data.name ?? "the signed face"} larger`}
                      onClick={() =>
                        data.anchorUrl
                          ? setViewingImage({ url: data.anchorUrl, label: "Master" })
                          : undefined
                      }
                    >
                      {data.anchorUrl ? (
                        <img src={data.anchorUrl} alt={data.name ?? "The signed face"} />
                      ) : null}
                      <span className="dpc-master__tag">MASTER</span>
                    </button>
                    <div className="dpc-master__side">
                      {companions.map((slot, index) => (
                        <button
                          type="button"
                          className="dpc-master__cell"
                          key={slot?.angle ?? `companion-${index}`}
                          disabled={!slot?.url}
                          aria-label={slot?.url ? `View ${slot.label} larger` : undefined}
                          onClick={() =>
                            slot?.url ? setViewingImage({ url: slot.url, label: slot.label }) : undefined
                          }
                        >
                          {slot?.url ? (
                            <img src={slot.url} alt={slot.label} />
                          ) : (
                            <span className="dpc-master__empty">
                              {slot ? slot.label : COMPANION_LABELS[index]}
                            </span>
                          )}
                        </button>
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
                    {/*
                      THE BULK-OWNERSHIP AFFORDANCE (founder ruling,
                      2026-08-02) — a real control, not hover chrome.

                      Per-image download lives in the viewer, which is right for
                      "I want that one". This is the other need: everything she
                      is, in one action. It is a plain sequence of the same
                      public URLs the viewer serves — no new server surface, no
                      archive to build — and the character-sheet artifact joins
                      it here when it ships, as the single-file form of the same
                      idea.
                    */}
                    <span className="dpc-takes__actions">
                      <Button
                        variant="quiet"
                        size="small"
                        disabled={packageFrames.length === 0}
                        onClick={() => downloadPackage(packageFrames)}
                      >
                        <Download size={12} strokeWidth={1.9} aria-hidden="true" />
                        Download package
                      </Button>
                    </span>
                    <span className="dpc-rcard__hint">
                      {/* The Master is not counted: it was never a paid view. */}
                      {data.slots.filter((slot) => slot.state === "ready").length} of{" "}
                      {data.slots.length} views
                    </span>
                  </div>
                  <div className="dpc-strip">
                    {/*
                      MASTER LEADS THE STRIP, and it is presentation only: the
                      signed sheet image itself, never generated and never
                      priced. One word in both places — the chip on the hero and
                      the label here — so the same picture is called the same
                      thing wherever it appears.
                    */}
                    {data.anchorUrl ? (
                      <article className="dpc-strip__item">
                        <button
                          type="button"
                          className="dpc-strip__frame dpc-media"
                          aria-label="View Master larger"
                          onClick={() =>
                            setViewingImage({ url: data.anchorUrl!, label: "Master" })
                          }
                        >
                          <img src={data.anchorUrl} alt="Master" />
                        </button>
                        <span className="dpc-slot__label">Master</span>
                      </article>
                    ) : null}
                    {data.slots.map((slot) => (
                      <article className="dpc-strip__item" key={slot.angle}>
                        <button
                          type="button"
                          className="dpc-strip__frame dpc-media"
                          disabled={!slot.url}
                          aria-label={slot.url ? `View ${slot.label} larger` : undefined}
                          onClick={() =>
                            slot.url ? setViewingImage({ url: slot.url, label: slot.label }) : undefined
                          }
                        >
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
                        </button>
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
                    Campaigns aren't built yet. When they are, the ones{" "}
                    {data.pronouns.subject} appear{data.pronouns.plural ? "" : "s"} in are
                    listed here.
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
                  {/*
                    REAL FACES (founder ruling, 2026-08-02). These are the
                    candidates kept beside her on the same sheet, and retention
                    protects exactly them for as long as she lives (§G.6) — so
                    the card can promise a face without promising something
                    that disappears in seven days. Verified against the live
                    sweep predicate, not assumed.

                    A tile opens the viewer, which is the right depth for now: a
                    near-miss is something you look at before deciding to cast
                    her too.
                  */}
                  {data.siblings.length > 0 ? (
                    <div className="dpc-sib__tiles">
                      {data.siblings.map((sibling) => (
                        <button
                          key={sibling.candidateId}
                          type="button"
                          className="dpc-sib__tile dpc-sib__tile--face"
                          /*
                            A SIBLING TILE NAVIGATES (founder ruling,
                            2026-08-02). The viewer stops being their only
                            destination: a sibling who was signed has a room,
                            and one who is still a face has a sheet.

                            This is an object card, not a media frame — the
                            "clicking is expanding" grammar governs pictures of
                            THIS Cast, and a card that stands for another person
                            goes to that person. The viewer remains the
                            destination when there is genuinely nowhere else to
                            go, which is what an expired sheet leaves behind.
                          */
                          onClick={() => {
                            if (sibling.destination === "cast" && sibling.castId) {
                              navigate(`/casting/cast/${sibling.castId}`);
                              return;
                            }
                            if (
                              sibling.destination === "sheet"
                              && data.lineage.fromSessionPublicId
                            ) {
                              navigate(
                                `/casting/s/${data.lineage.fromSessionPublicId}`
                                + `?focus=${sibling.candidateId}`,
                              );
                              return;
                            }
                            setViewingSibling(sibling);
                          }}
                          aria-label={
                            sibling.destination === "cast"
                              ? `Open ${sibling.personaLine ?? sibling.indexLabel}'s room`
                              : sibling.destination === "sheet"
                                ? `Find ${sibling.personaLine ?? sibling.indexLabel} on that sheet`
                                : `Look at ${sibling.personaLine ?? sibling.indexLabel}`
                          }
                        >
                          {sibling.imageUrl ? <img src={sibling.imageUrl} alt="" /> : null}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="dpc-rcard__body">
                      Nothing else was kept from {data.pronouns.possessive} sheet.
                    </p>
                  )}
                  {/*
                    Offered only while the sheet still EXISTS. Her siblings'
                    faces outlive their session by design (§G.6 protects the
                    candidates, not the page), so this link rots quietly on any
                    Cast older than her sheet's seven days — a dead end handed
                    to someone who did nothing wrong.
                  */}
                  {data.sheetOpen && data.lineage.fromSessionPublicId ? (
                    <Button
                      variant="quiet"
                      size="small"
                      onClick={() => navigate(`/casting/s/${data.lineage.fromSessionPublicId}`)}
                    >
                      Open the sheet {data.pronouns.subject} came from
                    </Button>
                  ) : null}
                </section>
              </div>
            </div>
          </>
        ) : null}

        {deleting && data ? (
          <DeleteCastConfirm
            name={data.name ?? "this cast"}
            imageUrl={data.anchorUrl}
            pronouns={data.pronouns}
            busy={deleteCast.isPending}
            onCancel={() => setDeleting(false)}
            onConfirm={async () => {
              try {
                await deleteCast.mutateAsync({
                  clientRequestId: createClientRequestId(),
                  castId,
                });
                toast(`${data.name ?? "That cast"} was deleted.`);
                // Her room is the page we are standing on, so leaving is part
                // of the ceremony rather than something to do afterwards.
                navigate("/casting");
              } catch (error) {
                toast(error instanceof Error
                  ? error.message
                  : `${data.name ?? "That cast"} could not be deleted.`);
              }
            }}
          />
        ) : null}

        {viewingImage ? (
          <CandidateViewer
            frames={packageFrames}
            index={Math.max(0, packageFrames.findIndex((frame) => frame.url === viewingImage.url))}
            /*
              The arrows walk the PACKAGE, master included — comparing a view
              against the face it was held to is the whole reason to open one
              large.
            */
            onIndexChange={(next) => {
              const frame = packageFrames[next];
              if (frame) setViewingImage({ url: frame.url, label: frame.label });
            }}
            onClose={() => setViewingImage(null)}
          />
        ) : null}

        {viewingSibling?.imageUrl ? (
          <CandidateViewer
            frames={siblingFrames}
            index={Math.max(
              0,
              siblingFrames.findIndex((frame) => frame.url === viewingSibling.imageUrl),
            )}
            onIndexChange={(next) => {
              const frame = siblingFrames[next];
              const sibling = (data?.siblings ?? []).find((entry) => entry.imageUrl === frame?.url);
              if (sibling) setViewingSibling(sibling);
            }}
            onClose={() => setViewingSibling(null)}
          />
        ) : null}

      </div>
    </AppShell>
  );
}
