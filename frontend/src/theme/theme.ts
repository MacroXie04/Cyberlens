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
