"use client";
import dynamic from "next/dynamic";

const WaiterFloorClient = dynamic(() => import("./WaiterFloorClient"), { ssr: false });

export default function WaiterFloorWrapper(props: { restaurants: { id: string; name: string }[]; waiterName: string; waiterId: string }) {
  return <WaiterFloorClient {...props} />;
}
