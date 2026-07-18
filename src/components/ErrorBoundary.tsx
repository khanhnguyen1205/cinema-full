import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

// Bắt lỗi render trong cây con để tránh "màn hình trắng". React chỉ hỗ trợ
// error boundary qua class component (getDerivedStateFromError/componentDidCatch).
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Vẫn log ra console để dev thấy stack; nơi thật có thể gửi về dịch vụ theo dõi.
    console.error("ErrorBoundary bắt lỗi:", error, info.componentStack);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          padding: "24px",
          textAlign: "center",
          background: "var(--bg)",
          color: "var(--text)",
        }}
      >
        <div style={{ fontSize: "48px", lineHeight: 1 }}>🎬</div>
        <h1
          style={{
            margin: 0,
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: "40px",
            letterSpacing: "1px",
            color: "var(--red)",
          }}
        >
          Đã có lỗi xảy ra
        </h1>
        <p style={{ margin: 0, maxWidth: "420px", color: "var(--text-muted)" }}>
          Rất tiếc, giao diện gặp sự cố ngoài dự kiến. Bạn thử tải lại trang —
          nếu vẫn lỗi, vui lòng quay lại sau.
        </p>
        {import.meta.env.DEV && (
          <pre
            style={{
              maxWidth: "90vw",
              overflow: "auto",
              padding: "12px 16px",
              borderRadius: "8px",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              color: "var(--text-dim)",
              fontSize: "12px",
              textAlign: "left",
            }}
          >
            {error.message}
          </pre>
        )}
        <button
          onClick={this.handleReload}
          style={{
            marginTop: "8px",
            padding: "12px 28px",
            border: "none",
            borderRadius: "6px",
            background: "var(--red)",
            color: "#fff",
            fontWeight: 600,
            letterSpacing: "0.5px",
            cursor: "pointer",
          }}
        >
          Tải lại trang
        </button>
      </div>
    );
  }
}
