import { useEffect, useRef, useState } from "react";
import { ProductCard } from "../components/ProductCard";
import { useChat } from "../hooks/useChat";
import styles from "./ChatPage.module.css";

const BOTTOM_THRESHOLD = 48;

// 负责聊天页面的显示与交互
export function ChatPage() {
  const {
    messages,
    input,
    setInput,
    status,
    errorMessage,
    sendMessage,
    retryMessageId,
    retryMessage,
    scrollTop,
    setScrollTop,
  } = useChat();

  const scrollAreaRef = useRef<HTMLElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasRestoredScrollRef = useRef(false);
  const previousMessageCountRef = useRef(messages.length);
  const previousStatusRef = useRef(status);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const updateScrollButtonVisibility = (scrollElement: HTMLElement | null) => {
    if (!scrollElement) {
      return;
    }

    const distanceToBottom =
      scrollElement.scrollHeight -
      scrollElement.scrollTop -
      scrollElement.clientHeight;

    setShowScrollToBottom(distanceToBottom > BOTTOM_THRESHOLD);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollToBottom(false);
  };

  // 进入聊天页面时恢复上次位置，离开时保存位置
  useEffect(() => {
    const scrollElement = scrollAreaRef.current;

    if (!scrollElement) {
      return;
    }

    scrollElement.scrollTop = scrollTop;
    updateScrollButtonVisibility(scrollElement);
    hasRestoredScrollRef.current = true;
    previousMessageCountRef.current = messages.length;
    previousStatusRef.current = status;

    return () => {
      if (scrollAreaRef.current) {
        setScrollTop(scrollAreaRef.current.scrollTop);
      }
    };
  }, []);

  useEffect(() => {
    if (!hasRestoredScrollRef.current) {
      return;
    }

    const hasNewMessage = messages.length > previousMessageCountRef.current;
    const startedLoading =
      status === "loading" && previousStatusRef.current !== "loading";

    if (hasNewMessage || startedLoading) {
      scrollToBottom();
    }

    updateScrollButtonVisibility(scrollAreaRef.current);

    previousMessageCountRef.current = messages.length;
    previousStatusRef.current = status;
  }, [messages.length, status]);

  return (
    <>
      <main className={styles.container}>
        <header className={styles.header}>AI 购物助手</header>

        <section
          ref={scrollAreaRef}
          className={styles.scrollArea}
          onScroll={(event) => {
            setScrollTop(event.currentTarget.scrollTop);
            updateScrollButtonVisibility(event.currentTarget);
          }}
        >
          <div className={styles.chatList}>
            {messages.map((message) => {
              const products =
                message.products && message.products.length > 0
                  ? message.products
                  : message.product
                    ? [message.product]
                    : [];
              const showRetryButton =
                message.isUser &&
                status === "error" &&
                retryMessageId === message.id;

              return (
                <div
                  key={message.id}
                  className={`${styles.messageRow} ${message.isUser ? styles.messageRowUser : styles.messageRowAi}`}
                >
                  <div
                    className={`${styles.messageContentRow} ${message.isUser ? styles.messageContentRowUser : styles.messageContentRowAi}`}
                  >
                    <div
                      className={`${styles.bubble} ${message.isUser ? styles.bubbleUser : styles.bubbleAi}`}
                    >
                      {message.text}
                    </div>

                    {showRetryButton && (
                      <button
                        type="button"
                        onClick={retryMessage}
                        className={styles.retryBtn}
                        title="重新发送"
                        aria-label="重新发送这条消息"
                      >
                        ↻
                      </button>
                    )}
                  </div>

                  {products.length > 0 && (
                    <div className={styles.productGrid}>
                      {products.map((product) => (
                        <ProductCard key={product.id} product={product} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {status === "loading" && (
              <div className={styles.statusText}>正在思考...</div>
            )}
            {status === "error" && (
              <div className={styles.errorText}>请求失败:{errorMessage}</div>
            )}
            {status === "idle" && messages.length === 0 && (
              <div className={styles.welcomeText}>有什么能帮您的？</div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </section>

        {messages.length > 0 && showScrollToBottom && (
          <button
            type="button"
            onClick={scrollToBottom}
            className={styles.scrollToBottomBtn}
            title="滚动到底部"
            aria-label="滚动到底部"
          >
            ↓
          </button>
        )}

        <footer className={styles.inputArea}>
          <div className={styles.inputContainer}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="iMessage信息..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && status !== "loading") {
                  sendMessage();
                }
              }}
              className={styles.inputField}
            />
            <button
              onClick={sendMessage}
              disabled={status === "loading"}
              className={`${styles.sendBtn} ${status === "loading" ? styles.sendBtnDisabled : styles.sendBtnActive}`}
            >
              ↑
            </button>
          </div>
        </footer>
      </main>
    </>
  );
}
