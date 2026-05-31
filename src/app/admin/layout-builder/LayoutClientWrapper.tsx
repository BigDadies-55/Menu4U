"use client";

import dynamic from "next/dynamic";
import { Component, ReactNode } from "react";

const LayoutClient = dynamic(() => import("./LayoutClient"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 64px)", background: "#0d0404", color: "#6c757d", fontSize: 15 }}>
      טוען עורך פריסה...
    </div>
  ),
});

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, background: "#1a0a0a", minHeight: "100vh", color: "#ff6b6b", fontFamily: "monospace", direction: "ltr" }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Layout Builder Error</div>
          <div style={{ background: "rgba(255,0,0,0.1)", border: "1px solid rgba(255,0,0,0.3)", borderRadius: 8, padding: 16, whiteSpace: "pre-wrap", fontSize: 13 }}>
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function LayoutClientWrapper(props: { restaurants: { id: string; name: string }[] }) {
  return (
    <ErrorBoundary>
      <LayoutClient {...props} />
    </ErrorBoundary>
  );
}
