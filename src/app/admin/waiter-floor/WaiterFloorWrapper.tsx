"use client";

import dynamic from "next/dynamic";

const WaiterFloorClient = dynamic(() => import("./WaiterFloorClient"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 64px)", background: "#0a0402", color: "#7a6050", fontSize: 15 }}>
      טוען רצפת שירות...
    </div>
  ),
});

export default function WaiterFloorWrapper(props: { restaurants: { id: string; name: string }[]; waiterName: string }) {
  return <WaiterFloorClient {...props} />;
}
