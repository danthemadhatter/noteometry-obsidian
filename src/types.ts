export type AIProvider = "claude" | "lmstudio" | "perplexity";

export interface NoteometrySettings {
  aiProvider: AIProvider;
  claudeApiKey: string;
  claudeModel: string;
  perplexityApiKey: string;
  perplexityModel: string;
  lmStudioUrl: string;
  lmStudioTextModel: string;
  lmStudioVisionModel: string;
  vaultFolder: string;
  autoSave: boolean;
  autoSaveDelay: number;
}

export const DEFAULT_SETTINGS: NoteometrySettings = {
  aiProvider: "perplexity",
  claudeApiKey: "",
  claudeModel: "claude-opus-4-6",
  perplexityApiKey: "",
  perplexityModel: "openai/gpt-5.4",
  lmStudioUrl: "http://localhost:1234",
  lmStudioTextModel: "qwen3-235b",
  lmStudioVisionModel: "qwen2-vl-72b",
  vaultFolder: "Noteometry",
  autoSave: true,
  autoSaveDelay: 2000,
};

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export interface Attachment {
  name: string;
  mimeType: string;
  data: string;
}
