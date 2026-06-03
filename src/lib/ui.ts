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
  // Backgrounds (dark → light)
  bg:       "#0a0402",   // page background
  surface:  "#160805",   // card / panel base
  panel:    "#1a0c06",   // topbar / sidebar surface
  raised:   "#1e1008",   // elevated surface (nested cards)
  overlay:  "#2a1408",   // input background, deep overlays

  // Borders
  border:   "rgba(212,160,23,0.18)",
  borderSub:"rgba(212,160,23,0.08)",

  // Text
  text:     "#f0e6d3",   // primary
  sub:      "#c4a882",   // secondary / labels
  muted:    "#7a6050",   // placeholder / disabled

  // Brand accent
  gold:     "#d4a017",
  goldSub:  "rgba(212,160,23,0.15)",

  // Semantic colors
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
  bgNeon:      "#060610",           // deep space bg for template screens
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
} as const;

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
  primary: { bg: T.gold,   color: "#000" },
  danger:  { bg: T.red,    color: "#fff" },
  success: { bg: T.green,  color: "#000" },
  warning: { bg: T.orange, color: "#fff" },
  info:    { bg: T.blue,   color: "#fff" },
  ghost:   { bg: "transparent", color: T.sub, border: T.border },
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
  return {
    background:   color + "22",
    color,
    border:       `1px solid ${color}55`,
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
  background:   T.overlay,
  border:       `1px solid rgba(212,160,23,0.25)`,
  borderRadius: T.rMd,
  color:        T.text,
  fontSize:     T.fmd,
  padding:      "7px 10px",
  width:        "100%",
  outline:      "none",
  fontFamily:   "inherit",
};

/** Card container */
export function card(elevated = false): CSSProperties {
  return {
    background:   elevated ? T.raised : T.surface,
    border:       `1px solid ${T.border}`,
    borderRadius: T.rLg,
  };
}

/** Small status/label badge */
export function badge(color: string): CSSProperties {
  return {
    background:   color + "20",
    border:       `1px solid ${color}44`,
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
  return {
    background:   active ? color : color + "18",
    color:        active ? "#000" : color,
    border:       `1px solid ${active ? color : color + "44"}`,
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
  color:      T.gold,
  lineHeight: 1.2,
};

export const label: CSSProperties = {
  fontSize:   T.fsm,
  fontWeight: 600,
  color:      T.sub,
  letterSpacing: "0.04em",
};

// ─────────────────────────────────────────────
// LAYOUT CONSTANTS
// ─────────────────────────────────────────────

export const TOPBAR_H = 56; // px
export const SIDEBAR_W = 264; // px
