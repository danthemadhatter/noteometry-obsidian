import { useState, useRef, useCallback, Dispatch, SetStateAction } from "react";
import type NoteometryPlugin from "../../main";
import type { ChatMessage, Attachment } from "../../types";
import { readInk, chat, solve } from "../../lib/ai";

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
  setInputCode: Dispatch<SetStateAction<string>>;
  setChatMessages: Dispatch<SetStateAction<ChatMessage[]>>;
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

  // Mirror ref: lets awaited API calls read the latest history
  // without rebinding sendToChat on every chatMessages change.
  const chatMessagesRef = useRef<ChatMessage[]>([]);
  chatMessagesRef.current = chatMessages;

  const inputCodeRef = useRef("");
  inputCodeRef.current = inputCode;

  const sendToChat = useCallback(async (userText: string, atts: Attachment[] = []) => {
    const userMsg: ChatMessage = { role: "user", text: userText };
    const newHistory = [...chatMessagesRef.current, userMsg];
    setChatMessages(newHistory);
    setChatLoading(true);
    try {
      const res = await chat(newHistory, atts, plugin.settings);
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
    setChatMessages((prev) => [...prev, { role: "user", text: current }]);
    setChatLoading(true);
    try {
      const res = await solve(current, plugin.settings);
      setChatMessages((prev) => [...prev, {
        role: "assistant",
        text: res.ok ? res.text : (res.error ?? "Solve failed."),
      }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", text: "Solver error." }]);
    }
    setChatLoading(false);
  }, [plugin]);

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
    setInputCode,
    setChatMessages,
    sendToChat,
    processCrop,
    handleSolveInput,
    handleInsertSymbol,
    hydrate,
  };
}
