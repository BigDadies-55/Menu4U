/**
 * Menu4U — Design System
 *
 * Single source of truth for colors, typography, spacing, and component styles.
 * Every admin page imports from here — never define local C/D/colors objects.
 *
 * Usage:
 *   import { T, btn, inp, card, badge } from "@/lib/ui";
 *   <div style={{ background: T.bg, color: T.text }}>
 *   <button style={btn("primary")}>שלח</button>
 */

import type { CSSProperties } from "react";

// ─────────────────────────────────────────────
// TOKENS — core design values
// ─────────────────────────────────────────────

export const T = {
  // Backgrounds — resolved via CSS variables so palettes work
  bg:      "var(--c-bg)",
  surface: "var(--c-surface)",
  panel:   "var(--c-panel)",
  raised:  "var(--c-raised)",
  overlay: "var(--c-overlay)",

  border:    "var(--c-border)",
  borderSub: "var(--c-border-sub)",

  text:  "var(--c-text)",
  sub:   "var(--c-sub)",
  muted: "var(--c-muted)",

  gold:    "var(--c-gold)",
  goldSub: "var(--c-gold-sub)",

  // Semantic colors — hardcoded, look fine on all palettes
  green:    "#22c55e",
  greenSub: "rgba(34,197,94,0.12)",
  orange:   "#f97316",
  orangeSub:"rgba(249,115,22,0.12)",
  red:      "#ef4444",
  redSub:   "rgba(239,68,68,0.12)",
  blue:     "#3b82f6",
  blueSub:  "rgba(59,130,246,0.12)",
  purple:   "#a855f7",
  purpleSub:"rgba(168,85,247,0.12)",
  purpleGlow:"rgba(168,85,247,0.45)",
  yellow:   "#facc15",
  yellowSub:"rgba(250,204,21,0.12)",
  cyan:     "#22d3ee",
  cyanSub:  "rgba(34,211,238,0.12)",
  cyanGlow: "rgba(34,211,238,0.4)",
  rose:     "#fb7185",
  roseSub:  "rgba(251,113,133,0.12)",
  roseGlow: "rgba(251,113,133,0.45)",
  emerald:  "#34d399",
  emeraldSub:"rgba(52,211,153,0.12)",
  emeraldGlow:"rgba(52,211,153,0.45)",
  amber:    "#fbbf24",
  amberGlow:"rgba(251,191,36,0.45)",

  // Neon / template palette
  bgNeon:      "#060610",
  glass:       "rgba(255,255,255,0.055)",
  glassHover:  "rgba(255,255,255,0.10)",
  glassBorder: "rgba(255,255,255,0.10)",
  glassBorderBright:"rgba(255,255,255,0.22)",

  // Radius
  rSm:  4,
  rMd:  8,
  rLg:  12,
  rXl:  16,
  rFull:9999,

  // Typography
  fxs:   10,
  fsm:   11,
  fmd:   13,
  flg:   15,
  fxl:   18,
  f2xl:  22,
  f3xl:  32,

  // Spacing
  p1: 4,
  p2: 8,
  p3: 12,
  p4: 16,
  p5: 24,

  fontSans: "var(--font-geist-sans), Arial, Helvetica, sans-serif",
  fontMono: "var(--font-geist-mono), 'Courier New', monospace",
} as const;

// ─────────────────────────────────────────────
// PALETTE DEFINITIONS
// ─────────────────────────────────────────────

