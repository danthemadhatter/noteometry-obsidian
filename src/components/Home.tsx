import React, { useCallback, useEffect, useState } from "react";
import { EventRef, TFile } from "obsidian";
import type NoteometryPlugin from "../main";
import { getRecentPages, formatRelativeTime, RecentPage } from "../lib/recentPages";
import { rootDir } from "../lib/persistence";

interface Props {
  plugin: NoteometryPlugin;
}

export default function Home({ plugin }: Props) {
  const app = plugin.app;
  const [recents, setRecents] = useState<RecentPage[]>([]);

  const refresh = useCallback(() => {
    setRecents(getRecentPages(app, rootDir(plugin), 6));
  }, [app, plugin]);

  useEffect(() => {
    refresh();
    // modify fires per stroke autosave on .nmpage edits, but the file
    // being edited is already #1 in recents — reorder only happens on
    // create/delete/rename, so we skip modify entirely.
    const refs: EventRef[] = [
      app.vault.on("create", refresh),
      app.vault.on("delete", refresh),
      app.vault.on("rename", refresh),
    ];
    return () => {
      for (const r of refs) app.vault.offref(r);
    };
  }, [app, refresh]);

  const openFile = useCallback(
    (file: TFile) => {
      void plugin.app.workspace.getLeaf(false).openFile(file);
    },
    [plugin],
  );

  const focusFileExplorer = useCallback(() => {
    const explorer = app.workspace.getLeavesOfType("file-explorer")[0];
    if (explorer) void app.workspace.revealLeaf(explorer);
  }, [app]);

  const resume = recents[0];
  const restRecents = recents.slice(1);

  return (
    <div className="noteometry-home">
      <div className="noteometry-home-inner">
        <h1 className="noteometry-home-greet">Welcome back.</h1>

        {resume ? (
          <button
            type="button"
            className="noteometry-home-resume"
            onClick={() => openFile(resume.file)}
          >
            <span className="noteometry-home-resume-label">Resume</span>
            <span className="noteometry-home-resume-title">{resume.basename}</span>
            <span className="noteometry-home-resume-meta">
              {resume.parentPath || "/"} · {formatRelativeTime(resume.mtime)}
            </span>
          </button>
        ) : (
          <div className="noteometry-home-resume noteometry-home-resume-empty">
            <span className="noteometry-home-resume-label">No pages yet</span>
            <span className="noteometry-home-resume-title">Tap below to start.</span>
          </div>
        )}

        <div className="noteometry-home-actions">
          <button
            type="button"
            className="noteometry-home-action noteometry-home-action-primary"
            onClick={() => void plugin.createAndOpenNewPage()}
          >
            <span className="noteometry-home-action-glyph">+</span>
            <span>New page</span>
          </button>
          <button
            type="button"
            className="noteometry-home-action"
            onClick={focusFileExplorer}
          >
            <span>All pages</span>
          </button>
        </div>

        {restRecents.length > 0 && (
          <div className="noteometry-home-recent">
            <div className="noteometry-home-recent-hdr">Recently touched</div>
            <ul className="noteometry-home-recent-list">
              {restRecents.map(p => (
                <li key={p.path}>
                  <button
                    type="button"
                    className="noteometry-home-recent-row"
                    onClick={() => openFile(p.file)}
                  >
                    <span className="noteometry-home-recent-name">{p.basename}</span>
                    <span className="noteometry-home-recent-folder">
                      {p.parentPath || "/"}
                    </span>
                    <span className="noteometry-home-recent-when">
                      {formatRelativeTime(p.mtime)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
