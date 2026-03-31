import { ItemView, WorkspaceLeaf } from "obsidian";
import React from "react";
import { createRoot } from "react-dom/client";
import { Excalidraw } from "@excalidraw/excalidraw";
import Toolbar from "./components/Toolbar";
import { useState, useEffect } from "react";
import { readInkFromImage, solveWithDLP } from "./lib/gemini";

export class NoteometryView extends ItemView {
  root: any;
  plugin: any;

  constructor(leaf: WorkspaceLeaf, plugin: any) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() { return "noteometry-view"; }
  getDisplayText() { return "Noteometry"; }
  getIcon() { return "pencil"; }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    this.root = createRoot(container);
    this.root.render(<NoteometryApp plugin={this.plugin} />);
  }

  async onClose() {
    this.root.unmount();
  }
}

function NoteometryApp({ plugin }: { plugin: any }) {
  const [mode, setMode] = useState<"text" | "math" | "circuits">("math");
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [apiKey] = useState(() => plugin.settings.geminiApiKey);

  useEffect(() => {
    if (!apiKey) {
      alert("⚠️ Please set your Gemini API key in Obsidian Settings → Noteometry");
    }
  }, [apiKey]);

  const handleReadInk = async () => {
    if (!excalidrawAPI || !apiKey) return;
    try {
      const blob = await excalidrawAPI.exportToBlob({ type: "png" });
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const latex = await readInkFromImage(base64, apiKey);
        alert("✅ READ INK SUCCESS!\n\nLaTeX returned:\n" + latex + "\n\n(Paste into canvas as text element next update)");
        console.log("Gemini 3.1 Pro Preview LaTeX:", latex);
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      alert("Error capturing canvas: " + e);
    }
  };

  const handleSolve = async () => {
    if (!excalidrawAPI || !apiKey) return;
    alert("SOLVE button pressed – DLP v12 coming in next update (stub works for now)");
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <Toolbar mode={mode} setMode={setMode} onReadInk={handleReadInk} onSolve={handleSolve} />
      <div style={{ flex: 1 }}>
        <Excalidraw
          ref={(api) => setExcalidrawAPI(api)}
          initialData={{
            elements: [],
            appState: { zenModeEnabled: true, viewModeEnabled: false },
          }}
          onChange={() => {}}
          options={{
            zenModeEnabled: true,
            gridModeEnabled: mode === "circuits",
          }}
        />
      </div>
    </div>
  );
}
