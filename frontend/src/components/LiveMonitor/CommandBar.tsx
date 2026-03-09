import type { GcpHistoryStatus, LiveMonitorMode } from "../../types";
import { socColors } from "../../theme/theme";

import CommandBarFilters from "./CommandBarFilters";
import CommandBarHeader from "./CommandBarHeader";
import ReplayControls from "./ReplayControls";

interface Props {
  projectId: string;
  mode: LiveMonitorMode;
  historyStatus: GcpHistoryStatus | null;
  selectedRegion: string;
  regions: string[];
  selectedService: string;
  services: string[];
  selectedSource: string;
  selectedSeverity: string;
  timeRange: number;
  socketConnected: boolean;
  lastSync: string | null;
  refreshing?: boolean;
  replayCursor: string | null;
  timelineStart: string | null;
  timelineEnd: string | null;
  playbackSpeed: number;
  isPlaying: boolean;
  onModeChange: (mode: LiveMonitorMode) => void;
  onRegionChange: (value: string) => void;
  onServiceChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onSeverityChange: (value: string) => void;
  onTimeRangeChange: (value: number) => void;
  onRefresh: () => void;
  onReplayCursorChange: (value: string) => void;
  onTogglePlayback: () => void;
  onPlaybackSpeedChange: (value: number) => void;
  onJumpStart: () => void;
  onJumpNow: () => void;
}

export default function CommandBar(props: Props) {
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        padding: "20px 20px 14px",
        background: "linear-gradient(180deg, rgba(247,249,252,0.98) 0%, rgba(247,249,252,0.94) 70%, rgba(247,249,252,0.84) 100%)",
        backdropFilter: "blur(18px)",
        borderBottom: `1px solid ${socColors.border}`,
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(244,247,252,0.98) 100%)",
          border: `1px solid ${socColors.border}`,
          borderRadius: 32,
          padding: 18,
          boxShadow: socColors.shadow,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <CommandBarHeader {...props} />

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <CommandBarFilters {...props} />
          <ReplayControls {...props} />
        </div>
      </div>
    </div>
  );
}
