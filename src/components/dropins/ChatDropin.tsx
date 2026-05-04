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
import { IconSend, IconPaperclip, IconX } from "../Icons";
import { renderAsMathML } from "../../lib/mathml";
import { chat } from "../../lib/ai";
import { DEFAULT_PRESETS } from "../../features/pipeline/presets";
import { useAIActivity } from "../../features/aiActivity";
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
  seedText?: string;
  pending?: boolean;
  onChange: (u: {
    messages?: ChatMessage[];
    pending?: boolean;
    seedLatex?: string;
    seedText?: string;
  }) => void;
  /** v1.14.0: footer button → export the chat history to a TextBox
   *  dropin so the user can paste-to-Word from there with KaTeX-
   *  rendered LaTeX. Caller spawns the TextBox; this component just
   *  forwards the message list. */
  onExportToTextBox?: (messages: ChatMessage[]) => void;
}

export default function ChatDropin({
  plugin,
  messages,
  attachedImage,
  seedLatex,
  seedText,
  pending,
  onChange,
  onExportToTextBox,
}: Props) {
  // v1.11.0 phase-3 sub-PR 3.2: seedText pre-fills the textarea (NOT
  // auto-fired). Used by the freeze "Brain dump" path to drop the user
  // straight into typing without the friction of an empty box.
  const [input, setInput] = useState(seedText ?? "");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // v1.11 phase-0: AI activity context observation. Each send pings
  // begin/end so the app-level ribbon and any future freeze-state
  // observer can see this drop-in as live.
  const aiActivity = useAIActivity();

  // Cancel token for in-flight requests. Fresh object per send so a
  // later send can't get confused with an earlier abort. The activity
  // callId travels with the token so end() fires correctly even if
  // stop() races completion.
  const abortRef = useRef<{ cancelled: boolean; callId: string } | null>(null);

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

    const callId = aiActivity.begin();
    const token = { cancelled: false, callId };
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
      // Always end the activity record, even if the call was soft-aborted.
      // The bytes may still be in flight (requestUrl can't be cancelled),
      // but the EFFECT is done — no observer should see this as live.
      aiActivity.end(callId);
      if (abortRef.current === token) abortRef.current = null;
    }
  }, [plugin, onChange, aiActivity]);

  const stop = useCallback(() => {
    const t = abortRef.current;
    if (!t) return;
    t.cancelled = true;
    // Mirror end() here so the activity count drops immediately on stop
    // rather than waiting for the network round-trip to land. The finally
    // block in send() is idempotent — end() on an already-ended id is a
    // no-op, so this double-call is safe.
    aiActivity.end(t.callId);
    abortRef.current = null;
    onChange({ pending: false });
  }, [onChange, aiActivity]);

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

  /** Brain-dump-seeded drop-ins focus the textarea on mount with the
   *  seed text pre-filled and cursor placed at the END so the user just
   *  keeps typing. Cleared after consumption so re-opening the page
   *  doesn't re-seed (the input state holds it for this session). */
  const didSeedTextRef = useRef(false);
  useEffect(() => {
    if (didSeedTextRef.current) return;
    if (!seedText) return;
    didSeedTextRef.current = true;
    onChange({ seedText: undefined });
    // Defer focus to next tick so layout is settled.
    queueMicrotask(() => {
      const ta = taRef.current;
      if (!ta) return;
      ta.focus();
      const len = ta.value.length;
      ta.setSelectionRange(len, len);
    });
  }, [seedText, onChange]);

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

  // v1.14.0: per-message "Copy for Word" button removed. The export
  // path now goes Chat → TextBox dropin (rich-text + KaTeX) → existing
  // TextBox copy-as-rich-text button. Single workflow, editable mid-
  // stream, paste-to-Word from a place that's actually styled like a
  // document.

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

      {/* v1.14.0: Export-to-TextBox footer button. Only shown once
       *  there's at least one assistant turn to export — otherwise
       *  it'd just produce an empty TextBox. The button sits above
       *  the input row so it's the natural next step after reading
       *  a finished answer. */}
      {onExportToTextBox && messages.some((m) => m.role === "assistant" && m.text.trim().length > 0) && !pending && (
        <div className="noteometry-chat-export-row">
          <button
            className="noteometry-chat-export-btn"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => {
              e.stopPropagation();
              onExportToTextBox(messages);
            }}
            title="Export this conversation to a text box on the canvas (rendered LaTeX, paste-to-Word from there)"
          >
            📄 Export to text box
          </button>
        </div>
      )}

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
