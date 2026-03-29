

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser } from "../types";

// 同时兼容线上部署和本地开发
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

//后端登录/注册成功后返回的响应体
interface AuthResponse {
  user: AuthUser;
  // 登录凭证
  token: string;
}

// 前端登录/注册请求体
interface AuthPayload {
  email: string;
  password: string;
  name?: string;
}

// 仓库结构说明书
interface AuthStore {
  user: AuthUser | null;
  token: string | null;
  login: (payload: AuthPayload) => Promise<void>;
  register: (payload: AuthPayload) => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
}

// 发送认证请求到后端 如果成功将返回响应体AuthResponse
async function requestAuth(
  path: "/api/auth/login" | "/api/auth/register",
  payload: AuthPayload,
) {
  let response: Response;
  // 尝试发送请求
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    // 请求失败
    throw new Error(
      `无法连接到后端服务，请确认 ai-shop-server 已启动在 ${API_BASE_URL}`,
    );
  }

  const rawText = await response.text();
  let data: (Partial<AuthResponse> & { error?: string }) | null = null;
  // 尝试解析响应体
  if (rawText.trim()) {
    try {
      data = JSON.parse(rawText) as Partial<AuthResponse> & { error?: string };
    } catch {
      throw new Error(
        `后端返回了非 JSON 响应，请确认 ai-shop-server 已重启并监听 ${API_BASE_URL}`,
      );
    }
  }

  // 如果响应不成功（状态码不是2开头
  if (!response.ok) {
    throw new Error(data?.error || "认证请求失败");
  }
  // 检查响应的结构是否完整
  if (!data?.user || !data.token) {
    throw new Error("认证响应缺少用户信息"); 
  }

  // 收口类型为AuthResponse
  return data as AuthResponse;
}

// 
export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,

      // 登录 发送请求 更新AuthStore
      login: async (payload) => {
        const result = await requestAuth("/api/auth/login", payload);
        set({
          user: result.user,
          token: result.token,
        });
      },

      // 注册 发送请求 更新AuthStore
      register: async (payload) => {
        const result = await requestAuth("/api/auth/register", payload);
        set({
          user: result.user,
          token: result.token,
        });
      },

      // 单独更新user信息
      setUser: (user) => {
        set({ user });
      },

      // 登出
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

        // 没有user或者token 直接当成未登录
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
