import React from "react";

interface Props {
  mode: "chat" | "solve";
  onChange: (updates: { mode: "chat" | "solve" }) => void;
}

/**
 * AI Drop-in — wrapper that shows Chat/Solve mode toggle.
 * The actual AI chat and solve functionality is provided by the
 * parent NoteometryApp through the existing ChatPanel + Panel components.
 * This drop-in provides a canvas-positionable container for the AI interface.
 */
export default function AIDropin({ mode, onChange }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontSize: "12px" }}>
      {/* Preview section */}
      <div style={{
        padding: "8px", borderBottom: "1px solid #E0E0E0",
        fontSize: "11px", color: "#999", minHeight: "40px",
      }}>
        <div style={{ fontWeight: 600, marginBottom: "4px", color: "var(--nm-ink)" }}>PREVIEW</div>
        <div>Use toolbar lasso + OCR, or type below</div>
      </div>

      {/* Input section */}
      <div style={{ padding: "8px", borderBottom: "1px solid #E0E0E0", flex: 1, minHeight: 0 }}>
        <div style={{ fontWeight: 600, marginBottom: "4px", fontSize: "11px", color: "var(--nm-ink)" }}>INPUT</div>
        <textarea
          placeholder="Type or paste LaTeX, or use READ INK..."
          style={{
            width: "100%", height: "60px", boxSizing: "border-box",
            fontSize: "12px", padding: "6px", border: "1px solid #E0E0E0",
            borderRadius: "4px", resize: "none", fontFamily: "var(--nm-font-mono)",
          }}
        />
      </div>

      {/* Chat section */}
      <div style={{ padding: "8px", fontSize: "11px" }}>
        <div style={{ display: "flex", gap: "4px", marginBottom: "8px" }}>
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
        <div style={{ color: "#999", textAlign: "center", padding: "12px 0" }}>
          Draw and READ INK, or type a problem below
        </div>
      </div>

      {/* Input bar */}
      <div style={{
        display: "flex", gap: "4px", padding: "8px",
        borderTop: "1px solid #E0E0E0", background: "var(--nm-faceplate)",
      }}>
        <input placeholder="Type a problem or question... (Enter to send)"
          style={{
            flex: 1, fontSize: "12px", padding: "6px 8px",
            border: "1px solid #E0E0E0", borderRadius: "4px",
          }}
        />
      </div>
    </div>
  );
}
