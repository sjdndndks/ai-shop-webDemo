import { useCartStore } from "../store/cartStore";
import { Link } from "react-router-dom";
import styles from "./CartPage.moudle.css";

export function CartPage() {
  const items = useCartStore((state) => state.items);
  const totalPrice = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  return <main className={styles.container}></main>;
}
