export type PaletteVars = {
  gold: string;
  goldLight: string;
  goldDark: string;
  goldRgb: string;
  bg: string;
  bgCard: string;
  bgTile: string;
  headerFrom: string;
  headerTo: string;
  headerBorder: string;
  headerText: string;
};

export type ThemePalette = {
  id: string;
  name: string;
  color: string;
  vars: PaletteVars;
};

export const MENU_PALETTES: Record<string, ThemePalette[]> = {
  luxury: [
    { id: '0', name: 'זהב',   color: '#c9a35d', vars: { gold: '#c9a35d', goldLight: '#e0c084', goldDark: '#8b6f3e', goldRgb: '201, 163, 93',  bg: '#0a0a0a', bgCard: '#1a1a1a', bgTile: '#0d0d0d', headerFrom: '#b89868', headerTo: '#c9a878', headerBorder: '#7a5f33', headerText: '#2a1f0f' } },
    { id: '1', name: 'כסף',   color: '#94a3b8', vars: { gold: '#94a3b8', goldLight: '#bdd1e6', goldDark: '#607080', goldRgb: '148, 163, 184', bg: '#080b10', bgCard: '#10151e', bgTile: '#0a0d14', headerFrom: '#253045', headerTo: '#2e3c58', headerBorder: '#3a5070', headerText: '#b8cce0' } },
    { id: '2', name: 'רוזה',  color: '#c98080', vars: { gold: '#c98080', goldLight: '#e8a8a0', goldDark: '#8b5050', goldRgb: '201, 128, 128', bg: '#0c0808', bgCard: '#1a1212', bgTile: '#0e0a0a', headerFrom: '#804848', headerTo: '#985858', headerBorder: '#6a3535', headerText: '#f0d5d5' } },
    { id: '3', name: 'ירקן',  color: '#5aba90', vars: { gold: '#5aba90', goldLight: '#80d4b0', goldDark: '#347860', goldRgb: '90, 186, 144',  bg: '#050e0b', bgCard: '#0f1c18', bgTile: '#091410', headerFrom: '#1e4535', headerTo: '#255040', headerBorder: '#2d6a4a', headerText: '#c0f0e0' } },
  ],
  fresh: [
    { id: '0', name: 'ענבר',  color: '#f59e0b', vars: { gold: '#f59e0b', goldLight: '#fbbf24', goldDark: '#d97706', goldRgb: '245, 158, 11',  bg: '#1a1a1a', bgCard: '#222222', bgTile: '#181818', headerFrom: '#2a2a2a', headerTo: '#333333', headerBorder: '#f59e0b', headerText: '#f59e0b' } },
    { id: '1', name: 'כחול',  color: '#3b82f6', vars: { gold: '#3b82f6', goldLight: '#60a5fa', goldDark: '#1d4ed8', goldRgb: '59, 130, 246',  bg: '#101624', bgCard: '#181f30', bgTile: '#0e1520', headerFrom: '#1a253a', headerTo: '#1e2e4a', headerBorder: '#3b82f6', headerText: '#60a5fa' } },
    { id: '2', name: 'ליים',  color: '#a3e635', vars: { gold: '#a3e635', goldLight: '#bef264', goldDark: '#65a30d', goldRgb: '163, 230, 53',  bg: '#111a10', bgCard: '#182416', bgTile: '#0f1a0d', headerFrom: '#1a2818', headerTo: '#202e1e', headerBorder: '#a3e635', headerText: '#a3e635' } },
    { id: '3', name: 'אדום',  color: '#e53e3e', vars: { gold: '#e53e3e', goldLight: '#fc6868', goldDark: '#c53030', goldRgb: '229, 62, 62',   bg: '#1a1010', bgCard: '#221414', bgTile: '#181010', headerFrom: '#2a1818', headerTo: '#332020', headerBorder: '#e53e3e', headerText: '#fc6868' } },
  ],
  nature: [
    { id: '0', name: 'יער',     color: '#4ade80', vars: { gold: '#4ade80', goldLight: '#86efac', goldDark: '#15803d', goldRgb: '74, 222, 128',  bg: '#030f06', bgCard: '#0a1f0d', bgTile: '#071508', headerFrom: '#0f3518', headerTo: '#133d1e', headerBorder: '#1e5c2d', headerText: '#86efac' } },
    { id: '1', name: 'ים',      color: '#38bdf8', vars: { gold: '#38bdf8', goldLight: '#7dd3fc', goldDark: '#0284c7', goldRgb: '56, 189, 248',  bg: '#050d18', bgCard: '#0e1f33', bgTile: '#0a1826', headerFrom: '#0c2a4a', headerTo: '#0e3358', headerBorder: '#1a4a7a', headerText: '#7dd3fc' } },
    { id: '2', name: 'חרסינה', color: '#d4795a', vars: { gold: '#d4795a', goldLight: '#f0a07a', goldDark: '#b45a3a', goldRgb: '212, 121, 90',  bg: '#120a08', bgCard: '#1e120e', bgTile: '#170d0a', headerFrom: '#3a1a10', headerTo: '#4a2018', headerBorder: '#7a3a28', headerText: '#f0c0a0' } },
    { id: '3', name: 'לבנדר', color: '#a78bfa', vars: { gold: '#a78bfa', goldLight: '#c4b5fd', goldDark: '#7c3aed', goldRgb: '167, 139, 250', bg: '#0e0815', bgCard: '#180e25', bgTile: '#130b1d', headerFrom: '#2a1845', headerTo: '#321e55', headerBorder: '#5a2890', headerText: '#c4b5fd' } },
  ],
  bold: [
    { id: '0', name: 'ורוד',  color: '#f472b6', vars: { gold: '#f472b6', goldLight: '#f9a8d4', goldDark: '#be185d', goldRgb: '244, 114, 182', bg: '#0f0512', bgCard: '#1f0a25', bgTile: '#160818', headerFrom: '#4a0a5c', headerTo: '#5c0e72', headerBorder: '#7b1fa2', headerText: '#f9a8d4' } },
    { id: '1', name: 'סגול',  color: '#a855f7', vars: { gold: '#a855f7', goldLight: '#d8b4fe', goldDark: '#7e22ce', goldRgb: '168, 85, 247',  bg: '#0c0814', bgCard: '#180e28', bgTile: '#11081e', headerFrom: '#2a1250', headerTo: '#341860', headerBorder: '#6a25a0', headerText: '#d8b4fe' } },
    { id: '2', name: 'ציאן',  color: '#06b6d4', vars: { gold: '#06b6d4', goldLight: '#67e8f9', goldDark: '#0891b2', goldRgb: '6, 182, 212',   bg: '#060e12', bgCard: '#0e1e25', bgTile: '#0a181e', headerFrom: '#0a2535', headerTo: '#0c2e40', headerBorder: '#0e4a60', headerText: '#67e8f9' } },
    { id: '3', name: 'זהב',   color: '#fbbf24', vars: { gold: '#fbbf24', goldLight: '#fde68a', goldDark: '#d97706', goldRgb: '251, 191, 36',  bg: '#0e0e08', bgCard: '#1c1c10', bgTile: '#181810', headerFrom: '#2a2808', headerTo: '#333010', headerBorder: '#6a6010', headerText: '#fde68a' } },
  ],
};

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
function lighten(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
}
function darken(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - amt), g * (1 - amt), b * (1 - amt));
}
function toRgbStr(hex: string): string {
  return hexToRgb(hex).join(', ');
}

