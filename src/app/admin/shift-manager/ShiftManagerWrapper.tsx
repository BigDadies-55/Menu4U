"use client";

import dynamic from "next/dynamic";
import { T } from "@/lib/ui";

const ShiftManagerClient = dynamic(() => import("./ShiftManagerClient"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 64px)", background: T.bg, color: "#7a6050", fontSize: 15 }}>
      טוען מנהל משמרת...
    </div>
  ),
});

export default function ShiftManagerWrapper(props: { restaurants: { id: string; name: string }[]; managerName: string }) {
  return <ShiftManagerClient {...props} />;
}
