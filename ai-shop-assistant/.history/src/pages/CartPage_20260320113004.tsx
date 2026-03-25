import { useCartStore } from "../store/cartStore";
import { Link } from "react-router-dom";

export function CartPage(){
    const items = useCartStore((state) => state.items)
    const totalPrice = items.reduce((sum,item) => sum + item.price * item.quantity, 0)

    return (
        
    )
}