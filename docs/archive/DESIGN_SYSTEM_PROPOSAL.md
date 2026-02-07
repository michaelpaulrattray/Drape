# FormaStudio™ Design System Architecture Proposal

**Author:** Manus AI  
**Date:** February 2026  
**Status:** Proposal for Review

---

## Executive Summary

This proposal outlines a comprehensive design system architecture for FormaStudio™ that codifies the visual patterns extracted from `Home.tsx` into reusable tokens, components, and utilities. The goal is to ensure consistency across all pages while reducing code duplication and making future development faster and more maintainable.

---

## 1. Proposed File Structure

```
client/
├── src/
│   ├── styles/
│   │   ├── tokens.css          # CSS custom properties (design tokens)
│   │   └── animations.css      # Keyframe animations
│   │
│   ├── lib/
│   │   ├── cn.ts               # Class name utility (already exists via shadcn)
│   │   └── motion.ts           # Framer Motion variants & presets
│   │
│   ├── components/
│   │   └── ui/
│   │       ├── Section.tsx         # Section wrapper with consistent padding
│   │       ├── Container.tsx       # Max-width container
│   │       ├── SectionLabel.tsx    # "/ Label (00)" component
│   │       ├── Heading.tsx         # Typography component with variants
│   │       ├── Text.tsx            # Body text component
│   │       ├── Card.tsx            # Card variants (outer/inner/project/dark)
│   │       ├── Button.tsx          # Button with conveyor animation
│   │       ├── Tag.tsx             # Tag/badge component
│   │       ├── Grid.tsx            # Grid layout presets
│   │       └── ConveyorText.tsx    # Reusable conveyor hover effect
│   │
│   └── index.css               # Import tokens + animations + base styles
```

---

## 2. Design Tokens (CSS Custom Properties)

The following values should be extracted into `client/src/styles/tokens.css` as CSS custom properties. This enables easy theming and ensures consistency across all components.

### 2.1 Color Tokens

```css
/* client/src/styles/tokens.css */

:root {
  /* Primary Colors */
  --color-black: #0A0A0A;
  --color-dark: #121212;
  --color-white: #FFFFFF;
  
  /* Gray Scale */
  --color-gray-100: #EBEBEB;  /* Surface, buttons, cards */
  --color-gray-200: #D4D4D4;  /* Borders */
  --color-gray-400: #757575;  /* Secondary text */
  --color-gray-500: #4D4D4D;  /* Body text */
  
  /* Semantic Colors */
  --color-surface: var(--color-gray-100);
  --color-text-primary: var(--color-black);
  --color-text-secondary: var(--color-gray-400);
  --color-text-muted: var(--color-gray-500);
  --color-border: rgba(10, 10, 10, 0.1);
  --color-border-medium: rgba(10, 10, 10, 0.2);
  
  /* Dark Mode Variants */
  --color-text-on-dark: var(--color-white);
  --color-text-on-dark-muted: rgba(255, 255, 255, 0.6);
  --color-border-on-dark: rgba(255, 255, 255, 0.2);
}
```

### 2.2 Spacing Tokens

```css
:root {
  /* Spacing Scale (based on 4px grid) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-24: 96px;
  
  /* Section Spacing */
  --section-padding-y: var(--space-24);  /* py-24 = 96px */
  --section-label-gap: 22px;
  --content-gap: var(--space-16);        /* 64px between major blocks */
  
  /* Card Spacing */
  --card-padding-outer: var(--space-2);  /* p-2 = 8px */
  --card-padding-inner: var(--space-4);  /* p-4 = 16px */
  --card-padding-large: var(--space-6);  /* p-6 = 24px */
  --card-gap: var(--space-1);            /* gap-1 = 4px */
}
```

### 2.3 Typography Tokens

