import React, { useRef, useCallback, useEffect, useState } from "react";
import { Notice } from "obsidian";
import { getTextBoxData, setTextBoxData } from "../lib/tableStore";
import { buildRichTextClipboardBlobs, htmlToPlainText } from "../lib/dropinExport";

interface Props {
  textBoxId: string;
  scope: string;
}

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32];
const BLOCK_OPTIONS: { value: string; label: string }[] = [
  { value: "p", label: "Paragraph" },
  { value: "h1", label: "Heading 1" },
  { value: "h2", label: "Heading 2" },
  { value: "h3", label: "Heading 3" },
  { value: "blockquote", label: "Quote" },
  { value: "pre", label: "Code block" },
];

/** Inline formatting buttons whose toggle state is read via queryCommandState. */
type InlineCmd = "bold" | "italic" | "underline" | "strikeThrough" | "subscript" | "superscript";
type AlignCmd = "justifyLeft" | "justifyCenter" | "justifyRight" | "justifyFull";

export default function RichTextEditor({ textBoxId, scope }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(16);
  const [block, setBlock] = useState("p");
  const [active, setActive] = useState<Record<string, boolean>>({});

  // v1.14.1: load saved content. innerHTML is set directly so KaTeX HTML
  // exported from the chat dropin paints with full styling.
  useEffect(() => {
    if (editorRef.current) {
      const saved = getTextBoxData(scope, textBoxId);
      if (saved) editorRef.current.innerHTML = saved;
    }
  }, [scope, textBoxId]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      setTextBoxData(scope, textBoxId, editorRef.current.innerHTML);
    }
  }, [scope, textBoxId]);

  /** Refresh which toggle buttons should glow based on the current
   *  selection. Block dropdown reads queryCommandValue("formatBlock"). */
  const refreshState = useCallback(() => {
    const cmds: (InlineCmd | AlignCmd)[] = [
      "bold", "italic", "underline", "strikeThrough", "subscript", "superscript",
      "justifyLeft", "justifyCenter", "justifyRight", "justifyFull",
    ];
    const next: Record<string, boolean> = {};
    for (const c of cmds) {
      try { next[c] = document.queryCommandState(c); } catch { next[c] = false; }
    }
    setActive(next);
    try {
      // Browsers return either "h1" / "<h1>" depending on quirks. Strip <>.
      const raw = (document.queryCommandValue("formatBlock") || "").toLowerCase();
      const stripped = raw.replace(/[<>]/g, "");
      setBlock(stripped || "p");
    } catch {
      setBlock("p");
    }
  }, []);

  /** Run an execCommand, then sync state + persist. Focus the editor
   *  first so toolbar mousedown doesn't strip the selection. */
  const exec = useCallback((cmd: string, value?: string) => {
    editorRef.current?.focus();
    try { document.execCommand(cmd, false, value); } catch (err) {
      console.warn(`[Noteometry] execCommand ${cmd} failed:`, err);
    }
    refreshState();
    handleInput();
  }, [refreshState, handleInput]);

  const handleBlock = useCallback((tag: string) => {
    // Most browsers want the tag wrapped: "<h1>". Some accept bare. Send
    // the wrapped form — it's the historical canonical input.
    exec("formatBlock", `<${tag}>`);
  }, [exec]);

  const handleLink = useCallback(() => {
    const sel = window.getSelection();
    const hasSelection = sel && !sel.isCollapsed
      && editorRef.current?.contains(sel.anchorNode ?? null);
    // Pre-fill with whatever's already a link inside the selection (if
    // any), otherwise empty. Native prompt is fast on iPad and Z Fold.
    const url = window.prompt("Link URL (https://… or empty to clear):", "https://");
    if (url === null) return; // user cancelled
    if (url.trim() === "") {
      exec("unlink");
      return;
    }
    if (!hasSelection) {
      // Insert the URL as the link text when there's no selection.
      exec("insertHTML", `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${escapeText(url)}</a>`);
      return;
    }
    exec("createLink", url);
  }, [exec]);

  const handleColor = useCallback((color: string) => {
    exec("foreColor", color);
  }, [exec]);

  const handleHighlight = useCallback((color: string) => {
    // hiliteColor is the WebKit/Blink name; fall back to backColor.
    editorRef.current?.focus();
    let ok = false;
    try { ok = document.execCommand("hiliteColor", false, color); } catch { /* ignore */ }
    if (!ok) {
      try { document.execCommand("backColor", false, color); } catch { /* ignore */ }
    }
    refreshState();
    handleInput();
  }, [refreshState, handleInput]);

  const handleClearFormat = useCallback(() => {
    // removeFormat clears inline formatting; also strip block by re-applying
    // paragraph so a bold heading reverts cleanly.
    exec("removeFormat");
    exec("formatBlock", "<p>");
  }, [exec]);

  const handleCopy = useCallback(async () => {
    const html = editorRef.current?.innerHTML ?? "";
    if (!html.trim()) {
      new Notice("Nothing to copy");
      return;
    }
    try {
      const payload = buildRichTextClipboardBlobs(html);
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
        try {
          const span = document.createElement("span");
          span.style.fontSize = `${size}px`;
          range.surroundContents(span);
          sel.removeAllRanges();
          sel.addRange(range);
          handleInput();
          return;
        } catch {
          // Fall through to whole-editor fallback.
        }
      }
    }
    editorRef.current.style.fontSize = `${size}px`;
    handleInput();
  }, [handleInput]);

  const btn = (cmd: InlineCmd | AlignCmd, label: React.ReactNode, title: string) => (
    <button
      className={`noteometry-richtext-btn ${active[cmd] ? "active" : ""}`}
      onPointerDown={(e) => { e.preventDefault(); exec(cmd); }}
      title={title}
      aria-label={title}
    >
      {label}
    </button>
  );

  return (
    <div className="noteometry-richtext">
      <div className="noteometry-richtext-toolbar">
        {/* Block format dropdown — paragraph, headings, quote, code. */}
        <select
          className="noteometry-richtext-select"
          value={block}
          onChange={(e) => handleBlock(e.target.value)}
          title="Block style"
          aria-label="Block style"
        >
          {BLOCK_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <span className="noteometry-richtext-sep" />

        {btn("bold",          <strong>B</strong>, "Bold")}
        {btn("italic",        <em>I</em>,         "Italic")}
        {btn("underline",     <u>U</u>,           "Underline")}
        {btn("strikeThrough", <s>S</s>,           "Strikethrough")}
        {btn("superscript",   <span>X<sup>2</sup></span>, "Superscript")}
        {btn("subscript",     <span>X<sub>2</sub></span>, "Subscript")}

        <span className="noteometry-richtext-sep" />

        {btn("justifyLeft",   "⇤", "Align left")}
        {btn("justifyCenter", "↔", "Align center")}
        {btn("justifyRight",  "⇥", "Align right")}
        {btn("justifyFull",   "≡", "Justify")}

        <span className="noteometry-richtext-sep" />

        <button
          className="noteometry-richtext-btn"
          onPointerDown={(e) => { e.preventDefault(); exec("insertUnorderedList"); }}
          title="Bullet list"
          aria-label="Bullet list"
        >•</button>
        <button
          className="noteometry-richtext-btn"
          onPointerDown={(e) => { e.preventDefault(); exec("insertOrderedList"); }}
          title="Numbered list"
          aria-label="Numbered list"
        >1.</button>
        <button
          className="noteometry-richtext-btn"
          onPointerDown={(e) => { e.preventDefault(); exec("insertHTML", "<code>code</code>&nbsp;"); }}
          title="Inline code"
          aria-label="Inline code"
        ><code>{"</>"}</code></button>

        <span className="noteometry-richtext-sep" />

        <button
          className="noteometry-richtext-btn"
          onPointerDown={(e) => { e.preventDefault(); handleLink(); }}
          title="Insert / edit link"
          aria-label="Insert link"
        >🔗</button>

        {/* Native color picker — system UI on iPad / Z Fold. */}
        <label className="noteometry-richtext-color" title="Text color">
          <span className="noteometry-richtext-color-label">A</span>
          <input
            type="color"
            defaultValue="#1a1a1a"
            onChange={(e) => handleColor(e.target.value)}
            aria-label="Text color"
          />
        </label>
        <label className="noteometry-richtext-color noteometry-richtext-highlight" title="Highlight">
          <span className="noteometry-richtext-color-label">▮</span>
          <input
            type="color"
            defaultValue="#fff59d"
            onChange={(e) => handleHighlight(e.target.value)}
            aria-label="Highlight color"
          />
        </label>

        <span className="noteometry-richtext-sep" />

        <select
          className="noteometry-richtext-select"
          value={fontSize}
          onChange={(e) => handleFontSize(Number(e.target.value))}
          title="Font size"
          aria-label="Font size"
        >
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>{s}px</option>
          ))}
        </select>

        <span className="noteometry-richtext-sep" />

        <button
          className="noteometry-richtext-btn"
          onPointerDown={(e) => { e.preventDefault(); exec("undo"); }}
          title="Undo"
          aria-label="Undo"
        >↶</button>
        <button
          className="noteometry-richtext-btn"
          onPointerDown={(e) => { e.preventDefault(); exec("redo"); }}
          title="Redo"
          aria-label="Redo"
        >↷</button>

        <span className="noteometry-richtext-sep" />

        <button
          className="noteometry-richtext-btn"
          onPointerDown={(e) => { e.preventDefault(); handleClearFormat(); }}
          title="Clear formatting"
          aria-label="Clear formatting"
        >⌫</button>

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

      <div
        ref={editorRef}
        className="noteometry-richtext-content"
        contentEditable
        tabIndex={0}
        inputMode="text"
        role="textbox"
        onInput={handleInput}
        onKeyUp={refreshState}
        onMouseUp={refreshState}
        onClick={refreshState}
        onTouchEnd={(e) => { e.currentTarget.focus(); refreshState(); }}
        onKeyDown={(e) => e.stopPropagation()}
        style={{ fontSize: `${fontSize}px` }}
        suppressContentEditableWarning
      />
    </div>
  );
}

/** Minimal HTML-attr escape for the link insert path. */
function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
