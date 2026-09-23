import { useRef, useState, type DragEvent } from "react";

/**
 * Counts a dragged FILE over one target and answers the hand holding it.
 *
 * Promoted out of `ConceptReviewModal` (card 1118) once a second surface
 * needed it — the legacy ink panel's *attach a reference picture* button took
 * a drop and said nothing while the file was in the air. A second hand-rolled
 * copy of this counting is exactly the drift working law 4 is about, so there
 * is one implementation and both surfaces call it.
 *
 * ⚠ **The name is NOT `useDropZone`, and the rename was deliberate** (the
 * promotion pass: rename on the way in, never after). `foundation` already
 * exports a `DropZone` — a dashed button with *no drag behaviour whatsoever*,
 * a look and nothing else. A hook called `useDropZone` sitting beside it in
 * the same barrel reads as that component's hook, which it has never been.
 *
 * **Why the depth counter, rather than a boolean.** `dragleave` fires when the
 * pointer crosses onto a CHILD of the target, not only when it leaves the
 * target — so a zone with any content inside it flickers its over-state off
 * the moment the file passes over the picture, the icon or the label. Entering
 * a child fires `dragenter` on the child first, so counting enters against
 * leaves and only answering at zero is what makes the state survive the
 * journey across the zone's own contents.
 *
 * **One hook call per zone, never one flag shared by several.** Card 1087's
 * finding: two zones reading one flag light the wrong one — the picture
 * answered while the hand was two columns away and said nothing when the file
 * was actually over the face.
 *
 * `preventDefault` on dragover is what MAKES an element a drop target. Without
 * it the browser refuses the drop and then NAVIGATES THE TAB to the file,
 * which takes whatever the customer was working on with it.
 */
export function useFileDropTarget(onFiles: (files: FileList | null) => void) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const handlers = {
    onDragEnter: (event: DragEvent) => {
      if (!event.dataTransfer?.types?.includes("Files")) return;
      depth.current += 1;
      setOver(true);
    },
    onDragOver: (event: DragEvent) => {
      if (!event.dataTransfer?.types?.includes("Files")) return;
      event.preventDefault();
    },
    onDragLeave: () => {
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setOver(false);
    },
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      depth.current = 0;
      setOver(false);
      onFiles(event.dataTransfer?.files ?? null);
    },
  };
  return { over, handlers };
}
