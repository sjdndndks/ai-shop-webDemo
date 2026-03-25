import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "../types";

//定义购物车里每件商品长什么样
export interface CartItem extends Product {
    quantity: number
}

//定义记账本的规矩
interface CartStore {
    items: CartItem[]
    selectedIds: string[]
    //把商品扔进购物车
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
            addToCart: (product) =>
                set((state)=> {
                    const existingItem = state.items.find(item => item.id === product.id)
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

                    return {
                        items: [...state.items, { ...product, quantity: 1 }],
                        selectedIds: [...state.selectedIds, product.id],
                    }
                }),
            increaseQuantity: (productId) =>
                set((state)=> ({
                    items: state.items.map(item => 
                        item.id === productId
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                    )
                })),
            decreaseQuantity: (productId) =>
                set((state)=> ({
                    items: state.items.flatMap(item => {
                        if (item.id !== productId) {
                            return [item]
                        }

                        if (item.quantity <= 1) {
                            return []
                        }

                        return [{ ...item, quantity: item.quantity - 1 }]
                    }),
                    selectedIds: state.items.find(item => item.id === productId)?.quantity === 1
                        ? state.selectedIds.filter(id => id !== productId)
                        : state.selectedIds,
                })),
            removeFromCart: (productId) =>
                set((state)=> ({
                    items: state.items.filter(item => item.id !== productId),
                    selectedIds: state.selectedIds.filter(id => id !== productId),
                })),
            removeItems: (productIds) =>
                set((state)=> ({
                    items: state.items.filter(item => !productIds.includes(item.id)),
                    selectedIds: state.selectedIds.filter(id => !productIds.includes(id)),
                })),
            reconcileItems: (products, missingIds) =>
                set((state)=> {
                    const productMap = new Map(products.map(product => [product.id, product]))
                    const nextItems = state.items
                        .filter(item => !missingIds.includes(item.id))
                        .map(item => {
                            const latestProduct = productMap.get(item.id)

                            if (!latestProduct) {
                                return item
                            }

                            return {
                                ...item,
                                ...latestProduct,
                            }
                        })
                    const nextSelectedIds = state.selectedIds.filter(id => !missingIds.includes(id))
                    const itemsChanged =
                        nextItems.length !== state.items.length ||
                        nextItems.some((item, index) => {
                            const currentItem = state.items[index]

                            if (!currentItem) {
                                return true
                            }

                            return (
                                item.id !== currentItem.id ||
                                item.name !== currentItem.name ||
                                item.price !== currentItem.price ||
                                item.imageUrl !== currentItem.imageUrl ||
                                item.quantity !== currentItem.quantity
                            )
                        })
                    const selectionChanged =
                        nextSelectedIds.length !== state.selectedIds.length ||
                        nextSelectedIds.some((id, index) => id !== state.selectedIds[index])

                    if (!itemsChanged && !selectionChanged) {
                        return state
                    }

                    return {
                        items: nextItems,
                        selectedIds: nextSelectedIds,
                    }
                }),
            toggleSelected: (productId) =>
                set((state)=> ({
                    selectedIds: state.selectedIds.includes(productId)
                        ? state.selectedIds.filter(id => id !== productId)
                        : [...state.selectedIds, productId],
                })),
            toggleSelectAll: () =>
                set((state)=> ({
                    selectedIds: state.selectedIds.length === state.items.length
                        ? []
                        : state.items.map(item => item.id),
                })),
            clearSelection: () => set({ selectedIds: [] }),
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
