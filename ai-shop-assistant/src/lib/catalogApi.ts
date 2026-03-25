import type { Product } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

type ResolveProductsResponse = {
  products?: Product[];
  missingIds?: string[];
  error?: string;
};

export async function resolveCatalogProducts(ids: string[]) {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/api/products/resolve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids }),
    });
  } catch {
    throw new Error(
      `无法连接到后端服务，请确认 ai-shop-server 已启动在 ${API_BASE_URL}`,
    );
  }

  const rawText = await response.text();
  let data: ResolveProductsResponse | null = null;

  if (rawText.trim()) {
    try {
      data = JSON.parse(rawText) as ResolveProductsResponse;
    } catch {
      throw new Error(
        `后端返回了非 JSON 响应，请确认 ai-shop-server 已重启并监听 ${API_BASE_URL}`,
      );
    }
  }

  if (!response.ok) {
    throw new Error(data?.error || "同步商品信息失败");
  }

  return {
    products: data?.products ?? [],
    missingIds: data?.missingIds ?? [],
  };
}
