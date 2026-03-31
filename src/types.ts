export interface NoteometrySettings {
  geminiApiKey: string;
  geminiModel: string;
  autoSave: boolean;
  autoSaveDelay: number;
}

export const DEFAULT_SETTINGS: NoteometrySettings = {
  geminiApiKey: "",
  geminiModel: "gemini-3.1-pro-preview",
  autoSave: true,
  autoSaveDelay: 2000,
};

export type NoteometryMode = "text" | "math" | "circuits";
