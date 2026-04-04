import type {
  AccountSettings,
  AuthUser,
  PaymentMethod,
  SavedAddress,
  SavedPaymentMethod,
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

type RequestOptions = RequestInit & {
  token: string;
};

export type AddressPayload = {
  label: string;
  recipientName: string;
  phone: string;
  address: string;
  isDefault: boolean;
};

export type PaymentMethodPayload = {
  label: string;
  method: PaymentMethod;
  accountName: string;
  accountIdentifier: string;
  cardNumber?: string;
  expiry?: string;
  isDefault: boolean;
};

type AddressResponse = {
  address: SavedAddress;
  error?: string;
};

type PaymentMethodResponse = {
  paymentMethod: SavedPaymentMethod;
  error?: string;
};

type ProfileResponse = {
  user: AuthUser;
  error?: string;
};

async function requestJson<T>(path: string, options: RequestOptions): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.token}`,
        ...(options.headers ?? {}),
      },
    });
  } catch {
    throw new Error(
      `无法连接到后端服务，请确认 ai-shop-server 已启动在 ${API_BASE_URL}`,
    );
  }

  const rawText = await response.text();
  let data: (T & { error?: string }) | null = null;

  if (rawText.trim()) {
    try {
      data = JSON.parse(rawText) as T & { error?: string };
    } catch {
      throw new Error(
        `后端返回了非 JSON 响应，请确认 ai-shop-server 已重启并监听 ${API_BASE_URL}`,
      );
    }
  }

  if (!response.ok) {
    throw new Error(data?.error || "请求失败");
  }

  return (data ?? {}) as T;
}

// 获取账户设置
export async function fetchAccountSettings(token: string) {
  return requestJson<AccountSettings>("/api/account/settings", {
    method: "GET",
    token,
  });
}

export async function updateAccountProfile(
  token: string,
  payload: {
    name: string;
    avatarUrl: string;
  },
) {
  return requestJson<ProfileResponse>("/api/account/profile", {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

export async function createAddress(token: string, payload: AddressPayload) {
  return requestJson<AddressResponse>("/api/account/addresses", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function updateAddress(
  token: string,
  addressId: string,
  payload: AddressPayload,
) {
  return requestJson<AddressResponse>(`/api/account/addresses/${addressId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

export async function deleteAddress(token: string, addressId: string) {
  return requestJson<Record<string, never>>(`/api/account/addresses/${addressId}`, {
    method: "DELETE",
    token,
  });
}

export async function createPaymentMethod(
  token: string,
  payload: PaymentMethodPayload,
) {
  return requestJson<PaymentMethodResponse>("/api/account/payment-methods", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function updatePaymentMethod(
  token: string,
  paymentMethodId: string,
  payload: PaymentMethodPayload,
) {
  return requestJson<PaymentMethodResponse>(
    `/api/account/payment-methods/${paymentMethodId}`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify(payload),
    },
  );
}

export async function deletePaymentMethod(token: string, paymentMethodId: string) {
  return requestJson<Record<string, never>>(
    `/api/account/payment-methods/${paymentMethodId}`,
    {
      method: "DELETE",
      token,
    },
  );
}
