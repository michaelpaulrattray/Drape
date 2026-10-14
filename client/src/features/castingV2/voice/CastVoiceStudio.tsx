import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

import { Button } from "@/foundation";
import { trpc } from "@/lib/trpc";
import { logRawFailure } from "@/lib/failureSentence";
import {
  VOICE_CANNOT_KEEP,
  VOICE_CHOICES_LABEL,
  VOICE_KEEP_FAILED,
  VOICE_KEPT_HINT,
  VOICE_LINE_TOO_SHORT,
  VOICE_MAKE_AGAIN,
  VOICE_MAKE_FAILED,
  VOICE_MAKING_LOADER,
  VOICE_NEEDS_A_LINE,
  voiceAuditionLoader,
  voiceKeepLabel,
  voiceKeptFoot,
  voiceLabel,
  voicePlayLabel,
} from "@shared/voiceCardCopy";
import {
  VOICE_WAVE_BARS,
  barsPlayed,
  peaksFromSamples,
  spokenDuration,
} from "./waveform";

/**
 * LISTEN AND PICK — the Voice card's own half, N4b-2 (#2470), design
 * `docs/specs/N4B_VOICE_DESIGN_2026-10-13.md` §1/§6.
 *
 * The voice LINE stays on top and is not this component's (#2140: *"the voice
 * text stays on top as the main editable field"*). What sits under it is three
 * voices made from those words, each with play and a waveform, and one press to
 * keep the one they pick.
 *
 * # ⚠ WHILE THE ROAD IS DARK THIS DRAWS EXACTLY WHAT THE CARD DREW BEFORE
 *
 * `voiceStatus` answers `available: false` outside `CASTING_VOICE_SCOPE`, and
 * the panel then renders the resting player and *"No voice yet"* — the stub's
 * own markup, moved here rather than copied, so there is ONE drawing of it
 * (working law 4). The flag is unset everywhere, so this whole slice is
 * invisible on production until his account is named in it.
 *
 * # WHAT A CUSTOMER LEARNS TO USE IT: NOTHING (the law's first question)
 *
 * They already write the line. The voices appear under it; they press play,
 * listen, and press Keep. There is no voice id, no slot, no clone, no vendor
 * and no format anywhere on the path — every string comes from
 * `shared/voiceCardCopy.ts` and a test reads them all.
 *
 * ⚠ **AND THERE IS NO NUMBER ON THE BUTTON, WHICH IS A DEPARTURE FROM THE
 * CARD'S LETTER AND IS DECLARED RATHER THAN QUIET.** The card asks for
 * *"Make new voices from this text · <credits>"* with a **placeholder** price.
 * Nothing is charged in this slice — the real price and the atomic charge are
 * #2471 — and a credit figure drawn beside a press that charges nothing is a
 * false promise, as well as being the *"number nobody can act on"* the
 * disappearing-technology law's third question forbids. So the button says what
 * it does and names no price until there is one to name, and the two arrive
 * together. The simpler road, named because the fidelity law asks: draw a
 * plausible figure now and hope the rung lands before anyone presses it.
 */

/** One voice a customer can listen to. The audio is bytes, never an address. */
export type VoiceChoice = {
  /** Opaque — only the server can turn it back into a provider id. */
  handle: string;
  audioBase64: string;
  contentType: string;
  durationSeconds: number | null;
};

export type VoiceStudioStage = "resting" | "making" | "choosing" | "keeping";

/** What one strip knows about itself. Bars are measured, or null at rest. */
export type VoiceStripState = {
  bars: number[] | null;
  playing: boolean;
  barsLit: number;
  duration: string | null;
};

/**
 * The resting ornament, and the one place it is written down.
 *
 * It is the strip the card has always drawn before anything was pressed, and it
 * is an ORNAMENT rather than a measurement — a bar strip at rest, not a claim
 * about a recording. The moment there is audio, {@link peaksFromSamples}
 * replaces it with the real shape.
 */
export const VOICE_RESTING_WAVE: readonly number[] = [
  30, 55, 40, 70, 45, 85, 35, 60, 50, 75, 40, 65, 30, 80, 45,
  55, 70, 35, 60, 40, 75, 50, 65, 30, 55, 45, 70, 40, 60, 35,
];

