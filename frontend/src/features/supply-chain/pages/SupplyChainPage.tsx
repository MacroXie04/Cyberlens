import AdkPipelineView from "../../../components/SupplyChain/AdkPipelineView";
import AgentActivityPanel from "../../../components/SupplyChain/agent-panel/AgentActivityPanel";
import AgentRequestLog from "../../../components/SupplyChain/agent-log/AgentRequestLog";
import CodeScanLiveView from "../../../components/SupplyChain/code-scan/CodeScanLiveView";
import CodeSecurityFindings from "../../../components/SupplyChain/code-findings/CodeSecurityFindings";
import DependencyInventory from "../../../components/SupplyChain/inventory/DependencyInventory";
import DependencyList from "../../../components/SupplyChain/dependencies/DependencyList";
import DependencyTree from "../../../components/SupplyChain/dependencies/DependencyTree";
import ScanProgress from "../../../components/SupplyChain/ScanProgress";
import VulnerabilityList from "../../../components/SupplyChain/vulnerabilities/VulnerabilityList";
import AiRemediationReport from "../../../components/SupplyChain/remediation/AiRemediationReport";
import type { SelectedProject } from "../types";
import OverviewTab from "../components/layout/OverviewTab";
import ResultTabs from "../components/layout/ResultTabs";
import ScanHistoryPanel from "../components/layout/ScanHistoryPanel";
import SupplyChainHeader from "../components/layout/SupplyChainHeader";
import { IdleState, InlineScanNotice, NoProjectState } from "../components/layout/SupplyChainStates";
import { useSupplyChainScan } from "../hooks/useSupplyChainScan";

interface Props {
  selectedProject: SelectedProject;
}

export default function SupplyChainPage({ selectedProject }: Props) {
  const state = useSupplyChainScan(selectedProject);
  const vulnerabilitySummary = `C ${state.vulnerabilityCounts.critical} · H ${state.vulnerabilityCounts.high} · M ${state.vulnerabilityCounts.medium} · L ${state.vulnerabilityCounts.low}`;
  const codeSummary = `C ${state.codeCounts.critical} · H ${state.codeCounts.high} · M ${state.codeCounts.medium} · L ${state.codeCounts.low}`;

  if (!selectedProject) return <NoProjectState />;

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="scan-workbench-grid" style={{ display: "grid", gridTemplateColumns: "320px minmax(0, 1fr)", gap: 20, alignItems: "start" }}>
        <ScanHistoryPanel historyLoading={state.historyLoading} scanHistory={state.scanHistory} selectedScanId={state.selectedScanId} onSelect={state.selectHistoryItem} />

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <SupplyChainHeader activeScan={state.activeScan} adkTrace={state.adkTrace} liveCodeFindings={state.codeFindings} scoreColor={state.scoreColor} scanning={state.scanning} selectedHistoryItem={state.selectedHistoryItem} selectedProject={selectedProject} totalVulns={state.totalVulns} activityPhaseLabel={state.activity.phase_label} hasTrace={state.hasTrace} vulnerabilitySummary={vulnerabilitySummary} codeSummary={codeSummary} runScan={state.runScan} />
          {state.scanning && <ScanProgress currentStep={state.scanStep} message={state.scanMessage} />}
          {state.adkTrace && (state.scanning || state.adkTrace.events.length > 0) && <AgentActivityPanel adkTrace={state.adkTrace} activity={state.activity} />}
          {state.codeScanActive && state.scanning && <CodeScanLiveView streamEvents={state.codeScanStreamEvents} agentRequests={state.codeAgentRequests} />}
          {state.isIdle && <IdleState />}

          {(state.activeScan || state.historyLoading || state.detailLoading || state.hasTrace) && (
            <>
              <ResultTabs selected={state.resultTab} onChange={state.setResultTab} dependenciesCount={state.dependencies.length} totalVulns={state.totalVulns} findingsCount={state.codeFindings.length} urgentFindings={state.codeFindings.some((finding) => finding.severity === "critical" || finding.severity === "high")} eventsCount={state.adkTrace?.events.length || 0} hasPipelineError={state.adkTrace?.phases.some((phase) => phase.status === "error")} />
              <div style={{ minHeight: 420 }}>
                {state.detailLoading && !state.activeScan ? <div className="card" style={{ padding: 18, color: "var(--md-on-surface-variant)", fontSize: 13 }}>Loading scan details...</div> : state.resultTab === "overview" ? (
                  <OverviewTab activeScan={state.activeScan} codeSummary={codeSummary} dependencies={state.dependencies} liveCodeFindings={state.codeFindings} report={state.report} vulnerabilitySummary={vulnerabilitySummary} />
                ) : state.resultTab === "dependencies" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{state.activeScan ? <><DependencyInventory dependencies={state.dependencies} /><DependencyTree dependencies={state.dependencies} /><DependencyList dependencies={state.dependencies} /></> : <InlineScanNotice message="No dependency inventory is available for the selected scan." />}</div>
                ) : state.resultTab === "vulnerabilities" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{state.activeScan ? <><VulnerabilityList dependencies={state.dependencies} />{state.report && <AiRemediationReport report={state.report} />}</> : <InlineScanNotice message="No vulnerability results are available for the selected scan." />}</div>
                ) : state.resultTab === "code" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}><AgentRequestLog events={state.codeAgentRequests} loading={state.scanning} />{state.scanning && state.codeFindings.length === 0 && <InlineScanNotice message="Code findings will appear here as verification completes." />}<CodeSecurityFindings findings={state.codeFindings} /></div>
                ) : (
                  <AdkPipelineView snapshot={state.adkTrace} loading={state.adkTraceLoading || state.scanning} scan={state.activeScan} codeScanStreamEvents={state.codeScanStreamEvents} />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`@media (max-width: 1100px) { .scan-workbench-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
