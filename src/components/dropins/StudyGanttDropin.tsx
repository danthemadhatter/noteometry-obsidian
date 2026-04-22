import React, { useCallback } from "react";

interface Task {
  id: string; title: string; startDay: number; duration: number;
  color: string; progress: number;
}
interface Props {
  startDate: string;
  tasks: Task[];
  onChange: (updates: { startDate?: string; tasks?: Task[] }) => void;
}

const COLORS = ["#4A90D9", "#16A34A", "#F59E0B", "#DC2626", "#7C3AED", "#EC4899"];

const ganttNumInput: React.CSSProperties = {
  width: "36px", fontSize: "10px", padding: "1px 2px",
  border: "1px solid #E0E0E0", borderRadius: "3px",
  background: "var(--nm-faceplate)", color: "var(--nm-ink)",
  textAlign: "right",
};

export default function StudyGanttDropin({ startDate, tasks, onChange }: Props) {
  const addTask = useCallback(() => {
    const id = crypto.randomUUID();
    const color = COLORS[tasks.length % COLORS.length] ?? "#4A90D9";
    const newTask: Task = {
      id, title: "New Task", startDay: 0, duration: 7, color, progress: 0,
    };
    onChange({ tasks: [...tasks, newTask] });
  }, [tasks, onChange]);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    onChange({ tasks: tasks.map(t => t.id === id ? { ...t, ...updates } : t) });
  }, [tasks, onChange]);

  const removeTask = useCallback((id: string) => {
    onChange({ tasks: tasks.filter(t => t.id !== id) });
  }, [tasks, onChange]);

  const totalDays = Math.max(30, ...tasks.map(t => t.startDay + t.duration + 5));

  return (
    <div style={{ padding: "8px", fontSize: "11px", fontFamily: "var(--nm-font)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <div style={{ fontWeight: 700, fontSize: "12px", color: "var(--nm-ink)" }}>STUDY PLAN</div>
        <input type="date" value={startDate}
          onChange={e => onChange({ startDate: e.target.value })}
          style={{ fontSize: "11px", padding: "2px 4px", border: "1px solid #E0E0E0", borderRadius: "3px" }}
        />
        <button onClick={addTask}
          style={{
            padding: "2px 8px", fontSize: "11px", border: "1px solid var(--nm-accent)",
            borderRadius: "4px", cursor: "pointer", background: "var(--nm-accent)", color: "#fff",
          }}
        >+ Task</button>
      </div>
      {tasks.length === 0 && (
        <div style={{ textAlign: "center", color: "#999", padding: "20px" }}>
          No tasks yet. Click "+ Task" to start planning.
        </div>
      )}
      {tasks.map(task => (
        <div key={task.id} style={{ marginBottom: "6px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
            <span
              onClick={() => {
                const idx = COLORS.indexOf(task.color);
                const next = COLORS[(idx + 1) % COLORS.length] ?? task.color;
                updateTask(task.id, { color: next });
              }}
              title="Click to cycle color"
              style={{ width: "10px", height: "10px", borderRadius: "50%", background: task.color, flexShrink: 0, cursor: "pointer" }}
            />
            <input value={task.title}
              onChange={e => updateTask(task.id, { title: e.target.value })}
              style={{ flex: 1, fontSize: "11px", border: "none", background: "transparent", color: "var(--nm-ink)", fontWeight: 600 }}
            />
            <label title="Start day" style={{ color: "#666", fontSize: "10px" }}>s</label>
            <input type="number" min={0} value={task.startDay}
              onChange={e => updateTask(task.id, { startDay: Math.max(0, parseInt(e.target.value) || 0) })}
              style={ganttNumInput}
            />
            <label title="Duration in days" style={{ color: "#666", fontSize: "10px" }}>d</label>
            <input type="number" min={1} value={task.duration}
              onChange={e => updateTask(task.id, { duration: Math.max(1, parseInt(e.target.value) || 1) })}
              style={ganttNumInput}
            />
            <label title="Progress %" style={{ color: "#666", fontSize: "10px" }}>%</label>
            <input type="number" min={0} max={100} value={task.progress}
              onChange={e => updateTask(task.id, { progress: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })}
              style={ganttNumInput}
            />
            <button onClick={() => removeTask(task.id)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: "10px" }}
            >x</button>
          </div>
          {/* Gantt bar */}
          <div style={{ position: "relative", height: "14px", background: "#F0F0F0", borderRadius: "3px", overflow: "hidden" }}>
            <div style={{
              position: "absolute",
              left: `${(task.startDay / totalDays) * 100}%`,
              width: `${(task.duration / totalDays) * 100}%`,
              height: "100%",
              background: task.color,
              opacity: 0.3,
              borderRadius: "3px",
            }} />
            <div style={{
              position: "absolute",
              left: `${(task.startDay / totalDays) * 100}%`,
              width: `${(task.duration / totalDays) * 100 * task.progress / 100}%`,
              height: "100%",
              background: task.color,
              borderRadius: "3px",
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}
