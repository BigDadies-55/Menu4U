"use client";
import dynamic from "next/dynamic";
import { T } from "@/lib/ui";

const WaiterPosClient = dynamic(() => import("./WaiterPosClient"), {
  ssr: false,
  loading: () => (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", background: T.bg, color: T.muted, fontSize: 14,
    }}>
      🍽️ טוען מסך מלצר...
    </div>
  ),
});

export default function WaiterPosWrapper(props: {
  restaurants: { id: string; name: string }[];
  waiterName: string;
  waiterId: string;
}) {
  return <WaiterPosClient {...props} />;
}
