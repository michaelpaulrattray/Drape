import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Plus, Search, Upload } from "lucide-react";
import { toast } from "sonner";

import {
  AppShell,
  Button,
  Card,
  Chip,
  DropZone,
  Field,
  Input,
  ScopePill,
  SectionHead,
} from "@/foundation";
import { trpc } from "@/lib/trpc";
import { createClientRequestId } from "@shared/clientRequestId";
import { useSheetState } from "@/features/castingV2/sheetState";
import heroPortrait from "@/assets/casting/hero-portrait.webp";
import heroSecondFrame from "@/assets/casting/hero-second-frame.webp";
import "@/features/castingV2/castingV2.css";

/**
 * The Casting tab (handoff chapter 07, plan §K M5).
 *
 * Sentence in, sheet out. Two things are deliberately missing and both are
 * absences with reasons:
 *
 *   - **No hero band of ambient numbers.** The prototype's "184 performers
 *     cleared for paid ads", "99.4% retention" and "locks in ~4 min" are
 *     decorative fiction. The honest-capability law (§B-17) says real numbers
 *     or none, and right now there are none to state.
 *   - **No engine selector.** The prototype's "Klieg V2" dropdown was
 *     confirmed by the founder as prototype fiction — provider choice is
 *     server policy, app-wide, and no casting surface offers it.
 *
 * The roster grid is genuinely empty in M5, because Sign lands in M7 and no V2
 * cast can exist before it. It still renders, with the dashed create tile
 * first: the create action never hides behind the collection, and a section
 * that appears from nowhere at M7 would be a worse introduction than one that
 * has always been there.
 */

const ROLL_PRICE_FALLBACK = 0;

/**
 * Starting points, not presets. They fill the box so the first sentence is
 * easy to write; nothing is applied until the user reads it and rolls.
 */
const TRY_BRIEFS = [
  "Skincare founder, 40s, unbothered",
  "Gen-Z gym rat, ring light, fast talker",
  "Bodega owner, Brooklyn, gravelly",
  "Night-routine voice, almost whispering",
];

/** F3: UNSIGNED everywhere. DRAFT is retired vocabulary. */
const ROSTER_SCOPES = ["All", "Signed", "UNSIGNED"] as const;
type RosterScope = (typeof ROSTER_SCOPES)[number];

