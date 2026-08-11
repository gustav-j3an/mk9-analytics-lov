# Plan — MK9 Presence Module Responsiveness Overhaul (v2.5.0)

## Goals
Fix the broken responsiveness of the Presence Control module across all devices, ensuring data integrity and professional UI/UX standards.

## Technical Details

### 1. Header & Actions Refactor
- Refactor `Mk9PageHeader` in `Mk9PresenceModule` to support stacked layouts on smaller screens.
- Replace the fixed-width date input with a flexible, icon-padded container to prevent text clipping (e.g., "11/08/2026" must be fully visible).
- Use `flex-wrap` and responsive spacing for action buttons (Save, Excel, Config).

### 2. Metric Grid
- Update the KPI grid from `grid-cols-2 md:grid-cols-5` to a more granular responsive scale:
  - Mobile: `grid-cols-1` or `grid-cols-2`
  - Tablet: `grid-cols-2` or `grid-cols-3`
  - Desktop: `grid-cols-5`

### 3. Filter Section
- Remove the horizontal-only flex container for filters.
- Implement a responsive grid or wrapping flex container:
  - Mobile: Full-width stacked inputs/selects.
  - Tablet: 2-column layout.
  - Desktop: Inline layout with proper `min-w-0` to prevent overflow.

### 4. Presence List (Mobile-First View)
- Implement a **Card-based view** for screens below `768px` (md breakpoint).
- Keep the `table` view for desktop and large tablets.
- Mobile cards will feature:
  - Name and UF in a clear header.
  - Registration number badge.
  - Vertical or wrapped status buttons (Present, Absent, Medical) with touch-friendly heights (min-h-[40px]).
  - Observation input spanning full card width.

### 5. Global Styles & Constraints
- Audit and remove any `flex-nowrap`, `white-space: nowrap`, or hardcoded `calc(100vw - Xpx)` that causes horizontal scroll.
- Ensure the sidebar interaction (open/closed) doesn't break the main content container's fluid width.

## Verification
- Visual check on simulated viewports: 360px, 390px, 768px, 1024px, 1440px.
- Confirm date string "11/08/2026" visibility.
- Confirm 0 horizontal global scroll.