export const ADMIN_PALETTES: Record<string, Record<string, string>> = {
  dark: {
    "--c-bg":         "#0c0c0c",
    "--c-surface":    "#161616",
    "--c-panel":      "#1e1e1e",
    "--c-raised":     "#2a2826",
    "--c-overlay":    "#242220",
    "--c-border":     "rgba(255,255,255,0.08)",
    "--c-border-sub": "rgba(255,255,255,0.04)",
    "--c-text":       "#f0ece6",
    "--c-sub":        "#c8bfb0",
    "--c-muted":      "#7a7268",
    "--c-gold":       "#c9890a",
    "--c-gold-sub":   "rgba(201,137,10,0.15)",
    "--c-sidebar-from": "#050505",
    "--c-sidebar-mid":  "#161616",
    "--c-sidebar-to":   "#26200e",
  },
  "warm-light": {
    "--c-bg":         "#eeeae2",
    "--c-surface":    "#f8f5ef",
    "--c-panel":      "#f0ebe0",
    "--c-raised":     "#e8e0d0",
    "--c-overlay":    "#ece8de",
    "--c-border":     "rgba(60,45,20,0.10)",
    "--c-border-sub": "rgba(60,45,20,0.05)",
    "--c-text":       "#1c1710",
    "--c-sub":        "#5a5048",
    "--c-muted":      "#a09484",
    "--c-gold":       "#4a7c8c",
    "--c-gold-sub":   "rgba(74,124,140,0.12)",
    "--c-sidebar-from": "#d8d2c6",
    "--c-sidebar-mid":  "#dfd8cc",
    "--c-sidebar-to":   "#ece6da",
  },
  "earth-life": {
    "--c-bg":         "#f6f0e6",
    "--c-surface":    "#ffffff",
    "--c-panel":      "#fdf8f0",
    "--c-raised":     "#f0e8d8",
    "--c-overlay":    "#f8f4ec",
    "--c-border":     "rgba(120,80,30,0.12)",
    "--c-border-sub": "rgba(120,80,30,0.06)",
    "--c-text":       "#2c1f0e",
    "--c-sub":        "#7a6245",
    "--c-muted":      "#b09878",
    "--c-gold":       "#8c6820",
    "--c-gold-sub":   "rgba(140,104,32,0.12)",
    "--c-sidebar-from": "#fdf8f0",
    "--c-sidebar-mid":  "#fdf8f0",
    "--c-sidebar-to":   "#f0e8d8",
  },
  earthy: {
    "--c-bg":         "#f5ede0",
    "--c-surface":    "#fdf8f0",
    "--c-panel":      "#f0e4d0",
    "--c-raised":     "#ddd0bc",
    "--c-overlay":    "#f0e8d8",
    "--c-border":     "rgba(100,55,20,0.12)",
    "--c-border-sub": "rgba(100,55,20,0.06)",
    "--c-text":       "#1e0e08",
    "--c-sub":        "#6b4a30",
    "--c-muted":      "#9a7050",
    "--c-gold":       "#65011b",
    "--c-gold-sub":   "rgba(101,1,27,0.12)",
    "--c-sidebar-from": "#1a0a06",
    "--c-sidebar-mid":  "#2d1010",
    "--c-sidebar-to":   "#4a1020",
  },
};

export const ADMIN_PALETTE_LABELS: Record<string, string> = {
  dark:         "כהה קלאסי",
  "warm-light": "בהיר נעים",
  "earth-life": "אדמה וחיים",
  earthy:       "אורגני יוקרתי",
};

// ─────────────────────────────────────────────
// STATUS CONFIG — table / order states
// ─────────────────────────────────────────────

export const STATUS = {
  free: {
    stripe: T.green,  badge: T.green,  badgeBg: T.greenSub,
    border: "#1e5c1e", glow: "rgba(34,197,94,0.10)", label: "פנוי",
  },
  occupied: {
    stripe: T.orange, badge: T.orange, badgeBg: T.orangeSub,
    border: "#7a4a00", glow: "rgba(249,115,22,0.10)", label: "תפוס",
  },
  "bill-requested": {
    stripe: T.red,    badge: T.red,    badgeBg: T.redSub,
    border: "#6b1414", glow: "rgba(239,68,68,0.10)", label: "חשבון",
  },
  seated: {
    stripe: T.purple, badge: T.purple, badgeBg: T.purpleSub,
    border: "#4a2080", glow: "rgba(124,58,237,0.08)", label: "הושב",
  },
} as const;

export type StatusKey = keyof typeof STATUS;

// ─────────────────────────────────────────────
// COMPONENT HELPERS
// ─────────────────────────────────────────────

type BtnVariant = "primary" | "danger" | "success" | "ghost" | "warning" | "info";

const BTN_CFG: Record<BtnVariant, { bg: string; color: string; border?: string }> = {
  primary: { bg: "var(--c-gold)",   color: "#fff" },
  danger:  { bg: T.red,    color: "#fff" },
  success: { bg: T.green,  color: "#000" },
  warning: { bg: T.orange, color: "#fff" },
  info:    { bg: T.blue,   color: "#fff" },
  ghost:   { bg: "transparent", color: "var(--c-sub)", border: "var(--c-border)" },
};

