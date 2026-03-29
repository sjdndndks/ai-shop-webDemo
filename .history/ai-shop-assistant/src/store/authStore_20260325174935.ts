import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

interface AuthResponse {
  user: AuthUser;
  token: string;
}

interface AuthPayload {
  email: string;
  password: string;
  name?: string;
}

interface AuthStore {
  user: AuthUser | null;
  token: string | null;
  login: (payload: AuthPayload) => Promise<void>;
  register: (payload: AuthPayload) => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
}

async function requestAuth(
  path: "/api/auth/login" | "/api/auth/register",
  payload: AuthPayload,
) {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new Error(
      `无法连接到后端服务，请确认 ai-shop-server 已启动在 ${API_BASE_URL}`,
    );
  }

  const rawText = await response.text();
  let data: (Partial<AuthResponse> & { error?: string }) | null = null;

  if (rawText.trim()) {
    try {
      data = JSON.parse(rawText) as Partial<AuthResponse> & { error?: string };
    } catch {
      throw new Error(
        `后端返回了非 JSON 响应，请确认 ai-shop-server 已重启并监听 ${API_BASE_URL}`,
      );
    }
  }

  if (!response.ok) {
    throw new Error(data?.error || "认证请求失败");
  }

  if (!data?.user || !data.token) {
    throw new Error("认证响应缺少用户信息");
  }

  return data as AuthResponse;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      login: async (payload) => {
        const result = await requestAuth("/api/auth/login", payload);

        set({
          user: result.user,
          token: result.token,
        });
      },
      register: async (payload) => {
        const result = await requestAuth("/api/auth/register", payload);

        set({
          user: result.user,
          token: result.token,
        });
      },
      setUser: (user) => {
        set({ user });
      },
      logout: () => {
        set({
          user: null,
          token: null,
        });
      },
    }),
    {
      name: "ai-shop-auth",
      version: 3,
      partialize: (state) => ({
        user: state.user,
        token: state.token,
      }),
      migrate: (persistedState) => {
        const state = persistedState as {
          user?: AuthUser | null;
          token?: string | null;
        };

        if (!state?.user || !state?.token) {
          return {
            user: null,
            token: null,
          };
        }

        return {
          user: {
            ...state.user,
            avatarUrl: state.user.avatarUrl || "",
          },
          token: state.token,
        };
      },
    },
  ),
);
