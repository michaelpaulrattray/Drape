import { useEffect, useRef, useState } from "react";

import { ATTACHED_PICTURE_LABEL } from "../referenceAttachCopy";
import { SPOTLIGHT_READING, SPOTLIGHT_STAGE_LABEL } from "../referenceSpotlightCopy";
import { framePoint, litPixels, pieceAt, SPOTLIGHT_NOTHING, type SpotlightIndex } from "../spotlightMap";
import { takenAt, type SpotlightView, type TakenPiece } from "../spotlightSurface";

/**
 * THE ATTACHED PICTURE, OPEN — #14 slice 3b, the spotlight itself.
 *
 * His proposal is the spec, verbatim (2026-10-30): *"it sort of highlights the
 * piece your mouse is over and darkens the rest"*, and his eye on the
 * prototype chose it over the boxes: *"I WOULD SAY I LIKE THIS MUCH BETTER
 * THAN THE BOXES THOUGH"*. So the picture carries no dots, no outlines and no
 * labels. The only thing painted on it is light.
 *
 * ## How the light is made
 *
 * The photograph is an ordinary `<img>` — the picture they attached, from the
 * browser's own copy, never a byte back from the server. Over it sits ONE
 * canvas at the frame's own size: dark everywhere, and the lit piece drawn
 * back from the photograph on top with a soft glow. That is the prototype's
 * recipe (its 0.62 dark and its white glow) carried over rather than
 * re-invented, because it is the thing he looked at and liked.
 *
 * ## What lights, and when
 *
 * - **Pointer over a piece** — that piece. A hit-test in a byte array the
 *   browser already holds; it costs nothing and asks nothing.
 * - **Pointer off the picture** — whatever has been taken, so the picture shows
 *   what is chosen without a second legend somewhere else.
 * - **A face never lights.** Not because this component checks — the server's
 *   map has no piece there (§6: faces subtracted, the whole-person piece
 *   dropped) — so there is nothing under the pointer to light.
 *
 * ## Taking
 *
 * A tap is honoured wherever it lands, lit or not (§3 item 3): small things —
 * an earring, a fine chain — have no piece of their own and are still cut by
 * the point under the finger. On a touch screen there is no hover, so the
 * first tap on a piece lights it and the second takes it; a tap on nothing lit
 * takes at once, because there is nothing to light first. A tap on something
 * already taken lets it go.
 */
/** How near a second tap must land to a taken thing to let it go, in screen pixels. */
const LET_GO_REACH_PX = 8;