```css
:root {
  /* Font Family */
  --font-sans: 'Inter', system-ui, sans-serif;
  
  /* Font Sizes */
  --text-xs: 12px;
  --text-sm: 14px;
  --text-base: 16px;
  --text-lg: 18px;
  --text-xl: 20px;
  --text-2xl: 24px;
  --text-3xl: 30px;
  --text-4xl: 36px;
  --text-5xl: 48px;
  --text-6xl: 54px;      /* Section headlines */
  --text-hero: 210px;    /* Hero title */
  
  /* Font Weights */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;
  
  /* Line Heights */
  --leading-tight: 1.1;
  --leading-snug: 1.15;
  --leading-normal: 1.375;  /* 22px for 16px text */
  --leading-relaxed: 1.625;
}
```

### 2.4 Border Radius Tokens

```css
:root {
  /* Border Radius Scale */
  --radius-sm: 8px;       /* rounded-lg */
  --radius-md: 12px;      /* rounded-xl */
  --radius-lg: 16px;      /* rounded-2xl */
  --radius-xl: 24px;      /* rounded-3xl */
  --radius-full: 9999px;  /* rounded-full */
  
  /* Semantic Radius */
  --radius-card-outer: var(--radius-lg);
  --radius-card-inner: var(--radius-md);
  --radius-button: var(--radius-full);
  --radius-image: var(--radius-md);
}
```

### 2.5 Motion Tokens

```css
:root {
  /* Durations */
  --duration-fast: 200ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;
  --duration-slower: 700ms;
  
  /* Easing */
  --ease-out: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  
  /* Semantic Motion */
  --transition-conveyor: var(--duration-slow) var(--ease-out);
  --transition-image-zoom: var(--duration-slower);
  --transition-color: var(--duration-slow);
  --transition-accordion: var(--duration-slow) var(--ease-out);
}
```

### 2.6 Layout Tokens

```css
:root {
  /* Container */
  --container-max: 1520px;
  --container-padding: 24px;
  --container-padding-lg: 48px;
  
  /* Grid */
  --grid-gap-tight: var(--space-1);   /* 4px */
  --grid-gap-normal: var(--space-4);  /* 16px */
  --grid-gap-wide: var(--space-16);   /* 64px */
}
```

---

## 3. Animation Presets

Create `client/src/styles/animations.css` for keyframe animations:

```css
/* client/src/styles/animations.css */

@keyframes marquee {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

@keyframes marquee-reverse {
  0% { transform: translateX(-50%); }
  100% { transform: translateX(0); }
}

.animate-marquee {
  animation: marquee 30s linear infinite;
}

.animate-marquee-reverse {
  animation: marquee-reverse 30s linear infinite;
}
```

Create `client/src/lib/motion.ts` for Framer Motion variants:

```typescript
// client/src/lib/motion.ts

import type { Variants } from "framer-motion";

// Standard easing curve
export const easeOut = [0.25, 0.46, 0.45, 0.94] as const;

// Fade in from bottom
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.6, ease: easeOut }
  }
};

// Simple fade
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: 0.6, ease: "easeOut" }
  }
};

// Scale in
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.6, ease: "easeOut" }
  }
};

// Stagger container
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
};

// Stagger item (for use with staggerContainer)
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5, ease: easeOut }
  }
};

// Viewport settings
export const viewportOnce = { once: true, margin: "-100px" };
export const viewportOnceClose = { once: true, margin: "-50px" };
```

---

## 4. Component Layer

The following components should be created to encapsulate repeated patterns.

### 4.1 Container Component

```tsx
// client/src/components/ui/Container.tsx

import { cn } from "@/lib/utils";

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
  fullBleed?: boolean;  // Remove horizontal padding
}

export function Container({ children, className, fullBleed }: ContainerProps) {
  return (
    <div 
      className={cn(
        "max-w-[var(--container-max)] mx-auto",
        !fullBleed && "px-6 lg:px-12",
        className
      )}
    >
      {children}
    </div>
  );
}
```

### 4.2 Section Component

```tsx
// client/src/components/ui/Section.tsx

import { cn } from "@/lib/utils";
import { Container } from "./Container";

interface SectionProps {
  children: React.ReactNode;
  id?: string;
  className?: string;
  dark?: boolean;
  fullBleed?: boolean;
}

export function Section({ 
  children, 
  id, 
  className, 
  dark,
  fullBleed 
}: SectionProps) {
  return (
    <section 
      id={id}
      className={cn(
        "py-[var(--section-padding-y)]",
        dark ? "bg-[var(--color-black)] text-white" : "bg-white",
        className
      )}
    >
      <Container fullBleed={fullBleed}>
        {children}
      </Container>
    </section>
  );
}
```

