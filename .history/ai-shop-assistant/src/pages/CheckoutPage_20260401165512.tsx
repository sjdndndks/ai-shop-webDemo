import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { fetchAccountSettings } from "../lib/accountApi";
import { resolveCatalogProducts } from "../lib/catalogApi";
import { useAuthStore } from "../store/authStore";
import { useCartStore } from "../store/cartStore";
import type { AccountSettings } from "../types";
import styles from "./CheckoutPage.module.css";

// 后端下单接口返回值
type OrderResponse = {
  error?: string;
  order?: {
    id: string;
    total: number;
  };
};

// 后端服务器的基础地址 通过地址找后端
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

const paymentMethodLabels = {
  card: "银行卡",
  alipay: "支付宝",
  wechat: "微信支付",
} as const; //常量断言：把对象里的值固定死

export function CheckoutPage() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const setUser = useAuthStore((state) => state.setUser);
  const items = useCartStore((state) => state.items);
  const selectedIds = useCartStore((state) => state.selectedIds);
  const removeItems = useCartStore((state) => state.removeItems);
  const reconcileItems = useCartStore((state) => state.reconcileItems);

  // 账户设置的地址和支付方式信息
  const [accountSettings, setAccountSettings] =
    useState<AccountSettings | null>(null);

  // 当前选中的地址id
  const [selectedAddressId, setSelectedAddressId] = useState("");

  // 当前选择的支付方式
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState("");

  // 是否正在加载账户设置
  const [loadingSettings, setLoadingSettings] = useState(false);

  // 是否正在提交订单
  const [submitting, setSubmitting] = useState(false);

  // 是否支付成功
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  //
  const [paidAmount, setPaidAmount] = useState(0);
  // 订单ID
  const [orderId, setOrderId] = useState("");
  const [error, setError] = useState("");

  // 商品同步提示
  const [catalogNotice, setCatalogNotice] = useState("");

  // 计算出选中的商品ID
  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.includes(item.id)),
    [items, selectedIds],
  );

  // 已选商品总数
  const totalQuantity = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.quantity, 0),
    [selectedItems],
  );

  // 商品总额
  const subtotal = useMemo(
    () =>
      selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [selectedItems],
  );

  // 运费 总价大于99或者没买商品 免运费
  const shippingFee = subtotal >= 99 || selectedItems.length === 0 ? 0 : 12;

  // 应付金额 总价+运费
  const payableAmount = subtotal + shippingFee;

  // 加载账户设置
  useEffect(() => {
    // 没登录权限 没法请求后端
    if (!token) {
      return;
    }

    let active = true;

    // 加载设置函数
    const loadSettings = async () => {
      try {
        setLoadingSettings(true);

        // 去后端拉地址和支付方式
        const settings = await fetchAccountSettings(token);

        if (!active) {
          return;
        }

        // 同步信息
        setAccountSettings(settings);
        setUser(settings.user);

        // 设置地址 默认地址？第一个地址？空地址
        setSelectedAddressId(
          settings.addresses.find((address) => address.isDefault)?.id ||
            settings.addresses[0]?.id ||
            "",
        );
        setSelectedPaymentMethodId(
          settings.paymentMethods.find(
            (paymentMethod) => paymentMethod.isDefault,
          )?.id ||
            settings.paymentMethods[0]?.id ||
            "",
        );
      } catch (loadError) {
        if (!active) {
          return;
        }

        // 设置error信息
        setError(
          loadError instanceof Error
            ? loadError.message
            : "获取账户信息失败，请稍后再试",
        );
      } finally {
        if (active) {
          setLoadingSettings(false);
        }
      }
    };

    void loadSettings();

    return () => {
      active = false;
    };
  }, [setUser, token]);

  // 和后端商品库对账 和购物车的那个一样
  useEffect(() => {
    let active = true;

    // 购物车为空 清楚提示并退出
    if (items.length === 0) {
      setCatalogNotice("");
      return;
    }

    const syncItems = async () => {
      try {
        const result = await resolveCatalogProducts(
          items.map((item) => item.id),
        );

        if (!active) {
          return;
        }

        reconcileItems(result.products, result.missingIds);

        if (result.missingIds.length > 0) {
          setCatalogNotice(
            `购物车里有 ${result.missingIds.length} 件旧商品已下架，系统已经自动移除。`,
          );
        } else {
          setCatalogNotice("");
        }
      } catch {
        if (active) {
          setCatalogNotice("");
        }
      }
    };

    void syncItems();

    return () => {
      active = false;
    };
  }, [items, reconcileItems]);

  // 如果没登录 就转到登录页
  if (!user || !token) {
    return <Navigate to="/login" replace />;
  }

  // 处理提交订单事件
  const handleSubmit = async () => {
    // 没选商品
    if (selectedItems.length === 0) {
      setError("请先在购物车里勾选要结算的商品。");
      return;
    }

    // 没保存过地址
    if (!selectedAddressId) {
      setError("请先在设置里保存地址，并选择一个收货地址。");
      return;
    }

    // 没保存过支付方式
    if (!selectedPaymentMethodId) {
      setError("请先在设置里保存支付方式，并选择一个支付方式。");
      return;
    }

    // 开始提交流程
    try {
      setError("");
      setSubmitting(true);

      let response: Response;

      try {
        // 提交订单
        response = await fetch(`${API_BASE_URL}/api/orders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            items: selectedItems.map((item) => ({
              productId: item.id,
              quantity: item.quantity,
            })),
            addressId: selectedAddressId,
            paymentProfileId: selectedPaymentMethodId,
          }),
        });
      } catch {
        throw new Error(
          `无法连接到后端服务，请确认 ai-shop-server 已启动在 ${API_BASE_URL}`,
        );
      }

      const rawText = await response.text();
      let data: OrderResponse | null = null;

      if (rawText.trim()) {
        try {
          data = JSON.parse(rawText) as OrderResponse;
        } catch {
          throw new Error(
            `后端返回了非 JSON 响应，请确认 ai-shop-server 已重启并监听 ${API_BASE_URL}`,
          );
        }
      }

      if (!response.ok || !data?.order) {
        throw new Error(data?.error || "提交订单失败");
      }

      setPaidAmount(data.order.total);
      setOrderId(data.order.id);
      removeItems(selectedItems.map((item) => item.id));
      setPaymentSuccess(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "支付请求失败",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <header className={styles.header}>
          {/* 左侧标题区 */}
          <div>
            <p className={styles.kicker}>Checkout</p>
            <h1 className={styles.title}>确认订单与支付</h1>
          </div>
          {/* 右侧link区 */}
          <div className={styles.headerActions}>
            <Link to="/settings" className={styles.backLink}>
              管理地址与支付方式
            </Link>
            <Link to="/cart" className={styles.backLink}>
              返回购物车
            </Link>
          </div>
        </header>

        {paymentSuccess ? (
          // 支付成功
          <section className={styles.successCard}>
            <div className={styles.successIcon}>✓</div>
            <h2 className={styles.successTitle}>支付成功</h2>
            <p className={styles.successText}>
              订单已提交，{user.name}，我们会尽快为你安排发货。
            </p>
            <div className={styles.successMeta}>
              <span>订单号</span>
              <strong>{orderId}</strong>
            </div>
            <div className={styles.successMeta}>
              <span>支付金额</span>
              <strong>¥{paidAmount.toFixed(2)}</strong>
            </div>
            <div className={styles.successActions}>
              <Link to="/" className={styles.primaryBtn}>
                回到聊天页
              </Link>
              <Link to="/settings" className={styles.secondaryBtn}>
                继续管理账户信息
              </Link>
            </div>
          </section>
        ) : (
          // 还没支付成功
          <div className={styles.grid}>
            {/* 左侧表单卡片 */}
            <section className={styles.formCard}>
              <div className={styles.form}>
                {/* 收货地址区 */}
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <h2 className={styles.sectionTitle}>收货地址</h2>
                      <p className={styles.sectionHint}>
                        直接使用你在设置页里保存的地址，无需每次重复填写。
                      </p>
                    </div>
                    <Link to="/settings" className={styles.inlineLink}>
                      去设置
                    </Link>
                  </div>

                  {loadingSettings ? (
                    <div className={styles.paymentHint}>
                      正在加载账户信息...
                    </div>
                  ) : accountSettings?.addresses.length ? (
                    <div className={styles.optionList}>
                      {/* 渲染地址卡片组 */}
                      {accountSettings.addresses.map((address) => (
                        <button
                          type="button"
                          key={address.id}
                          className={`${styles.optionCard} ${selectedAddressId === address.id ? styles.optionCardActive : ""}`}
                          onClick={() => setSelectedAddressId(address.id)}
                        >
                          <div className={styles.optionTop}>
                            <strong>{address.label}</strong>
                            {address.isDefault && (
                              <span className={styles.defaultBadge}>默认</span>
                            )}
                          </div>
                          <div className={styles.optionMeta}>
                            {address.recipientName} · {address.phone}
                          </div>
                          <div className={styles.optionDetail}>
                            {address.address}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.emptyState}>
                      还没有保存任何地址，先去设置页添加一个地址。
                    </div>
                  )}
                </div>

                {/* 支付方式区 */}
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <h2 className={styles.sectionTitle}>支付方式</h2>
                      <p className={styles.sectionHint}>
                        支付方式也从设置页读取，可保存多组并设置默认。
                      </p>
                    </div>
                    <Link to="/settings" className={styles.inlineLink}>
                      去设置
                    </Link>
                  </div>

                  {loadingSettings ? (
                    <div className={styles.paymentHint}>
                      正在加载支付方式...
                    </div>
                  ) : accountSettings?.paymentMethods.length ? (
                    <div className={styles.optionList}>
                      {accountSettings.paymentMethods.map((paymentMethod) => (
                        <button
                          type="button"
                          key={paymentMethod.id}
                          className={`${styles.optionCard} ${selectedPaymentMethodId === paymentMethod.id ? styles.optionCardActive : ""}`}
                          onClick={() =>
                            setSelectedPaymentMethodId(paymentMethod.id)
                          }
                        >
                          <div className={styles.optionTop}>
                            <strong>{paymentMethod.label}</strong>
                            {paymentMethod.isDefault && (
                              <span className={styles.defaultBadge}>默认</span>
                            )}
                          </div>
                          <div className={styles.optionMeta}>
                            {paymentMethodLabels[paymentMethod.method]}
                          </div>
                          <div className={styles.optionDetail}>
                            {paymentMethod.accountName} ·{" "}
                            {paymentMethod.accountIdentifier}
                            {paymentMethod.expiry
                              ? ` · 有效期 ${paymentMethod.expiry}`
                              : ""}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.emptyState}>
                      还没有保存任何支付方式，先去设置页添加一个。
                    </div>
                  )}
                </div>

                {catalogNotice && (
                  <div className={styles.paymentHint}>{catalogNotice}</div>
                )}
                {error && <div className={styles.error}>{error}</div>}

                <button
                  type="button"
                  className={styles.submitBtn}
                  onClick={handleSubmit}
                  disabled={submitting || loadingSettings}
                >
                  {submitting ? "提交中..." : "确认支付并下单"}
                </button>
              </div>
            </section>

            <aside className={styles.summaryCard}>
              <div className={styles.summaryHeader}>
                <span>已选商品</span>
                <strong>{totalQuantity} 件</strong>
              </div>

              {selectedItems.length === 0 ? (
                <div className={styles.emptyState}>
                  当前没有勾选任何要结算的商品。
                </div>
              ) : (
                <div className={styles.summaryList}>
                  {selectedItems.map((item) => (
                    <div key={item.id} className={styles.summaryItem}>
                      <div>
                        <div className={styles.itemName}>{item.name}</div>
                        <div className={styles.itemMeta}>
                          数量 {item.quantity}
                        </div>
                      </div>
                      <strong>
                        ¥{(item.price * item.quantity).toFixed(2)}
                      </strong>
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.totalRow}>
                <span>商品小计</span>
                <strong>¥{subtotal.toFixed(2)}</strong>
              </div>
              <div className={styles.totalRow}>
                <span>运费</span>
                <strong>
                  {shippingFee === 0 ? "免运费" : `¥${shippingFee.toFixed(2)}`}
                </strong>
              </div>
              <div className={`${styles.totalRow} ${styles.grandTotal}`}>
                <span>应付总额</span>
                <strong>¥{payableAmount.toFixed(2)}</strong>
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
