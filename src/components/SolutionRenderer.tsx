import React from "react";
import { App } from "obsidian";
import MarkdownPreview from "./MarkdownPreview";

interface Props {
  raw: string;
  app: App;
}

const LABELS = new Set(["Problem", "Given", "Equations", "Where", "Solution", "Answer"]);

export default function SolutionRenderer({ raw, app }: Props) {
  const lines = raw.split("\n").filter((l) => l.trim());

  return (
    <div className="noteometry-solution">
      {lines.map((line, i) => {
        const trimmed = line.trim();

        if (LABELS.has(trimmed)) {
          return (
            <div key={i} className="noteometry-solution-label">
              {trimmed}
            </div>
          );
        }

        // Render via Obsidian's MarkdownRenderer which handles $...$ math
        return (
          <div key={i} className="noteometry-solution-line">
            <MarkdownPreview content={trimmed} app={app} />
          </div>
        );
      })}
    </div>
  );
}
