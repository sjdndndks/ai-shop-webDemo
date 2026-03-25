import { useCartStore } from "../store/cartStore";
import { Link } from "react-router-dom";
import styles from "./CartPage.module.css";

export function CartPage() {
  const items = useCartStore((state) => state.items);
  const totalPrice = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  return (
    //页面主体
    <main className={styles.container}>
      <header className={styles.header}>
        <h2>🛒 我的购物车</h2>
        <Link to="/" style={{color:'#007aff', textDecoration:'none'}}>back</Link>
      </header>

      {items.length === 0? (
        <section className={styles.emptyState}>购物车是空的，快去让 AI 推荐点什么吧！</section>
      ):(
        
      )}
    </main>
  );
}
