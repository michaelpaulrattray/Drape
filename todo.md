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
- [x] Create two-column sticky scroll ProcessSection component with IntersectionObserver
- [x] Add ProcessSection under draggable cards section on waitlist page
