import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Message, Product } from "../types";
import { useSettingsStore } from "./settingsStore";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

interface ProductReply {
  type: "product" | "product_list" | "products";
  data: Product | Product[];
  reply?: string;
}

function toApiMessages(messages: Message[]) {
  return messages.map((message) => ({
    role: message.isUser ? "user" : "assistant",
    content: message.rawText ?? message.text,
  }));
}

function isValidProduct(value: unknown): value is Product {
  if (!value || typeof value !== "object") {
    return false;
  }

  const product = value as Record<string, unknown>;
  return (
    typeof product.id === "string" &&
    typeof product.name === "string" &&
    typeof product.price === "number" &&
    Number.isFinite(product.price) &&
    typeof product.imageUrl === "string"
  );
}

function normalizeProducts(data: ProductReply["data"]) {
  if (Array.isArray(data)) {
    const products = data.filter(isValidProduct);
    return products.length > 0 ? products : undefined;
  }

  return isValidProduct(data) ? [data] : undefined;
}

function getJsonCandidates(text: string) {
  const trimmed = text.trim();
  const candidates = [trimmed];

  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fencedMatch?.[1]) {
    candidates.push(fencedMatch[1].trim());
  }

  const firstBraceIndex = trimmed.indexOf("{");
  const lastBraceIndex = trimmed.lastIndexOf("}");
  if (
    firstBraceIndex !== -1 &&
    lastBraceIndex !== -1 &&
    lastBraceIndex > firstBraceIndex
  ) {
    candidates.push(trimmed.slice(firstBraceIndex, lastBraceIndex + 1).trim());
  }

  return [...new Set(candidates)];
}

function parseProductReply(text: string): {
  normalizedText: string;
  products?: Product[];
  reply?: string;
} {
  for (const candidate of getJsonCandidates(text)) {
    try {
      const parsed = JSON.parse(candidate) as ProductReply;
      if (
        parsed.type === "product" ||
        parsed.type === "product_list" ||
        parsed.type === "products"
      ) {
        const products = normalizeProducts(parsed.data);

        if (!products) {
          continue;
        }

        return {
          normalizedText: JSON.stringify({
            type: "product_list",
            reply: parsed.reply,
            data: products,
          }),
          products,
          reply: typeof parsed.reply === "string" ? parsed.reply.trim() : undefined,
        };
      }
    } catch {
      // 继续尝试下一个候选文本
    }
  }

  return { normalizedText: text.trim() };
}

function createAssistantMessage(aiReply: string): Message {
  const { normalizedText, products, reply } = parseProductReply(aiReply);
  const aiMessage: Message = {
    id: Date.now() + 1,
    text: normalizedText,
    rawText: normalizedText,
    isUser: false,
  };

  if (products && products.length > 0) {
    aiMessage.text = reply || `为您找到以下 ${products.length} 件商品`;
    aiMessage.products = products;
  }

  return aiMessage;
}

type ChatStatus = "idle" | "loading" | "error";

async function requestAssistantReply(
  messages: Message[],
  signal: AbortSignal,
) {
  const productCount = useSettingsStore.getState().productCount;
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: toApiMessages(messages),
        productCount,
      }),
      signal,
    });
  } catch (error) {
    throw new Error(
      `无法连接到后端服务，请确认 ai-shop-server 已启动在 ${API_BASE_URL}`,
    );
  }

  const rawText = await response.text();
  let data: any = null;

  if (rawText.trim()) {
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error(
        `后端返回了非 JSON 响应，请确认 ai-shop-server 已重启并监听 ${API_BASE_URL}`,
      );
    }
  }

  if (!response.ok) {
    throw new Error(
      `API Error ${response.status}: ${data?.error?.message || data?.error || "未知参数错误"}`,
    );
  }

  if (data?.error) {
    throw new Error(`API 内部报错啦：${data.error.message || data.error}`);
  }

  if (!data?.choices || data.choices.length === 0) {
    throw new Error("API 返回了奇怪数据，找不到 choices");
  }

  const aiReply = data.choices[0]?.message?.content;
  if (typeof aiReply !== "string" || !aiReply.trim()) {
    throw new Error("AI 没有返回可显示的内容");
  }

  return createAssistantMessage(aiReply);
}

