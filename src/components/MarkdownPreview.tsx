import React, { useEffect, useRef } from "react";
import { App, MarkdownRenderer, Component } from "obsidian";

interface Props {
  content: string;
  app: App;
}

export default function MarkdownPreview({ content, app }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const compRef = useRef<Component | null>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    // Tear down previous render
    if (compRef.current) {
      compRef.current.unload();
      compRef.current = null;
    }
    el.innerHTML = "";

    if (!content) return;

    const component = new Component();
    component.load();
    compRef.current = component;

    // MarkdownRenderer.render is async — fire-and-forget is fine here;
    // the DOM node is stable and the cleanup handles component lifecycle.
    MarkdownRenderer.render(app, content, el, "", component).catch(() => {
      // Fallback: dump as plain text if render fails
      if (el) el.textContent = content;
    });

    return () => {
      if (compRef.current) {
        compRef.current.unload();
        compRef.current = null;
      }
    };
  }, [content, app]);

  return <div ref={elRef} className="noteometry-markdown" />;
}