export function buildCustomPaletteVars(ac: string, bg: string): PaletteVars {
  return {
    gold: ac,
    goldLight: lighten(ac, 0.22),
    goldDark: darken(ac, 0.32),
    goldRgb: toRgbStr(ac),
    bg,
    bgCard: lighten(bg, 0.09),
    bgTile: lighten(bg, 0.04),
    headerFrom: darken(ac, 0.28),
    headerTo: darken(ac, 0.18),
    headerBorder: darken(ac, 0.35),
    headerText: lighten(bg, 0.85),
  };
}

export function buildPaletteStyle(
  theme: string,
  palette: string,
  paletteData?: string | null
): Record<string, string> {
  let vars: PaletteVars | null = null;

  if (palette === 'custom' && paletteData) {
    try {
      const data = JSON.parse(paletteData) as { ac: string; bg: string };
      vars = buildCustomPaletteVars(data.ac, data.bg);
    } catch { /* ignore */ }
  }

  if (!vars) {
    const idx = parseInt(palette ?? '0') || 0;
    vars = MENU_PALETTES[theme]?.[idx]?.vars ?? null;
  }

  if (!vars) return {};

  return {
    '--gold': vars.gold,
    '--gold-light': vars.goldLight,
    '--gold-dark': vars.goldDark,
    '--gold-rgb': vars.goldRgb,
    '--bg': vars.bg,
    '--bg-card': vars.bgCard,
    '--bg-tile': vars.bgTile,
    '--header-bg': `radial-gradient(ellipse at center top, rgba(255,240,215,0.15) 0%, transparent 70%), linear-gradient(180deg, ${vars.headerFrom} 0%, ${vars.headerTo} 50%, ${vars.headerFrom} 100%)`,
    '--header-border-color': vars.headerBorder,
    '--header-text-color': vars.headerText,
  };
}
