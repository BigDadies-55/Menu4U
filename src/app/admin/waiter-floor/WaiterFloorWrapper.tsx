"use client";

import dynamic from "next/dynamic";
import { T } from "@/lib/ui";

const WaiterFloorClient = dynamic(() => import("./WaiterFloorClient"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 64px)", background: T.bg, color: "#7a6050", fontSize: 15 }}>
      טוען רצפת שירות...
    </div>
  ),
});

export default function WaiterFloorWrapper(props: { restaurants: { id: string; name: string }[]; waiterName: string; waiterId: string }) {
  return <WaiterFloorClient {...props} />;
}
