import { NavLink } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import styles from "./Sidebar.module.css";

type Props = {
  collapsed: boolean;
  onToggle: () => void;
};

export default function Sidebar({ collapsed, onToggle }: Props) {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}>
      <div className={styles.top}>
        <button
          className={styles.toggleBtn}
          onClick={onToggle}
          aria-label="切换侧边栏"
        >
          {collapsed ? "☰" : "<"}
        </button>

        {!collapsed && <div className={styles.brand}>AI Shop</div>}
      </div>

      <nav className={styles.nav}>
        <NavLink
          to="/"
          className={({ isActive }) =>
            isActive ? `${styles.link} ${styles.active}` : styles.link
          }
          title="聊天"
        >
          <span className={styles.icon}>💬</span>
          {!collapsed && <span className={styles.text}>聊天</span>}
        </NavLink>

        <NavLink
          to="/cart"
          // className={({ isActive }) =>
          //   isActive ? `${styles.link} ${styles.active}` : styles.link
          // }
          // className={`${styles.link} `}
          title="购物车"
        >
          <span className={styles.icon}>🛒</span>
          {!collapsed && <span className={styles.text}>购物车</span>}
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            isActive ? `${styles.link} ${styles.active}` : styles.link
          }
          title="设置"
        >
          <span className={styles.icon}>⚙️</span>
          {!collapsed && <span className={styles.text}>设置</span>}
        </NavLink>

        <NavLink
          to={user ? "/checkout" : "/login"}
          className={({ isActive }) =>
            isActive ? `${styles.link} ${styles.active}` : styles.link
          }
          title={user ? "结算" : "登录"}
        >
          <span className={styles.icon}>{user ? "💳" : "👤"}</span>
          {!collapsed && (
            <span className={styles.text}>{user ? "结算" : "登录"}</span>
          )}
        </NavLink>
      </nav>

      <div className={styles.accountPanel}>
        {user ? (
          <>
            <div className={styles.accountInfo}>
              <div className={styles.avatar}>
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className={styles.avatarImage}
                  />
                ) : (
                  user.name.slice(0, 1).toUpperCase()
                )}
              </div>
              {!collapsed && (
                <div className={styles.accountText}>
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>
                </div>
              )}
            </div>
            {!collapsed && (
              <button className={styles.logoutBtn} onClick={logout}>
                退出登录
              </button>
            )}
          </>
        ) : (
          !collapsed && (
            <div className={styles.guestTip}>
              登录后可进入支付流程并保存你的身份状态。
            </div>
          )
        )}
      </div>
    </aside>
  );
}
