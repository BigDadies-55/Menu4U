"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WaiterPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/waiter-pos");
  }, [router]);

  return null;
}