/** Solid button styles */
export function btn(variant: BtnVariant = "primary", size: "sm" | "md" | "lg" = "md"): CSSProperties {
  const cfg = BTN_CFG[variant];
  const pad = size === "sm" ? "4px 10px" : size === "lg" ? "12px 28px" : "8px 18px";
  const fs  = size === "sm" ? T.fsm : size === "lg" ? T.flg : T.fmd;
  return {
    background:  cfg.bg,
    color:       cfg.color,
    border:      cfg.border ? `1px solid ${cfg.border}` : "none",
    borderRadius: T.rMd,
    padding:     pad,
    fontSize:    fs,
    fontWeight:  700,
    cursor:      "pointer",
    lineHeight:  1.4,
    display:     "inline-flex",
    alignItems:  "center",
    gap:         6,
  };
}

/** Ghost/outline button (translucent fill) */
export function btnGhost(color: string, size: "sm" | "md" | "lg" = "md"): CSSProperties {
  const pad = size === "sm" ? "3px 10px" : size === "lg" ? "10px 24px" : "6px 16px";
  const fs  = size === "sm" ? T.fsm : size === "lg" ? T.flg : T.fmd;
  const isVar = color.startsWith("var(");
  const bg     = isVar ? `color-mix(in srgb, ${color} 13%, transparent)` : color + "22";
  const border = isVar ? `color-mix(in srgb, ${color} 33%, transparent)` : color + "55";
  return {
    background:   bg,
    color,
    border:       `1px solid ${border}`,
    borderRadius: T.rMd,
    padding:      pad,
    fontSize:     fs,
    fontWeight:   700,
    cursor:       "pointer",
    lineHeight:   1.4,
    display:      "inline-flex",
    alignItems:   "center",
    gap:          6,
  };
}

/** Input / textarea base style */
export const inp: CSSProperties = {
  background:   "var(--c-overlay)",
  border:       "1px solid var(--c-border)",
  borderRadius: T.rMd,
  color:        "var(--c-text)",
  fontSize:     T.fmd,
  padding:      "7px 10px",
  width:        "100%",
  outline:      "none",
  fontFamily:   "inherit",
};

/** Card container */
export function card(elevated = false): CSSProperties {
  return {
    background:   elevated ? "var(--c-raised)" : "var(--c-surface)",
    border:       "1px solid var(--c-border)",
    borderRadius: T.rLg,
  };
}

/** Small status/label badge */
export function badge(color: string): CSSProperties {
  const isVar = color.startsWith("var(");
  return {
    background:   isVar ? `color-mix(in srgb, ${color} 13%, transparent)` : color + "20",
    border:       `1px solid ${isVar ? `color-mix(in srgb, ${color} 27%, transparent)` : color + "44"}`,
    borderRadius: T.rFull,
    color,
    fontSize:     T.fxs,
    fontWeight:   700,
    padding:      "1px 8px",
    lineHeight:   "18px",
    whiteSpace:   "nowrap" as const,
    display:      "inline-block",
  };
}

/** Chip / tag (slightly larger than badge) */
export function chip(color: string, active = false): CSSProperties {
  const isVar = color.startsWith("var(");
  return {
    background:   active ? color : (isVar ? `color-mix(in srgb, ${color} 9%, transparent)` : color + "18"),
    color:        active ? "#000" : color,
    border:       `1px solid ${active ? color : (isVar ? `color-mix(in srgb, ${color} 27%, transparent)` : color + "44")}`,
    borderRadius: T.rFull,
    padding:      "4px 12px",
    fontSize:     T.fmd,
    fontWeight:   600,
    cursor:       "pointer",
    whiteSpace:   "nowrap" as const,
  };
}

/** Modal backdrop */
export const backdrop: CSSProperties = {
  position: "fixed",
  inset:    0,
  zIndex:   999,
  background: "rgba(0,0,0,0.72)",
  display:  "flex",
  alignItems: "center",
  justifyContent: "center",
};

/** Modal box */
export function modal(width = 360): CSSProperties {
  return {
    ...card(),
    padding:  T.p5,
    width,
    maxWidth: "90vw",
    direction: "rtl" as const,
    boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
  };
}

// ─────────────────────────────────────────────
// TYPOGRAPHY HELPERS
// ─────────────────────────────────────────────

export const heading: CSSProperties = {
  fontSize:   T.fxl,
  fontWeight: 800,
  color:      "var(--c-gold)",
  lineHeight: 1.2,
};

export const label: CSSProperties = {
  fontSize:   T.fsm,
  fontWeight: 600,
  color:      "var(--c-sub)",
  letterSpacing: "0.04em",
};

// ─────────────────────────────────────────────
// LAYOUT CONSTANTS
// ─────────────────────────────────────────────

export const TOPBAR_H = 56; // px
export const SIDEBAR_W = 264; // px
