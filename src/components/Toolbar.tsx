import React from "react";
import { NoteometryMode } from "../types";

interface Props {
  mode: NoteometryMode;
  setMode: (m: NoteometryMode) => void;
}

const MODES: { key: NoteometryMode; icon: string; label: string }[] = [
  { key: "text", icon: "📝", label: "Text" },
  { key: "math", icon: "➗", label: "Math" },
  { key: "circuits", icon: "⚡", label: "Circuits" },
];

export default function Toolbar({ mode, setMode }: Props) {
  return (
    <div className="noteometry-toolbar">
      <span className="noteometry-title">NOTEOMETRY</span>
      <div className="noteometry-modes">
        {MODES.map((m) => (
          <button
            key={m.key}
            className={`noteometry-mode-btn ${mode === m.key ? "active" : ""}`}
            onClick={() => setMode(m.key)}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
