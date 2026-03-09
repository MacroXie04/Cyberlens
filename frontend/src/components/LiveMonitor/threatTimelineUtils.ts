import { socColors } from "../../theme/theme";

export const severityColor: Record<string, string> = {
  p1: socColors.critical,
  p2: socColors.high,
  p3: socColors.medium,
  p4: socColors.textDim,
  critical: socColors.critical,
  high: socColors.high,
  medium: socColors.medium,
  low: socColors.low,
  info: socColors.info,
};

export function formatTick(value: string) {
  try {
    const date = new Date(value);
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
  } catch {
    return value;
  }
}

export function formatTooltipLabel(value: string) {
  try {
    return new Date(value).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}
