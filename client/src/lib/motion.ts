/**
 * Drape™ Motion Presets
 * 
 * This file contains all Framer Motion variants, easing curves, and animation
 * presets extracted from Home.tsx. Use these presets to ensure consistent
 * animations across all pages and components.
 * 
 * Usage:
 *   import { fadeInUp, staggerContainer, easeOut } from "@/lib/motion";
 *   <motion.div variants={fadeInUp} initial="hidden" whileInView="visible">
 * 
 * @see STYLE_GUIDE.md for usage guidelines
 * @see DESIGN_SYSTEM_PROPOSAL.md for architecture details
 */

import type { Variants, Transition } from "framer-motion";

/* ============================================
 * EASING CURVES
 * ============================================ */

/**
 * Standard ease-out curve for most animations.
 * Use for: fade-ins, reveals, hover states
 */
export const easeOut: [number, number, number, number] = [0, 0, 0.2, 1];

/**
 * Smooth ease-in-out curve for more refined animations.
 * Use for: hero animations, important reveals
 */
export const easeInOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

/**
 * Spring-like curve for playful animations.
 * Use for: buttons, interactive elements
 */
export const easeSpring: [number, number, number, number] = [0.34, 1.56, 0.64, 1];

/* ============================================
 * DURATION CONSTANTS
 * ============================================ */

export const duration = {
  fast: 0.2,
  normal: 0.3,
  slow: 0.5,
  slower: 0.7,
  slowest: 0.8,
} as const;

/* ============================================
 * ANIMATION VARIANTS
 * ============================================ */

/**
 * Fade in from bottom - standard section entrance
 * Use for: section headers, content blocks
 */
export const fadeInUp: Variants = {
  hidden: { 
    opacity: 0, 
    y: 30 
  },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { 
      duration: duration.slow + 0.1, 
      ease: easeInOut 
    }
  }
};

/**
 * Simple fade in - subtle reveals
 * Use for: images, secondary content
 */
export const fadeIn: Variants = {
  hidden: { 
    opacity: 0 
  },
  visible: { 
    opacity: 1,
    transition: { 
      duration: duration.slow + 0.1, 
      ease: easeOut 
    }
  }
};

/**
 * Scale in - card containers, modals
 * Use for: cards, dialogs, overlays
 */
export const scaleIn: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.95 
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { 
      duration: duration.slow + 0.1, 
      ease: easeOut 
    }
  }
};

/**
 * Slide in from left
 * Use for: sidebars, navigation panels
 */
export const slideInLeft: Variants = {
  hidden: { 
    opacity: 0, 
    x: -30 
  },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { 
      duration: duration.slow, 
      ease: easeOut 
    }
  }
};

/**
 * Slide in from right
 * Use for: sidebars, panels
 */
export const slideInRight: Variants = {
  hidden: { 
    opacity: 0, 
    x: 30 
  },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { 
      duration: duration.slow, 
      ease: easeOut 
    }
  }
};

/* ============================================
 * STAGGER VARIANTS
 * ============================================ */

/**
 * Container for staggered children animations
 * Use with: staggerItem for grid items, lists
 */
export const staggerContainer: Variants = {
  hidden: { 
    opacity: 0 
  },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
};

/**
 * Fast stagger container for quick reveals
 * Use for: navigation items, quick lists
 */
export const staggerContainerFast: Variants = {
  hidden: { 
    opacity: 0 
  },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05
    }
  }
};

/**
 * Slow stagger container for dramatic reveals
 * Use for: hero elements, important content
 */
export const staggerContainerSlow: Variants = {
  hidden: { 
    opacity: 0 
  },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2
    }
  }
};

/**
 * Standard stagger item - use with staggerContainer
 */
export const staggerItem: Variants = {
  hidden: { 
    opacity: 0, 
    y: 20 
  },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { 
      duration: duration.slow, 
      ease: easeOut 
    }
  }
};

/**
 * Scale stagger item - for cards in grids
 */
export const staggerItemScale: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.95 
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { 
      duration: duration.slow, 
      ease: easeOut 
    }
  }
};

/* ============================================
 * VIEWPORT SETTINGS
 * ============================================ */

/**
 * Standard viewport trigger - fires once when element enters view
 * Use for: most scroll-triggered animations
 */
export const viewportOnce = { 
  once: true, 
  margin: "-100px" 
};

/**
 * Close viewport trigger - fires closer to viewport edge
 * Use for: elements that should animate later
 */
export const viewportOnceClose = { 
  once: true, 
  margin: "-50px" 
};

/**
 * Repeating viewport trigger - fires every time element enters view
 * Use for: elements that should re-animate on scroll
 */
export const viewportRepeat = { 
  once: false, 
  margin: "-100px" 
};

/* ============================================
 * TRANSITION PRESETS
 * ============================================ */

/**
 * Standard transition for most animations
 */
export const transitionStandard: Transition = {
  duration: duration.slow + 0.1,
  ease: easeOut
};

/**
 * Fast transition for hover states
 */
export const transitionFast: Transition = {
  duration: duration.normal,
  ease: easeOut
};

/**
 * Slow transition for hero elements
 */
export const transitionSlow: Transition = {
  duration: duration.slower,
  ease: easeInOut
};

/**
 * Spring transition for interactive elements
 */
export const transitionSpring: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 30
};

/* ============================================
 * HOVER ANIMATIONS
 * ============================================ */

/**
 * Standard hover scale - for buttons, cards
 */
export const hoverScale = {
  scale: 1.02,
  transition: transitionFast
};

/**
 * Subtle hover scale - for links, small elements
 */
export const hoverScaleSubtle = {
  scale: 1.01,
  transition: transitionFast
};

/**
 * Hover lift - for cards with shadow
 */
export const hoverLift = {
  y: -4,
  transition: transitionFast
};

/* ============================================
 * IMAGE ANIMATIONS
 * ============================================ */

/**
 * Image zoom on scroll - for hero images
 * Use with useTransform and useScroll
 */
export const imageZoomConfig = {
  initialScale: 1.15,
  finalScale: 1,
  duration: duration.slower
};

/* ============================================
 * CONVEYOR ANIMATION HELPERS
 * ============================================ */

/**
 * Conveyor belt animation duration (CSS value)
 */
export const conveyorDuration = "500ms";

/**
 * Conveyor belt easing (CSS value)
 */
export const conveyorEasing = "cubic-bezier(0, 0, 0.2, 1)";

/**
 * Full conveyor transition string for use in className
 */
export const conveyorTransition = `transform ${conveyorDuration} ${conveyorEasing}`;

/* ============================================
 * UTILITY FUNCTIONS
 * ============================================ */

/**
 * Create a delayed variant of any animation
 * @param variant - The base variant to delay
 * @param delay - Delay in seconds
 */
export function withDelay(variant: Variants, delay: number): Variants {
  return {
    ...variant,
    visible: {
      ...(variant.visible as object),
      transition: {
        ...((variant.visible as { transition?: Transition })?.transition || {}),
        delay
      }
    }
  };
}

/**
 * Create a custom duration variant
 * @param variant - The base variant
 * @param newDuration - New duration in seconds
 */
export function withDuration(variant: Variants, newDuration: number): Variants {
  return {
    ...variant,
    visible: {
      ...(variant.visible as object),
      transition: {
        ...((variant.visible as { transition?: Transition })?.transition || {}),
        duration: newDuration
      }
    }
  };
}
