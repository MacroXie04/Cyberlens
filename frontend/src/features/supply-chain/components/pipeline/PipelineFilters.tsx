import { FilterSelect } from "../PipelineUi";

interface Props {
  kindFilter: string;
  phaseFilter: string;
  phaseOptions: Array<{ value: string; label: string }>;
  statusFilter: string;
  onKindFilterChange: (value: string) => void;
  onPhaseFilterChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
}

export default function PipelineFilters({
  kindFilter,
  phaseFilter,
  phaseOptions,
  statusFilter,
  onKindFilterChange,
  onPhaseFilterChange,
  onStatusFilterChange,
}: Props) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <FilterSelect label="Phase" value={phaseFilter} onChange={onPhaseFilterChange} options={[{ value: "all", label: "All phases" }, ...phaseOptions]} />
        <FilterSelect label="Kind" value={kindFilter} onChange={onKindFilterChange} options={[{ value: "all", label: "All kinds" }, { value: "stage_started", label: "Stage Started" }, { value: "stage_completed", label: "Stage Completed" }, { value: "llm_partial", label: "LLM Partial" }, { value: "llm_completed", label: "LLM Completed" }, { value: "artifact_created", label: "Artifact Created" }, { value: "metric", label: "Metric" }, { value: "warning", label: "Warning" }, { value: "error", label: "Error" }]} />
        <FilterSelect label="Status" value={statusFilter} onChange={onStatusFilterChange} options={[{ value: "all", label: "All statuses" }, { value: "running", label: "Running" }, { value: "success", label: "Success" }, { value: "warning", label: "Warning" }, { value: "error", label: "Error" }]} />
      </div>
    </div>
  );
}