/** A play/pause control, a strip, and a duration. One per voice. */
export function VoiceStrip({
  label,
  state,
  onToggle,
}: {
  label: string;
  state: VoiceStripState;
  /** Absent means a strip at rest with nothing to play — the dark card. */
  onToggle?: () => void;
}) {
  const bars = state.bars ?? VOICE_RESTING_WAVE;
  return (
    <div className="dpc-voice__player">
      {onToggle ? (
        <button
          type="button"
          className="dpc-voice__play dpc-voice__play--live"
          aria-label={label}
          aria-pressed={state.playing}
          onClick={onToggle}
        >
          {state.playing
            ? <Pause size={13} strokeWidth={2} aria-hidden="true" />
            : <Play size={13} strokeWidth={2} aria-hidden="true" />}
        </button>
      ) : (
        <span className="dpc-voice__play">
          <Play size={13} strokeWidth={2} aria-hidden="true" />
        </span>
      )}
      <span className="dpc-voice__wave" aria-hidden="true">
        {bars.map((height, index) => (
          <span
            key={index}
            className={index < state.barsLit ? "dpc-voice__bar--lit" : undefined}
            style={{ height: `${height}%` }}
          />
        ))}
      </span>
      {state.duration ? <span className="dpc-voice__len">{state.duration}</span> : null}
    </div>
  );
}

export type CastVoiceStudioPanelProps = {
  /** False while the road is dark — the panel then draws the old stub. */
  available: boolean;
  /** Whether there is a written voice line to make voices from. */
  hasLine: boolean;
  /** The cast's name, or null. Never used to gender anything. */
  name: string | null;
  kept: { clipPath: string } | null;
  stage: VoiceStudioStage;
  choices: readonly VoiceChoice[];
  /** A sentence saying why the last press didn't happen, or null. */
  refusal: string | null;
  stripFor: (key: string) => VoiceStripState;
  onToggle: (key: string) => void;
  onMake: () => void;
  onKeep: (handle: string) => void;
};

/** The key a strip is addressed by. One spelling, used by both halves. */
export function voiceStripKey(choice: { handle: string }): string {
  return `choice:${choice.handle}`;
}

/** The kept clip's strip key. */
export const KEPT_STRIP_KEY = "kept";

