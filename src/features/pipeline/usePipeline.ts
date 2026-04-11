import { useState, useRef, useCallback, Dispatch, SetStateAction } from "react";
import type NoteometryPlugin from "../../main";
import type { ChatMessage, Attachment } from "../../types";
import { readInk, chat } from "../../lib/ai";
import { DEFAULT_PRESETS, DEFAULT_PRESET_ID, getPresetById, type PromptPreset } from "./presets";

/**
 * Pipeline feature hook. Owns the state and actions for the lab bench /
 * AI processing flow:
 *   - panel input (the LaTeX/text staging area)
 *   - chat message history
 *   - loading flags (isReading for vision, chatLoading for chat/solve)
 *
 * In Phase 1 this wraps the existing single-call flow. In Phase 3 this
 * becomes the "lab bench" — multi-lasso batch composition, prompt presets,
 * and structured run history all live here.
 *
 * Key design note: sendToChat and processCrop use a chatMessages ref mirror
 * so awaited API calls read the latest conversation history without stale
 * closures, matching the prior pattern in NoteometryApp.
 */
export interface UsePipelineReturn {
  inputCode: string;
  chatMessages: ChatMessage[];
  isReading: boolean;
  chatLoading: boolean;
  /** All available prompt presets (readonly for now, editable in Phase 4+). */
  presets: PromptPreset[];
  /** The currently active preset — drives the system prompt for chat responses. */
  activePreset: PromptPreset;
  setInputCode: Dispatch<SetStateAction<string>>;
  setChatMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setActivePresetId: (id: string) => void;
  sendToChat: (userText: string, atts?: Attachment[]) => Promise<void>;
  processCrop: (dataURL: string) => Promise<boolean>;
  handleSolveInput: () => Promise<void>;
  handleInsertSymbol: (sym: string) => void;
  hydrate: (panelInput: string, messages: ChatMessage[]) => void;
}

export function usePipeline(plugin: NoteometryPlugin): UsePipelineReturn {
  const [inputCode, setInputCode] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isReading, setIsReading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [activePresetId, setActivePresetIdState] = useState<string>(DEFAULT_PRESET_ID);

  const activePreset = getPresetById(activePresetId);

  // Mirror ref: lets awaited API calls read the latest history and preset
  // without rebinding sendToChat on every state change.
  const chatMessagesRef = useRef<ChatMessage[]>([]);
  chatMessagesRef.current = chatMessages;

  const inputCodeRef = useRef("");
  inputCodeRef.current = inputCode;

  const activePresetRef = useRef<PromptPreset>(activePreset);
  activePresetRef.current = activePreset;

  const setActivePresetId = useCallback((id: string) => {
    setActivePresetIdState(id);
  }, []);

  const sendToChat = useCallback(async (userText: string, atts: Attachment[] = []) => {
    const userMsg: ChatMessage = { role: "user", text: userText };
    const newHistory = [...chatMessagesRef.current, userMsg];
    setChatMessages(newHistory);
    setChatLoading(true);
    try {
      // Use the active preset's system prompt. This is what makes "Solve"
      // behave differently from "Explain" from "Circuit" etc.
      const res = await chat(newHistory, atts, plugin.settings, activePresetRef.current.system);
      setChatMessages((prev) => [...prev, {
        role: "assistant",
        text: res.ok ? res.text : (res.error ?? "No response"),
      }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", text: "AI request failed." }]);
    }
    setChatLoading(false);
  }, [plugin]);

  /**
   * Process a base64 PNG crop (from lasso OCR) through the vision model,
   * populate the panel input with the extracted LaTeX, and auto-send to chat
   * with the original image attached so the model has visual context.
   */
  const processCrop = useCallback(async (dataURL: string): Promise<boolean> => {
    setIsReading(true);
    try {
      const res = await readInk(dataURL, plugin.settings);
      if (res.ok && res.text.trim()) {
        setInputCode(res.text);
        setIsReading(false);
        const imgAttachment: Attachment = {
          name: "lasso-capture.png",
          mimeType: "image/png",
          data: dataURL,
        };
        await sendToChat(`Solve this:\n${res.text}`, [imgAttachment]);
        return true;
      }
      setChatMessages((prev) => [...prev, {
        role: "assistant",
        text: res.error ?? "READ INK couldn't extract anything from the selection.",
      }]);
    } catch {
      setChatMessages((prev) => [...prev, {
        role: "assistant",
        text: "Vision API failed.",
      }]);
    }
    setIsReading(false);
    return false;
  }, [plugin, sendToChat]);

  const handleSolveInput = useCallback(async () => {
    const current = inputCodeRef.current;
    if (!current.trim()) return;
    // Route through sendToChat so the active preset drives the response
    // style. Previously this called solve() directly with a hardcoded
    // DLP_SYSTEM prompt; presets make that hardcoding obsolete.
    await sendToChat(current, []);
  }, [sendToChat]);

  const handleInsertSymbol = useCallback((sym: string) => {
    setInputCode((prev) => prev + sym);
  }, []);

  const hydrate = useCallback((panelInput: string, messages: ChatMessage[]) => {
    setInputCode(panelInput);
    setChatMessages(messages);
  }, []);

  return {
    inputCode,
    chatMessages,
    isReading,
    chatLoading,
    presets: DEFAULT_PRESETS,
    activePreset,
    setInputCode,
    setChatMessages,
    setActivePresetId,
    sendToChat,
    processCrop,
    handleSolveInput,
    handleInsertSymbol,
    hydrate,
  };
}
