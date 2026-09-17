/**
 * Button Component
 * 
 * Primary button component with the signature Drape conveyor belt
 * hover animation. Supports multiple variants, sizes, and icon options.
 * 
 * @example
 * <Button>Start a project</Button>
 * 
 * @example
 * <Button variant="outline" showPlus>
 *   Learn more
 * </Button>
 * 
 * @example
 * <Button variant="ghost" href="/contact">
 *   Contact us
 * </Button>
 */

import { forwardRef, type ReactNode, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

/* ============================================
 * TYPES
 * ============================================ */

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button content */
  children: ReactNode;
  /** Button style variant */
  variant?: "primary" | "secondary" | "outline" | "ghost" | "dark" | "secondary-invert";
  /** Button size */
  size?: "sm" | "md" | "lg";
  /** Optional icon (shown on right with conveyor animation) */
  icon?: ReactNode;
  /** Show plus icon with conveyor animation */
  showPlus?: boolean;
  /** Render as link */
  href?: string;
  /** Additional CSS classes */
  className?: string;
  /** Full width button */
  fullWidth?: boolean;
  /** Loading state */
  loading?: boolean;
}


/* ============================================
 * CONSTANTS
 * ============================================ */

const variantStyles = {
  primary: "bg-[#0A0A0A] text-white hover:bg-[#0A0A0A]/90",
  secondary: "bg-[#EBEBEB] text-[#0A0A0A] hover:bg-[#D4D4D4]",
  "secondary-invert": "bg-[#EBEBEB] text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white",
  outline: "bg-transparent border border-[#0A0A0A]/20 text-[#0A0A0A] hover:border-[#0A0A0A]/40",
  ghost: "bg-transparent text-[#0A0A0A] hover:bg-[#0A0A0A]/5",
  dark: "bg-[#0A0A0A] text-white hover:bg-[#121212]",
} as const;

const sizeStyles = {
  sm: "px-4 py-2 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-8 py-4 text-base",
} as const;


/* ============================================
 * CONVEYOR TEXT COMPONENT
 * ============================================ */

interface ConveyorTextProps {
  children: ReactNode;
  className?: string;
  height?: string;
}

/**
 * Text with conveyor belt hover animation
 * Requires parent to have `group` class
 */
function ConveyorText({ children, className, height = "h-5" }: ConveyorTextProps) {
  return (
    <span className={cn("overflow-hidden block", height, className)}>
      <span className="block transition-transform duration-500 ease-out group-hover:-translate-y-full">
        {children}
      </span>
      <span className="block transition-transform duration-500 ease-out group-hover:-translate-y-full">
        {children}
      </span>
    </span>
  );
}

/* ============================================
 * CONVEYOR TEXT WITH COLOR CHANGE
 * ============================================ */

/* ============================================
 * CONVEYOR ICON COMPONENT
 * ============================================ */

interface ConveyorIconProps {
  icon?: ReactNode;
  className?: string;
}

/**
 * Icon with conveyor belt hover animation
 * Requires parent to have `group` class
 */
function ConveyorIcon({ icon, className }: ConveyorIconProps) {
  const IconElement = icon || <Plus className="w-4 h-4" />;
  
  return (
    <span className={cn("overflow-hidden h-4 w-4 relative", className)}>
      <Plus className="absolute inset-0 w-4 h-4 transition-transform duration-500 ease-out group-hover:translate-y-4" />
      <Plus className="absolute inset-0 w-4 h-4 transition-transform duration-500 ease-out -translate-y-4 group-hover:translate-y-0" />
    </span>
  );
}

/* ============================================
 * BUTTON COMPONENT
 * ============================================ */

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      children,
      variant = "primary",
      size = "md",
      icon,
      showPlus = false,
      href,
      className,
      fullWidth = false,
      loading = false,
      disabled,
      ...props
    },
    ref
  ) {
    const baseStyles = cn(
      "group inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-300 overflow-hidden",
      variantStyles[variant],
      sizeStyles[size],
      fullWidth && "w-full",
      (disabled || loading) && "opacity-50 cursor-not-allowed",
      className
    );

    const content = (
      <>
        <ConveyorText>{children}</ConveyorText>
        {(icon || showPlus) && <ConveyorIcon icon={icon} />}
        {loading && (
          <span className="animate-spin ml-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </span>
        )}
      </>
    );

    if (href) {
      const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        const anchor = href.startsWith('/#') ? href.slice(1) : href;
        if (anchor.startsWith('#')) {
          e.preventDefault();
          const target = document.querySelector(anchor);
          if (target) {
            const headerOffset = 72;
            const elementPosition = target.getBoundingClientRect().top + window.scrollY;
            window.scrollTo({ top: elementPosition - headerOffset, behavior: 'smooth' });
          }
        }
      };

      return (
        <a href={href} onClick={handleAnchorClick} className={baseStyles}>
          {content}
        </a>
      );
    }

    return (
      <button
        ref={ref}
        className={baseStyles}
        disabled={disabled || loading}
        {...props}
      >
        {content}
      </button>
    );
  }
);
