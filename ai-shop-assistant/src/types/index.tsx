//消息定义
export interface Message {
  id: number;
  text: string;
  isUser: boolean;
  rawText?: string; //ai返回的原始文本
  product?: Product; //返回一个商品
  products?: Product[]; //返回多个商品
}

//商品定义
export interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
}

export type PaymentMethod = "card" | "alipay" | "wechat";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
}

export interface SavedAddress {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  address: string;
  isDefault: boolean;
}

export interface SavedPaymentMethod {
  id: string;
  label: string;
  method: PaymentMethod;
  accountName: string;
  accountIdentifier: string;
  cardLast4: string;
  expiry: string;
  isDefault: boolean;
}

export interface AccountSettings {
  user: AuthUser;
  addresses: SavedAddress[];
  paymentMethods: SavedPaymentMethod[];
}
