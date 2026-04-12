import React, { useState, useRef, useEffect, useCallback } from "react";
import { IconSend, IconPaperclip, IconX, IconRotate, IconCopy, IconCheck, IconType } from "./Icons";
import katex from "katex";
import type { ChatMessage, Attachment } from "../types";
import type { PromptPreset } from "../features/pipeline/presets";

interface Props {
  messages: ChatMessage[];
  onSend: (text: string, attachments: Attachment[]) => void;
  onClear: () => void;
  /** Optional: stop an in-flight chat request (streaming). */
  onStop?: () => void;
  loading: boolean;
  presets: PromptPreset[];
  activePresetId: string;
  onPresetChange: (id: string) => void;
  /** Called when the user clicks "Drop onto canvas" on an assistant message.
   * Receives the pre-rendered HTML (LaTeX → MathML) ready to drop into a
   * contenteditable text box on the canvas. */
  onDropToCanvas?: (html: string) => void;
}

/**
 * Render content with LaTeX as pure MathML (no KaTeX wrapper spans).
 * This produces bare <math> elements that Safari renders natively
 * and that copy-paste into Word as real equations.
 */
function renderAsMathML(text: string): string {
  if (!text) return "";
  let result = text;

  // Helper: render LaTeX to pure MathML, stripping KaTeX wrapper spans
  const toMath = (tex: string, display: boolean): string => {
    try {
      const html = katex.renderToString(tex.trim(), {
        output: "mathml",
        displayMode: display,
        throwOnError: false,
      });
      // KaTeX wraps in <span class="katex">...</span>, extract the <math> element
      const match = html.match(/<math[\s\S]*?<\/math>/);
      if (match) {
        return display
          ? `<div style="text-align:center;margin:8px 0">${match[0]}</div>`
          : match[0];
      }
      return html;
    } catch { return tex; }
  };

  // Display math $$...$$
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_m, tex) => toMath(tex, true));

  // Inline math $...$
  result = result.replace(/\$([^$]+?)\$/g, (_m, tex) => toMath(tex, false));

  result = result.replace(/\n/g, "<br>");
  return result;
}

/** Same as renderAsMathML but with <p> wrapping for Word clipboard */
function toMathMLForClipboard(text: string): string {
  const lines = text.split(/\n/);
  return lines
    .map((line) => {
      if (!line.trim()) return "";
      return `<p>${renderAsMathML(line)}</p>`;
    })
    .join("\n");
}

