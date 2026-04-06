export type AIProvider = "claude" | "lmstudio";

export interface NoteometrySettings {
  aiProvider: AIProvider;
  claudeApiKey: string;
  claudeModel: string;
  lmStudioUrl: string;
  lmStudioTextModel: string;
  lmStudioVisionModel: string;
  vaultFolder: string;
  autoSave: boolean;
  autoSaveDelay: number;
}

export const DEFAULT_SETTINGS: NoteometrySettings = {
  aiProvider: "claude",
  claudeApiKey: "",
  claudeModel: "claude-sonnet-4-20250514",
  lmStudioUrl: "http://localhost:1234",
  lmStudioTextModel: "qwen3-235b",
  lmStudioVisionModel: "qwen2-vl-72b",
  vaultFolder: "Noteometry",
  autoSave: true,
  autoSaveDelay: 2000,
};

export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export interface Stroke {
  id: string;
  points: Point[];
  color: string;
  width: number;
  tool: "pen" | "lasso";
}

export type Tool = "pen" | "eraser" | "lasso" | "grab" | "text";

export interface TextBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export interface Attachment {
  name: string;
  mimeType: string;
  data: string;
}
