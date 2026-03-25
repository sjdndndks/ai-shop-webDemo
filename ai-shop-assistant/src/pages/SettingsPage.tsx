import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { Link } from "react-router-dom";
import {
  createAddress,
  createPaymentMethod,
  deleteAddress,
  deletePaymentMethod,
  fetchAccountSettings,
  type AddressPayload,
  type PaymentMethodPayload,
  updateAccountProfile,
  updateAddress,
  updatePaymentMethod,
} from "../lib/accountApi";
import {
  MAX_RECOMMENDATION_COUNT,
  MIN_RECOMMENDATION_COUNT,
  useSettingsStore,
} from "../store/settingsStore";
import { useAuthStore } from "../store/authStore";
import type { PaymentMethod } from "../types";
import styles from "./SettingsPage.module.css";

const presetCounts = Array.from(
  { length: MAX_RECOMMENDATION_COUNT - MIN_RECOMMENDATION_COUNT + 1 },
  (_, index) => MIN_RECOMMENDATION_COUNT + index,
);

const emptyAddressForm: AddressPayload = {
  label: "",
  recipientName: "",
  phone: "",
  address: "",
  isDefault: false,
};

const emptyPaymentForm: PaymentMethodPayload = {
  label: "",
  method: "card",
  accountName: "",
  accountIdentifier: "",
  cardNumber: "",
  expiry: "",
  isDefault: false,
};

const paymentMethodLabels: Record<PaymentMethod, string> = {
  card: "银行卡",
  alipay: "支付宝",
  wechat: "微信支付",
};

const MAX_AVATAR_FILE_SIZE = 2 * 1024 * 1024;