export function CastVoiceStudioPanel({
  available,
  hasLine,
  name,
  kept,
  stage,
  choices,
  refusal,
  stripFor,
  onToggle,
  onMake,
  onKeep,
}: CastVoiceStudioPanelProps) {
  /*
    THE DARK CARD, AND IT IS THE STUB'S OWN MARKUP.

    `CastingRoom` drew this inline until this card; it is here now so there is
    one drawing of the resting voice card rather than two that drift. The words
    are the stub's, unchanged, because nothing about them is false while there
    is no voice road for this account.
  */
  if (!available) {
    return (
      <>
        <VoiceStrip label="" state={stripFor(KEPT_STRIP_KEY)} />
        <div className="dpc-voice__foot">
          <span className="dpc-voice__name">No voice yet</span>
          <span className="dpc-rcard__hint">
            A designed voice and an audition clip arrive with voice.
          </span>
        </div>
      </>
    );
  }

  /* A kept voice IS the card from then on: the player plays the cast's own
     audition and the foot names it, replacing "No voice yet" (design §6). */
  if (kept) {
    return (
      <>
        <VoiceStrip
          label={`Play ${voiceKeptFoot(name)}`}
          state={stripFor(KEPT_STRIP_KEY)}
          onToggle={() => onToggle(KEPT_STRIP_KEY)}
        />
        <div className="dpc-voice__foot">
          <span className="dpc-voice__name">{voiceKeptFoot(name)}</span>
          <span className="dpc-rcard__hint">{VOICE_KEPT_HINT}</span>
        </div>
      </>
    );
  }

  /* No line to make voices from: the card points at the door above it rather
     than offering a press that cannot work. */
  if (!hasLine) {
    return (
      <>
        <VoiceStrip label="" state={stripFor(KEPT_STRIP_KEY)} />
        <div className="dpc-voice__foot">
          <span className="dpc-voice__name">No voice yet</span>
          <span className="dpc-rcard__hint">{VOICE_NEEDS_A_LINE}</span>
        </div>
      </>
    );
  }

  const working = stage === "making" || stage === "keeping";
  const loader = stage === "keeping" ? voiceAuditionLoader(name) : VOICE_MAKING_LOADER;

  return (
    <>
      {working ? (
        /* THE HONEST LOADER (#55): it names what is happening to their cast,
           never what is doing it. */
        <div className="dpc-voice__working" role="status">
          <span className="dpc-voice__workingDot" aria-hidden="true" />
          <span className="dpc-voice__workingWord">{loader}</span>
        </div>
      ) : null}

      {choices.length > 0 && stage !== "keeping" ? (
        <div className="dpc-voice__choices">
          <span className="dpc-rcard__label">{VOICE_CHOICES_LABEL}</span>
          {choices.map((choice, index) => (
            <div className="dpc-voice__choice" key={choice.handle}>
              <span className="dpc-voice__choiceName">{voiceLabel(index)}</span>
              <VoiceStrip
                label={voicePlayLabel(index)}
                state={stripFor(voiceStripKey(choice))}
                onToggle={() => onToggle(voiceStripKey(choice))}
              />
              <Button
                variant="secondary"
                size="small"
                disabled={working}
                onClick={() => onKeep(choice.handle)}
              >
                {voiceKeepLabel(index)}
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {choices.length === 0 && !working ? (
        <VoiceStrip label="" state={stripFor(KEPT_STRIP_KEY)} />
      ) : null}

      <div className="dpc-voice__foot">
        <Button variant="quiet" size="small" disabled={working} onClick={onMake}>
          {VOICE_MAKE_AGAIN}
        </Button>
        {refusal ? (
          <span className="dpc-voice__refusal" role="alert">{refusal}</span>
        ) : null}
      </div>
    </>
  );
}

/**
 * Which refusals a customer reads which sentence for.
 *
 * ⚠ **Keyed on the refusal's own NAME, never on a server sentence.** The server
 * returns a discriminated key (`VoiceRefusal`) precisely so the words can live
 * in `shared/voiceCardCopy.ts`; mapping on prose is the class
 * [[spelling-not-meaning]] names. An unknown key falls back to the generic
 * sentence rather than showing nothing — a refusal with no words is the silence
 * direction.
 */
export function voiceRefusalSentence(refusal: string, during: "make" | "keep"): string {
  switch (refusal) {
    case "no_operations_left":
    case "no_slots_left":
      return VOICE_CANNOT_KEEP;
    case "voice_line_too_short":
      return VOICE_LINE_TOO_SHORT;
    case "no_voice_line":
      return VOICE_NEEDS_A_LINE;
    default:
      return during === "keep" ? VOICE_KEEP_FAILED : VOICE_MAKE_FAILED;
  }
}

/**
 * Which casts have already had their first three made in THIS page session.
 *
 * The design's *"the first three voices are made when the card first opens with
 * voice on"* is a once-per-cast event, not a once-per-mount one: the room
 * re-mounts on navigation, and a design costs house money every time. Module
 * scope rather than component state is what makes leaving the room and coming
 * back free.
 */
const designedThisSession = new Set<string>();

/** The panel, wired. `castId` is the cast's public Klieg ID. */
export function CastVoiceStudio({ castId, name }: { castId: string; name: string | null }) {
  const utils = trpc.useUtils();
  const status = trpc.castingV2.voice.status.useQuery({ castId }, { enabled: Boolean(castId) });
  const design = trpc.castingV2.voice.design.useMutation();
  const keep = trpc.castingV2.voice.keep.useMutation();

  const [designId, setDesignId] = useState<string | null>(null);
  const [choices, setChoices] = useState<readonly VoiceChoice[]>([]);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bars, setBars] = useState<Record<string, number[]>>({});

  const audio = useRef<HTMLAudioElement | null>(null);
  /* Object URLs are revoked when they are replaced and on unmount: a blob held
     by a dead component is a leak the browser cannot see is dead. */
  const urls = useRef<Map<string, string>>(new Map());

  const available = status.data?.available === true;
  const kept = status.data?.kept ?? null;
  const hasLine = status.data?.hasLine === true;

  const releaseUrls = useCallback(() => {
    for (const url of Array.from(urls.current.values())) URL.revokeObjectURL(url);
    urls.current.clear();
  }, []);

  useEffect(() => () => {
    audio.current?.pause();
    releaseUrls();
  }, [releaseUrls]);

  /** base64 → bytes. One spelling, used by the player and by the decoder. */
  const bytesOf = useCallback((base64: string): Uint8Array<ArrayBuffer> => {
    const binary = atob(base64);
    /* The buffer is named so the type is `Uint8Array<ArrayBuffer>` rather than
       `ArrayBufferLike`: a `SharedArrayBuffer` is not a `BlobPart`, and TS 5.9
       widens a bare `new Uint8Array(n)` to the union. */
    const buffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buffer);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }, []);

  /**
   * A playable address for one strip.
   *
   * ⚠ **THE KEPT CLIP IS FETCHED ONCE AND PLAYED FROM A BLOB, rather than
   * handed to the element as a URL** — and that is not an optimisation, it is
   * what lets its waveform be MEASURED. The route answers `private, no-store`,
   * so a browser fetching it twice (once to play, once to decode) would really
   * pull ~1.6 MB twice; one fetch feeds both. Drawing the resting ornament
   * instead was the first shape, and the rendered frame is what refused it: in
   * the kept state there IS audio, so an invented shape under a playing clip
   * reads as that clip's shape. The fidelity law, caught by looking.
   */
  const sourceFor = useCallback(async (key: string): Promise<{ url: string; bytes: Uint8Array<ArrayBuffer> } | null> => {
    const existing = urls.current.get(key);
    if (key === KEPT_STRIP_KEY) {
      if (existing) return { url: existing, bytes: new Uint8Array(new ArrayBuffer(0)) };
      if (!kept?.clipPath) return null;
      const response = await fetch(kept.clipPath, { credentials: "same-origin" });
      if (!response.ok) throw new Error(`clip ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      urls.current.set(key, url);
      return { url, bytes: new Uint8Array(await blob.arrayBuffer()) };
    }
    const choice = choices.find((candidate) => voiceStripKey(candidate) === key);
    if (!choice) return null;
    const bytes = bytesOf(choice.audioBase64);
    if (existing) return { url: existing, bytes };
    const url = URL.createObjectURL(new Blob([bytes], { type: choice.contentType }));
    urls.current.set(key, url);
    return { url, bytes };
  }, [bytesOf, choices, kept]);

  /** Decode one strip's bytes into its real shape. Silent on failure. */
  const measure = useCallback(async (key: string, bytes: Uint8Array<ArrayBuffer>) => {
    if (bytes.byteLength === 0) return;
    const AudioContextCtor = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const context = new AudioContextCtor();
    try {
      const decoded = await context.decodeAudioData(bytes.buffer.slice(0) as ArrayBuffer);
      const peaks = peaksFromSamples(decoded.getChannelData(0), VOICE_WAVE_BARS);
      if (peaks.length > 0) setBars((previous) => ({ ...previous, [key]: peaks }));
    } catch {
      /* The strip stays at rest. Nothing about their voice has gone wrong. */
    } finally {
      void context.close().catch(() => {});
    }
  }, []);

  /*
    THE REAL SHAPE OF EACH VOICE, decoded once per voice.

    `decodeAudioData` is the browser's own decoder — the dedicated tool the
    fidelity law asks for over drawing the resting ornament three times. A
    failure is not an error a customer should ever see: the strip simply stays
    at rest, which is honest, so it is caught and dropped.
  */
  useEffect(() => {
    const pending = choices.filter((choice) => !bars[voiceStripKey(choice)]);
    if (pending.length === 0) return;
    void (async () => {
      for (const choice of pending) {
        await measure(voiceStripKey(choice), bytesOf(choice.audioBase64));
      }
    })();
  }, [choices, bars, bytesOf, measure]);

  const stripFor = useCallback((key: string): VoiceStripState => {
    const playing = playingKey === key;
    const measured = bars[key] ?? null;
    const choice = choices.find((candidate) => voiceStripKey(candidate) === key);
    const known = playing && duration > 0
      ? duration
      : key === KEPT_STRIP_KEY ? null : choice?.durationSeconds ?? null;
    return {
      bars: measured,
      playing,
      barsLit: playing
        ? barsPlayed({ positionSeconds: position, durationSeconds: duration, bars: VOICE_WAVE_BARS })
        : 0,
      duration: spokenDuration(known),
    };
  }, [bars, choices, duration, playingKey, position]);

  const toggle = useCallback((key: string) => {
    const element = audio.current;
    if (!element) return;
    if (playingKey === key) {
      element.pause();
      setPlayingKey(null);
      return;
    }
    /* One at a time, deliberately: comparing voices means hearing one voice. */
    element.pause();
    void (async () => {
      let source: { url: string; bytes: Uint8Array<ArrayBuffer> } | null;
      try {
        source = await sourceFor(key);
      } catch (error) {
        logRawFailure("voiceClip.fetch", error);
        setRefusal(VOICE_KEEP_FAILED);
        return;
      }
      if (!source) return;
      element.src = source.url;
      setPosition(0);
      setDuration(0);
      setPlayingKey(key);
      /* Measured after the press rather than before it, so the fetch pays for
         the play first and the shape arrives a moment later. */
      if (!bars[key]) void measure(key, source.bytes);
      void element.play().catch((error) => {
        logRawFailure("voiceClip.play", error);
        setPlayingKey(null);
      });
    })();
  }, [bars, measure, playingKey, sourceFor]);

  const make = useCallback(async () => {
    setRefusal(null);
    audio.current?.pause();
    setPlayingKey(null);
    try {
      const result = await design.mutateAsync({ castId });
      if (!result.ok) {
        setRefusal(voiceRefusalSentence(result.refusal, "make"));
        return;
      }
      /* The previous design's blobs can never be kept now, so they are released
         with the voices they belonged to rather than at unmount. */
      releaseUrls();
      setBars({});
      setDesignId(result.designId);
      setChoices(result.voices);
    } catch (error) {
      logRawFailure("castingV2.voice.design", error);
      setRefusal(VOICE_MAKE_FAILED);
    }
  }, [castId, design, releaseUrls]);

  /* THE FIRST THREE ARRIVE WITHOUT A PRESS (design §1), once per cast per page
     session — see `designedThisSession` for why that is not per mount. */
  useEffect(() => {
    if (!available || !hasLine || kept || choices.length > 0) return;
    if (designedThisSession.has(castId)) return;
    designedThisSession.add(castId);
    void make();
  }, [available, hasLine, kept, choices.length, castId, make]);

  const onKeep = useCallback(async (handle: string) => {
    if (!designId) return;
    setRefusal(null);
    audio.current?.pause();
    setPlayingKey(null);
    try {
      const result = await keep.mutateAsync({ castId, designId, handle });
      if (!result.ok) {
        setRefusal(voiceRefusalSentence(result.refusal, "keep"));
        return;
      }
      releaseUrls();
      setChoices([]);
      setDesignId(null);
      setBars({});
    } catch (error) {
      logRawFailure("castingV2.voice.keep", error);
      setRefusal(VOICE_KEEP_FAILED);
    } finally {
      void utils.castingV2.voice.status.invalidate({ castId });
    }
  }, [castId, designId, keep, releaseUrls, utils]);

  const stage: VoiceStudioStage = keep.isPending
    ? "keeping"
    : design.isPending ? "making" : choices.length > 0 ? "choosing" : "resting";

  const panel = useMemo(() => ({ stripFor, onToggle: toggle, onMake: () => void make(), onKeep: (handle: string) => void onKeep(handle) }), [stripFor, toggle, make, onKeep]);

  return (
    <>
      <CastVoiceStudioPanel
        available={available}
        hasLine={hasLine}
        name={name}
        kept={kept}
        stage={stage}
        choices={choices}
        refusal={refusal}
        stripFor={panel.stripFor}
        onToggle={panel.onToggle}
        onMake={panel.onMake}
        onKeep={panel.onKeep}
      />
      {/*
        ONE audio element for the whole card, so pressing a second voice stops
        the first. `preload="none"` matters for the kept clip: it is ~2.1 MB
        (measured, #2469) and nothing should download until somebody presses
        play.
      */}
      <audio
        ref={audio}
        preload="none"
        hidden
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          const seconds = event.currentTarget.duration;
          setDuration(Number.isFinite(seconds) ? seconds : 0);
        }}
        onEnded={() => {
          setPlayingKey(null);
          setPosition(0);
        }}
        onError={() => setPlayingKey(null)}
      />
    </>
  );
}
