"use client";

import dynamic from "next/dynamic";

const ShiftManagerClient = dynamic(() => import("./ShiftManagerClient"), { ssr: false });

export default function ShiftManagerWrapper(props: {
  restaurants: { id: string; name: string }[];
  managerName: string;
}) {
  return <ShiftManagerClient {...props} />;
}
