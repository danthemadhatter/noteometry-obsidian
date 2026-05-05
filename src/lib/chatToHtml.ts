/**
 * v1.14.0 — Render a ChatMessage[] sequence to HTML for the
 * "Export to text box" flow. LaTeX delimiters are rendered via
 * KaTeX so the resulting TextBox shows real math, not raw `$...$`.
 *
 * Output shape (one block per turn):
 *
 *   <p><strong>You:</strong> question text…</p>
 *   <p><strong>AI:</strong> answer text with <span class="katex">…</span></p>
 *
 * Plain text is HTML-escaped before assembly. Math segments are
 * extracted first, so the escape pass doesn't mangle their backslashes
 * or ampersands.
 *
 * Belt-and-braces against katex throwing on malformed LaTeX:
 * `throwOnError: false` returns the raw source wrapped in an error
 * span — the user still sees the symbols, just unrendered.
 */

import type { ChatMessage } from "../types";
import { renderMathHtml } from "./renderMath";

/** HTML-escape plain (non-math) text segments. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Walk the input string, alternating between math segments
 * (`$...$` inline, `$$...$$` display) and non-math runs. Math is
 * rendered through KaTeX; non-math is HTML-escaped. Newlines in
 * non-math become `<br>`.
 *
 * The two-pass strategy: scan for `$$...$$` first (greedy, multiline),
 * then for `$...$` in the remaining text. This prevents a stray `$`
 * inside a $$...$$ block from being mis-paired.
 */
export function renderTextWithMath(text: string): string {
  if (!text) return "";

  // Tokenize: produce a list of { kind: 'text'|'inline'|'display', src }.
  type Token = { kind: "text" | "inline" | "display"; src: string };
  const tokens: Token[] = [];

  // Pass 1: split on $$...$$. Use a non-greedy match so adjacent display
  // blocks each get their own token rather than merging into one giant
  // span.
  const displayRe = /\$\$([\s\S]+?)\$\$/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = displayRe.exec(text)) !== null) {
    if (match.index > lastIdx) {
      tokens.push({ kind: "text", src: text.slice(lastIdx, match.index) });
    }
    tokens.push({ kind: "display", src: match[1]! });
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) {
    tokens.push({ kind: "text", src: text.slice(lastIdx) });
  }

  // Pass 2: split each text token on single $...$ (no spans through the
  // whitespace-less variant). Skip the math tokens themselves.
  const inlineRe = /\$([^$\n]+?)\$/g;
  const expanded: Token[] = [];
  for (const t of tokens) {
    if (t.kind !== "text") {
      expanded.push(t);
      continue;
    }
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = inlineRe.exec(t.src)) !== null) {
      if (m.index > last) {
        expanded.push({ kind: "text", src: t.src.slice(last, m.index) });
      }
      expanded.push({ kind: "inline", src: m[1]! });
      last = m.index + m[0].length;
    }
    if (last < t.src.length) {
      expanded.push({ kind: "text", src: t.src.slice(last) });
    }
  }

  // Render.
  return expanded
    .map((t) => {
      if (t.kind === "text") {
        return escapeHtml(t.src).replace(/\n/g, "<br>");
      }
      return renderMathHtml(t.src, t.kind === "display");
    })
    .join("");
}

/**
 * Convert a chat history into a single HTML blob suitable for dropping
 * straight into a Noteometry TextBox dropin (`setTextBoxData(scope, id, html)`).
 *
 * Empty inputs return an empty string so the caller can decide whether
 * to spawn the TextBox at all.
 */
export function chatToHtml(messages: ChatMessage[]): string {
  if (!messages || messages.length === 0) return "";
  const blocks: string[] = [];
  for (const m of messages) {
    const t = (m.text ?? "").trim();
    if (!t) continue;
    const label = m.role === "user" ? "You" : "AI";
    const body = renderTextWithMath(t);
    blocks.push(`<p><strong>${label}:</strong> ${body}</p>`);
  }
  return blocks.join("\n");
}
