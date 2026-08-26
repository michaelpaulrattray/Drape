import { ScopePill } from "@/foundation";
import { IMAGINATION_LINES, IMAGINATION_NAMES, IMAGINATIONS, type Imagination } from "@shared/imagination";

/**
 * THE IMAGINATION METER (#131 slice E) — drawn ONLY for an account on the
 * author road (`config.authorRoadEnabled`), in the place the path toggle used
 * to stand: the ruling retires the wardrobe/basics switch on this road (rule
 * 11, *"let the engine decide the outfits based on the prompt"*) and puts this
 * in its stead (rule 10). Same chrome as `PathToggle` on purpose — it is the
 * same kind of thing, a choice about the NEXT roll, told before the price.
 *
 * ABSENT, never disabled, off the road: the server ignores the field for an
 * account the author does not serve, so the client simply does not draw a
 * control nobody's roll would read (D-180: a disabled toggle is a question
 * with no answer wearing a tap target).
 */
export function ImaginationToggle({
  value,
  onChange,
  idPrefix,
  label,
}: {
  value: Imagination;
  onChange: (imagination: Imagination) => void;
  idPrefix: string;
  label: string;
}) {
  return (
    <div className="dpc-paths">
      <div className="dpc-paths__row" role="group" aria-label={label}>
        <span className="dp-chrome">IMAGINATION</span>
        {IMAGINATIONS.map((imagination) => (
          <ScopePill
            key={imagination}
            id={`${idPrefix}-${imagination}`}
            active={value === imagination}
            onClick={() => onChange(imagination)}
          >
            {IMAGINATION_NAMES[imagination]}
          </ScopePill>
        ))}
      </div>
      <p className="dpc-paths__note">{IMAGINATION_LINES[value]}</p>
    </div>
  );
}

