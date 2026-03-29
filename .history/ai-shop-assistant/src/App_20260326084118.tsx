import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./layout/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { ChatPage } from "./pages/ChatPage";
import { CartPage } from "./pages/CartPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { LoginPage } from "./pages/LoginPage";
import { SettingsPage } from "./pages/SettingsPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* 总体布局 */}
        <Route element={<Layout />}>
          <Route path="/" element={<ChatPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/settings" element={<SettingsPage />} />

          {/* 门卫RequireAuth 检查用户是否登录  如果未登录 则跳转到登录页 */}
          <Route element={<RequireAuth />}>
            <Route path="/checkout" element={<CheckoutPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
