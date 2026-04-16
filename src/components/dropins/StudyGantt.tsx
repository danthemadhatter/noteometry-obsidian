import React, { useState, useCallback } from "react";
import type { StudyGanttObject, GanttTask } from "../../lib/canvasObjects";

interface Props {
  obj: StudyGanttObject;
  onChange: (patch: Partial<StudyGanttObject>) => void;
}

const COLORS = ["#4A90D9", "#F5A623", "#16A34A", "#DC2626", "#7C3AED", "#0891B2"];

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

export default function StudyGantt({ obj, onChange }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const tasks = obj.tasks;
  const startDate = obj.startDate;

  // Compute the visible range (start to latest end)
  const endDates = tasks.map(t => t.endDate);
  const latestEnd = endDates.length > 0
    ? endDates.reduce((a, b) => a > b ? a : b)
    : new Date(new Date(startDate).getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const totalDays = Math.max(7, daysBetween(startDate, latestEnd) + 1);

  const addTask = () => {
    const today = new Date().toISOString().slice(0, 10);
    const end = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const newTask: GanttTask = {
      id: crypto.randomUUID(),
      label: `Task ${tasks.length + 1}`,
      startDate: today,
      endDate: end,
      color: COLORS[tasks.length % COLORS.length],
      progress: 0,
    };
    onChange({ tasks: [...tasks, newTask] });
  };

  const updateTask = (id: string, patch: Partial<GanttTask>) => {
    onChange({ tasks: tasks.map(t => t.id === id ? { ...t, ...patch } : t) });
  };

  const removeTask = (id: string) => {
    onChange({ tasks: tasks.filter(t => t.id !== id) });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", fontSize: 12, fontFamily: "var(--nm-font, sans-serif)" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "4px 8px", borderBottom: "1px solid var(--nm-paper-border, #e0e0e0)",
        background: "var(--nm-faceplate-recessed, #e8e8e8)",
      }}>
        <span style={{ fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.3, color: "var(--nm-ink-muted, #6b7280)" }}>
          Study Plan
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onChange({ startDate: e.target.value })}
            style={{ fontSize: 11, border: "1px solid var(--nm-paper-border)", borderRadius: 3, padding: "1px 4px" }}
          />
          <button onClick={addTask} style={addBtnStyle}>+ Task</button>
        </div>
      </div>

      {/* Gantt chart area */}
      <div style={{ flex: 1, overflow: "auto", padding: "4px 0" }}>
        {tasks.length === 0 && (
          <div style={{ textAlign: "center", padding: 20, color: "var(--nm-ink-muted, #999)" }}>
            No tasks yet. Click "+ Task" to start planning.
          </div>
        )}
        {tasks.map((task, idx) => {
          const offsetDays = daysBetween(startDate, task.startDate);
          const duration = daysBetween(task.startDate, task.endDate);
          const leftPct = Math.max(0, (offsetDays / totalDays) * 100);
          const widthPct = Math.max(2, (duration / totalDays) * 100);

          return (
            <div key={task.id} style={{
              display: "flex", alignItems: "center", height: 28,
              borderBottom: "1px solid rgba(0,0,0,0.04)",
            }}>
              {/* Label */}
              <div style={{ width: 100, flexShrink: 0, padding: "0 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {editingId === task.id ? (
                  <input
                    autoFocus
                    value={task.label}
                    onChange={(e) => updateTask(task.id, { label: e.target.value })}
                    onBlur={() => setEditingId(null)}
                    onKeyDown={(e) => { if (e.key === "Enter") setEditingId(null); }}
                    style={{ width: "100%", fontSize: 11, border: "1px solid var(--nm-accent)", borderRadius: 2, padding: "1px 2px" }}
                  />
                ) : (
                  <span
                    onClick={() => setEditingId(task.id)}
                    style={{ cursor: "pointer", fontSize: 11, fontWeight: 500 }}
                    title="Click to rename"
                  >
                    {task.label}
                  </span>
                )}
              </div>

              {/* Bar area */}
              <div style={{ flex: 1, position: "relative", height: 20 }}>
                <div style={{
                  position: "absolute",
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  top: 2, height: 16,
                  background: task.color,
                  borderRadius: 3,
                  opacity: 0.85,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 700, color: "#fff",
                  overflow: "hidden", whiteSpace: "nowrap",
                }}>
                  {task.progress > 0 && `${task.progress}%`}
                </div>
              </div>

              {/* Delete */}
              <button
                onClick={() => removeTask(task.id)}
                style={{ border: "none", background: "none", cursor: "pointer", color: "var(--nm-danger, #dc2626)", fontSize: 12, padding: "0 4px" }}
                title="Remove task"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const addBtnStyle: React.CSSProperties = {
  border: "1px solid var(--nm-accent, #4A90D9)",
  borderRadius: 4,
  background: "var(--nm-accent-light, rgba(74,144,217,0.12))",
  color: "var(--nm-accent, #4A90D9)",
  cursor: "pointer",
  padding: "2px 8px",
  fontSize: 11,
  fontWeight: 600,
};
