import { Outlet } from "react-router-dom";
import styles from "./Layout.module.css";
import { useState } from "react";
import Sidebar from "../components/Sidebar";

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className={styles.appShell}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => {
          setCollapsed((v) => !v);
        }}
      />
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
