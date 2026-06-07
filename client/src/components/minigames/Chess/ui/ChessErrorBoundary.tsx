import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ChessErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Chess] render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 420,
            width: "100%",
            padding: 24,
            background: "#0f1117",
            color: "#e2e8f0",
            fontFamily: "sans-serif",
            textAlign: "center",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 40 }}>♟️</div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            Chess failed to load
          </h2>
          <p
            style={{
              margin: 0,
              maxWidth: 420,
              fontSize: 13,
              color: "#94a3b8",
              lineHeight: 1.5,
            }}
          >
            {this.state.error.message}
          </p>
          <p
            style={{
              margin: 0,
              maxWidth: 420,
              fontSize: 12,
              color: "#64748b",
            }}
          >
            Try a hard refresh (Ctrl+Shift+R). If you recently pulled changes,
            run <code style={{ color: "#cbd5e1" }}>npm run build</code> before{" "}
            <code style={{ color: "#cbd5e1" }}>npm start</code>.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8,
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              background: "linear-gradient(160deg,#4f46e5,#6366f1)",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
