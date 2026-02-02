# Sticky Scroll Issue Findings

## Problem
The sticky image in the Process section is not staying visible when scrolling through steps 2 and 3. 

## Current Behavior
- When at step 1: Image is visible on the left
- When scrolling to step 2: Image disappears (scrolls out of view)
- When scrolling to step 3: Image still not visible

## Root Cause
The absolute positioned container with `h-full` is not working correctly because the parent doesn't have an explicit height. The sticky element needs to be inside a container that has enough height to allow scrolling while keeping the sticky element in place.

## Solution Needed
The left column needs to span the full height of all the steps on the right. The current structure has:
- Parent: `relative` div
- Left: `absolute left-0 top-0 w-[45%] h-full` with `sticky top-32` inside
- Right: `lg:ml-[50%] lg:pl-12` with the steps

The issue is that `h-full` on the absolute container doesn't give it the actual height of the content because the parent's height is determined by the right column content.

## Fix
Need to restructure so both columns are in a flex container where the left column naturally gets the same height as the right column.
