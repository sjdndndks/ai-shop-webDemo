import { useRef, useEffect } from "react";
import { ProductCard } from "../components/ProductCard";
import { useChat } from "../hooks/useChat";

function ChatPage() {
  const { messages, input, setInput, status, errorMessage, sendMessage } =
    useChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages, status]);

  return (
    <>
      {/* 最外层 霸占整个浏览器 */}
      <div
        style={{
          height: "100vh",
          width: "100vw",
          display: "flex",
          flexDirection: "column",
          margin: "0 auto",
          backgroundColor: "white",
        }}
      >
        {/* 顶部标题区 */}
        <div
          style={{
            padding: "16px",
            textAlign: "center",
            borderBottom: "1px solid #e5e5ea",
            fontWeight: "bold",
            fontSize: "18px",
            backgroundColor: "#f6f6f8",
          }}
        >
          AI 购物助手
        </div>
        {/* <ProductCarf product={fakeApple} /> */}

        {/* 聊天记录区 */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px",
            backgroundColor: "#ffffff",
          }}
        >
          {/* 消息列表,内层约束容器 */}
          <div
            style={{
              maxWidth: "800px",
              margin: "0 auto",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              padding: "10px",
            }}
          >
            {messages.map((meg) => (
              <div
                key={meg.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: meg.isUser ? "flex-end" : "flex-start",
                }}
              >
                {/* 气泡 */}
                <div
                  style={{
                    maxWidth: "75%",
                    padding: "10px 16px",
                    fontSize: "16px",
                    lineHeight: "1.4",
                    //苹果字体
                    fontFamily:
                      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, san-serif',
                    fontWeight: "400",
                    //苹果配色
                    backgroundColor: meg.isUser ? "#007aff" : "#e9e9eb",
                    color: meg.isUser ? "white" : "black",
                    // 气泡形状
                    borderRadius: meg.isUser
                      ? "18px 18px 4px 18px"
                      : "18px 18px 18px 4px",
                  }}
                >
                  {meg.text}
                </div>
                {/* 商品卡片 */}
                {meg.product && (
                  <div style={{ marginTop: "10px" }}>
                    <ProductCard product={meg.product} />
                  </div>
                )}
              </div>
            ))}

            {/* 状态提示 */}
            {status === "loading" && <div>正在思考...</div>}
            {status === "error" && (
              <div style={{ color: "red" }}>请求失败:{errorMessage}</div>
            )}
            {status === "idle" && messages.length === 0 && (
              <div
                style={{
                  fontSize: "14px",
                  textAlign: "center",
                  color: "#999",
                  marginTop: "40px",
                }}
              >
                有什么能帮您的？
              </div>
            )}

            {/* 隐形追踪器 */}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* 底部输入区域 */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            padding: "12px 16px",
            backgroundColor: "#f6f6f8",
            borderTop: "1px solid #e5e5ea",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* 底部长条框 */}
          <div
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "center",
              width: "100%",
              maxWidth: "800px",
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="iMessage信息..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && status != "loading") {
                  sendMessage();
                }
              }}
              style={{
                flex: 1,
                padding: "10px 16px",
                fontSize: "15px",
                borderRadius: "20px",
                border: "1px solid #d1d1d6",
                outline: "none",
                fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={status === "loading"}
              style={{
                backgroundColor: status === "loading" ? "#A0CFFF" : "#007aff",
                color: "white",
                border: "none",
                borderRadius: "50%",
                width: "32px",
                height: "32px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                cursor: status === "loading" ? "not-allowed" : "pointer",
                fontWeight: "bold",
                fontSize: "18px",
                flexShrink: 0,
              }}
            >
              ↑
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export function ChatPage();
