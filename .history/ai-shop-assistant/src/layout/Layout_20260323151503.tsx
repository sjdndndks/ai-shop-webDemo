import { Outlet } from "react-router-dom";
import styles from "./Layout.module.css";
import { useState } from "react";
import Sidebar from "../components/Sidebar";

export default function Layout() {
  //本地状态collapsed = false 表示侧边栏没折叠
  const [collapsed, setCollapsed] = useState(false);
  return (
    // 整个大页面
    <div className={styles.appShell}>
      {/* 侧边栏模块 */}
      <Sidebar
        collapsed={collapsed}
        onToggle={() => {
          setCollapsed((v) => !v);
        }}
      />

      {/* 主页面模块 */}
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
