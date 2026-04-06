import React, { useState, useRef, useEffect } from "react";
import { Send, Paperclip, X, RotateCcw } from "lucide-react";
import { App } from "obsidian";
import type { ChatMessage, Attachment } from "../types";
import MarkdownPreview from "./MarkdownPreview";

interface Props {
  messages: ChatMessage[];
  onSend: (text: string, attachments: Attachment[]) => void;
  onClear: () => void;
  loading: boolean;
  app: App;
}

export default function ChatPanel({ messages, onSend, onClear, loading, app }: Props) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      {/* Header */}
      <div className="noteometry-chat-header">
        <span className="noteometry-chat-title">Chat</span>
        {messages.length > 0 && (
          <button className="noteometry-chat-clear" onClick={onClear} title="New conversation">
            <RotateCcw size={13} />
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
              <MarkdownPreview content={m.text} app={app} />
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
                <X size={10} />
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
          <Paperclip size={15} />
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
        <button
          className="noteometry-chat-send-btn"
          onClick={send}
          disabled={loading || (!input.trim() && !attachments.length)}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
