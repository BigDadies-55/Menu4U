"use client";
// Full implementation in progress — stub placeholder
export default function CashierClient(_props: {
  initialOrders: unknown[];
  restaurants: { id: string; name: string }[];
  isSuperAdmin: boolean;
  defaultRestaurantId: string | null;
}) {
  return (
    <div className="p-8 text-center text-gray-400">
      <div className="text-4xl mb-3">💳</div>
      <p>מסך קאשייר — טוען...</p>
    </div>
  );
}