### 4.3 SectionLabel Component

```tsx
// client/src/components/ui/SectionLabel.tsx

import { cn } from "@/lib/utils";

interface SectionLabelProps {
  label: string;
  number: string;
  className?: string;
  dark?: boolean;
}

export function SectionLabel({ label, number, className, dark }: SectionLabelProps) {
  return (
    <div 
      className={cn(
        "flex items-center justify-between mb-[var(--section-label-gap)]",
        className
      )}
    >
      <span 
        className={cn(
          "text-[var(--text-base)] font-semibold tracking-wide",
          dark ? "text-white" : "text-[var(--color-black)]"
        )}
      >
        / {label}
      </span>
      <span 
        className={cn(
          "text-[var(--text-base)] font-semibold",
          dark ? "text-white/60" : "text-[var(--color-gray-400)]"
        )}
      >
        ({number})
      </span>
    </div>
  );
}
```

### 4.4 Heading Component

```tsx
// client/src/components/ui/Heading.tsx

import { cn } from "@/lib/utils";

type HeadingLevel = "h1" | "h2" | "h3" | "h4";
type HeadingVariant = "hero" | "section" | "card" | "small";

interface HeadingProps {
  as?: HeadingLevel;
  variant?: HeadingVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<HeadingVariant, string> = {
  hero: "text-[var(--text-hero)] font-medium tracking-tighter leading-[0.85]",
  section: "text-[var(--text-6xl)] font-medium leading-[var(--leading-snug)] tracking-tight",
  card: "text-[var(--text-2xl)] font-semibold",
  small: "text-[var(--text-lg)] font-semibold",
};

export function Heading({ 
  as: Component = "h2", 
  variant = "section",
  children, 
  className 
}: HeadingProps) {
  return (
    <Component 
      className={cn(
        "font-[var(--font-sans)] text-[var(--color-black)]",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </Component>
  );
}
```

### 4.5 Card Components

```tsx
// client/src/components/ui/Card.tsx

import { cn } from "@/lib/utils";

interface CardOuterProps {
  children: React.ReactNode;
  className?: string;
}

export function CardOuter({ children, className }: CardOuterProps) {
  return (
    <div 
      className={cn(
        "bg-[var(--color-surface)] rounded-[var(--radius-card-outer)] p-[var(--card-padding-outer)]",
        className
      )}
    >
      {children}
    </div>
  );
}

interface CardInnerProps {
  children: React.ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg";
}

export function CardInner({ children, className, padding = "md" }: CardInnerProps) {
  const paddingClass = {
    sm: "p-[var(--card-padding-outer)]",
    md: "p-[var(--card-padding-inner)]",
    lg: "p-[var(--card-padding-large)]",
  }[padding];

  return (
    <div 
      className={cn(
        "bg-white rounded-[var(--radius-card-inner)]",
        paddingClass,
        className
      )}
    >
      {children}
    </div>
  );
}

interface ProjectCardProps {
  children: React.ReactNode;
  href?: string;
  className?: string;
}

export function ProjectCard({ children, href, className }: ProjectCardProps) {
  const Component = href ? "a" : "div";
  
  return (
    <Component
      href={href}
      className={cn(
        "group block rounded-[var(--radius-card-outer)] overflow-hidden",
        "bg-[var(--color-surface)] hover:bg-[var(--color-black)]",
        "transition-colors duration-[var(--transition-color)]",
        className
      )}
    >
      {children}
    </Component>
  );
}
```

### 4.6 Button Component with Conveyor Animation

