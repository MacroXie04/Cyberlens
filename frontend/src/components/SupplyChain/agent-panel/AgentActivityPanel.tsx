import type { AdkTraceSnapshot, DerivedAgentActivity } from "../../../types";

import AgentActivityOverview from "./AgentActivityOverview";
import AgentActivityRecentEvents from "./AgentActivityRecentEvents";

interface Props {
  adkTrace: AdkTraceSnapshot;
  activity: DerivedAgentActivity;
}

export default function AgentActivityPanel({ adkTrace, activity }: Props) {
  return (
    <div
      className="card"
      style={{
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <AgentActivityOverview adkTrace={adkTrace} activity={activity} />
      <AgentActivityRecentEvents activity={activity} />

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        @media (max-width: 800px) {
          .agent-activity-panel-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
