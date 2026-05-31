"use client";

import dynamic from "next/dynamic";

const LayoutClient = dynamic(() => import("./LayoutClient"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 64px)", background: "#0d0404", color: "#6c757d", fontSize: 15 }}>
      טוען עורך פריסה...
    </div>
  ),
});

export default function LayoutClientWrapper(props: { restaurants: { id: string; name: string }[] }) {
  return <LayoutClient {...props} />;
}
