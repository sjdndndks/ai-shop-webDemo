import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export function RequireAuth() {
  const user = useAuthStore((state) => state.user);

  // 记录用户本来想去的页面
  const location = useLocation();

  // 如果没登录
  if (!user) {
    // 直接跳转
    return (
      <Navigate
        to="/login"
        // 替换当前历史记录  避免用户点击返回按钮  回到/checkout 然后又重定向到登录页
        replace
        // 传递用户本来想去的页面  登录后跳转回该页面
        state={{
          from: `${location.pathname}${location.search}${location.hash}`,
        }}
      />
    );
  }

  // 登录了 放行
  return <Outlet />;
}
