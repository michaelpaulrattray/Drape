import { Check } from "lucide-react";

/**
 * THE CHECKBOX ON A LIBRARY TILE (card #2251).
 *
 * ⚠ **A TICK MUST NEVER OPEN THE CAST.** The tile is a button that navigates
 * to the cast's room, and the obvious build puts the checkbox inside it — where
 * every tick is also a click on the tile. So it is a SIBLING of the tile, in
 * the same positioned wrapper the card's menu already uses, and the tile's
 * click handler is never on its path. Nesting a checkbox in a button would be
 * an interactive control inside another one as well, which is invalid markup.
 *
 * A real `<input type="checkbox">`, so Space toggles it, a screen reader
 * announces it as a checkbox with its state, and the browser owns the
 * semantics. It is drawn by the stylesheet; the glyph is decoration.
 *
 * Hidden at rest on a pointer device until the card is hovered or focused, like
 * the card's menu — and always shown once anything is ticked, or on a touch
 * screen where nothing hovers (`castingV2.css`, `.dpc-castpick`).
 */
export function CastPickBox({
  name,
  checked,
  onToggle,
}: {
  name: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="dpc-castpick">
      <input
        type="checkbox"
        className="dpc-castpick__input"
        checked={checked}
        aria-label={`Select ${name}`}
        onChange={onToggle}
        onClick={(event) => {
          /* Nothing above this is a link today; this keeps it so if one ever is. */
          event.stopPropagation();
        }}
      />
      <Check className="dpc-castpick__tick" size={13} strokeWidth={2.4} aria-hidden="true" />
    </label>
  );
}
