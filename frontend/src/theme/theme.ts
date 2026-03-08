// Material You (M3) Design Tokens — Light White Theme

export const colors = {
  primary: "#00838F",
  onPrimary: "#FFFFFF",
  primaryContainer: "#B2EBF2",
  onPrimaryContainer: "#004F54",

  surface: "#FAFAFA",
  surfaceContainer: "#F5F5F5",
  surfaceContainerHigh: "#EEEEEE",
  surfaceContainerHighest: "#E0E0E0",
  onSurface: "#1C1C1E",
  onSurfaceVariant: "#5C5C5E",

  error: "#C62828",
  warning: "#F9A825",
  safe: "#2E7D32",

  outline: "#757575",
  outlineVariant: "#BDBDBD",
} as const;

// SOC dark theme tokens
export const socColors = {
  bg: "#0a0e17",
  bgCard: "#111827",
  bgCardHover: "#1a2236",
  bgPanel: "#0d1321",
  border: "#1e293b",
  borderActive: "#334155",
  text: "#e2e8f0",
  textMuted: "#94a3b8",
  textDim: "#64748b",
  accent: "#38bdf8",
  accentDim: "#0ea5e9",
  critical: "#ef4444",
  criticalBg: "rgba(239,68,68,0.12)",
  high: "#f97316",
  highBg: "rgba(249,115,22,0.12)",
  medium: "#eab308",
  mediumBg: "rgba(234,179,8,0.12)",
  low: "#22d3ee",
  lowBg: "rgba(34,211,238,0.08)",
  info: "#64748b",
  infoBg: "rgba(100,116,139,0.1)",
  safe: "#22c55e",
  safeBg: "rgba(34,197,94,0.1)",
  p1: "#ef4444",
  p2: "#f97316",
  p3: "#eab308",
  p4: "#94a3b8",
  pulse: "#38bdf8",
} as const;

export const radius = {
  card: "28px",
  chip: "20px",
  listItem: "16px",
  button: "12px",
} as const;

export const typography = {
  fontDisplay: "'Google Sans', 'Helvetica Neue', sans-serif",
  fontBody: "'Google Sans', 'Helvetica Neue', sans-serif",
  fontMono: "'Noto Sans Mono', 'Courier New', monospace",
} as const;

// Inject CSS custom properties into the document
export function applyTheme(): void {
  const root = document.documentElement;

  Object.entries(colors).forEach(([key, value]) => {
    root.style.setProperty(`--md-${camelToKebab(key)}`, value);
  });

  Object.entries(radius).forEach(([key, value]) => {
    root.style.setProperty(`--md-radius-${key}`, value);
  });

  Object.entries(typography).forEach(([key, value]) => {
    root.style.setProperty(`--md-${camelToKebab(key)}`, value);
  });
}

function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}
