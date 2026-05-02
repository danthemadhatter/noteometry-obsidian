/**
 * ChatDropin — v1.10 "ABC" (and Solve) output.
 *
 * A canvas-anchored conversation pinned to the thing it's about.
 * Replaces the removed right-side ChatPanel. Each drop-in owns its
 * own history; no global chat state. Deleting the drop-in deletes
 * the conversation — there is no other canvas.
 *
 * Two spawn paths:
 *   1. Lasso → "ABC" → creates an empty ChatDropin with the lasso
 *      PNG pinned at the top. User types a question, the image goes
 *      with the first turn as an attachment. Follow-up turns are
 *      text-only — the provider already has the image in context.
 *   2. MathDropin → "Solve" → creates a ChatDropin with `seedLatex`
 *      set to the LaTeX. The drop-in auto-fires the first turn using
 *      the v12 Solve system prompt. No image; the math drop-in next
 *      to it is the visual anchor.
 *
 * Preserves everything that worked in the old ChatPanel: MathML
 * rendering, copy-for-Word, paperclip attach, paste-image attach,
 * Enter-to-send, stop-in-flight. Just re-homed into a drop-in shell.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Notice } from "obsidian";
import { IconSend, IconPaperclip, IconX, IconCopy, IconCheck } from "../Icons";
import { renderAsMathML, toMathMLForClipboard } from "../../lib/mathml";
import { chat } from "../../lib/ai";
import { DEFAULT_PRESETS } from "../../features/pipeline/presets";
import type { ChatMessage, Attachment } from "../../types";
import type NoteometryPlugin from "../../main";

/** Find the v12 "Solve" preset. Falls back to the first preset if
 *  the registry is ever reshuffled. */
function solvePreset() {
  // Belt-and-braces: cast the fallback through a non-null assertion. The
  // registry is statically defined and never empty, so the optional chain
  // is purely for TypeScript's noUncheckedIndexedAccess setting.
  return DEFAULT_PRESETS.find((p) => p.id === "solve") ?? DEFAULT_PRESETS[0]!;
}

interface Props {
  plugin: NoteometryPlugin;
  messages: ChatMessage[];
  attachedImage?: string;
  seedLatex?: string;
  pending?: boolean;
  onChange: (u: {
    messages?: ChatMessage[];
    pending?: boolean;
    seedLatex?: string;
  }) => void;
}

