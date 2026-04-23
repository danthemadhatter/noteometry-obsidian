import React, { useRef, useCallback, useEffect, useState } from "react";
import { Notice } from "obsidian";
import { getTextBoxData, setTextBoxData } from "../lib/tableStore";
import { buildRichTextClipboardBlobs, htmlToPlainText } from "../lib/dropinExport";

interface Props {
  textBoxId: string;
}

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32];

export default function RichTextEditor({ textBoxId }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(16);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);

  // Load saved content
  useEffect(() => {
    if (editorRef.current) {
      const saved = getTextBoxData(textBoxId);
      if (saved) editorRef.current.innerHTML = saved;
    }
  }, [textBoxId]);

  // Save on input
  const handleInput = useCallback(() => {
    if (editorRef.current) {
      setTextBoxData(textBoxId, editorRef.current.innerHTML);
    }
  }, [textBoxId]);

  // Update formatting state on selection change
  const updateFormatState = useCallback(() => {
    setIsBold(document.queryCommandState("bold"));
    setIsItalic(document.queryCommandState("italic"));
  }, []);

  const exec = useCallback((cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    updateFormatState();
    handleInput();
  }, [updateFormatState, handleInput]);

  const handleCopy = useCallback(async () => {
    const html = editorRef.current?.innerHTML ?? "";
    if (!html.trim()) {
      new Notice("Nothing to copy");
      return;
    }
    try {
      const payload = buildRichTextClipboardBlobs(html);
      // ClipboardItem may not exist in older WebViews; fall back to text.
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem(payload)]);
        new Notice("Copied as rich text");
        return;
      }
      await navigator.clipboard.writeText(htmlToPlainText(html));
      new Notice("Copied as plain text (rich-text clipboard unavailable)");
    } catch (err) {
      console.warn("[Noteometry] rich-text copy failed", err);
      try {
        await navigator.clipboard.writeText(htmlToPlainText(html));
        new Notice("Copied as plain text");
      } catch {
        new Notice("Copy failed");
      }
    }
  }, []);

  const handleFontSize = useCallback((size: number) => {
    setFontSize(size);
    const sel = window.getSelection();
    if (!editorRef.current) return;

    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (!range.collapsed && editorRef.current.contains(range.commonAncestorContainer)) {
        // surroundContents() throws "Failed to execute 'surroundContents'
        // on 'Range': The Range has partially selected a non-text node"
        // whenever the selection crosses element boundaries — e.g., spans
        // two paragraphs or overlaps a <b>/<i> run. That's Dan's "I clicked
        // 16pt and it blew up the code" bug.
        try {
          const span = document.createElement("span");
          span.style.fontSize = `${size}px`;
          range.surroundContents(span);
          sel.removeAllRanges();
          sel.addRange(range);
          handleInput();
          return;
        } catch {
          // Fall through to whole-editor fallback below.
        }
      }
    }

    // No selection, or surroundContents refused the range — set the font
    // size on the editor as a whole. Future typing uses the new size.
    // Existing per-span font sizes stay intact because inline styles win.
    editorRef.current.style.fontSize = `${size}px`;
    handleInput();
  }, [handleInput]);

  return (
    <div className="noteometry-richtext">
      {/* Mini toolbar */}
      <div className="noteometry-richtext-toolbar">
        <button
          className={`noteometry-richtext-btn ${isBold ? "active" : ""}`}
          onPointerDown={(e) => { e.preventDefault(); exec("bold"); }}
          title="Bold"
        >
          <strong>B</strong>
        </button>
        <button
          className={`noteometry-richtext-btn ${isItalic ? "active" : ""}`}
          onPointerDown={(e) => { e.preventDefault(); exec("italic"); }}
          title="Italic"
        >
          <em>I</em>
        </button>
        <button
          className="noteometry-richtext-btn"
          onPointerDown={(e) => { e.preventDefault(); exec("underline"); }}
          title="Underline"
        >
          <u>U</u>
        </button>
        <span className="noteometry-richtext-sep" />
        <button
          className="noteometry-richtext-btn"
          onPointerDown={(e) => { e.preventDefault(); exec("insertUnorderedList"); }}
          title="Bullet list"
        >
          •
        </button>
        <button
          className="noteometry-richtext-btn"
          onPointerDown={(e) => { e.preventDefault(); exec("insertOrderedList"); }}
          title="Numbered list"
        >
          1.
        </button>
        <span className="noteometry-richtext-sep" />
        <select
          className="noteometry-richtext-select"
          value={fontSize}
          onChange={(e) => handleFontSize(Number(e.target.value))}
          title="Font size"
        >
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>{s}px</option>
          ))}
        </select>
        <span className="noteometry-richtext-sep" />
        <button
          className="noteometry-richtext-btn"
          onPointerDown={(e) => { e.preventDefault(); handleCopy(); }}
          title="Copy as rich text (paste into Word / Docs)"
          aria-label="Copy as rich text"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        className="noteometry-richtext-content"
        contentEditable
        tabIndex={0}
        inputMode="text"
        role="textbox"
        onInput={handleInput}
        onKeyUp={updateFormatState}
        onClick={updateFormatState}
        onTouchEnd={(e) => { e.currentTarget.focus(); updateFormatState(); }}
        onKeyDown={(e) => e.stopPropagation()}
        style={{ fontSize: `${fontSize}px` }}
        suppressContentEditableWarning
      />
    </div>
  );
}