```tsx
// client/src/components/ui/Button.tsx

import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
  showPlus?: boolean;
  className?: string;
  onClick?: () => void;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-[var(--color-black)] text-white hover:bg-[var(--color-black)]/90",
  secondary: "bg-[var(--color-surface)] text-[var(--color-black)] hover:bg-[var(--color-black)] hover:text-white",
  ghost: "bg-transparent text-[var(--color-black)] hover:bg-[var(--color-surface)]",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3 text-sm",
};

export function Button({ 
  children, 
  variant = "secondary",
  size = "md",
  href,
  showPlus = true,
  className,
  onClick
}: ButtonProps) {
  const Component = href ? "a" : "button";
  
  return (
    <Component
      href={href}
      onClick={onClick}
      className={cn(
        "group inline-flex items-center gap-2 font-medium rounded-full",
        "transition-all overflow-hidden",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {/* Conveyor text */}
      <span className="overflow-hidden h-5">
        <span className="block transition-transform duration-[var(--transition-conveyor)] group-hover:-translate-y-full">
          {children}
        </span>
        <span className="block transition-transform duration-[var(--transition-conveyor)] group-hover:-translate-y-full">
          {children}
        </span>
      </span>
      
      {/* Plus icon with conveyor */}
      {showPlus && (
        <span className="overflow-hidden h-4 w-4 relative">
          <Plus className="absolute inset-0 w-4 h-4 transition-transform duration-[var(--transition-conveyor)] group-hover:translate-y-4" />
          <Plus className="absolute inset-0 w-4 h-4 transition-transform duration-[var(--transition-conveyor)] -translate-y-4 group-hover:translate-y-0" />
        </span>
      )}
    </Component>
  );
}
```

### 4.7 ConveyorText Component

```tsx
// client/src/components/ui/ConveyorText.tsx

import { cn } from "@/lib/utils";

interface ConveyorTextProps {
  children: React.ReactNode;
  hoverText?: React.ReactNode;  // Optional different text on hover
  className?: string;
  hoverClassName?: string;
}

export function ConveyorText({ 
  children, 
  hoverText,
  className,
  hoverClassName 
}: ConveyorTextProps) {
  return (
    <span className="overflow-hidden h-5 block">
      <span 
        className={cn(
          "block transition-transform duration-[var(--transition-conveyor)] group-hover:-translate-y-full",
          className
        )}
      >
        {children}
      </span>
      <span 
        className={cn(
          "block transition-transform duration-[var(--transition-conveyor)] group-hover:-translate-y-full",
          hoverClassName || className
        )}
      >
        {hoverText || children}
      </span>
    </span>
  );
}
```

### 4.8 Tag Component

```tsx
// client/src/components/ui/Tag.tsx

import { cn } from "@/lib/utils";

type TagVariant = "outline" | "filled" | "badge";

interface TagProps {
  children: React.ReactNode;
  variant?: TagVariant;
  dark?: boolean;
  className?: string;
}

export function Tag({ children, variant = "outline", dark, className }: TagProps) {
  const baseStyles = "px-4 py-2 rounded-full text-sm";
  
  const variantStyles: Record<TagVariant, string> = {
    outline: dark 
      ? "border border-white/20 text-white/80" 
      : "border border-[var(--color-border-medium)] text-[var(--color-text-secondary)]",
    filled: dark
      ? "bg-white/10 text-white/80"
      : "bg-[var(--color-surface)] text-[var(--color-black)]",
    badge: "px-3 py-1.5 bg-white/90 backdrop-blur-sm text-xs font-medium text-[var(--color-black)]",
  };

  return (
    <span className={cn(baseStyles, variantStyles[variant], className)}>
      {children}
    </span>
  );
}
```

### 4.9 Grid Component

```tsx
// client/src/components/ui/Grid.tsx

import { cn } from "@/lib/utils";

type GridVariant = "2-col" | "4-col" | "bento" | "projects" | "blog";

interface GridProps {
  children: React.ReactNode;
  variant?: GridVariant;
  className?: string;
}

const gridStyles: Record<GridVariant, string> = {
  "2-col": "grid lg:grid-cols-2 gap-[var(--grid-gap-wide)]",
  "4-col": "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[var(--grid-gap-tight)]",
  "bento": "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[var(--grid-gap-tight)]",
  "projects": "grid md:grid-cols-2 gap-[var(--grid-gap-tight)]",
  "blog": "grid md:grid-cols-4 gap-[var(--grid-gap-tight)] items-start",
};

export function Grid({ children, variant = "2-col", className }: GridProps) {
  return (
    <div className={cn(gridStyles[variant], className)}>
      {children}
    </div>
  );
}
```

