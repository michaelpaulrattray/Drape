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


## Phase 1.6: Redesign to Match AI Creative Agency Style

### Design Updates
- [x] Update to pure black background
- [x] Add orange/coral accent color for CTAs
- [x] Bolder, larger typography
- [x] Remove glassmorphism, use solid colors
- [x] Add image grid gallery in hero section
- [x] Redesign problem section with asymmetric layout
- [x] Update FAQ to accordion style
- [x] Simplify navigation
- [x] Add showcase images of AI capabilities


## Phase 1.7: Dashboard Redesign (Mango Style)

### Routing Changes
- [x] Remove /app page route
- [x] Update routing so logged-in users go to dashboard

### Dashboard Design Updates
- [x] Add lime/green accent color
- [x] Create sidebar navigation component
- [x] Add user profile section in sidebar
- [x] Create top header with search bar
- [x] Add studio cards (Casting, Outfit, Photo)
- [x] Display points balance prominently
- [x] Add recent activity/models section
- [x] Mobile-responsive sidebar (collapsible)


## Phase 1.8: Consistent Styling Across All Pages

### Dashboard Updates
- [x] Change lime/green accents to orange
- [x] Update sidebar navigation styling
- [x] Update points balance display
- [x] Update studio cards hover effects

### Login Page Updates
- [x] Match waitlist page styling
- [x] Update social login buttons
- [x] Consistent typography

### Other Pages
- [x] Update Coming Soon page
- [x] Update NotFound page
- [x] Consistent navigation elements


## Phase 1.9: Waitlist Hero Full Viewport

- [x] Make hero section full viewport height (100vh)
- [x] Ensure content is vertically centered
- [x] Maintain mobile responsiveness


## Phase 1.10: Waitlist Page Redesign to Match Reference

### Layout & Structure
- [x] Full viewport hero with asymmetric image grid
- [x] Diagonal/angled section dividers
- [x] Two-column layouts with large images
- [x] Marquee/scrolling text sections
- [x] Testimonial cards with profile images

### Typography & Colors
- [x] Match exact font sizes and weights
- [x] Match exact color palette from reference
- [x] Match text opacity levels

### Animations
- [x] Fade-in-up animations on scroll
- [x] Image hover scale effects
- [x] Smooth section transitions
- [x] Marquee scrolling animation

### Components
- [x] Navigation with exact styling
- [x] Hero section with image grid
- [x] Services/capabilities section
- [x] Process/how it works section
- [x] Testimonials section
- [x] FAQ accordion
- [x] Footer with links


## Phase 1.11: Fix Sticky Scroll in Process Section

- [x] Fix sticky image positioning to stay visible while scrolling
- [x] Ensure image changes as user scrolls through each step
- [x] Verify step number overlay updates correctly
- [x] Test on desktop viewport


## Phase 1.12: Waitlist Page Rebuild from Reference HTML

### Structure
- [x] Hero section with video background and gradient overlay
- [x] Mix-blend-difference navigation
- [x] Draggable services marquee section
- [x] Process section with proper sticky scroll (grid layout)
- [x] Benefits bento grid section
- [x] Contact form with glass panel styling
- [x] Footer with marquee text and dynamic time

### Sticky Scroll Fix (from reference)
- [x] Use CSS Grid (grid-cols-2) instead of flexbox
- [x] Left column: relative h-full min-h-screen with border
- [x] Sticky container: top-0 h-screen with flex items-center
- [x] Right column: scrolling steps with min-h-[40vh] each
- [x] IntersectionObserver with rootMargin: '-40% 0px -40% 0px'