export default function ChatPanel({
  messages, onSend, onClear, onStop, loading,
  presets, activePresetId, onPresetChange,
  onDropToCanvas,
}: Props) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [presetMenuOpen, setPresetMenuOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const presetMenuRef = useRef<HTMLDivElement>(null);

  const activePreset = presets.find((p) => p.id === activePresetId) ?? presets[0]!;

  // Close the preset menu when clicking outside
  useEffect(() => {
    if (!presetMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!presetMenuRef.current?.contains(e.target as Node)) {
        setPresetMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [presetMenuOpen]);

  const copyAsMathML = useCallback(async (text: string, idx: number) => {
    const mathml = toMathMLForClipboard(text);
    try {
      // Try ClipboardItem API (works in modern browsers for HTML)
      if (typeof ClipboardItem !== "undefined") {
        const blob = new Blob([mathml], { type: "text/html" });
        const textBlob = new Blob([text], { type: "text/plain" });
        await navigator.clipboard.write([
          new ClipboardItem({ "text/html": blob, "text/plain": textBlob }),
        ]);
      } else {
        // Fallback: use execCommand with a hidden div for HTML clipboard
        const tmp = document.createElement("div");
        tmp.innerHTML = mathml;
        tmp.style.position = "fixed";
        tmp.style.left = "-9999px";
        document.body.appendChild(tmp);
        const range = document.createRange();
        range.selectNodeContents(tmp);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        document.execCommand("copy");
        sel?.removeAllRanges();
        document.body.removeChild(tmp);
      }
    } catch {
      await navigator.clipboard.writeText(text);
    }
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    if (!input.trim() && !attachments.length) return;
    onSend(input, [...attachments]);
    setInput("");
    setAttachments([]);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const data = (ev.target?.result as string) || "";
        setAttachments((prev) => [...prev, { name: file.name, mimeType: file.type, data }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  return (
    <div className="noteometry-chat">
      {/* Header with preset selector */}
      <div className="noteometry-chat-header">
        <div className="noteometry-preset-selector" ref={presetMenuRef}>
          <button
            className="noteometry-preset-btn"
            onClick={() => setPresetMenuOpen((v) => !v)}
            title={activePreset.description}
          >
            <span className="noteometry-preset-badge">{activePreset.badge}</span>
            <span className="noteometry-preset-label">{activePreset.label}</span>
            <span className="noteometry-preset-caret">▾</span>
          </button>
          {presetMenuOpen && (
            <div className="noteometry-preset-menu">
              {presets.map((p) => (
                <button
                  key={p.id}
                  className={`noteometry-preset-menu-item ${p.id === activePresetId ? "active" : ""}`}
                  onClick={() => {
                    onPresetChange(p.id);
                    setPresetMenuOpen(false);
                  }}
                  title={p.description}
                >
                  <span className="noteometry-preset-badge">{p.badge}</span>
                  <span className="noteometry-preset-menu-label">
                    <span className="noteometry-preset-menu-name">{p.label}</span>
                    <span className="noteometry-preset-menu-desc">{p.description}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        {messages.length > 0 && (
          <button className="noteometry-chat-clear" onClick={onClear} title="New conversation">
            <IconRotate />
            <span>New</span>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="noteometry-chat-messages">
        {messages.length === 0 && (
          <div className="noteometry-chat-empty">
            Draw and READ INK, or type a problem below
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`noteometry-chat-row ${m.role}`}>
            <div className={`noteometry-chat-bubble ${m.role}`}>
              <div
                className="noteometry-katex-output"
                dangerouslySetInnerHTML={{ __html: renderAsMathML(m.text) }}
              />
              {m.role === "assistant" && (
                <div className="noteometry-chat-bubble-actions">
                  <button
                    className="noteometry-chat-copy-btn"
                    onClick={() => copyAsMathML(m.text, i)}
                    title="Copy as MathML (paste into Word)"
                  >
                    {copiedIdx === i ? <IconCheck /> : <IconCopy />}
                    {copiedIdx === i ? "Copied!" : "Copy for Word"}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="noteometry-chat-row assistant">
            <div className="noteometry-chat-bubble assistant noteometry-pulse">Solving…</div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="noteometry-chat-attachments">
          {attachments.map((a, i) => (
            <div key={i} className="noteometry-chat-attachment-chip">
              <span className="noteometry-chat-attachment-name">{a.name}</span>
              <button
                className="noteometry-chat-attachment-remove"
                onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
              >
                <IconX />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="noteometry-chat-input-row">
        <input
          ref={fileRef}
          type="file"
          onChange={handleFile}
          accept="image/*,.pdf,.docx,.doc,.md,.txt"
          multiple
          className="noteometry-hidden"
        />
        <button
          className="noteometry-chat-attach-btn"
          onClick={() => fileRef.current?.click()}
        >
          <IconPaperclip />
        </button>
        <textarea
          ref={textareaRef}
          className="noteometry-chat-textarea"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Type a problem or question... (Enter to send)"
          rows={2}
        />
        {loading && onStop ? (
          <button
            className="noteometry-chat-send-btn noteometry-chat-stop-btn"
            onClick={onStop}
            title="Stop the in-flight request"
            aria-label="Stop"
          >
            <IconX />
          </button>
        ) : (
          <button
            className="noteometry-chat-send-btn"
            onClick={send}
            disabled={loading || (!input.trim() && !attachments.length)}
          >
            <IconSend />
          </button>
        )}
      </div>
    </div>
  );
}
