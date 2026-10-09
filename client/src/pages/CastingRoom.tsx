import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Download, Lock, Play, Plus } from "lucide-react";

import { creditsReturnedText } from "@shared/refundCopy";
import { Button, EmptyState, Skeleton } from "@/foundation";
import { AppChrome } from "@/components/AppChrome";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { createClientRequestId } from "@shared/clientRequestId";
import "@/features/castingV2/castingV2.css";
import {
  CandidateViewer,
  type ViewerFrame,
} from "@/features/castingV2/components/CandidateViewer";
import { CardMenu } from "@/foundation";
import { DestructiveConfirm } from "@/foundation";
import {
  castRoomIsWorking,
  slotIsBeingAsked,
  slotShowsWorking,
} from "@/features/castingV2/roomBusy";
import {
  PACKAGE_REDO_WORKING,
  packageRedoLabel,
} from "@/features/castingV2/packageRedoRow";
import { logRawFailure, readableFailure } from "@/lib/failureSentence";
import { CAST_NAME_MAX_LENGTH } from "@shared/inputLimits";
import {
  CastPersonalityCard,
  CastVoiceBadge,
  CastVoiceLine,
  type CastPersonaFieldName,
} from "@/features/castingV2/components/CastPersonaCards";

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
 * What the ? beside the Klieg ID says (#2124), verbatim from the card. It is
 * both the tooltip and the button's accessible name, so a screen reader hears
 * the same sentence a pointer sees.
 */
const CAST_ID_EXPLAINED =
  "This cast's Klieg ID. It never changes and belongs only to them — quote it if you ever contact us about this cast.";

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
function downloadPackage(frames: readonly ViewerFrame[], castId: string) {
  /*
    THE CHARACTER SHEET LEADS (D-104).

    It is the one file that answers "who is she" on its own — the whole pack
    composed into a single labelled turnaround — and it is what a real workflow
    conditions on. Saved first so it is the first thing in the downloads folder
    rather than the last.

    It comes from an authenticated route rather than a public URL, because
    unlike the views it is composed on demand for this owner. The browser sends
    the session cookie with a same-origin navigation, so the anchor works
    exactly like the others.
  */
  const files = [
    // JPEG: the sheet is bounded to the envelope external tools accept.
    { url: `/api/cast/${encodeURIComponent(castId)}/sheet`, name: "character-sheet.jpg" },
    ...frames.map((frame) => ({ url: frame.url, name: `${frame.downloadName}.png` })),
  ];
  files.forEach((file, index) => {
    window.setTimeout(() => {
      const link = document.createElement("a");
      link.href = file.url;
      link.download = file.name;
      link.rel = "noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
    }, index * 400);
  });
}

export default function CastingRoom() {
  const [, params] = useRoute("/app/casting/cast/:castId");
  const [, navigate] = useLocation();
  const castId = params?.castId ?? "";

  const config = trpc.castingV2.config.useQuery({});
  const rename = trpc.castingV2.renameCast.useMutation();
  const editPersona = trpc.castingV2.editCastPersonaField.useMutation();
  const utils = trpc.useUtils();
  /** Inline rename on the title. Null when not editing. */
  const [draftName, setDraftName] = useState<string | null>(null);
  /*
    WHICH OF THE TWO LINES IS IN FLIGHT - N2b (#1242).

    Declared HERE, beside the rename's own draft, and deliberately not below the
    loading return further down this file: a `useState` under an early return
    runs on some renders and not others, which is React #310 and crashes every
    load of this page (memory `hooks-below-early-return`).
  */
  const [savingPersonaField, setSavingPersonaField] = useState<CastPersonaFieldName | null>(null);
  /** A package or hero image opened in the viewer. */
  const [viewingImage, setViewingImage] = useState<{ url: string; label: string } | null>(null);
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
  /*
    ⚠ **TRY AGAIN ON ONE VIEW STOOD HERE AND IS RETIRED — #2089, his word of
    2026-10-08 (terminal), verbatim and entire: *"regenerate is the only
    option"*.** The `retryView` mutation, its press handler and its toasts are
    gone with the row that called them; the server answers no per-view offer on
    any slot and refuses a stale press for free. The one remedy on this page is
    the whole-set redo below.
  */
  /**
   * The angles WE have just pressed — the optimistic first frame, nothing more
   * (#1235).
   *
   * ⚠ **IT WAS ONE STRING AND THAT WAS THE SECOND BUG HE REPORTED.** Every
   * button read `disabled={retryingAngle !== null}`, so asking for one view
   * locked the other two — a client convenience with no rule behind it: each
   * Try again is its own operation, fences on its own, and renders through the
   * Sign's own view queue, which already runs views in parallel. A set makes
   * each tile independent; the server decides busy either way, and this only
   * makes the press visible before the next read lands.
   */
  const [asking, setAsking] = useState<ReadonlySet<string>>(() => new Set());
  /*
    ASK FOR ALL HER VIEWS AGAIN (#1903 slice 2).

    His ruling: a redo for a customer who simply does not like what arrived, no
    fault needing to be found first. The price is not decided here and is not a
    constant in this file — it arrives on the Cast (`data.redo.priceCredits`),
    from the same server reading that authorizes the spend, so the button and
    the till can never disagree.
  */
  const redoPackage = trpc.castingV2.redoPackage.useMutation();
  /*
    OUR OWN PRESS, for the first frame only — the same job `asking` does for one
    tile, and it is a boolean because a redo is one press on the whole Cast.
    The server's answer takes over the moment it lands: every slot reads
    `retrying`, so all five tiles draw the working state they draw for any view
    being made, and `data.redo` is withheld for as long as the operations run.
  */
  const [askingAll, setAskingAll] = useState(false);
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
      /*
        The poll stops itself. A room whose package is terminal has nothing left
        to learn, and a permanent 2.5s heartbeat on a finished Cast is a cost
        with no reader.

        ⚠ **IT READS THE SLOTS AS WELL AS THE CAST, AND THAT IS #1235's THIRD
        HALF.** A Try again never puts the Cast back into `building`, so a room
        watching only the Cast's status learned nothing while a view rendered:
        the new picture arrived on a manual reload, which is exactly what *"it
        looks like it stopped generating"* looked like from the outside.
      */
      refetchInterval: (query) => (castRoomIsWorking(query.state.data) ? POLL_MS : false),
    },
  );

  useEffect(() => {
    if (config.data && config.data.enabled === false) navigate("/app/casting");
  }, [config.data, navigate]);

  const data = cast.data;

  /**
   * Ask for all her views again.
   *
   * One press, no choice, no second dialog — the price is on the button, so the
   * decision was made before the finger landed. The server re-reads whether she
   * may be asked at all and what it costs, so a room left open in another tab
   * cannot spend against a Cast that has since started making something.
   */
  const askForAllViewsAgain = () => {
    if (!data || askingAll) return;
    setAskingAll(true);
    /*
      EVERY TILE GOES TO WORK IN THE SAME FRAME THE FINGER LEAVES THE BUTTON.

      The per-slot set already exists for the Try again and already drives
      `slotShowsWorking`, so a redo reuses it rather than teaching the strip a
      second way to look busy — five tiles that behave exactly as one does when
      it is being asked for again. The server's `retrying` takes over on the
      next read; this is only the first frame.
    */
    setAsking(new Set(data.slots.map((slot) => slot.angle)));
    redoPackage.mutate(
      { clientRequestId: createClientRequestId(), castId: data.castId },
      {
        onSuccess: (result) => {
          setAskingAll(false);
          setAsking(new Set());
          void utils.castingV2.getCast.invalidate({ castId: data.castId });
          /*
            NO TOAST WHEN THEY ALL ARRIVED — the retry road's answer and the
            same reasoning: the new pictures ARE the notice, and a better one
            than a sentence about them. The price was on the button before the
            press, so nothing about the money is news either.
          */
          if (result.failed.length === 0) return;
          /*
            Truthful about the money even when it went wrong, and the test stays
            on the LEDGER with only the printed number converted (#1600).
            Branching on the displayed figure would say "you weren't charged" to
            somebody who was charged and refunded a sum too small to show.
          */
          if (!result.refundRecorded) {
            toast("Some views didn't arrive — and the refund couldn't be recorded. Support can restore it.");
            return;
          }
          /* NO PRONOUN. A Cast is referred to by the pronouns on her own
             record (`castPronouns`) or by name — never by one typed into a
             sentence, which is how Jericho came to be called the wrong thing on
             his own page. These say "the views", which needs no record at all
             and reads the same for every cast. */
          /*
            ⚠ **NOTHING COMES BACK FOR ONE VIEW UNDER THE FLAT PRICE, so this
            line says nothing about money unless money actually moved** (#1968,
            his word of 2026-10-08; #1903's card names it — *"nothing may imply
            credits came back for that view"*). Repaired on PR #1924 when
            `main` merged forward.

            It used to end with a sentence telling her she had not been charged
            — and under the flat price that is the ORDINARY partial failure,
            because her slot rows cost nothing and `refundedCredits` is 0. True
            of the pipeline, false to the person who paid 650 for the set. So
            the claim is removed rather than reworded: the honest line says
            which views are new and makes none about the till.

            ⚠ **And when money DID come back it is said in the product's one
            refund vocabulary** (`creditsReturnedText`, #1940). The spelling
            this branch had — *"Your N credits … are back."* — is one of the
            four that helper was built to retire, reintroduced on a branch cut
            before it landed. Exactly the drift `shared/refundCopy.ts` exists
            to prevent.
          */
          const back = result.refundedCredits > 0
            ? ` ${creditsReturnedText(result.refundedCredits)}`
            : "";
          toast(result.committed.length === 0
            ? `None of the views arrived this time.${back}`
            : `${result.failed.length} of the views didn't arrive.${back} The rest are new.`);
        },
        onError: (error) => {
          setAskingAll(false);
          setAsking(new Set());
          logRawFailure('castingV2.redoPackage', error);
          toast.error(readableFailure(error, "Those views couldn't be asked for again."));
        },
      },
    );
  };

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
          logRawFailure('castingV2.renameCast', error);
          toast.error(readableFailure(error, 'That name could not be saved.'));
        },
      },
    );
  };

  /**
   * SHE REWRITES ONE OF HER CAST'S TWO LINES - N2b (#1242).
   *
   * Free: no price, no credit, no confirmation. On the rename's own shape above
   * because it IS that act - a customer correcting a piece of text on her own
   * Cast - and a second shape for it would be a second thing to maintain.
   *
   * ⚠ **NO SUCCESS TOAST.** The badge going is the receipt, and it is on the
   * card she is looking at. A sentence telling her the thing she just typed was
   * saved is the kind of noise his #2089 ruling took off these tiles.
   */
  const savePersonaField = (line: CastPersonaFieldName, text: string) => {
    if (!data) return;
    setSavingPersonaField(line);
    editPersona.mutate(
      { castId: data.castId, line, text },
      {
        onSuccess: (saved) => {
          setSavingPersonaField(null);
          /*
            THE CUSTOMER'S OWN WORDS GO STRAIGHT INTO THE CACHE — the relay's
            non-blocking note on PR #2114, and the reason the procedure returns
            them at all.

            Without this the card falls back to `value.text` the instant the
            textarea closes, which is still the OLD sentence until the refetch
            lands: **the edit flashes back to what it was and then changes
            again** — measured at 2,230 ms on a real Cast. The entrance's reply
            is shaped for exactly this — its own comment says the reply comes
            back *"with the badge already gone"* so the card *"does not need a
            refetch"* — and nothing was reading it.

            The `invalidate` below stays: this writes the one line the reply is
            authoritative about, and the refetch is still what reconciles
            everything else on the Cast.
          */
          utils.castingV2.getCast.setData({ castId: data.castId }, (previous) => {
            if (!previous) return previous;
            const line = { text: saved.text, drafted: saved.drafted };
            return {
              ...previous,
              persona: {
                personality: previous.persona?.personality ?? null,
                voice: previous.persona?.voice ?? null,
                [saved.line]: line,
              },
            };
          });
          void utils.castingV2.getCast.invalidate({ castId: data.castId });
        },
        onError: (error) => {
          setSavingPersonaField(null);
          logRawFailure('castingV2.editCastPersonaField', error);
          toast.error(readableFailure(
            error,
            line === "voice"
              ? 'That voice line could not be saved.'
              : 'That personality could not be saved.',
          ));
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
  /*
    ⚠ **CHOSEN BY ANGLE, AND IT USED TO ALSO REQUIRE A PICTURE (#1372).**

    His report, 2026-09-26, verbatim: *"another small fix - the view cards now
    show when they are in a generating state but on the hero views they dont
    show as generating if they are empty"*.

    The `&& slot.url` here was the whole defect. A slot with no picture YET —
    queued, dispatched, or re-asked with Try again — was dropped to `null`
    before the hero ever saw it, so the cell could only ever draw a label on a
    disabled box. The strip's tile for the SAME view was drawing its working
    state two sections down (#1235). One view, two surfaces, two different
    stories about whether anything is happening.

    `!slot.standIn` STAYS, and it is a different question with a different
    answer: a stand-in is a placeholder standing where a real view is not, and
    the hero's two companions are the package's own best two. That rule is
    unchanged — what changed is that "not made YET" stopped being treated as
    "not there".
  */
  const companions = ["threeQuarter", "sideClose"].map(
    (angle) => data?.slots.find((slot) => slot.angle === angle && !slot.standIn) ?? null,
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
        caption: data.name ?? null,
        downloadName: `${castName}-master`,
      }]
      : []),
    ...(data?.slots ?? [])
      .filter((slot) => slot.url)
      .map((slot) => ({
        url: slot.url as string,
        label: slot.label,
        caption: data?.name ?? null,
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
      caption: sibling.destination === "viewer"
        ? `From a sheet that has expired or was deleted — ${
          data?.pronouns.subject ?? "they"} remain${
          data?.pronouns.plural ? "" : "s"} as a sibling of ${data?.name ?? "this Cast"}.`
        : null,
      downloadName: `sibling-${sibling.indexLabel}`,
    }));

  return (
    <AppChrome breadcrumb="Casting / Room" current="casting" width="working">
      <div className="dp-stack" style={{ gap: 22 }}>
        <div className="dp-row" style={{ justifyContent: "space-between" }}>
          <Button variant="quiet" size="small" onClick={() => navigate("/app/casting")}>
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
                <div className="dpc-room__nameline">
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
                      maxLength={CAST_NAME_MAX_LENGTH}
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
                </div>
                <p className="dpc-room__read">{data.provenance}</p>
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
                      {companions.map((slot, index) => {
                        /*
                          THE SAME READING THE STRIP'S TILE MAKES, from the same
                          two helpers (working law 4). A second rule here — "no
                          url and the cast is building" — would have been a
                          parallel copy of `slotShowsWorking`, and it would have
                          drifted the first time a third state was added: the
                          tile already knows that a view being RE-ASKED is a view
                          being made (#1235), which no local rule would have
                          known.
                        */
                        const working = slot ? slotShowsWorking(slot, asking) : false;
                        const openable = Boolean(slot?.url) && !working;
                        return (
                        <button
                          type="button"
                          className="dpc-master__cell"
                          key={slot?.angle ?? `companion-${index}`}
                          disabled={!openable}
                          aria-label={openable ? `View ${slot!.label} larger` : undefined}
                          onClick={() =>
                            openable ? setViewingImage({ url: slot!.url as string, label: slot!.label }) : undefined
                          }
                        >
                          {/*
                            A LANDED PICTURE STAYS UNDER THE WORKING STATE rather
                            than being swapped for it, exactly as the tile does
                            it: a Try again on a view that already has a picture
                            keeps showing the picture it is replacing, so the
                            cell never goes blank mid-press.
                          */}
                          {slot?.url ? <img src={slot.url} alt={slot.label} /> : null}
                          {working ? (
                            /*
                              THE CELL'S OWN GEOMETRY, not the skeleton's.
                              `.dp-skeleton` carries `border-radius: var(--r-ctl)`
                              and a 1px border, which suits the strip's tile — a
                              standalone card, which is why the tile overrides the
                              radius to its own 9. The hero's two cells butt
                              against the Master and each other and are square,
                              so the default drew a rounded, bordered card inside
                              a square box, with its curved bottom corners plainly
                              visible against the cell below (seen in both themes
                              before this line existed). The outer corner is
                              clipped by the side column, as it is for a landed
                              picture.
                            */
                            <Skeleton
                              style={{ position: "absolute", inset: 0, borderRadius: 0, border: "none" }}
                              label=""
                            />
                          ) : null}
                          {!slot?.url && !working ? (
                            <span className="dpc-master__empty">
                              {slot ? slot.label : COMPANION_LABELS[index]}
                            </span>
                          ) : null}
                        </button>
                        );
                      })}
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
                    {/*
                      THE BUILDING LINE IS ABOUT THE PERSON, NOT THE PIPELINE
                      (#1550, approved on his Notion desk 30 Sep 2026).

                      It read "Building the package — views appear as they pass
                      their checks.", which is QA's vocabulary in the one moment
                      the customer has just signed someone: "the package" is our
                      noun for a row of jobs, and "checks" tells them we are
                      inspecting their cast rather than making her. Working law 8
                      — the user's ontology governs the copy; the checks are real
                      and are the implementation.

                      The pronoun is the cast's own (`his` / `her` / `their`,
                      `their` when the record never stated a sex), for the reason
                      `castPronouns.ts` was written at all: the room used to call
                      every Cast "she", and Jericho is male.
                    */}
                    {/*
                      THE FINISHED LINE PROMISES THE LOCK, NOT A CHECK (#2087).
                      It read "Every view here was checked against the face you
                      signed." — false for a view the checker never reached,
                      which is delivered and charged on purpose (3 of 119 read at
                      production, 2026-10-08), and since #1903 nothing on the
                      page admits it. The lock is true whatever the checker
                      managed, and it is what the lock and the Klieg ID beside it
                      claim (that tag read IDENTITY LOCKED until #2124).
                    */}
                    <span className="dpc-master__retention">
                      {data.status === "building"
                        ? `Building ${data.pronouns.possessive} other views…`
                        : "The face you signed is locked across every view."}
                    </span>
                    {/*
                      THE LOCK WEARS THE CAST'S KLIEG ID, NOT A SLOGAN (#2124).
                      It read IDENTITY LOCKED, which repeated the caption beside
                      it. His word, 2026-10-09: "maybe it can be their unique
                      identifier code? with a small tooltip ? that explain what
                      its for". The id is `data.castId` — the public id
                      (`models.agencyId`, KI-… or an older MOD-…) the owner's
                      projection already carries, so nothing is widened. Clicking
                      it copies it; the ? explains it on hover and on keyboard
                      focus, through the house tooltip.
                    */}
                    <span className="dpc-master__locked">
                      <Lock size={11} strokeWidth={2} aria-hidden="true" />
                      <button
                        type="button"
                        className="dpc-master__castid"
                        aria-label={`Copy Klieg ID ${data.castId}`}
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(data.castId);
                            toast("Copied");
                          } catch {
                            toast.error("Couldn't copy the ID. Select it and copy it by hand.");
                          }
                        }}
                      >
                        {data.castId}
                      </button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="dpc-master__idhelp"
                            aria-label={CAST_ID_EXPLAINED}
                          >
                            ?
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={6} className="max-w-[260px]">
                          {CAST_ID_EXPLAINED}
                        </TooltipContent>
                      </Tooltip>
                    </span>
                  </div>
                </section>

                {/*
                  REFINE — the drawn anatomy, inert. Input, button and chips all
                  render and are all disabled, following the F5 Upload-a-real-
                  person precedent: present with an honest coming-soon state,
                  never omitted, never a control that pretends to work.
                */}
                <section className="dpc-rcard dpc-rrefine">
                  <div className="dpc-rcard__head">
                    <span className="dpc-rcard__title">Refine without recasting</span>
                    <span className="dpc-rcard__hint">
                      Face stays locked. Everything else is fair game.
                    </span>
                  </div>
                  <div className="dpc-rrefine__shell">
                    <input
                      className="dpc-rrefine__input"
                      placeholder="softer light, less styled hair, plain grey tee"
                      disabled
                      aria-label="Refine this Cast (not available yet)"
                    />
                    <button type="button" className="dpc-rrefine__go" disabled>
                      New takes
                    </button>
                  </div>
                  <div className="dpc-rrefine__chips">
                    {REFINE_CHIPS.map((chip) => (
                      <button type="button" className="dpc-rrefine__chip" key={chip} disabled>
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
                        onClick={() => downloadPackage(packageFrames, castId)}
                      >
                        <Download size={12} strokeWidth={1.9} aria-hidden="true" />
                        Download package
                      </Button>
                      {/*
                        DELETING HER IS A SENTENCE, NOT A MENU (founder ruling,
                        2026-08-03) — and it sits with the other thing you can
                        do to the whole Cast rather than to one picture.

                        A three-dot menu beside her name put file-manager
                        furniture on the one line that is meant to be her, and
                        offered a Rename the name already does when you click
                        it. Two affordances for one action, and a heavy one.

                        Accent-coloured because it is the only irreversible
                        thing in the room, and last in the row because it is the
                        last thing anyone should reach for. Same gating as
                        before: absent while she builds, absent while the
                        server's door is shut.
                      */}
                      {/*
                        ASK FOR ALL HER VIEWS AGAIN (#1903 slice 2) — on the row
                        of things you do to the WHOLE Cast rather than to one
                        picture, which is where the other one already is.

                        ⚠ **BEFORE Delete and not after**, because that button
                        carries its own standing rule two comments down: it is
                        accent-coloured and LAST *"because it is the last thing
                        anyone should reach for"*. The first draft of this row
                        put the redo after it and the frame said so — a reading
                        no test could have given, and law 6 exactly.

                        ⚠ **THE OFFER DECIDES WHETHER IT IS DRAWN, NOT THIS
                        COMPONENT.** The server withholds `redo` while she is
                        building and while anything of hers is in flight, so
                        there is no second rule here to drift from it — and no
                        disabled button wearing a verb, which is the shape #1235
                        took off the tiles.
                      */}
                      {askingAll ? (
                        /* ⚠ NOT `dpc-slot__row`, which is the muted line UNDER
                           A TILE. Borrowing it put a second element with that
                           class above the strip, and the row's own guard (deleted with the row, #2089)
                           slices the component from the FIRST one — so his two
                           Try again sentences were being read out of this header
                           instead. A guard whose anchor another element can
                           steal is the shape that memory is about. */
                        <span className="dpc-room__redo-working" role="status">{PACKAGE_REDO_WORKING}</span>
                      ) : data.redo ? (
                        <button
                          type="button"
                          className="dpc-room__redo"
                          onClick={askForAllViewsAgain}
                        >
                          {/* The LEDGER price, straight off the wire. The copy
                              module converts it through the one converter
                              (#1600) so the routing is visible where it happens;
                              this file does no arithmetic at all. */}
                          {packageRedoLabel(data.redo.priceCredits)}
                        </button>
                      ) : null}
                      {deleteDoorOpen && data.status !== "building" ? (
                        <button
                          type="button"
                          className="dpc-room__delete"
                          onClick={() => setDeleting(true)}
                        >
                          Delete this cast
                        </button>
                      ) : null}
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
                    {data.slots.map((slot) => {
                      /*
                        A VIEW BEING ASKED FOR AGAIN IS A VIEW BEING MADE
                        (#1235). Both readings come from `roomBusy`, once, and
                        the tile then answers the way it does for any view the
                        Sign is still working on — no verb, no second
                        vocabulary, nothing new to learn.

                        `beingAsked` also takes the CAPTION and the BUTTON away:
                        the server has already dropped both by the time it
                        answers, and this makes the press visible in the same
                        frame the finger leaves it.
                      */
                      const beingAsked = slotIsBeingAsked(slot, asking);
                      const working = slotShowsWorking(slot, asking);
                      return (
                      <article className="dpc-strip__item" key={slot.angle}>
                        <button
                          type="button"
                          className="dpc-strip__frame dpc-media"
                          disabled={!slot.url || working}
                          aria-label={slot.url && !working ? `View ${slot.label} larger` : undefined}
                          onClick={() =>
                            slot.url && !working
                              ? setViewingImage({ url: slot.url, label: slot.label })
                              : undefined
                          }
                        >
                          {slot.url ? <img src={slot.url} alt={slot.label} /> : null}
                          {working ? (
                            <Skeleton
                              style={{ position: "absolute", inset: 0, borderRadius: 9 }}
                              label=""
                            />
                          ) : null}
                          {slot.state === "failed-refunded" && !beingAsked ? (
                            <div className="dpc-slot__confession">
                              {/*
                                ⚠ THE "50 CR BACK" PILL IS GONE — his ruling,
                                2026-09-26 (Desk reply 224): *"Drop the '50 CR
                                BACK' inside the empty tile too — 'This view
                                didn't arrive — refunded' is enough, and the row
                                underneath already says Refunded."* Two
                                statements of the same money fact on one tile,
                                one of them in mono, was a third of the weight
                                he was reading as noise.
                              */}
                              <p>{slot.note}</p>
                            </div>
                          ) : null}
                        </button>
                        <span className="dpc-slot__label">{slot.label}</span>
                        {/*
                          ⚠ **NOTHING UNDER THE NAME, ON ANY VIEW — #2089, his
                          word of 2026-10-08: *"regenerate is the only
                          option"*.** A muted `Refunded · Try again` row stood
                          here (#1347's shape, his Desk reply 224) under a view
                          that never arrived, and #1903 slice 3 had already
                          taken its `Unchecked` sibling. Both are gone: the
                          empty tile keeps its one true sentence above, and the
                          remedy for any view, arrived or refunded, is the
                          whole-set *Regenerate* on the row of things done to
                          the whole Cast. The server offers no per-view ask, so
                          there is nothing here for a client to draw.
                        */}
                      </article>
                      );
                    })}
                  </div>
                </section>
              </div>

              <div className="dpc-room__right">
                {/*
                  PERSONALITY - N2b (#1242). Drawn only when there is a line,
                  which is his brief's own rule: a Cast signed before N2b, or
                  one whose read failed, shows no card rather than an empty one.

                  ⚠ ABOVE the voice, because who she is comes before how she
                  sounds in the only order a director reads them in.
                */}
                <CastPersonalityCard
                  personality={data.persona?.personality ?? null}
                  onSave={savePersonaField}
                  savingLine={savingPersonaField}
                />
                {/* VOICE — the drawn card with its player skeleton at rest. */}
                <section className="dpc-rcard" style={{ gap: 13 }}>
                  <div className="dpc-rcard__head">
                    <span className="dpc-persona__head">
                      <span className="dpc-rcard__label">VOICE</span>
                      {/* N2b's badge sits with the label, as the personality
                          card's does — one placement for one idea. */}
                      <CastVoiceBadge voice={data.persona?.voice ?? null} />
                    </span>
                    <button type="button" className="dpc-rcard__quiet" disabled>
                      Change
                    </button>
                  </div>
                  {/*
                    HOW SHE SOUNDS - N2b (#1242), inside the EXISTING stub
                    rather than replacing it. His brief: *"the existing Voice
                    card stub gains this text half."*

                    ⚠ **ABOVE THE PLAYER, AND THE RENDERED FRAME IS WHY.** It
                    was below, next to the foot, and the card then read: a
                    sentence describing how she sounds, and underneath it the
                    words "No voice yet". Two true statements about two
                    different things — the text line exists, the AUDIO does not
                    — stacked into what a customer reads as a contradiction.
                    Above the skeleton the line is what the card is about, and
                    the skeleton with its promise is plainly the audio half
                    that has not been built. Nothing in the stub changed.
                  */}
                  <CastVoiceLine
                    voice={data.persona?.voice ?? null}
                    onSave={savePersonaField}
                    savingLine={savingPersonaField}
                  />
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
                    that disappears in thirty days. Verified against the live
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
                              navigate(`/app/casting/cast/${sibling.castId}`);
                              return;
                            }
                            if (
                              sibling.destination === "sheet"
                              && data.lineage.fromSessionPublicId
                            ) {
                              navigate(
                                `/app/casting/s/${data.lineage.fromSessionPublicId}`
                                + `?focus=${sibling.candidateId}`,
                              );
                              return;
                            }
                            setViewingSibling(sibling);
                          }}
                          aria-label={
                            sibling.destination === "cast"
                              ? `Open ${sibling.indexLabel}'s room`
                              : sibling.destination === "sheet"
                                ? `Find ${sibling.indexLabel} on that sheet`
                                : `Look at ${sibling.indexLabel}`
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
                    Cast older than her sheet's thirty days — a dead end handed
                    to someone who did nothing wrong.
                  */}
                  {data.sheetOpen && data.lineage.fromSessionPublicId ? (
                    <Button
                      variant="quiet"
                      size="small"
                      onClick={() => navigate(`/app/casting/s/${data.lineage.fromSessionPublicId}`)}
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
          <DestructiveConfirm
            name={data.name ?? "this cast"}
            imageUrl={data.anchorUrl}
            busy={deleteCast.isPending}
            onCancel={() => setDeleting(false)}
            onConfirm={async () => {
              try {
                await deleteCast.mutateAsync({
                  clientRequestId: createClientRequestId(),
                  castId,
                });
                /*
                  KEPT, and the one destructive success in the product that
                  still toasts (D-110).

                  The rule elsewhere is that the surface acknowledges: a card
                  vanishing from a strip in front of you is a transition you
                  SEE. This action has no such surface — it destroys the page
                  that would have done the acknowledging, and lands the user on
                  a lobby where she is merely absent. An absence is a state you
                  would have to audit, not an answer to what you just did.

                  So this is D-110's fallback case rather than an exception to
                  it: work whose own surface is gone.
                */
                toast(`${data.name ?? "That cast"} was deleted.`);
                // Her room is the page we are standing on, so leaving is part
                // of the ceremony rather than something to do afterwards.
                navigate("/app/casting");
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
    </AppChrome>
  );
}
