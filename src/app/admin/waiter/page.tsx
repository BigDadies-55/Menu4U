"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WaiterPage() {
  const router = useRouter();

  useEffect(() => {
    const restaurantId = localStorage.getItem("menu4u_active_restaurant");
    if (!restaurantId) {
      router.replace("/admin/waiter-pos-2");
      return;
    }
    fetch(`/api/admin/waiter-pos/bg-settings?restaurantId=${restaurantId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const screen = d?.waiterScreen ?? 2;
        router.replace(screen === 1 ? "/admin/waiter-pos" : "/admin/waiter-pos-2");
      })
      .catch(() => router.replace("/admin/waiter-pos-2"));
  }, [router]);

  return null;
}
