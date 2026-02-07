# FormaStudio™ Global Style Guide

**Derived from:** `Home.tsx` (Landing Page)  
**Version:** 1.0  
**Last Updated:** February 2026

---

## Table of Contents

1. [Layout & Max-Width Rules](#1-layout--max-width-rules)
2. [Spacing Scale & Section Padding](#2-spacing-scale--section-padding)
3. [Typography Scale & Hierarchy](#3-typography-scale--hierarchy)
4. [Color System](#4-color-system)
5. [Component Rules](#5-component-rules)
6. [Motion Rules](#6-motion-rules)
7. [Inconsistencies Found & Recommendations](#7-inconsistencies-found--recommendations)
8. [Do/Don't Examples](#8-dodont-examples)

---

## 1. Layout & Max-Width Rules

### Container Standards

| Property | Value | Usage |
|----------|-------|-------|
| **Max Width** | `1520px` | Primary content container |
| **Horizontal Padding** | `px-6 lg:px-12` | Standard responsive padding |
| **Override Pattern** | `style={{paddingRight: '0px', paddingLeft: '0px'}}` | Full-bleed sections |

### Standard Container Class

```tsx
<div className="max-w-[1520px] mx-auto px-6 lg:px-12">
```

### Grid Systems

| Grid Type | Class | Usage |
|-----------|-------|-------|
| **2-Column** | `grid lg:grid-cols-2 gap-16` | Process, FAQ sections |
| **4-Column** | `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-1` | Bento grid (Why Us) |
| **Project Grid** | `grid md:grid-cols-2 gap-1` | Work section |
| **Blog Grid** | `grid md:grid-cols-4 gap-1` | Blog section |

### Border Radius Scale

| Size | Class | Usage |
|------|-------|-------|
| **Small** | `rounded-lg` | Mega menu image |
| **Medium** | `rounded-xl` | Inner cards, images |
| **Large** | `rounded-2xl` | Outer card containers, project cards |
| **Extra Large** | `rounded-3xl` | Services dark container |
| **Full** | `rounded-full` | Buttons, badges |

---

## 2. Spacing Scale & Section Padding

### Section Padding

| Standard | Value | Notes |
|----------|-------|-------|
| **Vertical Padding** | `py-24` | All major sections |
| **Hero Top Padding** | `pt-20` | Hero section only |
| **Hero Bottom** | `style={{paddingBottom: '120px'}}` | Custom override |

### Internal Spacing

| Element | Spacing | Class/Style |
|---------|---------|-------------|
| **Section Label to Content** | 22px | `style={{marginBottom: '22px'}}` |
| **Headline to Description** | `mb-4` to `mb-8` | Varies by section |
| **Content Blocks** | `mb-12` to `mb-16` | Standard section spacing |
| **Card Inner Padding** | `p-4` to `p-6` | Depends on card size |
| **Card Gap** | `gap-1` to `gap-2` | Tight grid spacing |

### Card Container Padding

| Container Type | Padding |
|----------------|---------|
| **Bento Outer** | `p-2` |
| **Bento Inner Cards** | `p-4` to `p-6` |
| **Services Container** | `px-8 py-12 lg:px-16 lg:py-16` |
| **FAQ/Process Container** | `p-2` outer, `p-5` to `p-6` inner |

---

## 3. Typography Scale & Hierarchy

### Font Family

The primary font is **Inter** (sans-serif), applied via inline styles throughout.

```tsx
style={{ fontFamily: 'Inter, sans-serif' }}
```

### Heading Scale

| Level | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| **Hero Title** | 210px | 500 | 0.85 | Main wordmark "Forma®" |
| **Section Headline** | 54px | 500 | 1.15 / 59px | Two-tone headlines |
| **Work Title** | 64px | 500 | 1.1 | "Selected Work." |
| **Footer Wordmark** | clamp(3rem,10vw,8rem) | bold | — | "Forma® Studio" |
| **Card Title** | 24px | 600/bold | — | Process steps, feature cards |
| **Blog Title** | 18px-21px | semibold | — | Post titles |
| **Nav Items** | 24px | 600 | — | Mega menu navigation |

### Body Text Scale

| Type | Size | Weight | Color | Line Height |
|------|------|--------|-------|-------------|
| **Primary Body** | 16px | 500 | #757575 | 22px |
| **Secondary Body** | 14px (text-sm) | 400-500 | #4D4D4D | relaxed |
| **Small/Caption** | 12px (text-xs) | 400-500 | #757575 | — |
| **Tagline** | 18px (text-lg) | 500 | #757575 | 22px |

### Section Label Component

```tsx
<div className="flex items-center justify-between" style={{marginBottom: '22px'}}>
  <span className="text-sm font-semibold text-[#0A0A0A] tracking-wide" style={{fontSize: '16px'}}>
    / {label}
  </span>
  <span className="text-sm font-semibold text-[#757575]" style={{fontSize: '16px'}}>
    ({number})
  </span>
</div>
```

---

## 4. Color System

### Primary Palette

| Name | Hex | Usage |
|------|-----|-------|
| **Black** | `#0A0A0A` | Primary text, dark backgrounds |
| **Dark Gray** | `#121212` | Services section background |
| **Medium Gray** | `#757575` | Secondary text, muted content |
| **Light Gray** | `#4D4D4D` | Body text, descriptions |
| **Surface Gray** | `#EBEBEB` | Card backgrounds, header, buttons |
| **White** | `#FFFFFF` | Page background, card interiors |

### Opacity Variants

| Pattern | Usage |
|---------|-------|
| `text-[#0A0A0A]/70` | Nav items default state |
| `text-[#0A0A0A]/40` | Muted elements (year, index) |
| `text-[#0A0A0A]/30` | Very muted (step numbers) |
| `text-white/60` | Footer links, muted white text |
| `text-white/80` | Emphasized white text |
| `border-[#0A0A0A]/10` | Subtle borders |
| `border-[#0A0A0A]/20` | Medium borders |

### Background Rules

| Context | Background |
|---------|------------|
| **Page** | `bg-white` |
| **Header** | `bg-[#EBEBEB]` |
| **Cards (Light)** | `bg-[#EBEBEB]` outer, `bg-white` inner |
| **Cards (Dark)** | `bg-[#0A0A0A]` or `bg-[#121212]` |
| **Footer** | `bg-[#0A0A0A]` |

---

## 5. Component Rules

### Buttons

#### Primary Button (Dark)

```tsx
<Link
  href="/#contact"
  className="group inline-flex items-center gap-2 px-5 py-2.5 bg-[#0A0A0A] text-white text-sm font-medium rounded-full hover:bg-[#0A0A0A]/90 transition-colors overflow-hidden"
>
  <span className="overflow-hidden h-5">
    <span className="block transition-transform duration-500 ease-out group-hover:-translate-y-full">
      Start a project
    </span>
    <span className="block transition-transform duration-500 ease-out group-hover:-translate-y-full">
      Start a project
    </span>
  </span>
</Link>
```

#### Secondary Button (Light with Plus Icon)

```tsx
<a 
  href="#" 
  className="group inline-flex items-center gap-2 px-5 py-2.5 bg-[#EBEBEB] text-[#0A0A0A] rounded-full hover:bg-[#0A0A0A] hover:text-white transition-all overflow-hidden"
  style={{fontWeight: '500'}}
>
  <span className="overflow-hidden h-5">
    <span className="block transition-transform duration-500 ease-out group-hover:-translate-y-full">
      View all projects
    </span>
    <span className="block transition-transform duration-500 ease-out group-hover:-translate-y-full">
      View all projects
    </span>
  </span>
  <span className="overflow-hidden h-4 w-4 relative">
    <Plus className="absolute inset-0 w-4 h-4 transition-transform duration-500 ease-out group-hover:translate-y-4" />
    <Plus className="absolute inset-0 w-4 h-4 transition-transform duration-500 ease-out -translate-y-4 group-hover:translate-y-0" />
  </span>
</a>
```

#### Button Sizes

| Size | Padding | Usage |
|------|---------|-------|
| **Standard** | `px-5 py-2.5` | Header CTA, inline buttons |
| **Large** | `px-6 py-3` | Section CTAs |
| **Small** | `px-4 py-2` | Card buttons |

### Cards

#### Outer Container Card

```tsx
<div className="bg-[#EBEBEB] rounded-2xl p-2 flex flex-col gap-2">
  {/* Inner cards go here */}
</div>
```

#### Inner Content Card

```tsx
<div className="bg-white rounded-xl p-4">
  {/* Content */}
</div>
```

#### Project Card (Hover State Change)

```tsx
<a className="group block rounded-2xl overflow-hidden transition-all duration-500 bg-[#EBEBEB] hover:bg-[#0A0A0A]">
  <div className="relative aspect-[4/3] overflow-hidden rounded-xl m-1.5">
    <img className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
  </div>
  {/* Text with color swap animation */}
</a>
```

### Inputs

#### Newsletter Input

```tsx
<input
  type="email"
  placeholder="Email"
  className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-full text-white placeholder:text-white/40 focus:outline-none focus:border-white/40"
/>
```

### Navigation

#### Header Nav Item (Conveyor Effect)

```tsx
<a href="#about" className="group overflow-hidden">
  <span className="overflow-hidden h-5 block">
    <span className="block text-sm text-[#0A0A0A]/70 font-medium transition-transform duration-500 ease-out group-hover:-translate-y-full">
      About
    </span>
    <span className="block text-sm text-[#0A0A0A] font-medium transition-transform duration-500 ease-out group-hover:-translate-y-full">
      About
    </span>
  </span>
</a>
```

### Tags/Badges

```tsx
<span className="px-4 py-2 border border-white/20 rounded-full text-sm text-white/80">
  {item}
</span>
```

```tsx
<span className="px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full text-xs font-medium text-[#0A0A0A]">
  {category}
</span>
```

---

## 6. Motion Rules

### Animation Variants (Framer Motion)

#### fadeInUp

```tsx
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }
  }
};
```

#### fadeIn

```tsx
const fadeIn = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: 0.6, ease: "easeOut" }
  }
};
```

#### staggerContainer

```tsx
const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
};
```

#### scaleIn

```tsx
const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.6, ease: "easeOut" }
  }
};
```

### Hover Transitions

| Element | Duration | Easing | Effect |
|---------|----------|--------|--------|
| **Conveyor Text** | 500ms | ease-out | `-translate-y-full` |
| **Plus Icon** | 500ms | ease-out | `translate-y-4` / `-translate-y-4` |
| **Image Zoom** | 700ms | default | `scale-110` |
| **Color Change** | 500ms | default | `transition-colors` |
| **Background** | 300ms-500ms | default | `transition-all` |

### Scroll Animations

| Effect | Implementation |
|--------|----------------|
| **Hero Image Unzoom** | `useScroll` + `useTransform` (1.25 → 1.0) |
| **Viewport Trigger** | `whileInView` with `margin: "-100px"` or `"-50px"` |
| **Spring Physics** | `stiffness: 100, damping: 30` |

### Accordion Transitions

```tsx
className={`overflow-hidden transition-all duration-500 ease-out ${
  isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
}`}
```

---

## 7. Inconsistencies Found & Recommendations

### Critical Inconsistencies

| Issue | Location | Current | Recommended |
|-------|----------|---------|-------------|
| **Duplicate inline styles** | StatsMarquee (line 576) | Multiple `style={{color: '#757575'}}` | Single style attribute |
| **Container padding override** | Multiple sections | `style={{paddingRight: '0px', paddingLeft: '0px'}}` | Create utility class or remove base padding |
| **Mixed font-weight patterns** | Throughout | Both `font-medium` class and `fontWeight: '500'` inline | Standardize to Tailwind classes |
| **Inconsistent line-height** | Body text | Mix of `leading-relaxed`, `lineHeight: '22px'` | Standardize to `22px` for 16px text |

### Typography Inconsistencies

| Element | Variations Found | Recommendation |
|---------|------------------|----------------|
| **Section Headlines** | 54px (About, Why Us, Process, FAQ, Blog) vs 64px (Work) | Standardize to 54px |
| **Card Titles** | 18px, 24px mixed usage | Use 24px for primary, 18px for secondary |
| **Body Text Weight** | 400, 500 mixed | Standardize to 500 for primary body |

### Spacing Inconsistencies

| Element | Variations | Recommendation |
|---------|------------|----------------|
| **Section Label margin-bottom** | `mb-12` class vs `marginBottom: '22px'` inline | Use 22px consistently |
| **Header-to-content gap** | `mb-12`, `mb-16`, custom values | Standardize to `mb-12` (48px) |
| **Button margin-top** | `marginTop: '100px'` on some buttons | Create consistent pattern |

### Border Inconsistencies

| Element | Current | Recommendation |
|---------|---------|----------------|
| **Mega menu nav borders** | `borderColor: '#d4d4d4'` | Use `border-[#0A0A0A]/20` for consistency |
| **Card gaps** | `gap-1`, `gap-2` mixed | Standardize to `gap-1` for tight grids |

### Animation Timing Inconsistencies

| Element | Current Duration | Recommendation |
|---------|------------------|----------------|
| **Conveyor text** | 500ms | Keep as standard |
| **Image zoom** | 700ms | Keep as standard |
| **FAQ accordion** | 300ms | Align to 500ms for consistency |
| **Services accordion** | 500ms | Keep as standard |

---

## 8. Do/Don't Examples

### Layout

| ✅ Do | ❌ Don't |
|-------|---------|
| Use `max-w-[1520px] mx-auto px-6 lg:px-12` | Use arbitrary max-widths like `max-w-[1400px]` |
| Apply `rounded-2xl` to outer cards | Mix `rounded-xl` and `rounded-2xl` on same-level cards |
| Use `gap-1` for tight card grids | Use `gap-4` or larger for bento grids |

### Typography

| ✅ Do | ❌ Don't |
|-------|---------|
| Use Inter font family consistently | Mix font families |
| Apply `fontSize: '54px'` for section headlines | Use varying headline sizes (48px, 54px, 64px) |
| Use `fontWeight: '500'` for body text | Mix 400 and 500 weights randomly |
| Set `lineHeight: '22px'` for 16px body text | Use `leading-relaxed` inconsistently |

### Colors

| ✅ Do | ❌ Don't |
|-------|---------|
| Use `#0A0A0A` for primary dark | Use `#000000` or other blacks |
| Use `#EBEBEB` for surface backgrounds | Use `#F5F5F5` or other grays |
| Use `#757575` for secondary text | Use `#666666` or `#888888` |
| Apply opacity via `/70`, `/40` patterns | Use separate hex values for opacity |

### Buttons

| ✅ Do | ❌ Don't |
|-------|---------|
| Include conveyor text animation on all buttons | Have static text on some buttons |
| Use `rounded-full` for all buttons | Mix `rounded-lg` and `rounded-full` |
| Apply `px-5 py-2.5` for standard buttons | Use inconsistent padding |
| Include Plus icon animation on secondary buttons | Have static icons |

### Motion

| ✅ Do | ❌ Don't |
|-------|---------|
| Use `duration-500` for conveyor effects | Mix 300ms, 500ms, 700ms randomly |
| Apply `ease-out` for text transitions | Use different easing functions |
| Use `duration-700` for image zoom | Use faster durations for image effects |
| Set `viewport={{ once: true, margin: "-100px" }}` | Trigger animations multiple times |

### Cards

| ✅ Do | ❌ Don't |
|-------|---------|
| Use `bg-[#EBEBEB]` outer + `bg-white` inner | Use white for both layers |
| Apply `p-2` to outer containers | Use larger padding on outer containers |
| Include hover state color swap on project cards | Have static project cards |
| Use `m-1.5` for image inset in cards | Use `p-1.5` (padding instead of margin) |

### Hover States

| ✅ Do | ❌ Don't |
|-------|---------|
| Swap background from `#EBEBEB` to `#0A0A0A` | Only change opacity on hover |
| Animate text color along with background | Keep text color static |
| Scale images to `1.1` on hover | Use larger scale values |
| Use `transition-all duration-500` | Omit transition properties |

---

## Quick Reference: Standard Classes

### Container

```tsx
className="max-w-[1520px] mx-auto px-6 lg:px-12"
```

### Section

```tsx
className="py-24 bg-white"
```

### Headline (Two-tone)

```tsx
className="text-[clamp(1.75rem,4vw,3rem)] font-medium leading-[1.15] tracking-tight"
style={{ fontSize: '54px', fontFamily: 'Inter, sans-serif' }}
```

### Body Text

```tsx
className="text-[#4D4D4D]"
style={{ fontSize: '16px', fontWeight: '500', lineHeight: '22px' }}
```

### Primary Button

```tsx
className="group inline-flex items-center gap-2 px-5 py-2.5 bg-[#0A0A0A] text-white text-sm font-medium rounded-full hover:bg-[#0A0A0A]/90 transition-colors overflow-hidden"
```

### Secondary Button

```tsx
className="group inline-flex items-center gap-2 px-5 py-2.5 bg-[#EBEBEB] text-[#0A0A0A] rounded-full hover:bg-[#0A0A0A] hover:text-white transition-all overflow-hidden"
style={{ fontWeight: '500' }}
```

### Card Outer

```tsx
className="bg-[#EBEBEB] rounded-2xl p-2"
```

### Card Inner

```tsx
className="bg-white rounded-xl p-4"
```

---

*This style guide should be referenced when creating new pages or components to ensure visual consistency across the FormaStudio™ website.*
