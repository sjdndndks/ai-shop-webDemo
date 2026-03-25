import { useRef, useEffect } from "react";
import { ProductCard } from "../components/ProductCard";
import { useChat } from "../hooks/useChat";
import styles from "./ChatPage.module.css";

export function ChatPage() {
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
      <main
        className={styles.container}
      >
        {/* 顶部标题区 */}
        <header
          className={styles.header}
        >
          AI 购物助手
        </header>
        {/* <ProductCarf product={fakeApple} /> */}

        {/* 聊天记录区 */}
        <section
          className={styles.scrollArea}
        >
          {/* 消息列表,内层约束容器 */}
          <div
            className={styles.chatList}
          >
            {messages.map((meg) => (
              <div
                key={meg.id}
                className={ `${styles.messageRow} ${meg.isUser? styles.messageRowUser :styles.messageRowAi}`}
              >
                {/* 气泡 */}
                <div
                  className={}
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
            flexShrink: 0,
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
