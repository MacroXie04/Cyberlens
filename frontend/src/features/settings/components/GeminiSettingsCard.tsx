import type { SettingsMessage } from "../types";

interface Props {
  availableModels: string[];
  geminiModel: string;
  inputKey: string;
  keyPreview: string;
  keySet: boolean;
  message: SettingsMessage | null;
  modelLoading: boolean;
  onInputKeyChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onSaveKey: () => void;
  onTestKey: () => void;
  saving: boolean;
  testing: boolean;
}

export default function GeminiSettingsCard({
  availableModels,
  geminiModel,
  inputKey,
  keyPreview,
  keySet,
  message,
  modelLoading,
  onInputKeyChange,
  onModelChange,
  onSaveKey,
  onTestKey,
  saving,
  testing,
}: Props) {
  return (
    <div className="card">
      <h3 style={{ fontSize: 16, fontWeight: 500, color: "var(--md-on-surface)", marginBottom: 4 }}>
        Google Agent Development Kit (ADK)
      </h3>
      <p style={{ fontSize: 13, color: "var(--md-on-surface-variant)", marginBottom: 16 }}>
        Required for AI-powered vulnerability analysis, code security scanning,
        and threat analysis. Uses Gemini via Google ADK.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontSize: 13 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: keySet ? "var(--md-safe)" : "var(--md-error)",
            display: "inline-block",
          }}
        />
        <span style={{ color: "var(--md-on-surface-variant)" }}>
          {keySet ? `Configured (${keyPreview})` : "Not configured"}
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="password"
          placeholder="Enter Google API key (AIza...)"
          value={inputKey}
          onChange={(event) => onInputKeyChange(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && onSaveKey()}
          style={inputStyle}
        />
        <button onClick={onSaveKey} disabled={saving || !inputKey.trim()} style={primaryButton(saving || !inputKey.trim())}>
          {saving ? "Saving..." : keySet ? "Update Key" : "Save Key"}
        </button>
        {keySet ? (
          <button onClick={onTestKey} disabled={testing} style={secondaryButton(testing)}>
            {testing ? "Testing..." : "Test Key"}
          </button>
        ) : null}
      </div>
      {keySet ? (
        <div style={{ marginTop: 16 }}>
          <label style={labelStyle}>Gemini Model</label>
          <select
            value={geminiModel}
            onChange={(event) => onModelChange(event.target.value)}
            disabled={modelLoading}
            style={selectStyle(modelLoading)}
          >
            <option value="">Default (gemini-2.5-flash)</option>
            {availableModels.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {message ? (
        <div style={messageStyle(message.error)}>
          {message.text}
        </div>
      ) : null}
    </div>
  );
}

const inputStyle = {
  flex: 1,
  minWidth: 0,
  padding: "10px 14px",
  borderRadius: "var(--md-radius-button)",
  border: "1px solid var(--md-outline-variant)",
  background: "var(--md-surface-container-high)",
  color: "var(--md-on-surface)",
  fontSize: 14,
  fontFamily: "var(--md-font-mono)",
  outline: "none",
} as const;

const labelStyle = {
  display: "block",
  fontSize: 13,
  fontWeight: 500,
  color: "var(--md-on-surface-variant)",
  marginBottom: 6,
} as const;

function primaryButton(disabled: boolean) {
  return {
    padding: "10px 24px",
    borderRadius: "var(--md-radius-button)",
    border: "none",
    background: disabled ? "var(--md-surface-container-high)" : "var(--md-primary)",
    color: disabled ? "var(--md-on-surface-variant)" : "var(--md-on-primary)",
    fontWeight: 500,
    fontSize: 14,
    cursor: disabled ? "default" : "pointer",
    whiteSpace: "nowrap",
  } as const;
}

function secondaryButton(disabled: boolean) {
  return {
    padding: "10px 24px",
    borderRadius: "var(--md-radius-button)",
    border: "1px solid var(--md-outline-variant)",
    background: "transparent",
    color: "var(--md-on-surface)",
    fontWeight: 500,
    fontSize: 14,
    cursor: disabled ? "wait" : "pointer",
    opacity: disabled ? 0.6 : 1,
    whiteSpace: "nowrap",
  } as const;
}

function selectStyle(disabled: boolean) {
  return {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "var(--md-radius-button)",
    border: "1px solid var(--md-outline-variant)",
    background: "var(--md-surface-container-high)",
    color: "var(--md-on-surface)",
    fontSize: 14,
    outline: "none",
    cursor: disabled ? "wait" : "pointer",
  } as const;
}

function messageStyle(error: boolean) {
  return {
    marginTop: 12,
    padding: "8px 12px",
    borderRadius: 8,
    fontSize: 13,
    background: error ? "rgba(239, 83, 80, 0.1)" : "rgba(129, 199, 132, 0.1)",
    color: error ? "var(--md-error)" : "var(--md-safe)",
  } as const;
}
