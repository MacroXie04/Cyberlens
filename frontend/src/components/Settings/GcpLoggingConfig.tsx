import { useState, useEffect } from "react";
import { getGcpSettings, updateGcpSettings } from "../../services/api";
import type { GcpSettings } from "../../types";

export default function GcpLoggingConfig() {
  const [settings, setSettings] = useState<GcpSettings | null>(null);
  const [projectId, setProjectId] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [region, setRegion] = useState("us-central1");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    getGcpSettings()
      .then((data) => {
        setSettings(data);
        setProjectId(data.gcp_project_id);
        setServiceName(data.gcp_service_name);
        setRegion(data.gcp_region || "us-central1");
      })
      .catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const data = await updateGcpSettings({
        gcp_project_id: projectId.trim(),
        gcp_service_name: serviceName.trim(),
        gcp_region: region.trim(),
      });
      setSettings(data);
      setMessage({ text: "GCP settings saved", error: false });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Failed to save", error: true });
    } finally {
      setSaving(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    setMessage(null);
    try {
      const text = await file.text();
      // Validate it's JSON
      JSON.parse(text);
      const data = await updateGcpSettings({ gcp_service_account_key: text });
      setSettings(data);
      setMessage({ text: "Service account key uploaded", error: false });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Invalid JSON file", error: true });
    } finally {
      setSaving(false);
      e.target.value = "";
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "var(--md-radius-button)",
    border: "1px solid var(--md-outline-variant)",
    background: "var(--md-surface-container-high)",
    color: "var(--md-on-surface)",
    fontSize: 14,
    fontFamily: "var(--md-font-mono)",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 13,
    fontWeight: 500,
    color: "var(--md-on-surface-variant)",
    marginBottom: 4,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label style={labelStyle}>GCP Project ID</label>
        <input
          type="text"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          placeholder="my-project-123"
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Cloud Run Service Name</label>
        <input
          type="text"
          value={serviceName}
          onChange={(e) => setServiceName(e.target.value)}
          placeholder="cyberlens-backend"
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Region</label>
        <input
          type="text"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          placeholder="us-central1"
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>
          Service Account Key (JSON)
          {settings?.gcp_service_account_key_set && (
            <span style={{ color: "var(--md-safe)", fontWeight: 400, marginLeft: 8 }}>
              Uploaded
            </span>
          )}
        </label>
        <input
          type="file"
          accept=".json"
          onChange={handleFileUpload}
          style={{
            ...inputStyle,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        />
        <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", marginTop: 4 }}>
          Live Monitor also needs <code>roles/run.viewer</code> and{" "}
          <code>roles/monitoring.viewer</code> for service discovery and health metrics.
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !projectId.trim() || !serviceName.trim()}
        style={{
          padding: "10px 24px",
          borderRadius: "var(--md-radius-button)",
          border: "none",
          background:
            saving || !projectId.trim() || !serviceName.trim()
              ? "var(--md-surface-container-high)"
              : "var(--md-primary)",
          color:
            saving || !projectId.trim() || !serviceName.trim()
              ? "var(--md-on-surface-variant)"
              : "var(--md-on-primary)",
          fontWeight: 500,
          fontSize: 14,
          cursor: saving || !projectId.trim() || !serviceName.trim() ? "default" : "pointer",
          alignSelf: "flex-start",
        }}
      >
        {saving ? "Saving..." : "Save GCP Settings"}
      </button>

      {message && (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            fontSize: 13,
            background: message.error ? "rgba(239, 83, 80, 0.1)" : "rgba(129, 199, 132, 0.1)",
            color: message.error ? "var(--md-error)" : "var(--md-safe)",
          }}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
