import { Outlet } from "react-router-dom";
import styles from "./Layout.module.css";
import { useState } from "react";
import Sidebar from "../components/Sidebar";

// 页面布局壳子组件
export default function Layout() {
  //本地状态collapsed = false 表示侧边栏没折叠
  const [collapsed, setCollapsed] = useState(false);
  return (
    // 整个大页面
    <div className={styles.appShell}>
      {/* 左边：侧边栏模块 */}
      <Sidebar
        collapsed={collapsed}
        onToggle={() => {
          setCollapsed((v) => !v);
        }}
      />

      {/* 右边：主页面模块 */}
      <main className={styles.main}>
        {/* 相当于一个显示器插槽 往里面放哪个页面就显示哪个页面 */}
        <Outlet />
      </main>
    </div>
  );
}
