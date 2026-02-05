/**
 * Card Component
 * 
 * Flexible card component with multiple variants matching the FormaStudio
 * design system. Supports outer (gray surface) and inner (white) styles,
 * as well as project card with image hover effects.
 * 
 * @example
 * <Card variant="outer">
 *   <Card variant="inner">
 *     <p>Content inside nested cards</p>
 *   </Card>
 * </Card>
 * 
 * @example
 * <ProjectCard
 *   image="/project.jpg"
 *   title="Project Name"
 *   category="Branding"
 *   href="/work/project"
 * />
 */

import { motion } from "framer-motion";
import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { scaleIn, viewportOnce, easeOut, duration } from "@/lib/motion";

/* ============================================
 * TYPES
 * ============================================ */

export interface CardProps {
  /** Card content */
  children: ReactNode;
  /** Card style variant */
  variant?: "outer" | "inner" | "flat" | "bordered";
  /** Additional CSS classes */
  className?: string;
  /** Whether to animate on scroll */
  animate?: boolean;
  /** Custom padding */
  padding?: "none" | "sm" | "md" | "lg";
  /** Whether card is clickable (adds hover effects) */
  interactive?: boolean;
  /** Click handler */
  onClick?: () => void;
}

export interface ProjectCardProps {
  /** Project image URL */
  image: string;
  /** Project title */
  title: string;
  /** Project category or type */
  category?: string;
  /** Link to project detail */
  href?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether to animate on scroll */
  animate?: boolean;
  /** Aspect ratio */
  aspectRatio?: "square" | "video" | "portrait" | "wide";
}

export interface ServiceCardProps {
  /** Service icon or number */
  icon?: ReactNode;
  /** Service title */
  title: string;
  /** Service description */
  description: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether to animate on scroll */
  animate?: boolean;
}

/* ============================================
 * CONSTANTS
 * ============================================ */

const variantStyles = {
  outer: "bg-[#EBEBEB] rounded-2xl p-2",
  inner: "bg-white rounded-xl",
  flat: "bg-white",
  bordered: "bg-white border border-[#0A0A0A]/10 rounded-xl",
} as const;

const paddingStyles = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
} as const;

const aspectRatioStyles = {
  square: "aspect-square",
  video: "aspect-video",
  portrait: "aspect-[3/4]",
  wide: "aspect-[16/9]",
} as const;

/* ============================================
 * BASE CARD COMPONENT
 * ============================================ */

export const Card = forwardRef<HTMLDivElement, CardProps>(
  function Card(
    {
      children,
      variant = "outer",
      className,
      animate = false,
      padding = "none",
      interactive = false,
      onClick,
    },
    ref
  ) {
    const Wrapper = animate ? motion.div : "div";
    const wrapperProps = animate
      ? {
          variants: scaleIn,
          initial: "hidden",
          whileInView: "visible",
          viewport: viewportOnce,
        }
      : {};

    const interactiveStyles = interactive
      ? "cursor-pointer transition-transform duration-300 hover:scale-[1.02]"
      : "";

    return (
      <Wrapper
        ref={ref}
        className={cn(
          variantStyles[variant],
          paddingStyles[padding],
          interactiveStyles,
          className
        )}
        onClick={onClick}
        {...wrapperProps}
      >
        {children}
      </Wrapper>
    );
  }
);

/* ============================================
 * PROJECT CARD COMPONENT
 * ============================================ */

/**
 * Project card with image, hover zoom effect, and overlay
 */
export function ProjectCard({
  image,
  title,
  category,
  href,
  className,
  animate = true,
  aspectRatio = "video",
}: ProjectCardProps) {
  const Wrapper = href ? "a" : "div";
  const wrapperProps = href ? { href } : {};

  const content = (
    <motion.div
      variants={animate ? scaleIn : undefined}
      initial={animate ? "hidden" : undefined}
      whileInView={animate ? "visible" : undefined}
      viewport={animate ? viewportOnce : undefined}
      className={cn(
        "group relative overflow-hidden rounded-xl bg-[#0A0A0A]/5",
        aspectRatioStyles[aspectRatio],
        className
      )}
    >
      {/* Image with zoom effect */}
      <motion.img
        src={image}
        alt={title}
        className="w-full h-full object-cover transition-transform"
        style={{
          transitionDuration: `${duration.slower * 1000}ms`,
          transitionTimingFunction: `cubic-bezier(${easeOut.join(",")})`,
        }}
        whileHover={{ scale: 1.05 }}
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      {/* Content overlay */}
      <div className="absolute inset-0 p-6 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        {category && (
          <span className="text-white/70 text-sm font-medium mb-1">
            {category}
          </span>
        )}
        <h3 className="text-white text-xl font-semibold">{title}</h3>
      </div>
    </motion.div>
  );

  return (
    <Wrapper {...wrapperProps} className="block">
      {content}
    </Wrapper>
  );
}

/* ============================================
 * SERVICE CARD COMPONENT
 * ============================================ */

/**
 * Service card with icon, title, and description
 */
export function ServiceCard({
  icon,
  title,
  description,
  className,
  animate = true,
}: ServiceCardProps) {
  const Wrapper = animate ? motion.div : "div";
  const wrapperProps = animate
    ? {
        variants: scaleIn,
        initial: "hidden",
        whileInView: "visible",
        viewport: viewportOnce,
      }
    : {};

  return (
    <Wrapper
      className={cn(
        "bg-[#EBEBEB] rounded-2xl p-2",
        className
      )}
      {...wrapperProps}
    >
      <div className="bg-white rounded-xl p-6 h-full">
        {icon && (
          <div className="mb-4 text-[#0A0A0A]">
            {icon}
          </div>
        )}
        <h3 className="text-xl font-semibold text-[#0A0A0A] mb-2">
          {title}
        </h3>
        <p className="text-[#757575] text-base leading-relaxed">
          {description}
        </p>
      </div>
    </Wrapper>
  );
}

/* ============================================
 * STAT CARD COMPONENT
 * ============================================ */

export interface StatCardProps {
  /** Large stat value */
  value: string;
  /** Stat label */
  label: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Stat card for displaying metrics
 */
export function StatCard({ value, label, className }: StatCardProps) {
  return (
    <div className={cn("text-center", className)}>
      <div className="text-4xl md:text-5xl font-bold text-[#0A0A0A] mb-2">
        {value}
      </div>
      <div className="text-sm text-[#757575] font-medium">
        {label}
      </div>
    </div>
  );
}

export default Card;
