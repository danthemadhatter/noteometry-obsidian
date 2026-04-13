import React, { useRef, useCallback, useEffect, useState } from "react";
import katex from "katex";
import { getTextBoxData, setTextBoxData } from "../lib/tableStore";

interface Props {
  textBoxId: string;
}

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32];

/** Render content with $...$ (inline) and $$...$$ (display) math via KaTeX.
 *  Non-math segments are HTML-escaped and newlines become <br>. */
function renderWithKaTeX(content: string): string {
  if (!content) return "";
  let result = content;
  // Display math $$...$$ first
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_m, tex) => {
    try {
      return katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false, trust: true });
    } catch {
      return `<span class="noteometry-katex-error">${tex}</span>`;
    }
  });
  // Inline math $...$
  result = result.replace(/\$([^$]+?)\$/g, (_m, tex) => {
    try {
      return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false, trust: true });
    } catch {
      return `<span class="noteometry-katex-error">${tex}</span>`;
    }
  });
  // Newlines to <br> (for plain-text segments)
  result = result.replace(/\n/g, "<br>");
  return result;
}

export default function RichTextEditor({ textBoxId }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(16);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Load saved content
  useEffect(() => {
    if (editorRef.current) {
      const saved = getTextBoxData(textBoxId);
      if (saved) editorRef.current.innerHTML = saved;
    }
  }, [textBoxId]);

  // Update KaTeX preview when switching to preview mode
  useEffect(() => {
    if (!isEditing && previewRef.current) {
      const raw = getTextBoxData(textBoxId) || "";
      // Extract text from HTML (strip tags for LaTeX processing)
      const temp = document.createElement("div");
      temp.innerHTML = raw;
      const plainText = temp.textContent || temp.innerText || "";
      if (plainText.includes("$")) {
        previewRef.current.innerHTML = renderWithKaTeX(plainText);
      } else {
        // No math delimiters — just show the HTML as-is
        previewRef.current.innerHTML = raw;
      }
    }
  }, [isEditing, textBoxId]);

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
    if (!editorRef.current) return;

    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (!range.collapsed && editorRef.current.contains(range.commonAncestorContainer)) {
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

    editorRef.current.style.fontSize = `${size}px`;
    handleInput();
  }, [handleInput]);

  const enterEditMode = useCallback(() => {
    setIsEditing(true);
    // Focus the editor after React renders it
    requestAnimationFrame(() => {
      editorRef.current?.focus();
    });
  }, []);

  const exitEditMode = useCallback(() => {
    setIsEditing(false);
  }, []);

  return (
    <div className="noteometry-richtext">
      {/* Mini toolbar — use onMouseDown preventDefault on all controls to
       *  prevent the blur event from firing on the contenteditable area,
       *  which would close the editing view before the click registers. */}
      <div className="noteometry-richtext-toolbar">
        <button
          className={`noteometry-richtext-btn ${isBold ? "active" : ""}`}
          onMouseDown={(e) => e.preventDefault()}
          onPointerDown={(e) => { e.preventDefault(); exec("bold"); }}
          title="Bold"
        >
          <strong>B</strong>
        </button>
        <button
          className={`noteometry-richtext-btn ${isItalic ? "active" : ""}`}
          onMouseDown={(e) => e.preventDefault()}
          onPointerDown={(e) => { e.preventDefault(); exec("italic"); }}
          title="Italic"
        >
          <em>I</em>
        </button>
        <button
          className="noteometry-richtext-btn"
          onMouseDown={(e) => e.preventDefault()}
          onPointerDown={(e) => { e.preventDefault(); exec("underline"); }}
          title="Underline"
        >
          <u>U</u>
        </button>
        <span className="noteometry-richtext-sep" />
        <button
          className="noteometry-richtext-btn"
          onMouseDown={(e) => e.preventDefault()}
          onPointerDown={(e) => { e.preventDefault(); exec("insertUnorderedList"); }}
          title="Bullet list"
        >
          •
        </button>
        <button
          className="noteometry-richtext-btn"
          onMouseDown={(e) => e.preventDefault()}
          onPointerDown={(e) => { e.preventDefault(); exec("insertOrderedList"); }}
          title="Numbered list"
        >
          1.
        </button>
        <span className="noteometry-richtext-sep" />
        <select
          className="noteometry-richtext-select"
          value={fontSize}
          onMouseDown={(e) => e.preventDefault()}
          onChange={(e) => handleFontSize(Number(e.target.value))}
          title="Font size"
        >
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>{s}px</option>
          ))}
        </select>
      </div>

      {/* KaTeX preview — shown when not editing */}
      {!isEditing && (
        <div
          ref={previewRef}
          className="noteometry-richtext-content noteometry-richtext-preview"
          style={{ fontSize: `${fontSize}px`, cursor: "text", minHeight: "2em" }}
          onDoubleClick={enterEditMode}
          onTouchEnd={(e) => {
            // Double-tap detection for touch: enter edit on any tap in
            // preview mode for better mobile UX
            e.currentTarget.focus();
            enterEditMode();
          }}
        />
      )}

      {/* Editable area — shown when editing */}
      {isEditing && (
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
          onBlur={exitEditMode}
          style={{ fontSize: `${fontSize}px` }}
          suppressContentEditableWarning
        />
      )}
    </div>
  );
}
