import React from "react";

interface Props {
  mode: "chat" | "solve";
  onChange: (updates: { mode: "chat" | "solve" }) => void;
}

/**
 * AI Drop-in — deprecated in v1.6.6. The inline textarea + "Type a problem"
 * input previously dropped on the floor: neither had a value/onChange or an
 * Enter-to-send handler. Rather than silently eat user input we now render
 * a clear placeholder pointing to the right panel (Panel + ChatPanel),
 * which is where the real AI flow lives. Kept so pages saved before v1.6.6
 * still load; the factory is no longer surfaced in the context menu.
 */
export default function AIDropin({ mode, onChange }: Props) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      fontSize: "12px", padding: "12px", gap: "10px",
      background: "var(--nm-faceplate)", boxSizing: "border-box",
    }}>
      <div style={{ fontWeight: 700, fontSize: "11px", color: "var(--nm-accent)", letterSpacing: "0.05em" }}>
        AI DROP-IN (DEPRECATED)
      </div>
      <div style={{ fontSize: "11px", color: "#666", lineHeight: 1.4 }}>
        The AI chat + solve flow now lives in the right panel. Use the panel
        toggle or the keyboard shortcut to open it — this drop-in is kept
        only so older pages still load.
      </div>
      <div style={{ display: "flex", gap: "4px" }}>
        <button
          onClick={() => onChange({ mode: "solve" })}
          style={{
            flex: 1, padding: "6px", border: "1px solid #E0E0E0", borderRadius: "4px",
            cursor: "pointer", fontSize: "12px", fontWeight: mode === "solve" ? 700 : 400,
            background: mode === "solve" ? "var(--nm-accent)" : "var(--nm-faceplate)",
            color: mode === "solve" ? "#fff" : "var(--nm-ink)",
          }}
        >Solve</button>
        <button
          onClick={() => onChange({ mode: "chat" })}
          style={{
            flex: 1, padding: "6px", border: "1px solid #E0E0E0", borderRadius: "4px",
            cursor: "pointer", fontSize: "12px", fontWeight: mode === "chat" ? 700 : 400,
            background: mode === "chat" ? "var(--nm-accent)" : "var(--nm-faceplate)",
            color: mode === "chat" ? "#fff" : "var(--nm-ink)",
          }}
        >Chat</button>
      </div>
      <div style={{ fontSize: "11px", color: "#999", marginTop: "auto" }}>
        Mode preference is still saved for legacy pages.
      </div>
    </div>
  );
}
