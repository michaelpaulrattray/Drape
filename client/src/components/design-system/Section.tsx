/**
 * Section Component
 * 
 * A standardized section wrapper with optional label, consistent spacing,
 * and scroll-triggered animations. Uses design tokens for all values.
 * 
 * @example
 * <Section label="Selected Work" id="work" background="white">
 *   <SectionHeading>Our Projects</SectionHeading>
 *   <p>Content here...</p>
 * </Section>
 */

import { motion } from "framer-motion";
import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { fadeInUp, viewportOnce } from "@/lib/motion";

/* ============================================
 * TYPES
 * ============================================ */

export interface SectionProps {
  /** Section content */
  children: ReactNode;
  /** Optional section label (e.g., "01 — About") */
  label?: string;
  /** HTML id for anchor links */
  id?: string;
  /** Background color variant */
  background?: "white" | "surface" | "dark" | "transparent";
  /** Additional CSS classes */
  className?: string;
  /** Whether to animate on scroll */
  animate?: boolean;
  /** Custom padding override */
  padding?: "none" | "sm" | "md" | "lg" | "xl";
  /** Whether section is full-width (no container) */
  fullWidth?: boolean;
}

export interface SectionLabelProps {
  /** Label text */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Text color variant */
  variant?: "default" | "light";
}

/* ============================================
 * CONSTANTS
 * ============================================ */

const backgroundStyles = {
  white: "bg-white",
  surface: "bg-[#EBEBEB]",
  dark: "bg-[#0A0A0A]",
  transparent: "bg-transparent",
} as const;

const paddingStyles = {
  none: "",
  sm: "py-12",
  md: "py-16",
  lg: "py-24",
  xl: "py-32",
} as const;

/* ============================================
 * SECTION LABEL COMPONENT
 * ============================================ */

/**
 * Section label displayed above section content
 * Follows the pattern: "01 — Label Text"
 */
export function SectionLabel({ 
  children, 
  className,
  variant = "default" 
}: SectionLabelProps) {
  const textColor = variant === "light" 
    ? "text-white/60" 
    : "text-[#757575]";
  
  return (
    <motion.span
      variants={fadeInUp}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      className={cn(
        "block text-sm font-medium tracking-wide uppercase mb-[22px]",
        textColor,
        className
      )}
    >
      {children}
    </motion.span>
  );
}

/* ============================================
 * SECTION COMPONENT
 * ============================================ */

export const Section = forwardRef<HTMLElement, SectionProps>(
  function Section(
    {
      children,
      label,
      id,
      background = "white",
      className,
      animate = true,
      padding = "lg",
      fullWidth = false,
    },
    ref
  ) {
    const Wrapper = animate ? motion.section : "section";
    const wrapperProps = animate
      ? {
          initial: { opacity: 0 },
          whileInView: { opacity: 1 },
          viewport: viewportOnce,
          transition: { duration: 0.6 },
        }
      : {};

    return (
      <Wrapper
        ref={ref}
        id={id}
        className={cn(
          backgroundStyles[background],
          paddingStyles[padding],
          className
        )}
        {...wrapperProps}
      >
        {fullWidth ? (
          <>
            {label && (
              <div className="max-w-[1520px] mx-auto px-6 lg:px-12">
                <SectionLabel variant={background === "dark" ? "light" : "default"}>
                  {label}
                </SectionLabel>
              </div>
            )}
            {children}
          </>
        ) : (
          <div className="max-w-[1520px] mx-auto px-6 lg:px-12">
            {label && (
              <SectionLabel variant={background === "dark" ? "light" : "default"}>
                {label}
              </SectionLabel>
            )}
            {children}
          </div>
        )}
      </Wrapper>
    );
  }
);

/* ============================================
 * CONTAINER COMPONENT
 * ============================================ */

export interface ContainerProps {
  /** Container content */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Max width variant */
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

const containerSizes = {
  sm: "max-w-3xl",
  md: "max-w-5xl",
  lg: "max-w-6xl",
  xl: "max-w-[1520px]",
  full: "max-w-full",
} as const;

/**
 * Container component for consistent max-width and padding
 */
export function Container({ 
  children, 
  className,
  size = "xl" 
}: ContainerProps) {
  return (
    <div
      className={cn(
        containerSizes[size],
        "mx-auto px-6 lg:px-12",
        className
      )}
    >
      {children}
    </div>
  );
}

export default Section;
