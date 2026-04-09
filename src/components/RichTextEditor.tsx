import React, { useRef, useCallback, useEffect, useState } from "react";
import { getTextBoxData, setTextBoxData } from "../lib/tableStore";

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

  const handleFontSize = useCallback((size: number) => {
    setFontSize(size);
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current) {
      const range = sel.getRangeAt(0);
      if (!range.collapsed && editorRef.current.contains(range.commonAncestorContainer)) {
        // Wrap the selected text in a span with the chosen font size
        const span = document.createElement("span");
        span.style.fontSize = `${size}px`;
        range.surroundContents(span);
        sel.removeAllRanges();
        sel.addRange(range);
        handleInput();
      } else {
        // No selection — set default for new text
        editorRef.current.style.fontSize = `${size}px`;
      }
    }
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
