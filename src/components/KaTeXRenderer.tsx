import React, { useMemo } from "react";
import katex from "katex";

interface Props {
  content: string;
}

/**
 * Parse content with $...$ (inline) and $$...$$ (display) math delimiters,
 * render math segments with KaTeX, and return plain text for non-math segments.
 */
function renderContent(content: string): string {
  if (!content) return "";

  let result = content;

  // Replace display math $$...$$ first (greedy, multiline)
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_m, tex) => {
    try {
      return katex.renderToString(tex.trim(), {
        displayMode: true,
        throwOnError: false,
        trust: true,
      });
    } catch {
      return `<span class="noteometry-katex-error">${tex}</span>`;
    }
  });

  // Replace inline math $...$
  result = result.replace(/\$([^$]+?)\$/g, (_m, tex) => {
    try {
      return katex.renderToString(tex.trim(), {
        displayMode: false,
        throwOnError: false,
        trust: true,
      });
    } catch {
      return `<span class="noteometry-katex-error">${tex}</span>`;
    }
  });

  // Convert newlines to <br> for plain text segments
  result = result.replace(/\n/g, "<br>");

  return result;
}

export default function KaTeXRenderer({ content }: Props) {
  const html = useMemo(() => renderContent(content), [content]);

  return (
    <div
      className="noteometry-katex-output"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
