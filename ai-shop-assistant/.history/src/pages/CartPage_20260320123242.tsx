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
        <Link to="/" style={{ color: "#007aff", textDecoration: "none" }}>
          back
        </Link>
      </header>

      {items.length === 0 ? (
        <section className={styles.emptyState}>
          购物车是空的，快去让 AI 推荐点什么吧！
        </section>
      ) : (
        <section>
          {items.map((item) => (
            <article key={item.id} className={styles.cartItem}>
              <img
                src={item.imageUrl}
                alt={item.name}
                className={styles.itemImage}
              />
              <div className={styles.itemInfo}>
                <h3 className={styles.itemName}>{item.name}</h3>
                <p className={styles.itemPrice}>${item.price}</p>
              </div>
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: "bold",
                }}
              >
                x {item.quantity}
              </div>
            </article>
          ))}

          <footer className={styles.checkoutSection}>
            <div style={{ fontSize: "20px" }}>
              总计：
              <span
                style={{
                  color: "#ff4d4f",
                  fontWeight: "bold",
                  fontSize: "28px",
                }}
              >
                ${totalPrice.toFixed(2)}
              </span>
            </div>
            <button className={styles.checkoutBtn}>去结算</button>
          </footer>
        </section>
      )}
    </main>
  );
}
