import React from "react";
import { App } from "obsidian";
import MarkdownPreview from "./MarkdownPreview";
import SolutionRenderer from "./SolutionRenderer";

interface Props {
  inputCode: string;
  setInputCode: (v: string) => void;
  outputCode: string;
  isSolving: boolean;
  app: App;
}

export default function Panel({
  inputCode, setInputCode, outputCode, isSolving, app,
}: Props) {
  return (
    <div className="noteometry-panel">
      {/* Box 1: Input — Rendered */}
      <div className="noteometry-panel-box">
        <div className="noteometry-panel-box-hdr">
          <span>Input — Rendered</span>
        </div>
        <div className="noteometry-panel-box-content">
          {inputCode.trim()
            ? <MarkdownPreview content={inputCode} app={app} />
            : <div className="noteometry-placeholder">Lasso ink to populate</div>}
        </div>
      </div>

      {/* Box 2: Input — Code */}
      <div className="noteometry-panel-box">
        <div className="noteometry-panel-box-hdr">
          <span>Input — Code</span>
          <button
            className="noteometry-panel-box-action noteometry-panel-box-action-danger"
            onClick={() => setInputCode("")}
          >
            Clear
          </button>
        </div>
        <textarea
          className="noteometry-panel-textarea"
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value)}
          placeholder="LaTeX / plain math / text — editable"
        />
      </div>

      {/* Box 3: Output — Rendered */}
      <div className="noteometry-panel-box">
        <div className="noteometry-panel-box-hdr">
          <span>Output — Rendered</span>
          {outputCode && (
            <button
              className="noteometry-panel-box-action noteometry-panel-box-action-copy"
              onClick={() => navigator.clipboard.writeText(outputCode).catch(() => {})}
            >
              Copy
            </button>
          )}
        </div>
        <div className="noteometry-panel-box-content">
          {isSolving
            ? <div className="noteometry-placeholder noteometry-pulse">DLP v12 solving…</div>
            : outputCode.trim()
              ? <SolutionRenderer raw={outputCode} app={app} />
              : <div className="noteometry-placeholder">Solution appears here</div>}
        </div>
      </div>

      {/* Box 4: Output — Raw LaTeX */}
      <div className="noteometry-panel-box">
        <div className="noteometry-panel-box-hdr">
          <span>Output — Raw LaTeX</span>
        </div>
        <pre className="noteometry-panel-raw">
          {outputCode || <span className="noteometry-placeholder">Raw LaTeX output</span>}
        </pre>
      </div>
    </div>
  );
}
