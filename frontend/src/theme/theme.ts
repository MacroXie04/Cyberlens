// Material You (M3) Design Tokens — Light White Theme

export const colors = {
  primary: "#0B57D0",
  onPrimary: "#FFFFFF",
  primaryContainer: "#D3E3FD",
  onPrimaryContainer: "#041E49",

  surface: "#F8F9FC",
  surfaceContainer: "#F2F5FA",
  surfaceContainerHigh: "#EDF2FA",
  surfaceContainerHighest: "#E6ECF5",
  onSurface: "#1F1F1F",
  onSurfaceVariant: "#5F6368",

  error: "#B3261E",
  warning: "#B06000",
  safe: "#137333",

  outline: "#747775",
  outlineVariant: "#C4C7C5",
} as const;

// SOC light theme tokens
export const socColors = {
  bg: "#f7f9fc",
  bgCard: "#ffffff",
  bgCardHover: "#f6f9fe",
  bgPanel: "#edf2fb",
  border: "#dde3ea",
  borderActive: "#b8c7dd",
  text: "#1f1f1f",
  textMuted: "#49545d",
  textDim: "#6b7280",
  accent: "#0b57d0",
  accentDim: "#0842a0",
  accentSoft: "#e8f0fe",
  critical: "#c5221f",
  criticalBg: "rgba(197,34,31,0.10)",
  high: "#c26401",
  highBg: "rgba(194,100,1,0.10)",
  medium: "#a56a00",
  mediumBg: "rgba(165,106,0,0.10)",
  low: "#0b57d0",
  lowBg: "rgba(11,87,208,0.08)",
  info: "#5f6368",
  infoBg: "rgba(95,99,104,0.08)",
  safe: "#137333",
  safeBg: "rgba(19,115,51,0.10)",
  p1: "#c5221f",
  p2: "#c26401",
  p3: "#a56a00",
  p4: "#7a7f85",
  pulse: "#0b57d0",
  shadow: "0 18px 40px rgba(16, 24, 40, 0.08)",
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
