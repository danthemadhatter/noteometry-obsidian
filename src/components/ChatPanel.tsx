import React, { useState, useRef, useEffect, useCallback } from "react";
import { IconSend, IconPaperclip, IconX, IconRotate, IconCopy, IconCheck } from "./Icons";
import type { ChatMessage, Attachment } from "../types";
import { renderAsMathML, toMathMLForClipboard } from "../lib/mathml";

interface Props {
  messages: ChatMessage[];
  onSend: (text: string, attachments: Attachment[]) => void;
  onClear: () => void;
  /** Optional: stop an in-flight chat request (streaming). */
  onStop?: () => void;
  loading: boolean;
  /** Called when the user clicks "Drop onto canvas" on an assistant message.
   * Receives the pre-rendered HTML (LaTeX → MathML) ready to drop into a
   * contenteditable text box on the canvas. */
  onDropToCanvas?: (html: string) => void;
}

export default function ChatPanel({
  messages, onSend, onClear, onStop, loading,
  onDropToCanvas,
}: Props) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const attachFiles = useCallback((files: File[]) => {
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const data = (ev.target?.result as string) || "";
        const name = file.name || `pasted-${Date.now()}.${(file.type.split("/")[1] || "bin")}`;
        setAttachments((prev) => [...prev, { name, mimeType: file.type, data }]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    attachFiles(Array.from(e.target.files || []));
    e.target.value = "";
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData?.files || []);
    if (files.length) {
      e.preventDefault();
      attachFiles(files);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length) {
      e.preventDefault();
      e.stopPropagation();
      attachFiles(files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer?.types.includes("Files")) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <div
      className="noteometry-chat"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Header — just the chat title + New button */}
      <div className="noteometry-chat-header">
        <span className="noteometry-chat-title">Chat</span>
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
          onPaste={handlePaste}
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
