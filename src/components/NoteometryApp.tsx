import React, { useState, useEffect, useRef, useCallback } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import { App } from "obsidian";
import type NoteometryPlugin from "../main";
import { NoteometryMode } from "../types";
import { readInk, solve } from "../lib/gemini";
import { saveCanvas, loadCanvas, CanvasData } from "../lib/persistence";
import Toolbar from "./Toolbar";
import Panel from "./Panel";

interface Props {
  plugin: NoteometryPlugin;
  app: App;
}

export default function NoteometryApp({ plugin, app }: Props) {
  /* ── state ─────────────────────────────────────────────── */
  const [mode, setMode] = useState<NoteometryMode>("math");
  const [inputRaw, setInputRaw] = useState("");
  const [outputRaw, setOutputRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [initialScene, setInitialScene] = useState<Record<string, unknown> | null>(null);

  const excalidrawRef = useRef<any>(null);
  const saveTimer = useRef<number>(0);

  /* ── load persisted state on mount ─────────────────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadCanvas(plugin);
      if (cancelled) return;
      if (saved) {
        setInitialScene({
          elements: saved.elements ?? [],
          appState: {
            ...(saved.appState ?? {}),
            zenModeEnabled: true,
            collaborators: new Map(),
          },
        });
        setInputRaw(saved.panelInput ?? "");
        setOutputRaw(saved.panelOutput ?? "");
        setMode((saved.panelMode as NoteometryMode) || "math");
      } else {
        setInitialScene({
          elements: [],
          appState: { zenModeEnabled: true },
        });
      }
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── debounced auto-save ───────────────────────────────── */
  const doSave = useCallback(() => {
    if (!plugin.settings.autoSave) return;
    const api = excalidrawRef.current;
    if (!api) return;

    if (saveTimer.current) window.clearTimeout(saveTimer.current);

    saveTimer.current = window.setTimeout(async () => {
      const elements = api.getSceneElements();
      const appState = api.getAppState();
      const data: CanvasData = {
        elements,
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
          gridSize: appState.gridSize,
        },
        panelInput: inputRaw,
        panelOutput: outputRaw,
        panelMode: mode,
        lastSaved: new Date().toISOString(),
      };
      await saveCanvas(plugin, data);
    }, plugin.settings.autoSaveDelay);
  }, [inputRaw, outputRaw, mode, plugin]);

  // Re-trigger save whenever panel state changes
  useEffect(() => { doSave(); }, [inputRaw, outputRaw, mode]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, []);

  /* ── READ INK ──────────────────────────────────────────── */
  const handleReadInk = async () => {
    const api = excalidrawRef.current;
    if (!api) { setError("Canvas not ready"); return; }

    const key = plugin.settings.geminiApiKey;
    const model = plugin.settings.geminiModel;

    setLoading(true);
    setError(null);

    try {
      const blob: Blob = await api.exportToBlob({ mimeType: "image/png", quality: 1 });

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const b64 = result.split(",")[1];
          if (b64) resolve(b64);
          else reject(new Error("Base64 encoding failed"));
        };
        reader.onerror = () => reject(new Error("FileReader error"));
        reader.readAsDataURL(blob);
      });

      const res = await readInk(base64, key, model);
      if (res.ok) {
        setInputRaw(res.text);
      } else {
        setError(res.error ?? "READ INK failed");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "READ INK error");
    } finally {
      setLoading(false);
    }
  };

  /* ── SOLVE ─────────────────────────────────────────────── */
  const handleSolve = async () => {
    if (!inputRaw.trim()) {
      setError("Nothing to solve — write or READ INK first");
      return;
    }

    const key = plugin.settings.geminiApiKey;
    const model = plugin.settings.geminiModel;

    setLoading(true);
    setError(null);

    try {
      const res = await solve(inputRaw, key, model);
      if (res.ok) {
        setOutputRaw(res.text);
      } else {
        setError(res.error ?? "SOLVE failed");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "SOLVE error");
    } finally {
      setLoading(false);
    }
  };

  /* ── palette insertion ─────────────────────────────────── */
  const handleInsertSymbol = (sym: string) => {
    setInputRaw((prev) => prev + sym);
  };

  /* ── Excalidraw change handler (triggers auto-save) ────── */
  const handleCanvasChange = useCallback(() => {
    doSave();
  }, [doSave]);

  /* ── render ────────────────────────────────────────────── */
  if (!ready || !initialScene) {
    return <div className="noteometry-loading">Loading Noteometry…</div>;
  }

  return (
    <div className="noteometry-container">
      <Toolbar mode={mode} setMode={setMode} />

      <div className="noteometry-split">
        <div className="noteometry-canvas">
          <Excalidraw
            excalidrawAPI={(api: unknown) => {
              excalidrawRef.current = api;
            }}
            initialData={initialScene}
            onChange={handleCanvasChange}
            zenModeEnabled={true}
            gridModeEnabled={mode === "circuits"}
          />
        </div>

        <Panel
          mode={mode}
          inputRaw={inputRaw}
          setInputRaw={setInputRaw}
          outputRaw={outputRaw}
          loading={loading}
          error={error}
          onReadInk={handleReadInk}
          onSolve={handleSolve}
          onInsertSymbol={handleInsertSymbol}
          app={app}
        />
      </div>
    </div>
  );
}
