/* 
    渲染购物车页面
    从cartstore读取状态并计算
    两个副作用：商品同步 滚动按钮
*/
import { useEffect, useRef, useState } from "react";
// 和后端商品库对账的API函数
import { resolveCatalogProducts } from "../lib/catalogApi";
import { useCartStore } from "../store/cartStore";
import { Link, useNavigate } from "react-router-dom";
import styles from "./CartPage.module.css";

// 定义离底部多近才算滚动到底部
const BOTTOM_THRESHOLD = 48;

export function CartPage() {
  // 从store中取
  const items = useCartStore((state) => state.items);
  const selectedIds = useCartStore((state) => state.selectedIds);
  const increaseQuantity = useCartStore((state) => state.increaseQuantity);
  const decreaseQuantity = useCartStore((state) => state.decreaseQuantity);
  const reconcileItems = useCartStore((state) => state.reconcileItems);
  const toggleSelected = useCartStore((state) => state.toggleSelected);
  const toggleSelectAll = useCartStore((state) => state.toggleSelectAll);

  const navigate = useNavigate();
  // 保存滚动容器DOM
  const scrollAreaRef = useRef<HTMLElement>(null);
  // 是否显示滚动到底部按钮
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  // 商品库对账通知
  const [catalogNotice, setCatalogNotice] = useState("");
  // 购物车中被选中的商品数组
  const selectedItems = items.filter((item) => selectedIds.includes(item.id));
  // 所有选中的商品总价
  const totalPrice = selectedItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  // 统计已选商品总数
  const selectedCount = selectedItems.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  // 判断是否全选
  const allSelected = items.length > 0 && selectedIds.length === items.length;

  // 判断滚动到底部按钮是否显示
  const updateScrollButtonVisibility = (scrollElement: HTMLElement | null) => {
    if (!scrollElement) {
      return;
    }

    // 计算离底部有多远
    const distanceToBottom =
      scrollElement.scrollHeight -
      scrollElement.scrollTop -
      scrollElement.clientHeight;

    //   如果离底部超过既定的高度 就显示按钮
    setShowScrollToBottom(distanceToBottom > BOTTOM_THRESHOLD);
  };

  // 执行滚动到底部
  const scrollToBottom = () => {
    const scrollElement = scrollAreaRef.current;

    if (!scrollElement) {
      return;
    }

    scrollElement.scrollTo({
      top: scrollElement.scrollHeight, //指定沿y轴滚动的像素数-滚到内容最底端
      behavior: "smooth",
    });
    // 隐藏滚动按钮
    setShowScrollToBottom(false);
  };

  //   商品数量变化时需要重新判断按钮是否显示
  useEffect(() => {
    updateScrollButtonVisibility(scrollAreaRef.current);
  }, [items.length]);

  useEffect(() => {
    // 标记本次effect是否有效
    let active = true;

    // 如果购物车是空的 就不用去后端对账
    if (items.length === 0) {
      setCatalogNotice("");
      return;
    }

    const syncItems = async () => {
      try {
        const result = await resolveCatalogProducts(
          items.map((item) => item.id),
        );

        // 本次effect过期了 回去吧
        if (!active) {
          return;
        }

        // 把后端返回的存在商品的最新信息和已经不存在的商品id给store 让他自己更新信息
        reconcileItems(result.products, result.missingIds);

        // 如果有失效商品就提示一下
        if (result.missingIds.length > 0) {
          setCatalogNotice(
            `购物车里有 ${result.missingIds.length} 件旧商品已下架，系统已经自动移除。`,
          );
        } else {
          setCatalogNotice("");
        }
      } catch {
        // 同步失败 不打断购物车主流程 静默降级 不打扰用户
        if (active) {
          // 清除提示
          setCatalogNotice("");
        }
      }
    };

    // 明确告诉ts 不接返回值
    void syncItems();

    // 清理函数，组件卸载时关闭active
    return () => {
      active = false;
    };
  }, [items, reconcileItems]);

  return (
    <div className={styles.page}>
      <main //主要滚动区域
        ref={scrollAreaRef}
        className={styles.container}
        // 页面滚动时会触发
        onScroll={(event) => {
          updateScrollButtonVisibility(event.currentTarget);
        }}
      >
        {/* 头部标题和返回link */}
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
          // 开始渲染购物车内容
          <section>
            {/* 有同步提示就显示 没有就不显示 */}
            {catalogNotice && (
              <div className={styles.catalogNotice}>{catalogNotice}</div>
            )}
            {/* 全选框和统计小字 */}
            <div className={styles.selectionBar}>
              <label className={styles.selectAllControl}>
                <input
                  type="checkbox"
                  checked={allSelected} //表示是否被默认选中
                  onChange={() => toggleSelectAll()} //用户切换时
                />
                <span>全选</span>
              </label>
              <span className={styles.selectionMeta}>
                已选 {selectedItems.length} 种商品，共 {selectedCount} 件
              </span>
            </div>

            {items.map((item) => (
              // 每个商品卡片
              <article key={item.id} className={styles.cartItem}>
                {/* 复选框 */}
                <label className={styles.checkboxWrap}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={() => toggleSelected(item.id)}
                  />
                </label>
                {/* 商品图片 */}
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className={styles.itemImage}
                />
                {/* 商品信息 */}
                <div className={styles.itemInfo}>
                  <h3 className={styles.itemName}>{item.name}</h3>
                  <p className={styles.itemPrice}>¥{item.price}</p>
                  {/* 单项商品小记 保留两位小数 */}
                  <p className={styles.itemSubtotal}>
                    小计：¥{(item.price * item.quantity).toFixed(2)}
                  </p>
                </div>
                {/* 商品选购数量控制 */}
                <div className={styles.quantityControl}>
                  <button
                    className={styles.quantityBtn}
                    onClick={() => decreaseQuantity(item.id)}
                  >
                    -
                  </button>
                  <span className={styles.quantityValue}>{item.quantity}</span>
                  <button
                    className={styles.quantityBtn}
                    onClick={() => increaseQuantity(item.id)}
                  >
                    +
                  </button>
                </div>
              </article>
            ))}

            {/* 结算区 */}
            <footer className={styles.checkoutSection}>
              {/* 统计金额 */}
              <div style={{ fontSize: "20px" }}>
                已选总计：
                <span
                  style={{
                    color: "#ff4d4f",
                    fontWeight: "bold",
                    fontSize: "28px",
                  }}
                >
                  ¥{totalPrice.toFixed(2)}
                </span>
              </div>
              {/* 按钮 */}
              <button
                className={styles.checkoutBtn}
                disabled={selectedItems.length === 0}
                onClick={() => navigate("/checkout")}
              >
                {selectedItems.length === 0 ? "请先勾选商品" : "去结算已选商品"}
              </button>
            </footer>
          </section>
        )}
      </main>

      {/* 购物车有商品并且离底部远就显示按钮 */}
      {items.length > 0 && showScrollToBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          className={styles.scrollToBottomBtn}
          title="滚动到底部" //鼠标悬停时的提示
          aria-label="滚动到底部"
        >
          ⬇
        </button>
      )}
    </div>
  );
}
