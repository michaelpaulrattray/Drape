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


## LUMEN Complete Redesign
- [x] Rewrite homepage to match LUMEN portfolio exactly
- [x] Hero section: 4-column grid with brand, image carousel, stats
- [x] Exploration section: 2-column gallery with project slider
- [x] Process section: stats with AI workflow content
- [x] Methodology section: camera image with philosophy text
- [x] Recognition section: 4-column awards grid
- [x] Journal section: featured article with sidebar entries
- [x] Waitlist section: centered form with name/email
- [x] Footer: 4-column layout with social links
- [x] Add sky-blue accent color (#38bdf8)
- [x] Grayscale image treatment with contrast boost

## Replace Recognition with Draggable Cards
- [x] Replace Recognition section with scrolling draggable card section
- [x] Add dark theme cards with hover effects and descriptions
- [x] Implement drag-to-scroll functionality with momentum
- [x] Style consistently with LUMEN light theme (dark section with light cards)

## Draggable Cards Auto-Scroll
- [x] Add slow auto-scroll animation to draggable cards section
- [x] Implement infinite loop with cloned cards
- [x] Pause auto-scroll on drag interaction

## Restyle Draggable Cards to LUMEN Style
- [x] Change dark background to light/white background
- [x] Update card styling to match LUMEN aesthetic (light cards, clean borders)
- [x] Update typography to match rest of page (Geist font, consistent sizing)
- [x] Add sky-blue accent color for hover states

## Gridline Background Consistency
- [x] Add subtle gridline background to "Solving Problems With Intelligent AI" section
- [x] Ensure visual continuity with other sections when scrolling

## Intelligent Gridlines for Services Section
- [x] Analyze how other sections frame content with gridlines
- [x] Design gridlines that stop/frame around content elements in Services Marquee
- [x] Create visual hierarchy with intentional grid placement

## Header, Hero & Page Cleanup
- [x] Redesign header to be inline like Spark Labs (mix-blend-difference, logo left, Join Waitlist pill right)
- [x] Remove hamburger menu and dropdown
- [x] Remove "View Studios" button from hero section
- [x] Make "Get Access" button more prominent in hero
- [x] Remove /app route (users go directly to dashboard)
- [x] Remove /settings page
- [x] Update OAuth callback to redirect to /dashboard

## Login Page Redesign
- [x] Match homepage light theme (bg-zinc-50, text-zinc-900)
- [x] Add subtle gridlines background
- [x] Use inline header style with forma studio logo
- [x] Style login button with sky-blue accent
- [x] Add cohesive typography and spacing

## Dashboard Redesign - Dark Theme
- [x] Create dark theme dashboard matching reference design
- [x] Add sidebar with navigation (Home, Studios, Library, History, etc.)
- [x] Add header with profile banner, avatar, and tabs
- [x] Add Team Members section with member avatars
- [x] Add Recent Work content grid section
- [x] Style with dark background (#0D0C12), rose accent for active items
- [x] Add Quick Actions cards for studio access

## Dashboard Clean Modern Dark Theme
- [x] Background: #151515 to #1a1a1a (dark gray, not pure black)
- [x] Text: #e5e5e5 to #f0f0f0 for readability
- [x] Accents: muted violet (#8b5cf6), sky (#60a5fa), amber colors
- [x] Generous spacing with subtle shadows
- [x] 12-16px border-radius on cards (rounded-xl, rounded-2xl)
- [x] WCAG contrast compliance for eye comfort
- [x] Match homepage fonts/weights/line-height

## Dashboard Sidebar Label Updates
- [x] Change "TEMPLATES" to "RESOURCES"
- [x] Change "MY STUDIO" to "TOOLS"

## Dashboard Reorganization
- [x] Move Studios (Casting, Wardrobe, Photo) under Tools menu
- [x] Move current Tools items (Library, History, etc.) under Home menu
- [x] Remove Team Members section
- [x] Add logout button (in sidebar user profile area)
- [x] Change profile picture gradient to grayscale abstract style

## Dashboard Updates - Profile & Menu Reorganization
- [x] Make user profile editable (profile picture, header background, email)
- [x] Add Billing & Usage to Home menu items
- [x] Remove small inline menu under profile picture (tabs)
- [x] Remove Downloads, History, Library menu items
- [x] Update Resources section:
  - [x] Casting Pro → Learn Casting
  - [x] Style Guide → Learn Wardrobe
  - [x] Campaign Kit → Learn Campaign
  - [x] Add Affiliate Program
  - [x] Add Legal & Copyright

## Dashboard Glass Morphism Restyle
- [x] Dark charcoal background (#0A0A0A) with subtle grid pattern
- [x] Glass morphism panels with backdrop-blur and white/10 borders
- [x] Orange accent color (#f97316/orange-500) for highlights
- [x] Monospace labels for section numbers ([01/01] // DASHBOARD style)
- [x] Monospace technical labels ([01/08] // SYS.INIT style)
- [x] Frosted glass cards with gradient borders
- [x] Clip animation inspired orange accent on hover
- [x] Editorial/premium creative studio aesthetic

## Dashboard Background Update
- [x] Remove checkerboard/grid pattern from dashboard
- [x] Add abstract landscape image as background
- [x] Desaturate and fade image to very subtle opacity (8% opacity + grayscale)
- [x] Ensure seamless blend with dark background (edge gradients)

## Dashboard Corner Styling Update
- [x] Mix soft rounded corners (rounded-lg, rounded-xl) with sharp edges
- [x] Apply rounded-full to icon buttons and avatars
- [x] Use rounded-lg for internal cards and content areas
- [x] Keep some elements sharp/square for contrast
- [x] Add gradient borders with border-gradient style
- [x] Improve backdrop-blur and glass effects

## Dashboard Default Images
- [x] Add default cover/banner image for users without custom upload
- [x] Add default profile picture/avatar for users without custom upload
- [x] Ensure professional appearance for new users

## Profile Settings Modal
- [x] Add cog/settings icon next to logout button in sidebar
- [x] Create profile settings modal/popout component
- [x] Include profile editing section (name, email, avatar, banner)
- [x] Include billing plan display and upgrade option
- [x] Include account settings (notifications, preferences)
- [x] Remove inline edit functionality from profile header
- [x] Style modal with glass morphism to match dashboard aesthetic

## Dashboard Button Styling Update
- [x] Change main buttons to white pill-shaped (rounded-full)
- [x] Use white/light backgrounds instead of orange for primary buttons
- [x] Keep orange only for small accents (dots, indicators, hover borders)
- [x] Apply consistent pill shape across all dashboard buttons
