"use client";

import dynamic from "next/dynamic";

const ShiftManagerClient = dynamic(() => import("./ShiftManagerClient"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 64px)", background: "#0a0402", color: "#7a6050", fontSize: 15 }}>
      טוען מנהל משמרת...
    </div>
  ),
});

export default function ShiftManagerWrapper(props: { restaurants: { id: string; name: string }[]; managerName: string }) {
  return <ShiftManagerClient {...props} />;
}
