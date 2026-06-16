export type ModuleKey =
  | "attendance"
  | "shifts"
  | "kds"
  | "loyalty"
  | "orders"
  | "cashier"
  | "crm"
  | "waiter_pos"
  | "live_floor"
  | "layout_builder"
  | "stats"
  | "assistant";

export const MODULES: { key: ModuleKey; label: string; icon: string; description: string }[] = [
  { key: "attendance",     label: "שעון נוכחות",    icon: "⏱️",  description: "רישום כניסה/יציאה לעובדים" },
  { key: "shifts",         label: "ניהול משמרות",   icon: "📅",  description: "לוח משמרות ובקשות החלפה" },
  { key: "kds",            label: "מסך מטבח (KDS)", icon: "👨‍🍳", description: "תצוגת הזמנות למטבח" },
  { key: "loyalty",        label: "מועדון נאמנות",  icon: "⭐",  description: "נקודות, קופונים וחברי מועדון" },
  { key: "orders",         label: "הזמנות",         icon: "🛒",  description: "ניהול הזמנות ומעקב סטטוס" },
  { key: "cashier",        label: "קאשייר",         icon: "💳",  description: "גביית תשלום וסגירת שולחנות" },
  { key: "crm",            label: "CRM",            icon: "📊",  description: "קשרי לקוחות ושליחת SMS" },
  { key: "waiter_pos",     label: "מלצר חכם (POS)", icon: "🤵",  description: "ממשק מלצר לניהול הזמנות" },
  { key: "live_floor",     label: "מפת שולחנות",   icon: "🗺️",  description: "תצוגה חיה של מצב השולחנות" },
  { key: "layout_builder", label: "פריסת שולחנות",  icon: "📐",  description: "בניית מפת שולחנות" },
  { key: "stats",          label: "סטטיסטיקות",     icon: "📈",  description: "ניתוח מכירות וביצועים" },
  { key: "assistant",      label: "עוזר AI",        icon: "🤖",  description: "עוזר אישי מבוסס AI" },
];
