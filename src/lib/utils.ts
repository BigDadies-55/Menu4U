import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
  }).format(price);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("he-IL", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}
