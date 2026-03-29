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
        replace
        //
        state={{
          from: `${location.pathname}${location.search}${location.hash}`,
        }}
      />
    );
  }

  // 登录了 放行
  return <Outlet />;
}