export default function ChatDropin({
  plugin,
  messages,
  attachedImage,
  seedLatex,
  pending,
  onChange,
}: Props) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Cancel token for in-flight requests. Fresh object per send so a
  // later send can't get confused with an earlier abort.
  const abortRef = useRef<{ cancelled: boolean } | null>(null);

  // Ref mirror of the canonical messages so async callbacks can read
  // the freshest history without stale closures. Same pattern as the
  // old usePipeline.
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;

  // Auto-scroll to newest message.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  /** Send one chat turn with whatever system prompt + attachments are
   *  appropriate. Writes the user turn + loading flag synchronously,
   *  then awaits and writes the assistant turn. */
  const send = useCallback(async (
    userText: string,
    atts: Attachment[],
    systemOverride?: string,
  ) => {
    const trimmed = userText.trim();
    if (!trimmed && !atts.length) return;
    const userMsg: ChatMessage = { role: "user", text: trimmed };
    const nextHistory = [...messagesRef.current, userMsg];
    onChange({ messages: nextHistory, pending: true });

    const token = { cancelled: false };
    abortRef.current = token;

    try {
      const res = await chat(nextHistory, atts, plugin.settings, systemOverride);
      if (token.cancelled) return;
      onChange({
        messages: [...nextHistory, {
          role: "assistant",
          text: res.ok ? res.text : (res.error ?? "No response"),
        }],
        pending: false,
      });
    } catch {
      if (token.cancelled) return;
      onChange({
        messages: [...nextHistory, { role: "assistant", text: "AI request failed." }],
        pending: false,
      });
    } finally {
      if (abortRef.current === token) abortRef.current = null;
    }
  }, [plugin, onChange]);

  const stop = useCallback(() => {
    const t = abortRef.current;
    if (!t) return;
    t.cancelled = true;
    abortRef.current = null;
    onChange({ pending: false });
  }, [onChange]);

  /** Solve-seeded drop-ins auto-fire their first turn once on mount.
   *  The seedLatex is cleared afterwards so re-hydrating the page
   *  from disk doesn't refire the call. */
  const didSeedRef = useRef(false);
  useEffect(() => {
    if (didSeedRef.current) return;
    if (!seedLatex || !seedLatex.trim()) return;
    if (messages.length > 0) {
      // Already ran in a previous session — clear the seed and bail.
      didSeedRef.current = true;
      onChange({ seedLatex: undefined });
      return;
    }
    didSeedRef.current = true;
    onChange({ seedLatex: undefined });
    void send(seedLatex, [], solvePreset().system);
  }, [seedLatex, messages.length, send, onChange]);

  const handleSend = useCallback(() => {
    const atts = [...attachments];
    // First turn of an ABC-spawned chat: attach the pinned lasso
    // image so the provider has it as context. Don't re-attach on
    // follow-up turns — the provider already saw it.
    if (attachedImage && messages.length === 0) {
      atts.unshift({
        name: "lasso.png",
        mimeType: "image/png",
        data: attachedImage,
      });
    }
    const text = input;
    setInput("");
    setAttachments([]);
    void send(text, atts);
  }, [input, attachments, attachedImage, messages.length, send]);

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

  const copyForWord = useCallback(async (text: string, idx: number) => {
    try {
      const mathml = toMathMLForClipboard(text);
      if (typeof ClipboardItem !== "undefined") {
        const html = new Blob([mathml], { type: "text/html" });
        const plain = new Blob([text], { type: "text/plain" });
        await navigator.clipboard.write([new ClipboardItem({
          "text/html": html, "text/plain": plain,
        })]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch {
      new Notice("Copy failed.");
    }
  }, []);

  return (
    <div className="noteometry-chat-dropin">
      {/* Pinned image attachment — ABC spawn only. Thumbnail with a
          subtle caption so the user always sees what the AI is
          looking at. Anti-amnesia: the attached context stays
          visible, not buried in a conversation scroll. */}
      {attachedImage && (
        <div className="noteometry-chat-attached-image" title="Lasso attachment">
          <img src={attachedImage} alt="Lasso attachment" />
        </div>
      )}

      <div className="noteometry-chat-messages">
        {messages.length === 0 && !pending && !seedLatex && (
          <div className="noteometry-chat-empty">
            {attachedImage
              ? "Ask about the selection."
              : "Type a question."}
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
                    onClick={() => copyForWord(m.text, i)}
                    title="Copy as MathML (paste into Word)"
                  >
                    {copiedIdx === i ? <IconCheck /> : <IconCopy />}
                    {copiedIdx === i ? "Copied" : "Copy for Word"}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {pending && (
          <div className="noteometry-chat-row assistant">
            <div className="noteometry-chat-bubble assistant noteometry-pulse">Thinking…</div>
          </div>
        )}
        <div ref={endRef} />
      </div>

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
          title="Attach"
        >
          <IconPaperclip />
        </button>
        <textarea
          ref={taRef}
          className="noteometry-chat-textarea"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={attachedImage && messages.length === 0
            ? "Ask about the selection… (Enter to send)"
            : "Type a question… (Enter to send)"}
          rows={2}
        />
        {pending ? (
          <button
            className="noteometry-chat-send-btn noteometry-chat-stop-btn"
            onClick={stop}
            title="Stop"
            aria-label="Stop"
          >
            <IconX />
          </button>
        ) : (
          <button
            className="noteometry-chat-send-btn"
            onClick={handleSend}
            disabled={!input.trim() && !attachments.length && !(attachedImage && messages.length === 0)}
            title="Send"
          >
            <IconSend />
          </button>
        )}
      </div>
    </div>
  );
}
