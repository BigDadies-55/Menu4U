export type OrderItemModifier = { groupName: string; label: string; priceAdd: number };

export type OrderItem = {
  id: string;
  quantity: number;
  price: number;
  notes: string | null;
  itemStatus: string;
  course: number;
  item: { name: string };
  modifiers?: OrderItemModifier[];
};

export type Order = {
  id: string;
  tableNumber: string | null;
  status: string;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
  restaurant: { id: string; name: string };
  items: OrderItem[];
  loyaltyDiscountAmount: number | null;
  loyaltyMemberName: string | null;
  loyaltyDiscountType: string | null;
};
