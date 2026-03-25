import { useCartStore } from "../store/cartStore";
import { Link } from "react-router-dom";
import styles from "./CartPage.moudle.css";

export function CartPage() {
  const items = useCartStore((state) => state.items);
  const totalPrice = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  return (
    //页面主体
    <main className={styles.container}>
      <header className={styles.header}></header>
    </main>
  );
}
