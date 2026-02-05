/**
 * Button Component
 * 
 * Primary button component with the signature FormaStudio conveyor belt
 * hover animation. Supports multiple variants, sizes, and icon options.
 * 
 * @example
 * <Button>Start a project</Button>
 * 
 * @example
 * <Button variant="outline" icon={<Plus />}>
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

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button content */
  children: ReactNode;
  /** Button style variant */
  variant?: "primary" | "secondary" | "outline" | "ghost" | "dark";
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

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button icon */
  icon: ReactNode;
  /** Accessible label */
  label: string;
  /** Button style variant */
  variant?: "primary" | "secondary" | "outline" | "ghost";
  /** Button size */
  size?: "sm" | "md" | "lg";
  /** Additional CSS classes */
  className?: string;
}

/* ============================================
 * CONSTANTS
 * ============================================ */

const variantStyles = {
  primary: "bg-[#0A0A0A] text-white hover:bg-[#0A0A0A]/90",
  secondary: "bg-[#EBEBEB] text-[#0A0A0A] hover:bg-[#D4D4D4]",
  outline: "bg-transparent border border-[#0A0A0A]/20 text-[#0A0A0A] hover:border-[#0A0A0A]/40",
  ghost: "bg-transparent text-[#0A0A0A] hover:bg-[#0A0A0A]/5",
  dark: "bg-[#0A0A0A] text-white hover:bg-[#121212]",
} as const;

const sizeStyles = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3 text-base",
  lg: "px-8 py-4 text-lg",
} as const;

const iconSizeStyles = {
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-12 h-12",
} as const;

/* ============================================
 * CONVEYOR TEXT COMPONENT
 * ============================================ */

interface ConveyorTextProps {
  children: ReactNode;
  className?: string;
}

/**
 * Text with conveyor belt hover animation
 * Requires parent to have `group` class
 */
export function ConveyorText({ children, className }: ConveyorTextProps) {
  return (
    <span className={cn("overflow-hidden h-5 block", className)}>
      <span className="flex flex-col transition-transform duration-500 ease-[cubic-bezier(0,0,0.2,1)] group-hover:-translate-y-1/2">
        <span className="h-5 flex items-center">{children}</span>
        <span className="h-5 flex items-center">{children}</span>
      </span>
    </span>
  );
}

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
export function ConveyorIcon({ icon, className }: ConveyorIconProps) {
  const IconElement = icon || <Plus className="w-4 h-4" />;
  
  return (
    <span className={cn("overflow-hidden h-4 w-4 relative", className)}>
      <span className="flex flex-col transition-transform duration-500 ease-[cubic-bezier(0,0,0.2,1)] group-hover:-translate-y-1/2">
        <span className="h-4 w-4 flex items-center justify-center">{IconElement}</span>
        <span className="h-4 w-4 flex items-center justify-center">{IconElement}</span>
      </span>
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
      "group inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors duration-300",
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
      return (
        <a href={href} className={baseStyles}>
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

/* ============================================
 * ICON BUTTON COMPONENT
 * ============================================ */

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      icon,
      label,
      variant = "secondary",
      size = "md",
      className,
      ...props
    },
    ref
  ) {
    const variantIconStyles = {
      primary: "bg-[#0A0A0A] text-white hover:bg-[#0A0A0A]/90",
      secondary: "bg-[#EBEBEB] text-[#0A0A0A] hover:bg-[#D4D4D4]",
      outline: "bg-transparent border border-[#0A0A0A]/20 text-[#0A0A0A] hover:border-[#0A0A0A]/40",
      ghost: "bg-transparent text-[#0A0A0A] hover:bg-[#0A0A0A]/5",
    } as const;

    return (
      <button
        ref={ref}
        className={cn(
          "group inline-flex items-center justify-center rounded-full transition-colors duration-300",
          variantIconStyles[variant],
          iconSizeStyles[size],
          className
        )}
        aria-label={label}
        {...props}
      >
        <ConveyorIcon icon={icon} />
      </button>
    );
  }
);

/* ============================================
 * LINK BUTTON COMPONENT
 * ============================================ */

export interface LinkButtonProps {
  /** Link text */
  children: ReactNode;
  /** Link URL */
  href: string;
  /** Additional CSS classes */
  className?: string;
  /** Show arrow icon */
  showArrow?: boolean;
}

/**
 * Text link with conveyor animation
 */
export function LinkButton({ 
  children, 
  href, 
  className,
  showArrow = false 
}: LinkButtonProps) {
  return (
    <a
      href={href}
      className={cn(
        "group inline-flex items-center gap-2 text-[#0A0A0A] font-medium hover:text-[#0A0A0A]/70 transition-colors duration-300",
        className
      )}
    >
      <ConveyorText>{children}</ConveyorText>
      {showArrow && (
        <span className="transition-transform duration-300 group-hover:translate-x-1">
          →
        </span>
      )}
    </a>
  );
}

export default Button;