export function SettingsPage() {
  const productCount = useSettingsStore((state) => state.productCount);
  const setProductCount = useSettingsStore((state) => state.setProductCount);
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const setUser = useAuthStore((state) => state.setUser);
  const [profileName, setProfileName] = useState(user?.name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [accountSettings, setAccountSettings] = useState<Awaited<
    ReturnType<typeof fetchAccountSettings>
  > | null>(null);
  const [addressForm, setAddressForm] = useState<AddressPayload>(emptyAddressForm);
  const [paymentForm, setPaymentForm] =
    useState<PaymentMethodPayload>(emptyPaymentForm);
  const [editingAddressId, setEditingAddressId] = useState("");
  const [editingPaymentMethodId, setEditingPaymentMethodId] = useState("");
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [savingPaymentMethod, setSavingPaymentMethod] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const recommendationText = useMemo(
    () => `当前会默认推荐 ${productCount} 件商品。这个设置保存在浏览器本地。`,
    [productCount],
  );

  const handleAvatarFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("头像必须是图片文件。");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_AVATAR_FILE_SIZE) {
      setError("头像图片不能超过 2MB。");
      event.target.value = "";
      return;
    }

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
          if (typeof reader.result === "string") {
            resolve(reader.result);
            return;
          }

          reject(new Error("头像读取失败"));
        };

        reader.onerror = () => reject(new Error("头像读取失败"));
        reader.readAsDataURL(file);
      });

      setAvatarUrl(dataUrl);
      setError("");
      setSuccessMessage("头像已读取，点击“保存账户资料”后生效。");
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : "头像读取失败");
    } finally {
      event.target.value = "";
    }
  };

  const loadAccount = async (active = true) => {
    if (!token) {
      return;
    }

    try {
      setLoadingAccount(true);
      const settings = await fetchAccountSettings(token);

      if (!active) {
        return;
      }

      setAccountSettings(settings);
      setUser(settings.user);
      setProfileName(settings.user.name);
      setAvatarUrl(settings.user.avatarUrl || "");
    } catch (loadError) {
      if (!active) {
        return;
      }

      setError(
        loadError instanceof Error
          ? loadError.message
          : "获取账户设置失败，请稍后再试",
      );
    } finally {
      if (active) {
        setLoadingAccount(false);
      }
    }
  };

  useEffect(() => {
    let active = true;

    if (token) {
      void loadAccount(active);
    }

    return () => {
      active = false;
    };
  }, [token]);

  const resetAddressForm = () => {
    setEditingAddressId("");
    setAddressForm({
      ...emptyAddressForm,
      isDefault: !accountSettings?.addresses.length,
    });
  };

  const resetPaymentForm = () => {
    setEditingPaymentMethodId("");
    setPaymentForm({
      ...emptyPaymentForm,
      isDefault: !accountSettings?.paymentMethods.length,
    });
  };

  const handleProfileSave = async () => {
    if (!token) {
      return;
    }

    try {
      setSavingProfile(true);
      setError("");
      setSuccessMessage("");
      const result = await updateAccountProfile(token, {
        name: profileName.trim(),
        avatarUrl: avatarUrl.trim(),
      });

      setUser(result.user);
      setSuccessMessage("账户资料已保存。");
      await loadAccount();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存账户资料失败");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddressSave = async () => {
    if (!token) {
      return;
    }

    try {
      setSavingAddress(true);
      setError("");
      setSuccessMessage("");

      if (editingAddressId) {
        await updateAddress(token, editingAddressId, addressForm);
        setSuccessMessage("地址已更新。");
      } else {
        await createAddress(token, addressForm);
        setSuccessMessage("地址已新增。");
      }

      resetAddressForm();
      await loadAccount();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存地址失败");
    } finally {
      setSavingAddress(false);
    }
  };

  const handleAddressDelete = async (addressId: string) => {
    if (!token) {
      return;
    }

    try {
      setError("");
      setSuccessMessage("");
      await deleteAddress(token, addressId);
      setSuccessMessage("地址已删除。");

      if (editingAddressId === addressId) {
        resetAddressForm();
      }

      await loadAccount();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除地址失败");
    }
  };

  const handlePaymentMethodSave = async () => {
    if (!token) {
      return;
    }

    try {
      setSavingPaymentMethod(true);
      setError("");
      setSuccessMessage("");

      if (editingPaymentMethodId) {
        await updatePaymentMethod(token, editingPaymentMethodId, paymentForm);
        setSuccessMessage("支付方式已更新。");
      } else {
        await createPaymentMethod(token, paymentForm);
        setSuccessMessage("支付方式已新增。");
      }

      resetPaymentForm();
      await loadAccount();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "保存支付方式失败",
      );
    } finally {
      setSavingPaymentMethod(false);
    }
  };

  const handlePaymentMethodDelete = async (paymentMethodId: string) => {
    if (!token) {
      return;
    }

    try {
      setError("");
      setSuccessMessage("");
      await deletePaymentMethod(token, paymentMethodId);
      setSuccessMessage("支付方式已删除。");

      if (editingPaymentMethodId === paymentMethodId) {
        resetPaymentForm();
      }

      await loadAccount();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "删除支付方式失败",
      );
    }
  };

  return (
    <main className={styles.container}>
      <div className={styles.content}>
        <header className={styles.header}>
          <h2 className={styles.title}>设置中心</h2>
          <p className={styles.subtitle}>
            管理推荐数量、账户资料、常用地址和支付方式。
          </p>
        </header>

        <section className={styles.panel}>
          <div className={styles.row}>
            <div>
              <h3 className={styles.sectionTitle}>每次推荐商品数</h3>
              <p className={styles.helpText}>{recommendationText}</p>
            </div>

            <div className={styles.stepper}>
              <button
                className={styles.stepBtn}
                onClick={() => setProductCount(productCount - 1)}
              >
                -
              </button>
              <div className={styles.countValue}>{productCount}</div>
              <button
                className={styles.stepBtn}
                onClick={() => setProductCount(productCount + 1)}
              >
                +
              </button>
            </div>
          </div>

          <div className={styles.presetList}>
            {presetCounts.map((count) => (
              <button
                key={count}
                className={`${styles.presetBtn} ${count === productCount ? styles.presetBtnActive : ""}`}
                onClick={() => setProductCount(count)}
              >
                {count} 件
              </button>
            ))}
          </div>
        </section>

        {!user || !token ? (
          <section className={styles.panel}>
            <h3 className={styles.sectionTitle}>账户设置</h3>
            <p className={styles.helpText}>
              登录后才能保存头像、昵称、地址和支付方式，并在结算页直接复用。
            </p>
            <Link to="/login" className={styles.primaryLink}>
              去登录
            </Link>
          </section>
        ) : (
          <>
            {(loadingAccount || error || successMessage) && (
              <section className={styles.statusGroup}>
                {loadingAccount && (
                  <div className={styles.infoBanner}>正在加载账户数据...</div>
                )}
                {error && <div className={styles.errorBanner}>{error}</div>}
                {successMessage && (
                  <div className={styles.successBanner}>{successMessage}</div>
                )}
              </section>
            )}

            <section className={styles.panel}>
              <div className={styles.sectionHeader}>
                <div>
                  <h3 className={styles.sectionTitle}>账户资料</h3>
                  <p className={styles.helpText}>
                    这里的昵称和头像会同步到侧边栏和结算流程。头像支持直接上传本地图片。
                  </p>
                </div>
              </div>

              <div className={styles.profileGrid}>
                <div className={styles.avatarPanel}>
                  <div className={styles.avatarPreview}>
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={profileName || user.name}
                        className={styles.avatarImage}
                      />
                    ) : (
                      <span className={styles.avatarFallback}>
                        {(profileName || user.name).slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className={styles.avatarMeta}>
                    <strong>头像</strong>
                    <span>支持 JPG、PNG、WEBP，大小不超过 2MB。</span>
                  </div>
                  <div className={styles.cardActions}>
                    <label className={styles.primaryBtn}>
                      选择本地图片
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                        className={styles.hiddenInput}
                        onChange={handleAvatarFileChange}
                      />
                    </label>
                    {avatarUrl && (
                      <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={() => {
                          setAvatarUrl("");
                          setSuccessMessage("头像已清除，保存后生效。");
                        }}
                      >
                        移除头像
                      </button>
                    )}
                  </div>
                </div>

                <div className={styles.fieldGrid}>
                  <label className={styles.field}>
                    <span>昵称</span>
                    <input
                      value={profileName}
                      onChange={(event) => setProfileName(event.target.value)}
                      className={styles.input}
                      placeholder="请输入昵称"
                    />
                  </label>
                  <div className={styles.field}>
                    <span>当前头像状态</span>
                    <div className={styles.staticInfo}>
                      {avatarUrl ? "已选择头像图片" : "未设置头像，将显示昵称首字母"}
                    </div>
                  </div>
                </div>
              </div>

              <button
                className={styles.primaryBtn}
                onClick={handleProfileSave}
                disabled={savingProfile}
              >
                {savingProfile ? "保存中..." : "保存账户资料"}
              </button>
            </section>

            <section className={styles.panel}>
              <div className={styles.sectionHeader}>
                <div>
                  <h3 className={styles.sectionTitle}>地址管理</h3>
                  <p className={styles.helpText}>
                    可保存多组地址，结算时直接选择，不用反复输入。
                  </p>
                </div>
              </div>

              <div className={styles.cardGrid}>
                {accountSettings?.addresses.map((address) => (
                  <article key={address.id} className={styles.itemCard}>
                    <div className={styles.itemTop}>
                      <strong>{address.label}</strong>
                      {address.isDefault && (
                        <span className={styles.defaultBadge}>默认</span>
                      )}
                    </div>
                    <p className={styles.itemMeta}>
                      {address.recipientName} · {address.phone}
                    </p>
                    <p className={styles.itemDetail}>{address.address}</p>
                    <div className={styles.cardActions}>
                      <button
                        className={styles.secondaryBtn}
                        onClick={() => {
                          setEditingAddressId(address.id);
                          setAddressForm({
                            label: address.label,
                            recipientName: address.recipientName,
                            phone: address.phone,
                            address: address.address,
                            isDefault: address.isDefault,
                          });
                        }}
                      >
                        编辑
                      </button>
                      <button
                        className={styles.dangerBtn}
                        onClick={() => void handleAddressDelete(address.id)}
                      >
                        删除
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              <div className={styles.formBlock}>
                <h4 className={styles.formTitle}>
                  {editingAddressId ? "编辑地址" : "新增地址"}
                </h4>
                <div className={styles.fieldGrid}>
                  <label className={styles.field}>
                    <span>地址备注</span>
                    <input
                      value={addressForm.label}
                      onChange={(event) =>
                        setAddressForm((current) => ({
                          ...current,
                          label: event.target.value,
                        }))
                      }
                      className={styles.input}
                      placeholder="例如：家里 / 公司"
                    />
                  </label>
                  <label className={styles.field}>
                    <span>收件人</span>
                    <input
                      value={addressForm.recipientName}
                      onChange={(event) =>
                        setAddressForm((current) => ({
                          ...current,
                          recipientName: event.target.value,
                        }))
                      }
                      className={styles.input}
                      placeholder="请输入收件人"
                    />
                  </label>
                  <label className={styles.field}>
                    <span>手机号</span>
                    <input
                      value={addressForm.phone}
                      onChange={(event) =>
                        setAddressForm((current) => ({
                          ...current,
                          phone: event.target.value,
                        }))
                      }
                      className={styles.input}
                      placeholder="请输入手机号"
                    />
                  </label>
                </div>
                <label className={styles.field}>
                  <span>详细地址</span>
                  <textarea
                    value={addressForm.address}
                    onChange={(event) =>
                      setAddressForm((current) => ({
                        ...current,
                        address: event.target.value,
                      }))
                    }
                    className={styles.textarea}
                    placeholder="请输入详细收货地址"
                  />
                </label>
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={addressForm.isDefault}
                    onChange={(event) =>
                      setAddressForm((current) => ({
                        ...current,
                        isDefault: event.target.checked,
                      }))
                    }
                  />
                  <span>设为默认地址</span>
                </label>
                <div className={styles.formActions}>
                  <button
                    className={styles.primaryBtn}
                    onClick={handleAddressSave}
                    disabled={savingAddress}
                  >
                    {savingAddress
                      ? "保存中..."
                      : editingAddressId
                        ? "更新地址"
                        : "新增地址"}
                  </button>
                  {editingAddressId && (
                    <button
                      className={styles.secondaryBtn}
                      onClick={resetAddressForm}
                    >
                      取消编辑
                    </button>
                  )}
                </div>
              </div>
            </section>

            <section className={styles.panel}>
              <div className={styles.sectionHeader}>
                <div>
                  <h3 className={styles.sectionTitle}>支付信息</h3>
                  <p className={styles.helpText}>
                    可保存多组支付方式，结算时直接选择。银行卡只保存脱敏信息。
                  </p>
                </div>
              </div>

              <div className={styles.cardGrid}>
                {accountSettings?.paymentMethods.map((paymentMethod) => (
                  <article key={paymentMethod.id} className={styles.itemCard}>
                    <div className={styles.itemTop}>
                      <strong>{paymentMethod.label}</strong>
                      {paymentMethod.isDefault && (
                        <span className={styles.defaultBadge}>默认</span>
                      )}
                    </div>
                    <p className={styles.itemMeta}>
                      {paymentMethodLabels[paymentMethod.method]} ·{" "}
                      {paymentMethod.accountName}
                    </p>
                    <p className={styles.itemDetail}>
                      {paymentMethod.accountIdentifier}
                      {paymentMethod.expiry
                        ? ` · 有效期 ${paymentMethod.expiry}`
                        : ""}
                    </p>
                    <div className={styles.cardActions}>
                      <button
                        className={styles.secondaryBtn}
                        onClick={() => {
                          setEditingPaymentMethodId(paymentMethod.id);
                          setPaymentForm({
                            label: paymentMethod.label,
                            method: paymentMethod.method,
                            accountName: paymentMethod.accountName,
                            accountIdentifier:
                              paymentMethod.method === "card"
                                ? ""
                                : paymentMethod.accountIdentifier,
                            cardNumber: "",
                            expiry: paymentMethod.expiry,
                            isDefault: paymentMethod.isDefault,
                          });
                        }}
                      >
                        编辑
                      </button>
                      <button
                        className={styles.dangerBtn}
                        onClick={() =>
                          void handlePaymentMethodDelete(paymentMethod.id)
                        }
                      >
                        删除
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              <div className={styles.formBlock}>
                <h4 className={styles.formTitle}>
                  {editingPaymentMethodId ? "编辑支付方式" : "新增支付方式"}
                </h4>
                <div className={styles.fieldGrid}>
                  <label className={styles.field}>
                    <span>备注</span>
                    <input
                      value={paymentForm.label}
                      onChange={(event) =>
                        setPaymentForm((current) => ({
                          ...current,
                          label: event.target.value,
                        }))
                      }
                      className={styles.input}
                      placeholder="例如：工资卡 / 常用支付宝"
                    />
                  </label>
                  <label className={styles.field}>
                    <span>支付方式</span>
                    <select
                      value={paymentForm.method}
                      onChange={(event) =>
                        setPaymentForm((current) => ({
                          ...current,
                          method: event.target.value as PaymentMethod,
                          accountIdentifier:
                            event.target.value === "card"
                              ? ""
                              : current.accountIdentifier,
                          cardNumber:
                            event.target.value === "card" ? current.cardNumber : "",
                          expiry: event.target.value === "card" ? current.expiry : "",
                        }))
                      }
                      className={styles.select}
                    >
                      <option value="card">银行卡</option>
                      <option value="alipay">支付宝</option>
                      <option value="wechat">微信支付</option>
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span>账户姓名</span>
                    <input
                      value={paymentForm.accountName}
                      onChange={(event) =>
                        setPaymentForm((current) => ({
                          ...current,
                          accountName: event.target.value,
                        }))
                      }
                      className={styles.input}
                      placeholder="请输入账户姓名"
                    />
                  </label>

                  {paymentForm.method === "card" ? (
                    <>
                      <label className={styles.field}>
                        <span>
                          银行卡号{editingPaymentMethodId ? "（留空则保留原卡）" : ""}
                        </span>
                        <input
                          value={paymentForm.cardNumber}
                          onChange={(event) =>
                            setPaymentForm((current) => ({
                              ...current,
                              cardNumber: event.target.value,
                            }))
                          }
                          className={styles.input}
                          placeholder="1234 5678 9012 3456"
                        />
                      </label>
                      <label className={styles.field}>
                        <span>有效期</span>
                        <input
                          value={paymentForm.expiry}
                          onChange={(event) =>
                            setPaymentForm((current) => ({
                              ...current,
                              expiry: event.target.value,
                            }))
                          }
                          className={styles.input}
                          placeholder="12/30"
                        />
                      </label>
                    </>
                  ) : (
                    <label className={styles.field}>
                      <span>支付账号</span>
                      <input
                        value={paymentForm.accountIdentifier}
                        onChange={(event) =>
                          setPaymentForm((current) => ({
                            ...current,
                            accountIdentifier: event.target.value,
                          }))
                        }
                        className={styles.input}
                        placeholder="请输入支付宝账号或微信号"
                      />
                    </label>
                  )}
                </div>

                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={paymentForm.isDefault}
                    onChange={(event) =>
                      setPaymentForm((current) => ({
                        ...current,
                        isDefault: event.target.checked,
                      }))
                    }
                  />
                  <span>设为默认支付方式</span>
                </label>

                <div className={styles.formActions}>
                  <button
                    className={styles.primaryBtn}
                    onClick={handlePaymentMethodSave}
                    disabled={savingPaymentMethod}
                  >
                    {savingPaymentMethod
                      ? "保存中..."
                      : editingPaymentMethodId
                        ? "更新支付方式"
                        : "新增支付方式"}
                  </button>
                  {editingPaymentMethodId && (
                    <button
                      className={styles.secondaryBtn}
                      onClick={resetPaymentForm}
                    >
                      取消编辑
                    </button>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
