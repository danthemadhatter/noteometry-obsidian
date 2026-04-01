export interface NoteometrySettings {
  geminiApiKey: string;
  geminiModel: string;
  autoSave: boolean;
  autoSaveDelay: number;
}

export const DEFAULT_SETTINGS: NoteometrySettings = {
  geminiApiKey: "***REMOVED***",
  geminiModel: "gemini-3.1-pro-preview",
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

export type Tool = "pen" | "eraser" | "lasso";

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export interface Attachment {
  name: string;
  mimeType: string;
  data: string;
}
