/**
 * Typography Components
 * 
 * Standardized typography components for headings, tags, and text elements.
 * Uses design tokens for consistent sizing and styling.
 * 
 * @example
 * <SectionHeading>Our Services</SectionHeading>
 * 
 * @example
 * <Tag>AI Photography</Tag>
 * 
 * @example
 * <BodyText>Description text here...</BodyText>
 */

import { motion } from "framer-motion";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { fadeInUp, viewportOnce, easeInOut } from "@/lib/motion";

/* ============================================
 * TYPES
 * ============================================ */

export interface HeadingProps {
  /** Heading content */
  children: ReactNode;
  /** Heading level */
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  /** Visual size (independent of semantic level) */
  size?: "hero" | "section" | "subsection" | "card" | "small";
  /** Additional CSS classes */
  className?: string;
  /** Whether to animate on scroll */
  animate?: boolean;
  /** Text color variant */
  variant?: "default" | "light" | "muted";
  /** HTML id attribute */
  id?: string;
}

export interface TagProps {
  /** Tag content */
  children: ReactNode;
  /** Tag style variant */
  variant?: "default" | "outline" | "filled" | "dark";
  /** Tag size */
  size?: "sm" | "md" | "lg";
  /** Additional CSS classes */
  className?: string;
  /** Click handler (makes tag interactive) */
  onClick?: () => void;
}

export interface BodyTextProps {
  /** Text content */
  children: ReactNode;
  /** Text size */
  size?: "sm" | "base" | "lg";
  /** Text color variant */
  variant?: "default" | "muted" | "light";
  /** Additional CSS classes */
  className?: string;
  /** Whether to animate on scroll */
  animate?: boolean;
}

/* ============================================
 * CONSTANTS
 * ============================================ */

const headingSizeStyles = {
  hero: "text-[clamp(4rem,15vw,12rem)] font-medium tracking-tighter leading-[0.85]",
  section: "text-[54px] font-medium tracking-tight leading-[1.15]",
  subsection: "text-3xl md:text-4xl font-semibold tracking-tight leading-tight",
  card: "text-xl md:text-2xl font-semibold leading-snug",
  small: "text-lg font-semibold leading-snug",
} as const;

const headingVariantStyles = {
  default: "text-[#0A0A0A]",
  light: "text-white",
  muted: "text-[#757575]",
} as const;

const tagVariantStyles = {
  default: "bg-[#EBEBEB] text-[#0A0A0A]",
  outline: "bg-transparent border border-[#0A0A0A]/20 text-[#0A0A0A]",
  filled: "bg-[#0A0A0A] text-white",
  dark: "bg-[#0A0A0A]/10 text-[#0A0A0A]",
} as const;

const tagSizeStyles = {
  sm: "px-3 py-1 text-xs",
  md: "px-4 py-1.5 text-sm",
  lg: "px-5 py-2 text-base",
} as const;

const bodyVariantStyles = {
  default: "text-[#4D4D4D]",
  muted: "text-[#757575]",
  light: "text-white/70",
} as const;

const bodySizeStyles = {
  sm: "text-sm leading-relaxed",
  base: "text-base leading-[22px]",
  lg: "text-lg leading-relaxed",
} as const;

/* ============================================
 * SECTION HEADING COMPONENT
 * ============================================ */

/**
 * Section heading with consistent styling
 */
export function SectionHeading({
  children,
  as: Component = "h2",
  size = "section",
  className,
  animate = true,
  variant = "default",
  id,
}: HeadingProps) {
  if (animate) {
    const MotionComponent = motion[Component];
    return (
      <MotionComponent
        id={id}
        variants={fadeInUp}
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        className={cn(
          headingSizeStyles[size],
          headingVariantStyles[variant],
          "font-sans",
          className
        )}
      >
        {children}
      </MotionComponent>
    );
  }

  return (
    <Component
      id={id}
      className={cn(
        headingSizeStyles[size],
        headingVariantStyles[variant],
        "font-sans",
        className
      )}
    >
      {children}
    </Component>
  );
}

/* ============================================
 * HERO HEADING COMPONENT
 * ============================================ */

/**
 * Large hero heading for page titles
 */
export function HeroHeading({ 
  children, 
  className,
  animate = true 
}: { 
  children: ReactNode; 
  className?: string;
  animate?: boolean;
}) {
  const Wrapper = animate ? motion.h1 : "h1";
  const wrapperProps = animate
    ? {
        initial: { opacity: 0, y: 40 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.8, ease: easeInOut },
      }
    : {};

  return (
    <Wrapper
      className={cn(
        headingSizeStyles.hero,
        headingVariantStyles.default,
        "font-sans",
        className
      )}
      {...wrapperProps}
    >
      {children}
    </Wrapper>
  );
}

/* ============================================
 * TAG COMPONENT
 * ============================================ */

/**
 * Tag/badge component for categories and labels
 */
export function Tag({
  children,
  variant = "default",
  size = "md",
  className,
  onClick,
}: TagProps) {
  const isInteractive = !!onClick;
  const Component = isInteractive ? "button" : "span";

  return (
    <Component
      className={cn(
        "inline-flex items-center justify-center rounded-full font-medium transition-colors duration-300",
        tagVariantStyles[variant],
        tagSizeStyles[size],
        isInteractive && "cursor-pointer hover:opacity-80",
        className
      )}
      onClick={onClick}
    >
      {children}
    </Component>
  );
}

/* ============================================
 * BODY TEXT COMPONENT
 * ============================================ */

/**
 * Body text with consistent styling
 */
export function BodyText({
  children,
  size = "base",
  variant = "default",
  className,
  animate = false,
}: BodyTextProps) {
  const Wrapper = animate ? motion.p : "p";
  const wrapperProps = animate
    ? {
        variants: fadeInUp,
        initial: "hidden",
        whileInView: "visible",
        viewport: viewportOnce,
      }
    : {};

  return (
    <Wrapper
      className={cn(
        bodySizeStyles[size],
        bodyVariantStyles[variant],
        "font-medium",
        className
      )}
      {...wrapperProps}
    >
      {children}
    </Wrapper>
  );
}

/* ============================================
 * LABEL COMPONENT
 * ============================================ */

export interface LabelProps {
  /** Label content */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Text color variant */
  variant?: "default" | "light";
}

/**
 * Small label text (for form labels, captions)
 */
export function Label({ 
  children, 
  className,
  variant = "default" 
}: LabelProps) {
  const variantStyles = {
    default: "text-[#757575]",
    light: "text-white/60",
  };

  return (
    <span
      className={cn(
        "text-sm font-medium tracking-wide uppercase",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export default SectionHeading;
