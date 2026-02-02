# FormaStudio™ Project TODO

## Phase 1: Foundational Backend & Authentication

### Database Schema
- [x] Users table with role-based access control
- [x] Points table for balance tracking
- [x] Point transactions table for history

### Design System
- [x] Configure dark theme with zinc palette
- [x] Add Instrument Serif font
- [x] Set up glassmorphism utilities
- [x] Configure animations (fade-in-up, etc.)

### Backend
- [x] Points system tRPC procedures (balance, transactions, deduct)
- [x] Initialize points for new users
- [x] Transaction history tracking

### Authentication UI
- [x] Dark card login design
- [x] Social login buttons (Google, Apple)
- [x] Email/password form styling
- [x] Responsive layout

### Navigation & Layout
- [x] Fixed navigation with mix-blend-difference
- [x] Glass panel components
- [x] Mobile-responsive navigation

### Dashboard
- [x] User dashboard page
- [x] Points balance display
- [x] Transaction history view
- [x] User profile section

### Testing
- [x] Points system unit tests
- [x] Authentication flow verification


## Phase 1.5: Waitlist Landing Page

### Landing Page Structure
- [x] Hero section with compelling headline and value proposition
- [x] Problem/solution section addressing pain points
- [x] Benefits section with key features
- [x] Social proof section (testimonials, brand logos, stats)
- [x] How it works section
- [x] Pricing preview / early access benefits
- [x] FAQ section
- [x] Final CTA section

### Waitlist System
- [x] Waitlist database table for email capture
- [x] Email signup form with validation
- [x] Success confirmation state
- [x] tRPC procedure for waitlist signup

### Copy & Conversion
- [x] Headline copy targeting creative directors
- [x] Benefit-driven feature descriptions
- [x] Urgency/scarcity messaging for early access
- [x] Clear call-to-action copy

### Polish
- [x] Smooth scroll animations
- [x] Mobile-responsive design
- [x] Loading states and error handling


## Lumen-Style Redesign
- [x] Update CSS with Lumen design tokens (light bg, orange accent, Geist font)
- [x] Implement animated neon grid lines background
- [x] Create 4-column hero layout with gallery slider
- [x] Add exploration section with image gallery
- [x] Add methodology/process section with accordion list
- [x] Add recognition/benefits section
- [x] Redesign footer with newsletter form
- [x] Ensure mobile responsiveness

## Cleanup
- [x] Remove /app page (users go directly to dashboard after login)

## Global Style Consistency
- [x] Redesign Login page with Lumen light theme (orange accents, Geist font)
- [x] Redesign Coming Soon pages with Lumen light theme
- [x] Ensure dashboard maintains dark theme for app interface
- [x] Update ThemeProvider to handle light/dark based on route

## Mango-Style Dashboard Redesign
- [x] Add display_name field to user schema for profile customization
- [x] Create Mango-style sidebar navigation component
- [x] Redesign dashboard layout with dark theme (#0D0C12 background)
- [x] Add profile header section with avatar and stats
- [x] Create studio cards with hover effects
- [x] Build profile settings page with avatar upload
- [x] Build profile settings page with display name editing
- [x] Add recent activity section

## Dashboard Restyling (Forma Design in Dark Mode)
- [x] Update dashboard to use Geist typography and Forma design language
- [x] Add subtle grid lines background (dark mode version)
- [x] Use orange accent color consistently
- [x] Restyle cards with border styling matching public pages
- [x] Update sidebar to match Forma aesthetic
- [x] Update Settings page to match new dashboard style

## Dark Mode Color Adjustment
- [x] Lighten dashboard background from pure black to softer dark gray

## Bug Fix
- [x] Fix dashboard dark mode - content area showing white instead of dark
- [x] Update dashboard background to #0a0a0a (bg-studio-950)
- [x] Fix nested anchor tag error on dashboard (<a> cannot contain nested <a>)
- [x] Fix dark mode not applying to main content area (sidebar dark, content white)
- [x] Update dark mode background to #18181b (zinc-900) for softer dark theme
- [x] Add scrolling/draggable card section under hero on waitlist page
- [x] Redesign draggable card section to match light theme (white bg, orange accents, Geist font)
- [x] Add "From Idea to Launch in 3 Steps" section under Cast, Style & Generate section
- [x] Redesign "From Idea to Launch in 3 Steps" section to match light theme (white bg, orange accents, borders)

## Header & Footer Updates
- [x] Redesign header navigation to inline style (logo left, nav links right, mix-blend-difference)
- [x] Add dynamic location tag to footer with user's timezone/location

## Hero Section Redesign
- [x] Redesign hero with clearer headline, prominent CTAs, and better visual hierarchy
- [x] Make copy more visible and impactful
- [x] Simplify layout for better user focus

## Hero Background Enhancement
- [x] Add animated gradient background to hero section

## Hero Section Split Layout Redesign
- [x] Redesign hero section with split layout (content left, image with stats right)


## Sticky Scroll Process Section
- [x] Implement dual-column sticky image + scrolling text section below draggable cards
- [x] Left column: sticky image that stays pinned during scroll
- [x] Right column: scrolling step blocks that drive image transitions
- [x] Scroll-driven image crossfade animation based on active step
- [x] Responsive fallback for mobile (stacked layout)

## Restore Original Sticky Scroll Design
- [x] Restore original dark theme sticky scroll process section from reference HTML
- [x] Apply overflow-hidden fix to prevent sticky breaking

## Section Removal
- [x] Remove "AI Model Casting" section from landing page
- [x] Remove "Cast, Style & Generate" section from landing page

## Styling Inconsistencies Review
- [x] Review homepage for styling inconsistencies
- [x] Add gradient transitions between light and dark sections
- [x] Standardize typography (use font-geist consistently for headings)
- [x] Standardize section labels (orange dot + uppercase pattern)
- [x] Standardize CTA button styles
- [x] Fix step number font consistency

## Creative Power Unbound Section
- [x] Replace "From Idea to Launch" section with "Creative Power, Unbound" bento grid
- [x] Implement dark theme bento grid with 4 cards layout
- [x] Add animated progress bar and rendering indicator

## Draggable Cards Slow Scroll Effect
- [x] Add slow scroll marquee animation to draggable cards section
- [x] Implement auto-scroll with pause on drag

## Creative Power Section Light Theme
- [x] Convert Creative Power, Unbound section from dark to light background

## Hero Section Updates
- [x] Make CTA text in header smaller
- [x] Remove cost savings and generation time cards
- [x] Keep only studio status card
- [x] Increase model image size
