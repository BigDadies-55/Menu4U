# Changelog

All notable changes to Menu4U are documented here.
Format: [Semantic Versioning](https://semver.org) — Keep a Changelog convention.

---

## [0.2.0] — 2026-06-03

### Added
- **Offline Mode** — Waiter screen queues orders to localStorage when offline and auto-syncs when network returns. Service worker caches the menu API for offline access. Offline indicator badge in the top bar shows pending count and sync status.
- **Course Firing UI** — Fire buttons per course in the active-order panel (waiter floor). Each button shows item count, loading state, and a toast confirmation on success.
- **Numpad PIN modal** — Replaced text password input with a 4-dot indicator + 3×4 numpad grid; auto-confirms on the 4th digit.
- **Course picker in "add more"** — Waiter can select course (ראשון / עיקרי / קינוח) when adding items to an existing order.
- **Split layout in Shift Manager floor tab** — Waitlist sidebar (264px) displayed alongside the floor canvas so managers see both simultaneously.
- **Floor map centering** — `offsetX/offsetY` computed from container size so the canvas stays centered regardless of viewport.

### Changed
- **Table card design** — Dark flat cards (`#0e0c0a`) with colored top stripe, status badge top-left, table number centered, timer/guests right-aligned at bottom. `borderRadius: 10` (always rectangular). Applies to both waiter-floor and shift-manager.
- **ORDER_STATUS_CFG** — Removed radial gradients; replaced with `stripe`, `badge`, `badgeBg`, `label` fields. Colors: free=`#22c55e`, occupied=`#f97316`, bill=`#ef4444`, seated=`#a78bfa` (shift-manager only).
- **Room background textures removed** — BGS patterns no longer rendered on floor maps. Custom `bgImg` still shown if set.
- **Shift Manager legend** — Updated colors to match new status config; added "הושב" (seated) state.

### Fixed
- `BTN(col, true)` helper used `rgba(#hex, 0.15)` — invalid CSS causing all light-mode buttons to be transparent with no border. Fixed to hex alpha suffix (`col + "26"` / `col + "66"`).
- Toast position in RTL: was `right: "50%", translateX(50%)` → fixed to `left: "50%", translateX(-50%)`.
- Pre-existing TypeScript errors in unrelated files (`backup/route.ts`, `MenuElegantClient.tsx`) — not introduced by this release.

---

## [0.1.0] — 2026-05-01

### Added
- **Layout Builder v2** — Full drag-and-drop floor plan editor. Multi-room support, table shapes, decorations (lines, labels, images), undo/redo, auto-save, export/import JSON, zoom/pan, fullscreen, sidebar pin.
- **Waiter Floor screen** (`/admin/waiter-floor`) — Floor map view for waiters. Select table → new order or active order panel. Add items from menu, per-item notes, submit to kitchen.
- **Shift Manager screen** (`/admin/shift-manager`) — Tabs: Floor map, Status grid, 86 items, Waitlist seating. Real-time SSE updates.
- **KDS enhancements** — FIRE/HOLD per item, 86 badge, seat count display, waiter alert system.
- **SHIFT_MANAGER role** — New role with scoped permissions. Surfaces in admin permissions screen alongside WAITER role.
- **PIN-protected actions** — Cancel item and Comp item require manager PIN. Comp reason stored and shown in audit log.
- **Audit log** — Records waiter order creation, item cancellations, and comp events with user, IP, and timestamp.
- **Station assignment** — Waiter stations configurable from backoffice.
- **`/api/admin/orders/waiter`** — Waiter-specific order creation endpoint: CONFIRMED directly, prices from DB, `heldUntilFired` for course > 1.
- **`/api/admin/orders/[orderId]/fire-course`** — Fire all held items for a given course number.
