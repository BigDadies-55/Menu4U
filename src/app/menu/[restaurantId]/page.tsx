import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import MenuPublicClient from "./MenuPublicClient";

export async function generateMetadata(
  { params }: { params: Promise<{ restaurantId: string }> }
): Promise<Metadata> {
  const { restaurantId } = await params;
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { name: true } });
  return { title: r?.name ?? "תפריט" };
}

export default async function PublicMenuPage(
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const { restaurantId } = await params;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId, isActive: true },
    select: {
      name: true, logo: true, address: true,
      phone: true, orderPhone: true, website: true, locationUrl: true,
      menus: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          categories: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            select: {
              id: true, name: true, image: true,
              items: {
                where: { isActive: true },
                orderBy: { sortOrder: "asc" },
                select: {
                  id: true, name: true, description: true, price: true, image: true,
                  isVegetarian: true, isVegan: true, isGlutenFree: true, tags: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!restaurant) notFound();

  return <MenuPublicClient restaurant={restaurant} />;
}
