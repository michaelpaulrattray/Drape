import { useCallback, useMemo, useState } from "react";

/**
 * ONE SELECTION, TWO VIEWS OF IT — the panel's rows and the picture's regions.
 *
 * The founder's spec (fable-200) is that clicking a feature ON THE IMAGE opens a
 * scoped edit box while the panel row lights up, and hovering either one shows
 * the other. That is one fact — *which feature are we talking about* — rendered
 * in two places, and the moment it is stored in two places it drifts: the row
 * stays lit after the box closes, or the box stays open over a feature whose row
 * has scrolled away.
 *
 * So it is held once, here, and both surfaces derive from it (working law 4).
 * The panel does not know the picture exists and the picture does not know the
 * panel does; each is handed the model and asks it the one question it needs.
 *
 * # Keys are SLOT keys, and a matched pair is one selection
 *
 * A row can be about two slots — "her earrings" while they match — so a
 * selection carries the whole set the ask would edit. `holds` answers "is this
 * slot part of what is selected", which is the question both views actually ask,
 * and it is why a matched pair lights BOTH regions on the picture.
 */
export type FaceSelection = {
  /** Everything the open selection is about. Empty when nothing is selected. */
  slots: readonly string[];
  /** How that selection reads, for the box's own scoping: "her earrings". */
  name: string;
  /** The opening of their sentence, already written for them. */
  prefill: string;
};

export type FaceSelectionModel = {
  hovered: readonly string[];
  selected: FaceSelection | null;
  /** True while this slot is under the cursor in either view. */
  isHovered: (slot: string) => boolean;
  /** True while this slot is part of the open selection. */
  isSelected: (slot: string) => boolean;
  hover: (slots: readonly string[] | null) => void;
  select: (selection: FaceSelection | null) => void;
};

export function useFaceSelection(): FaceSelectionModel {
  const [hovered, setHovered] = useState<readonly string[]>([]);
  const [selected, setSelected] = useState<FaceSelection | null>(null);

  const hover = useCallback((slots: readonly string[] | null) => {
    setHovered(slots ?? []);
  }, []);

  const select = useCallback((selection: FaceSelection | null) => {
    setSelected(selection);
  }, []);

  return useMemo(() => ({
    hovered,
    selected,
    isHovered: (slot: string) => hovered.includes(slot),
    isSelected: (slot: string) => selected?.slots.includes(slot) ?? false,
    hover,
    select,
  }), [hovered, selected, hover, select]);
}
