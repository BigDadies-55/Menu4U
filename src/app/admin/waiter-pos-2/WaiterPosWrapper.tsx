"use client";

import dynamic from "next/dynamic";
import { T } from "@/lib/ui";

const WaiterPosClient = dynamic(() => import("./WaiterPosClient"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 64px)", background: T.bg, color: "#7a6050", fontSize: 15 }}>
      טוען מלצר חכם...
    </div>
  ),
});

export default function WaiterPosWrapper(props: { restaurants: { id: string; name: string; waiterBg?: string | null; waiterBgOpacity?: number | null }[]; waiterName: string; isWaiter?: boolean }) {
  return <WaiterPosClient {...props} />;
}
