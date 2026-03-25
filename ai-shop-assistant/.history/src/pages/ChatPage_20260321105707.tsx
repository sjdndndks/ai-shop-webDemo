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
                  className={`${styles.bubble} ${meg.isUser? styles.bubbleUser : styles.bubbleAi}`}
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
            {status === "loading" && <div className={styles.statusText}>正在思考...</div>}
            {status === "error" && (
              <div className={styles.errorText}>请求失败:{errorMessage}</div>
            )}
            {status === "idle" && messages.length === 0 && (
              <div
                className={styles.welcomeText}
              >
                有什么能帮您的？
              </div>
            )}

            {/* 隐形追踪器 */}
            <div ref={messagesEndRef} />
          </div>
        </section>

        {/* 底部输入区域 */}
        <footer
          className={styles.inputArea}
        >
          {/* 底部长条框 */}
          <div
            className={styles.inputContainer}
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
              className={styles.inputField}
            />
            <button
              onClick={sendMessage}
              disabled={status === "loading"}
              className={`${styles.sendBtn} ${status==='loading'? styles.}`}
            >
              ↑
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