export function SpotlightStage({
  pictureUrl,
  view,
  taken,
  taking,
  onTake,
  onLetGo,
}: {
  pictureUrl: string;
  /** `reading` or `lit` — an unlit picture is never given a stage at all. */
  view: SpotlightView;
  taken: readonly TakenPiece[];
  /** A tap is being taken; further taps wait for it. */
  taking: boolean;
  onTake: (at: { x: number; y: number }) => void;
  onLetGo: (key: string) => void;
}) {
  const pictureRef = useRef<HTMLImageElement | null>(null);
  const lightRef = useRef<HTMLCanvasElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  /* The piece under the pointer (or, on touch, the one a first tap lit). */
  const [hovered, setHovered] = useState<number>(SPOTLIGHT_NOTHING);
  const lastPointer = useRef<string>("mouse");

  const map: SpotlightIndex | null = view.state === "lit" ? view.map : null;

  /* A new picture starts dark-free and unhovered. */
  useEffect(() => {
    setLoaded(false);
    setHovered(SPOTLIGHT_NOTHING);
  }, [pictureUrl]);

  /*
    THE LIGHT, redrawn whenever what should be lit changes.

    The canvas is sized to the FRAME, not the screen, so the map's pixels and
    the canvas's pixels are the same grid and nothing is resampled until the
    browser scales the whole layer with the picture under it.
  */
  useEffect(() => {
    const canvas = lightRef.current;
    const picture = pictureRef.current;
    if (!canvas || !picture || !map || !loaded) {
      if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const frame = { width: map.width, height: map.height };
    if (canvas.width !== frame.width) canvas.width = frame.width;
    if (canvas.height !== frame.height) canvas.height = frame.height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, frame.width, frame.height);

    const layers = hovered !== SPOTLIGHT_NOTHING
      ? [{ map, piece: hovered }]
      : taken.map((piece) => ({ map: piece.cut, piece: 1 }));
    if (layers.length === 0) return;

    /* The lit shape, filled with the photograph itself. */
    const shape = document.createElement("canvas");
    shape.width = frame.width;
    shape.height = frame.height;
    const shapeContext = shape.getContext("2d");
    if (!shapeContext) return;
    shapeContext.putImageData(new ImageData(litPixels(frame, layers), frame.width, frame.height), 0, 0);
    shapeContext.globalCompositeOperation = "source-in";
    shapeContext.drawImage(picture, 0, 0, frame.width, frame.height);

    /* Dark everywhere, then the piece back on top with a soft glow — the glow
       scaled to the screen so it reads the same on any picture size. */
    const onScreen = picture.getBoundingClientRect().width || frame.width;
    context.fillStyle = "rgba(8, 8, 8, 0.62)";
    context.fillRect(0, 0, frame.width, frame.height);
    context.save();
    context.shadowColor = "rgba(255, 255, 255, 0.85)";
    context.shadowBlur = 12 * (frame.width / onScreen);
    context.drawImage(shape, 0, 0);
    context.restore();
    context.drawImage(shape, 0, 0);
  }, [map, loaded, hovered, taken]);

  function pointOf(event: { clientX: number; clientY: number }): { x: number; y: number } | null {
    const picture = pictureRef.current;
    if (!picture || !map) return null;
    return framePoint(event, picture.getBoundingClientRect(), map);
  }

  return (
    <div
      className="dpc-spot"
      data-state={view.state}
      data-lit={String(hovered)}
      data-taking={taking ? "true" : "false"}
    >
      <div
        className="dpc-spot__frame"
        role={map ? "group" : undefined}
        aria-label={map ? SPOTLIGHT_STAGE_LABEL : undefined}
        onPointerDown={(event) => { lastPointer.current = event.pointerType || "mouse"; }}
        onPointerMove={(event) => {
          if (!map || event.pointerType === "touch") return;
          const piece = pieceAt(map, pointOf(event));
          if (piece !== hovered) setHovered(piece);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType !== "touch") setHovered(SPOTLIGHT_NOTHING);
        }}
        onClick={(event) => {
          if (!map) return;
          const point = pointOf(event);
          if (!point) return;
          /* Tap again to let go — on the cut, which knows where small things
             are, within a finger's width of it: a hoop is a thin ring. */
          const onScreen = pictureRef.current?.getBoundingClientRect().width || map.width;
          const already = takenAt(taken, point, LET_GO_REACH_PX * (map.width / onScreen));
          if (already) {
            onLetGo(already.key);
            setHovered(SPOTLIGHT_NOTHING);
            return;
          }
          if (taking) return;
          const piece = pieceAt(map, point);
          /* No hover on a finger: the first tap lights, the second takes. */
          if (lastPointer.current === "touch" && piece !== SPOTLIGHT_NOTHING && hovered !== piece) {
            setHovered(piece);
            return;
          }
          onTake(point);
          if (lastPointer.current === "touch") setHovered(SPOTLIGHT_NOTHING);
        }}
      >
        <img
          ref={pictureRef}
          className="dpc-spot__picture"
          src={pictureUrl}
          alt={ATTACHED_PICTURE_LABEL}
          draggable={false}
          onLoad={() => setLoaded(true)}
        />
        <canvas ref={lightRef} className="dpc-spot__light" aria-hidden="true" />
        {view.state === "reading" ? (
          <span className="dpc-spot__reading" role="status">{SPOTLIGHT_READING}</span>
        ) : null}
      </div>
    </div>
  );
}

/** Load a picture once. `null` when it will not decode. */
function loadPicture(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/**
 * THE ATTACHED PICTURE'S OWN PIXEL SIZE, as this browser decodes it — what the
 * server's map is checked against before anything lights (`mapFitsPicture`).
 */
export async function pictureSize(url: string): Promise<{ width: number; height: number } | null> {
  const picture = await loadPicture(url);
  return picture && picture.naturalWidth > 0
    ? { width: picture.naturalWidth, height: picture.naturalHeight }
    : null;
}

/**
 * A TAKEN PIECE AS A SMALL PICTURE — for its chip.
 *
 * Drawn from the photograph the browser already holds, masked by the cut and
 * framed on the cut's own bounds: the server sends geometry and never a pixel
 * of the photograph (§6), so this is the only place the chip's picture can come
 * from. `null` if the picture will not decode — the chip then carries its name
 * alone, which is the honest fallback rather than a broken image.
 */
export async function cutThumbnail(
  pictureUrl: string,
  piece: Pick<TakenPiece, "cut" | "bounds">,
  side = 64,
): Promise<string | null> {
  const picture = await loadPicture(pictureUrl);
  if (!picture) return null;
  const { cut, bounds } = piece;
  const frame = { width: cut.width, height: cut.height };
  const shape = document.createElement("canvas");
  shape.width = frame.width;
  shape.height = frame.height;
  const shapeContext = shape.getContext("2d");
  if (!shapeContext) return null;
  shapeContext.putImageData(new ImageData(litPixels(frame, [{ map: cut, piece: 1 }]), frame.width, frame.height), 0, 0);
  shapeContext.globalCompositeOperation = "source-in";
  shapeContext.drawImage(picture, 0, 0, frame.width, frame.height);

  const thumb = document.createElement("canvas");
  thumb.width = side;
  thumb.height = side;
  const thumbContext = thumb.getContext("2d");
  if (!thumbContext) return null;
  /* Contained, centred: the whole piece is visible, never cropped. */
  const scale = Math.min(side / bounds.width, side / bounds.height);
  const width = bounds.width * scale;
  const height = bounds.height * scale;
  thumbContext.drawImage(
    shape,
    bounds.x, bounds.y, bounds.width, bounds.height,
    (side - width) / 2, (side - height) / 2, width, height,
  );
  return thumb.toDataURL("image/png");
}
