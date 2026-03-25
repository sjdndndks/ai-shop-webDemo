import { NavLink } from "react-router-dom";
import styles from "./Sidebar.module.css";

type Props = {
  collapsed: boolean;
  onToggle: () => void;
};

export default function Sidebar({ collapsed, onToggle }: Props) {
  return (
    <aside className={`${styles.Sidebar} ${collapsed ? styles.collapsed : ""}`}>
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
    </aside>
  );
}