---

## 5. Integration with index.css

Update `client/src/index.css` to import the new token files:

```css
/* client/src/index.css */

@import "./styles/tokens.css";
@import "./styles/animations.css";

@import "tailwindcss";

/* ... existing base styles ... */
```

---

## 6. Usage Rules for New Pages

To ensure consistency across all pages, developers should follow these rules:

### 6.1 Layout Rules

| Rule | Implementation |
|------|----------------|
| Always use `<Section>` wrapper | Provides consistent vertical padding |
| Always use `<Container>` for content | Enforces max-width and horizontal padding |
| Use `fullBleed` prop sparingly | Only for edge-to-edge backgrounds |
| Start sections with `<SectionLabel>` | Maintains visual hierarchy |

### 6.2 Typography Rules

| Element | Component/Class |
|---------|-----------------|
| Page titles | `<Heading variant="hero">` |
| Section headlines | `<Heading variant="section">` |
| Card titles | `<Heading variant="card">` |
| Body text | `text-[var(--color-text-muted)]` with `font-medium` |
| Secondary text | `text-[var(--color-gray-400)]` |

### 6.3 Card Rules

| Pattern | Components |
|---------|------------|
| Nested cards | `<CardOuter>` → `<CardInner>` |
| Project cards | `<ProjectCard>` with hover state |
| Dark cards | Add `dark` prop to components |

### 6.4 Button Rules

| Context | Variant |
|---------|---------|
| Primary CTAs | `<Button variant="primary">` |
| Secondary actions | `<Button variant="secondary">` |
| In dark sections | `<Button variant="secondary">` (inverts automatically) |
| Always include | Conveyor animation (default) |

### 6.5 Motion Rules

| Animation | When to Use |
|-----------|-------------|
| `fadeInUp` | Section entrances |
| `fadeIn` | Subtle reveals |
| `scaleIn` | Card containers |
| `staggerContainer` | Grid items |
| `viewportOnce` | Standard scroll trigger |

### 6.6 Spacing Rules

| Context | Token |
|---------|-------|
| Between sections | `--section-padding-y` (96px) |
| Section label gap | `--section-label-gap` (22px) |
| Content blocks | `--content-gap` (64px) |
| Card gaps | `--card-gap` (4px) |

---

## 7. Migration Strategy

The migration should be done incrementally to avoid breaking changes.

### Phase 1: Foundation (Week 1)

1. Create `tokens.css` with all CSS custom properties
2. Create `animations.css` with keyframe animations
3. Create `motion.ts` with Framer Motion variants
4. Update `index.css` to import new files

### Phase 2: Core Components (Week 2)

1. Create `Container`, `Section`, `SectionLabel` components
2. Create `Heading`, `Text` components
3. Create `Button` with conveyor animation
4. Create `ConveyorText` utility component

### Phase 3: Card System (Week 3)

1. Create `CardOuter`, `CardInner`, `ProjectCard` components
2. Create `Tag` component
3. Create `Grid` component with presets

### Phase 4: Page Migration (Week 4+)

1. Refactor `Home.tsx` to use new components
2. Apply to other pages (Dashboard, Login, etc.)
3. Document any edge cases or exceptions

---

## 8. Benefits of This Approach

| Benefit | Description |
|---------|-------------|
| **Consistency** | All pages share the same visual language |
| **Maintainability** | Change a token once, update everywhere |
| **Speed** | New pages can be built faster with pre-built components |
| **Type Safety** | TypeScript components catch errors at compile time |
| **Documentation** | Self-documenting through component props |
| **Theming** | CSS variables enable easy dark/light mode switching |

---

## 9. Recommended Next Steps

1. **Review this proposal** and provide feedback on component API design
2. **Approve the token values** extracted from Home.tsx
3. **Prioritize components** based on frequency of use
4. **Begin Phase 1** implementation after approval

---

*This proposal is based on the analysis of Home.tsx patterns and aims to create a scalable, maintainable design system for FormaStudio™.*