export default function CastingV2() {
  const [, navigate] = useLocation();
  const [brief, setBrief] = useState("");
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<RosterScope>("All");
  const [starting, setStarting] = useState(false);
  const rosterRef = useRef<HTMLElement>(null);
  const reset = useSheetState((state) => state.reset);
  const setStartingRoll = useSheetState((state) => state.setStartingRoll);

  const focusBrief = () =>
    document.querySelector<HTMLInputElement>('input[aria-label="Casting brief"]')?.focus();

  /** The roster card targets the real roster — not a fake destination. */
  const scrollToRoster = () => {
    rosterRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const config = trpc.castingV2.config.useQuery({});
  const openSessions = trpc.castingV2.openSessions.useQuery(
    {},
    { enabled: config.data?.enabled === true },
  );

  const createSession = trpc.castingV2.createSession.useMutation();
  const createRoll = trpc.castingV2.createRoll.useMutation();

  if (config.isLoading) {
    return (
      <AppShell breadcrumb="Casting" current="casting" width="browse">
        <span className="dp-metadata">Loading…</span>
      </AppShell>
    );
  }

  /*
    Flag off is a real state, not a blank page. The rail links here for every
    signed-in user while the scope is founder-only, so this is what most
    accounts see — and it should read as "not yet" rather than as breakage.
  */
  if (!config.data?.enabled) {
    return (
      <AppShell breadcrumb="Casting" current="casting" width="browse">
        <div className="dp-stack" style={{ gap: 9, maxWidth: 520 }}>
          <span className="dp-eyebrow">Casting</span>
          <h1 className="dp-headline">Not open on this account yet.</h1>
          <p className="dp-body">
            Casting is being tested with a small group first. Nothing here is
            charged, and your existing models are unaffected.
          </p>
        </div>
      </AppShell>
    );
  }

  const price = config.data.rollPriceCredits ?? ROLL_PRICE_FALLBACK;
  const candidatesPerRoll = config.data.candidatesPerRoll ?? 8;

  const startCasting = async () => {
    if (brief.trim().length < 3 || starting) return;
    setStarting(true);
    try {
      const session = await createSession.mutateAsync({ originType: "roster" });

      /*
        Fire the roll and leave immediately — do NOT await it.

        `createRoll` awaits all eight candidates before it returns, which M3
        measured at 66–82 seconds. Awaiting it here would park the user on this
        page staring at a spinner for a minute, and then drop them onto a sheet
        where all eight images appear at once. That is precisely the batch flip
        the prototype does and the reconciliation rejects.

        The mutation survives this component unmounting, and the roll's rows
        commit before dispatch — so by the time the sheet's first poll lands,
        eight queued candidates are there to render as skeletons, each swapping
        on its own arrival.
      */
      reset();
      setStartingRoll(true);
      createRoll.mutate(
        {
          clientRequestId: createClientRequestId(),
          sessionId: session.sessionId,
          briefText: brief.trim(),
        },
        {
          onError: (error) => {
            setStartingRoll(false);
            toast(error.message);
          },
          onSettled: () => setStartingRoll(false),
        },
      );

      // Navigating IS the confirmation, so no toast — the toast law fires on
      // actions that leave you where you were, never on ones that move you.
      navigate(`/casting/s/${session.sessionId}`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "That roll could not start.");
    } finally {
      setStarting(false);
    }
  };

  const signedCount = 0; // Sign lands in M7; until then the roster is truly empty.
  const scopeCounts: Record<RosterScope, number> = {
    All: signedCount,
    Signed: signedCount,
    UNSIGNED: 0,
  };

  return (
    <AppShell breadcrumb="Casting" current="casting" width="browse">
      <div className="dp-stack" style={{ gap: 12 }}>
        {/* ---- hero card: copy left, the pair right, one seam between ---- */}
        <div className="dpc-hero">
          <div className="dpc-hero__copy">
            <span className="dp-eyebrow">Casting</span>
            {/*
              "Meet eight of them." — the copy law's own exemplar. A numeral
              here would be the cheapest possible way to break it, which is
              exactly why the handoff uses this line to make the point.
            */}
            <h1 className="dpc-hero__title">
              Say who you need.
              <br />
              Meet eight of them.
            </h1>
            <span className="dp-body">
              A cast member is a face, a voice and a way of talking — signed once, reusable in
              every campaign. Describe one and pick from a sheet, or start from photos of a
              real person.
            </span>

            <Field className="dpc-hero__field">
              <Input
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void startCasting();
                }}
                placeholder="a dad in his 30s in a cluttered garage, dry humour, explains things like he's talking to a mate"
                aria-label="Casting brief"
              />
              <Button variant="primary" size="small" onClick={startCasting} disabled={starting}>
                Cast it · {price} cr
                <ArrowRight size={12} strokeWidth={2.2} aria-hidden="true" />
              </Button>
            </Field>

            {/*
              Nudge chips. One tap fills the box — they do not roll, and they
              carry no price of their own. A chip that both spends and hides
              the cost is how a one-tap affordance stops reading as a purchase;
              the priced button sits directly above them (D-15).
            */}
            <div className="dp-row" style={{ gap: 7 }}>
              <span className="dp-chrome">TRY</span>
              {TRY_BRIEFS.map((suggestion) => (
                <Chip key={suggestion} onClick={() => setBrief(suggestion)}>
                  {suggestion}
                </Chip>
              ))}
            </div>
          </div>

          {/*
            The split pair. Its construction is the point: a 1px gap over a
            `--border` background, plus a 1px outline, so the seam between the
            two frames and the edge around them are the same hairline. Two
            bordered boxes side by side would read as two cards; this reads as
            one pane, split.

            The art is platform-owned synthetic output from the M3 identity run
            — one anchor held across views, which is precisely the claim the
            pair makes: the same person, framed twice. No pills: SIGNED would
            be false until M7 signs someone, and the prototype's "212 FRAMES"
            is invented. Structure ships, claims do not (F5).
          */}
          <div className="dpc-hero__pair">
            <div className="dpc-hero__slot">
              <img src={heroPortrait} alt="A cast member, portrait" />
            </div>
            <div className="dpc-hero__slot">
              <img src={heroSecondFrame} alt="The same cast member in a second frame" />
            </div>
          </div>
        </div>

        {/* ---- the two entry cards ---- */}
        <div className="dpc-entries">
          {/*
            Upload-a-real-person ships as drawn, inert, with copy that says so
            (F5 supersedes the earlier decision to omit it). The prototype's
            "Six photos or one 20-second clip. Likeness locks in about four
            minutes." is a promise about a feature that does not exist, so the
            structure stays and the claim goes.
          */}
          <div className="dpc-entry dpc-entry--inert" aria-disabled="true">
            <span className="dpc-entry__icon">
              <Upload size={14} strokeWidth={1.9} aria-hidden="true" />
            </span>
            <span className="dp-stack" style={{ gap: 4, minWidth: 0 }}>
              <span className="dp-label">Upload a real person</span>
              <span className="dp-secondary">
                Casting from your own photos is coming. For now, describe the person and cast
                them.
              </span>
            </span>
          </div>

          <button type="button" className="dpc-entry" onClick={scrollToRoster}>
            <span className="dpc-entry__stack" aria-hidden="true">
              <span className="dpc-entry__chip" />
              <span className="dpc-entry__chip" />
              <span className="dpc-entry__chip" />
            </span>
            <span className="dp-stack" style={{ gap: 4, minWidth: 0 }}>
              <span className="dp-label">Browse the signed roster</span>
              <span className="dp-secondary">
                {signedCount === 0
                  ? "No one signed yet. Cast a sheet and sign the one you want to keep."
                  : `${signedCount} signed and ready to use in any campaign.`}
              </span>
            </span>
          </button>
        </div>
      </div>

      {/* ---- search + scope. Empty-safe: it filters nothing gracefully. ---- */}
      <div className="dpc-filters">
        <Field compact className="dpc-filters__search">
          <Search size={13} strokeWidth={2} aria-hidden="true" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search cast by name, voice, or vibe"
            aria-label="Search cast"
          />
        </Field>
        {ROSTER_SCOPES.map((option) => (
          <ScopePill key={option} active={scope === option} onClick={() => setScope(option)}>
            {option}
          </ScopePill>
        ))}
      </div>

      {openSessions.data && openSessions.data.length > 0 ? (
        <section className="dp-stack" style={{ gap: 12 }}>
          <SectionHead eyebrow="Unsigned sheets" aside="pick up where you left off" />
          <div className="dp-grid">
            {openSessions.data.map((entry) => (
              <Card
                key={entry.sessionId}
                interactive
                onClick={() => navigate(`/casting/s/${entry.sessionId}`)}
              >
                <span className="dp-label">{entry.briefText ?? "Untitled sheet"}</span>
                <span className="dp-secondary">
                  {entry.rollCount} roll{entry.rollCount === 1 ? "" : "s"}
                  {entry.keptCount > 0 ? ` · ${entry.keptCount} kept` : ""}
                </span>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section className="dp-stack" style={{ gap: 12 }} ref={rosterRef}>
        {/*
          Scope label + count, as drawn. The count is real — and when it is
          zero it says zero, which is the whole difference between this and
          "184 performers already cleared for paid ads".
        */}
        <div className="dpc-rosterhead">
          <span className="dp-label" style={{ fontSize: 13.5 }}>
            {scope === "All" ? "All cast" : scope === "Signed" ? "Signed" : "Unsigned"}
          </span>
          <span className="dp-small">
            {scopeCounts[scope]} {scopeCounts[scope] === 1 ? "cast member" : "cast members"}
          </span>
        </div>

        {/* 178px 4:5 tiles, dashed create tile first (10-shared-patterns). */}
        <div className="dpc-roster">
          <DropZone className="dpc-roster__new" onClick={focusBrief}>
            <Plus size={17} strokeWidth={1.7} aria-hidden="true" />
            <span className="dp-secondary">New cast member</span>
          </DropZone>
        </div>

        {/* A sentence, so Archivo — mono is for machine facts only. */}
        <span className="dp-secondary">
          No one signed yet — cast a sheet, then sign the candidate you want to keep working
          with.
        </span>
      </section>
    </AppShell>
  );
}
