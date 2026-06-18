"use client";
import { useState, useEffect } from "react";

export function useModuleEnabled(restaurantId: string | undefined, moduleKey: string): boolean {
  const [enabled, setEnabled] = useState(true); // optimistic default

  useEffect(() => {
    if (!restaurantId) return;
    fetch(`/api/admin/modules/check?restaurantId=${restaurantId}&key=${moduleKey}`)
      .then(r => r.json())
      .then(d => setEnabled(d.enabled ?? true))
      .catch(() => setEnabled(true));
  }, [restaurantId, moduleKey]);

  return enabled;
}
