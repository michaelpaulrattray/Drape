/**
 * A section that can be its own card OR one block of a shared card (#1201).
 *
 * His word, 2026-09-25: *"shouldnt next up card and in flight card and
 * working now card be together or on the same card for an easy visual
 * overlook? at the moment i have to scroll to different parts of the page to
 * get a quick picture"*. So WORKING NOW, IN FLIGHT and NEXT UP keep their
 * bodies and lose their walls: passed `embedded`, each draws as a ruled block
 * under one eyebrow instead of a card of its own. Nothing about what a block
 * says changes with how it is framed — the same component, two frames.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TableHead } from "@/foundation";

export function SectionShell({
  embedded, first, className, testId, children,
}: {
  embedded?: boolean;
  /** The first block of a shared card sits under the eyebrow's own rule and draws no second one. */
  first?: boolean;
  className?: string;
  testId?: string;
  children: ReactNode;
}) {
  if (embedded) {
    return (
      <div className={cn(first ? "dp-crew__gap" : "dp-crew__rule", className)} data-testid={testId}>
        {children}
      </div>
    );
  }
  return (
    <section className={cn("dp-crew__card", className)} data-testid={testId}>
      {children}
    </section>
  );
}

export function SectionHead({
  embedded, eyebrow, children,
}: {
  embedded?: boolean;
  eyebrow: string;
  children?: ReactNode;
}) {
  if (embedded) {
    return (
      <div className="dp-crew__ladderhead">
        <h3 className="dp-crew__subhead">{eyebrow}</h3>
        {children ? <span className="dp-crew__headmeta">{children}</span> : null}
      </div>
    );
  }
  return <TableHead eyebrow={eyebrow}>{children}</TableHead>;
}
