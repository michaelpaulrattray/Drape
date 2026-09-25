/**
 * THE SECTION MENU (#1201). His word, 2026-09-25, at the readings block that
 * used to sit here: *"i barely read the overview circled in red it would be
 * better if it would quickly scroll me to the section maybe? like a menu or
 * whatever"*.
 *
 * One quiet line, sticky at the top of the reading pane: every section on
 * the page in his reading order, each with the one number that says whether
 * it wants him — cards needing an answer, frames for his eye, things landed
 * since he last looked, what is next, open faults. A zero draws no number:
 * the name alone says "nothing here". Tapping jumps; nothing else happens.
 * It is a menu, not a summary, which is the difference between this and the
 * block it replaces.
 */
import { cn } from "@/lib/utils";

export type CrewNavItem = {
  readonly id: string;
  readonly label: string;
  readonly count?: number;
  /** A count that means "new for you" rather than "open" — drawn in ink. */
  readonly fresh?: boolean;
};

export function CrewNav({ items }: { items: readonly CrewNavItem[] }) {
  return (
    <nav className="dp-crew__nav" aria-label="Sections" data-testid="crew-nav">
      {items.map((item) => (
        <a key={item.id} className="dp-crew__navlink" href={`#${item.id}`}>
          {item.label}
          {item.count !== undefined && item.count > 0 && (
            <span className={cn("dp-crew__navcount", item.fresh && "dp-crew__navcount--fresh")}>{item.count}</span>
          )}
        </a>
      ))}
    </nav>
  );
}
