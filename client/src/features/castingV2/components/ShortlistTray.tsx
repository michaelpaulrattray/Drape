import { GradientTile, SectionHead } from "@/foundation";

/**
 * The cross-roll tray.
 *
 * Keeps survive rolling again — that is the whole point of keeping something —
 * so a candidate kept on roll 1 is still here on roll 4, after its own sheet
 * has been rolled past. The prototype resets keeps on every roll and has no
 * tray; the ratified law wins and the tray is what makes the law visible.
 *
 * Carried members are tray-only: they are not re-inserted into the current
 * roll's grid, because a roll is an immutable record of eight candidates and
 * quietly adding a ninth from history would make the sheet lie about what it
 * is.
 */

export type TrayEntry = {
  candidateId: string;
  thumbUrl: string | null;
  imageUrl: string | null;
  personaLine: string | null;
  sourceRollIndex: number;
};

export function ShortlistTray({ entries }: { entries: readonly TrayEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <section className="dp-stack" style={{ gap: 12 }}>
      <SectionHead eyebrow="Kept" aside={`${entries.length} carried across rolls`} />
      <div className="dpc-tray">
        {entries.map((entry) => {
          const src = entry.thumbUrl ?? entry.imageUrl;
          return (
            <figure key={entry.candidateId} className="dpc-tray__item">
              {src ? (
                <img
                  src={src}
                  alt={entry.personaLine ?? "Kept candidate"}
                  className="dpc-tray__img"
                />
              ) : (
                // Below ~64px placeholder prose clips mid-word and reads as
                // broken text, so small media falls back to a gradient tile
                // rather than an empty frame (foundation README §6).
                <GradientTile width={52} height={64} label={`0${entry.sourceRollIndex}`} />
              )}
              <figcaption className="dp-metadata">
                {entry.personaLine ?? "Kept"} · roll {entry.sourceRollIndex}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
