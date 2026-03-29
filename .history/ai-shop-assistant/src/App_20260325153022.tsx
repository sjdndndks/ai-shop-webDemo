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
        <Route element={<Layout />}>
          <Route path="/" element={<ChatPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/checkout" element={<CheckoutPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
