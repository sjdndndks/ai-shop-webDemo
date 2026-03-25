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
