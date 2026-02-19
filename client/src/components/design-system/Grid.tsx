/**
 * Grid Component
 * 
 * Flexible grid layout component with preset configurations for common
 * layouts used throughout Drape.
 * 
 * @example
 * <Grid cols={3} gap="md">
 *   <Card>Item 1</Card>
 *   <Card>Item 2</Card>
 *   <Card>Item 3</Card>
 * </Grid>
 * 
 * @example
 * <Grid preset="projects">
 *   {projects.map(p => <ProjectCard key={p.id} {...p} />)}
 * </Grid>
 */

import { motion } from "framer-motion";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { staggerContainer, staggerItem, viewportOnce } from "@/lib/motion";

/* ============================================
 * TYPES
 * ============================================ */

export interface GridProps {
  /** Grid content */
  children: ReactNode;
  /** Number of columns (responsive) */
  cols?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Gap between items */
  gap?: "none" | "xs" | "sm" | "md" | "lg" | "xl";
  /** Use a preset configuration */
  preset?: "projects" | "services" | "team" | "features" | "stats";
  /** Additional CSS classes */
  className?: string;
  /** Whether to animate children on scroll */
  animate?: boolean;
}

export interface GridItemProps {
  /** Item content */
  children: ReactNode;
  /** Column span */
  span?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Additional CSS classes */
  className?: string;
}

/* ============================================
 * CONSTANTS
 * ============================================ */

const colStyles = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-1 md:grid-cols-2 lg:grid-cols-5",
  6: "grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
} as const;

const gapStyles = {
  none: "gap-0",
  xs: "gap-1",
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
  xl: "gap-8",
} as const;

const presetStyles = {
  projects: "grid-cols-1 md:grid-cols-2 gap-1",
  services: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4",
  team: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4",
  features: "grid-cols-1 md:grid-cols-2 gap-6",
  stats: "grid-cols-2 md:grid-cols-4 gap-8",
} as const;

const spanStyles = {
  1: "col-span-1",
  2: "col-span-1 md:col-span-2",
  3: "col-span-1 md:col-span-2 lg:col-span-3",
  4: "col-span-1 md:col-span-2 lg:col-span-4",
  5: "col-span-1 md:col-span-2 lg:col-span-5",
  6: "col-span-full",
} as const;

/* ============================================
 * GRID COMPONENT
 * ============================================ */

export function Grid({
  children,
  cols,
  gap = "md",
  preset,
  className,
  animate = false,
}: GridProps) {
  const gridClasses = preset
    ? presetStyles[preset]
    : cn(cols && colStyles[cols], gapStyles[gap]);

  if (animate) {
    return (
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        className={cn("grid", gridClasses, className)}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div className={cn("grid", gridClasses, className)}>
      {children}
    </div>
  );
}

/* ============================================
 * GRID ITEM COMPONENT
 * ============================================ */

/**
 * Grid item with optional column span
 */
export function GridItem({
  children,
  span,
  className,
}: GridItemProps) {
  return (
    <div className={cn(span && spanStyles[span], className)}>
      {children}
    </div>
  );
}

/* ============================================
 * ANIMATED GRID ITEM COMPONENT
 * ============================================ */

/**
 * Grid item with stagger animation
 * Use inside an animated Grid
 */
export function AnimatedGridItem({
  children,
  span,
  className,
}: GridItemProps) {
  return (
    <motion.div
      variants={staggerItem}
      className={cn(span && spanStyles[span], className)}
    >
      {children}
    </motion.div>
  );
}

/* ============================================
 * TWO COLUMN LAYOUT
 * ============================================ */

export interface TwoColumnProps {
  /** Left column content */
  left: ReactNode;
  /** Right column content */
  right: ReactNode;
  /** Gap between columns */
  gap?: "md" | "lg" | "xl";
  /** Reverse order on mobile */
  reverseOnMobile?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Left column width ratio */
  leftWidth?: "1/3" | "1/2" | "2/3" | "auto";
}

const twoColGapStyles = {
  md: "gap-8",
  lg: "gap-12",
  xl: "gap-16",
} as const;

const leftWidthStyles = {
  "1/3": "lg:w-1/3",
  "1/2": "lg:w-1/2",
  "2/3": "lg:w-2/3",
  auto: "lg:w-auto",
} as const;

/**
 * Two column layout for content + sidebar patterns
 */
export function TwoColumn({
  left,
  right,
  gap = "lg",
  reverseOnMobile = false,
  className,
  leftWidth = "1/2",
}: TwoColumnProps) {
  return (
    <div
      className={cn(
        "flex flex-col lg:flex-row",
        twoColGapStyles[gap],
        reverseOnMobile && "flex-col-reverse lg:flex-row",
        className
      )}
    >
      <div className={cn("flex-shrink-0", leftWidthStyles[leftWidth])}>
        {left}
      </div>
      <div className="flex-1">
        {right}
      </div>
    </div>
  );
}

export default Grid;
