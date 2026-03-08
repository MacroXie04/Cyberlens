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

// SOC light theme tokens
export const socColors = {
  bg: "#ffffff",
  bgCard: "#f8fafc",
  bgCardHover: "#f1f5f9",
  bgPanel: "#f0f4f8",
  border: "#e2e8f0",
  borderActive: "#cbd5e1",
  text: "#1e293b",
  textMuted: "#475569",
  textDim: "#94a3b8",
  accent: "#0284c7",
  accentDim: "#0369a1",
  critical: "#dc2626",
  criticalBg: "rgba(220,38,38,0.08)",
  high: "#ea580c",
  highBg: "rgba(234,88,12,0.08)",
  medium: "#ca8a04",
  mediumBg: "rgba(202,138,4,0.08)",
  low: "#0891b2",
  lowBg: "rgba(8,145,178,0.08)",
  info: "#64748b",
  infoBg: "rgba(100,116,139,0.06)",
  safe: "#16a34a",
  safeBg: "rgba(22,163,74,0.08)",
  p1: "#dc2626",
  p2: "#ea580c",
  p3: "#ca8a04",
  p4: "#94a3b8",
  pulse: "#0284c7",
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
