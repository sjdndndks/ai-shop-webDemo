import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "../types";

//定义购物车里每件商品长什么样
export interface CartItem extends Product {
    // 数量 加购了多少个
    quantity: number
}

//购物车仓库结构
interface CartStore {
    items: CartItem[]   //已加购的商品卡片组
    selectedIds: string[]
    //方法：
    addToCart: (product: Product)=> void
    increaseQuantity: (productId: string) => void
    decreaseQuantity: (productId: string) => void
    removeFromCart: (productId: string) => void
    removeItems: (productIds: string[]) => void
    reconcileItems: (products: Product[], missingIds: string[]) => void
    toggleSelected: (productId: string) => void
    toggleSelectAll: () => void
    clearSelection: () => void
    clearCart: () => void
}

export const useCartStore = create<CartStore>()(
    persist(
        (set)=> ({
            items: [],
            selectedIds: [],

            // 把商品加到购物车 点击立即购买按钮时才会触发 刚加入时默认勾选
            addToCart: (product) =>
                set((state)=> {

                    // 判断商品是否已存在于购物车
                    const existingItem = state.items.find(item => item.id === product.id)

                    // 存在 对应cart卡片数量+1 并勾选
                    if (existingItem) {
                        return {
                            items: state.items.map(item => 
                                item.id === product.id
                                ? { ...item, quantity: item.quantity + 1 }
                                : item
                            ),
                            selectedIds: state.selectedIds.includes(product.id)
                                ? state.selectedIds
                                : [...state.selectedIds, product.id],
                        }
                    }

                    // 不存在 把卡片加到购物车卡片组 并勾选
                    return {
                        items: [...state.items, { ...product, quantity: 1 }],
                        selectedIds: [...state.selectedIds, product.id],
                    }
                }),

            // 和+按钮绑定 加商品数量
            increaseQuantity: (productId) =>
                set((state)=> ({
                    items: state.items.map(item => 
                        item.id === productId
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                    )
                })),

            // 和-按钮绑定 减商品数量
            decreaseQuantity: (productId) =>
                set((state)=> ({
                    items: state.items.flatMap(item => {
                        // 不是要减的那个商品 原样直接返回
                        if (item.id !== productId) {
                            return [item]
                        }

                        // 找到要减的商品了 只剩1个了 直接删除这个卡片 返回空数组
                        if (item.quantity <= 1) {
                            return []
                        }
                        // 数量大于1 直接减1 返回[已更新的卡片]
                        return [{ ...item, quantity: item.quantity - 1 }]
                    }),
                    // 先找被勾选列表中有没有这个商品 没有就不需要任何操作 如果有
                    // 还没更新状态前 如果商品数量为1 那这次减1 就会被删除 要把他从勾选列表中删除
                    // 不是1 就不要改
                    selectedIds: state.items.find(item => item.id === productId)?.quantity === 1
                        ? state.selectedIds.filter(id => id !== productId)
                        : state.selectedIds,
                })),

            // 删除单个商品
            removeFromCart: (productId) =>
                set((state)=> ({
                    items: state.items.filter(item => item.id !== productId),
                    selectedIds: state.selectedIds.filter(id => id !== productId),
                })),

            // 删除一组商品 传入一组要删除的商品的id
            removeItems: (productIds) =>
                set((state)=> ({
                    items: state.items.filter(item => !productIds.includes(item.id)),
                    selectedIds: state.selectedIds.filter(id => !productIds.includes(id)),
                })),

            // 拿后端返回的最新商品数据和缺失商品id数组，来同步本地购物车。
            reconcileItems: (products, missingIds) =>
                set((state)=> {
                    // 把后端返回的商品最新数据转换为map 以商品id为key
                    const productMap = new Map(products.map(product => [product.id, product]))
                    // 从购物车卡片组中过滤掉缺失的商品并更新
                    const nextItems = state.items
                        .filter(item => !missingIds.includes(item.id))
                        .map(item => {
                            // 拿出目前item对应的最新商品数据
                            const latestProduct = productMap.get(item.id)

                            // 没有最新商品数据 直接返回原item
                            if (!latestProduct) {
                                return item
                            }

                            // 有更新数据 就用新的覆盖本地旧数据 但原来的quantity不变
                            return {
                                ...item,
                                ...latestProduct,
                            }
                        })
                    // 从购物车勾选列表组中过滤掉缺失的商品id
                    const nextSelectedIds = state.selectedIds.filter(id => !missingIds.includes(id))
                    // 判断cart items是否有变化
                    const itemsChanged =
                        nextItems.length !== state.items.length ||
                        nextItems.some((item, index) => {
                            const currentItem = state.items[index]

                            // 逐项比较是否有变化 有一项不同就是变了
                            return (
                                item.id !== currentItem.id ||
                                item.name !== currentItem.name ||
                                item.price !== currentItem.price ||
                                item.imageUrl !== currentItem.imageUrl ||
                                item.quantity !== currentItem.quantity
                            )
                        })
                    // 判断selectedIds是否有变化
                    const selectionChanged =
                        nextSelectedIds.length !== state.selectedIds.length 

                    // 如果都没变就返回原来的state 不更新状态  
                    if (!itemsChanged && !selectionChanged) {
                        return state
                    }

                    return {
                        items: nextItems,
                        selectedIds: nextSelectedIds,
                    }
                }),

            // 切换单个商品的勾选状态
            toggleSelected: (productId) =>
                set((state)=> ({
                    selectedIds: state.selectedIds.includes(productId)
                        ? state.selectedIds.filter(id => id !== productId)
                        : [...state.selectedIds, productId],
                })),

            // 切换是否全选
            toggleSelectAll: () =>
                set((state)=> ({
                    // 先判断选中的和仓库中的所有商品组长度是否一样 一样就改成全不选
                    selectedIds: state.selectedIds.length === state.items.length
                        ? []
                        : state.items.map(item => item.id),
                })),

            // 清空勾选列表
            clearSelection: () => set({ selectedIds: [] }),

            // 清空购物车
            clearCart: () => set({ items: [], selectedIds: [] })
        }),
        {
            name: "ai-shop-cart",
            version: 2,
            migrate: (persistedState) => {
                const state = persistedState as {
                    items?: CartItem[]
                    selectedIds?: string[]
                }
                // 如果旧数据里有 items，就用它；没有就用空数组。
                const items = state?.items ?? []
                const validIds = new Set(items.map(item => item.id))
                const selectedIds = (state?.selectedIds ?? items.map(item => item.id))
                    .filter(id => validIds.has(id))

                return {
                    items,
                    selectedIds,
                }
            }
        }
    )
)
