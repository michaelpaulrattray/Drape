# Sticky Scroll Issue Analysis

## Problem
The sticky image on the left side of the Process section is not staying visible when scrolling through steps 2 and 3. The image disappears after scrolling past step 1.

## Current Implementation
- The sticky container has `sticky top-32` class
- The image transitions are working (process-image.active/inactive classes)
- The IntersectionObserver is detecting step changes correctly

## Root Cause
The sticky element is inside a grid column that doesn't have enough height. When the user scrolls past the first step, the sticky element's container ends and the image scrolls away.

## Solution
1. The sticky container needs to span the full height of the process section
2. Need to ensure the left column has `min-h-full` or matches the height of the right column
3. The sticky element should be positioned relative to the section, not just the grid column
