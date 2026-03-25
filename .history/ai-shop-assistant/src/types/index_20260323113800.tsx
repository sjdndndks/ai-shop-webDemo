//消息定义
export interface Message {
  id: number
  text: string 
  isUser: boolean
  rawText?: string
  product?: Product     //有？代表这个属性是可选的
  products?: Product[]
}

//商品定义
export interface Product{
  id: string
  name: string
  price: number
  imageUrl: string
}