interface ChatStore {
  messages: Message[];
  input: string;
  status: ChatStatus;
  errorMessage: string;
  retryMessageId: number | null;
  scrollTop: number;
  setInput: (value: string) => void;
  setScrollTop: (value: number) => void;
  sendMessage: () => Promise<void>;
  retryMessage: () => Promise<void>;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      messages: [],
      input: "",
      status: "idle",
      errorMessage: "",
      retryMessageId: null,
      scrollTop: 0,
      setInput: (value) => {
        set({ input: value });
      },
      setScrollTop: (value) => {
        set({ scrollTop: value });
      },
      sendMessage: async () => {
        const { input, messages } = get();
        const trimmedInput = input.trim();

        set({
          errorMessage: "",
          retryMessageId: null,
        });

        if (!trimmedInput) {
          return;
        }

        const newMessage: Message = {
          id: Date.now(),
          text: trimmedInput,
          isUser: true,
        };

        const nextMessages = [...messages, newMessage];
        set({
          messages: nextMessages,
          input: "",
        });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 30000);

        try {
          set({ status: "loading" });
          const aiMessage = await requestAssistantReply(
            nextMessages,
            controller.signal,
          );

          set((state) => ({
            messages: [...state.messages, aiMessage],
            status: "idle",
            errorMessage: "",
            retryMessageId: null,
          }));
        } catch (err) {
          if (err instanceof Error) {
            if (err.name === "AbortError") {
              set({
                status: "error",
                errorMessage: "请求超时",
                retryMessageId: newMessage.id,
              });
            } else {
              set({
                status: "error",
                errorMessage: err.message,
                retryMessageId: newMessage.id,
              });
            }
          } else {
            set({
              status: "error",
              errorMessage: "未知错误",
              retryMessageId: newMessage.id,
            });
          }
        } finally {
          clearTimeout(timeoutId);
        }
      },
      retryMessage: async () => {
        const { messages, retryMessageId } = get();

        if (retryMessageId === null) {
          return;
        }

        const retryIndex = messages.findIndex(
          (message) => message.id === retryMessageId,
        );
        const retryTarget = retryIndex >= 0 ? messages[retryIndex] : null;

        if (!retryTarget || !retryTarget.isUser) {
          return;
        }

        const retryMessages = messages.slice(0, retryIndex + 1);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 30000);

        try {
          set({
            status: "loading",
            errorMessage: "",
          });

          const aiMessage = await requestAssistantReply(
            retryMessages,
            controller.signal,
          );

          set((state) => {
            const currentRetryIndex = state.messages.findIndex(
              (message) => message.id === retryMessageId,
            );

            if (currentRetryIndex === -1) {
              return {
                status: "idle",
                errorMessage: "",
                retryMessageId: null,
              };
            }

            const preservedMessages = state.messages.slice(
              0,
              currentRetryIndex + 1,
            );

            return {
              messages: [...preservedMessages, aiMessage],
              status: "idle",
              errorMessage: "",
              retryMessageId: null,
            };
          });
        } catch (err) {
          if (err instanceof Error) {
            if (err.name === "AbortError") {
              set({
                status: "error",
                errorMessage: "请求超时",
              });
            } else {
              set({
                status: "error",
                errorMessage: err.message,
              });
            }
          } else {
            set({
              status: "error",
              errorMessage: "未知错误",
            });
          }
        } finally {
          clearTimeout(timeoutId);
        }
      },
    }),
    {
      name: "ai-shop-chat",
      partialize: (state) => ({
        messages: state.messages,
        input: state.input,
      }),
    },
  ),
);
