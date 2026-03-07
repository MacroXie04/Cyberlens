// Material You (M3) Design Tokens — Dark Cybersecurity Theme

export const colors = {
  primary: "#00BCD4",
  onPrimary: "#003738",
  primaryContainer: "#004F51",
  onPrimaryContainer: "#6FF7FF",

  surface: "#0E1415",
  surfaceContainer: "#121C1E",
  surfaceContainerHigh: "#1C2729",
  surfaceContainerHighest: "#263233",
  onSurface: "#E0E3E3",
  onSurfaceVariant: "#BFC8CA",

  error: "#EF5350",
  warning: "#FFD54F",
  safe: "#81C784",

  outline: "#899294",
  outlineVariant: "#3F4849",
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
