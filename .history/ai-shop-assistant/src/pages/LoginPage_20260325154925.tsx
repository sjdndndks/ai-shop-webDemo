import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import styles from "./LoginPage.module.css";

type LocationState = {
  from?: string;
};

export function LoginPage() {
  const user = useAuthStore((state) => state.user);
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LocationState | null;
  const redirectTo = useMemo(
    () => locationState?.from || "/",
    [locationState?.from],
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (user) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail.includes("@")) {
      setError("请输入有效邮箱地址。");
      return;
    }

    if (trimmedPassword.length < 6) {
      setError("密码至少需要 6 位。");
      return;
    }

    if (mode === "register" && !name.trim()) {
      setError("注册时请填写昵称。");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      if (mode === "login") {
        await login({
          email: trimmedEmail,
          password: trimmedPassword,
        });
      } else {
        await register({
          email: trimmedEmail,
          password: trimmedPassword,
          name: name.trim(),
        });
      }

      navigate(redirectTo, { replace: true });
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "认证失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroBadge}>AI Shop</div>
        <h1 className={styles.heroTitle}>登录后再进入结算与支付流程</h1>
        <p className={styles.heroText}>
          这一版先补齐电商产品最基本的用户闭环：身份、购物车、结算、支付。
        </p>
        <ul className={styles.featureList}>
          <li>聊天推荐商品</li>
          <li>加购并调整数量</li>
          <li>登录后完成支付流程</li>
        </ul>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.modeSwitch}>
            <button
              type="button"
              className={`${styles.modeBtn} ${mode === "login" ? styles.modeBtnActive : ""}`}
              onClick={() => setMode("login")}
            >
              登录
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${mode === "register" ? styles.modeBtnActive : ""}`}
              onClick={() => setMode("register")}
            >
              注册
            </button>
          </div>
          <h2 className={styles.cardTitle}>
            {mode === "login" ? "欢迎回来" : "创建你的账户"}
          </h2>
          <p className={styles.cardSubtitle}>
            {mode === "login"
              ? "使用邮箱登录进入 AI Shop"
              : "先注册一个账号，再进入结算与支付流程"}
          </p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span className={styles.label}>昵称</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={styles.input}
              placeholder={mode === "login" ? "登录时可留空" : "注册时必填"}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>邮箱</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={styles.input}
              placeholder="you@example.com"
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>密码</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={styles.input}
              placeholder="至少 6 位"
              required
            />
          </label>

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className={styles.primaryBtn} disabled={submitting}>
            {submitting
              ? mode === "login"
                ? "登录中..."
                : "注册中..."
              : mode === "login"
                ? "登录并继续"
                : "注册并继续"}
          </button>
        </form>

        <div className={styles.meta}>
          <span>还没想登录？</span>
          <Link to="/" className={styles.link}>
            先回聊天页看看
          </Link>
        </div>
      </section>
    </main>
  );
}
