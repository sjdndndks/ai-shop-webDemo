import { NavLink } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import styles from "./Sidebar.module.css";

// 这个组件接收的参数类型
type Props = {
  // 是否为折叠状态
  collapsed: boolean;
  // 切换状态
  onToggle: () => void;
};

export default function Sidebar({ collapsed, onToggle }: Props) {
  // 从全局仓库中获取用户信息和注销函数
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}>
      <div className={styles.top}>
        <button
          className={styles.toggleBtn}
          onClick={onToggle}
          // 给无障碍工具读的说明文字
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
          // 鼠标悬停提示文字
          title="聊天"
        >
          <span className={styles.icon}>💬</span>
          {!collapsed && <span className={styles.text}>聊天</span>}
        </NavLink>

        <NavLink
          to="/cart"
          className={({ isActive }) =>
            isActive ? `${styles.link} ${styles.active}` : styles.link
          }
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
          // 如果用户登录了，就跳转到结算页面，否则跳转到登录页面
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
        {/* 如果用户已登录，就显示用户面板；否则显示游客提示。 */}
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
                  // 如果没有头像，就显示用户名的第一个字母并大写
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
