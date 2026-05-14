import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const password = await bcrypt.hash("admin123", 12);

  const superAdmin = await prisma.user.upsert({
    where: { email: "admin@menu4u.com" },
    update: {},
    create: {
      email: "admin@menu4u.com",
      name: "Super Admin",
      password,
      role: "SUPER_ADMIN",
    },
  });

  console.log("✅ Super Admin created:", superAdmin.email);

  const restaurant = await prisma.restaurant.upsert({
    where: { id: "demo-restaurant" },
    update: {},
    create: {
      id: "demo-restaurant",
      name: "מסעדת הדגמה",
      email: "demo@menu4u.com",
      phone: "03-1234567",
      address: "רחוב הדגמה 1, תל אביב",
      description: "מסעדת דגמה למערכת Menu4U",
    },
  });

  console.log("✅ Demo restaurant created:", restaurant.name);

  const menu = await prisma.menu.upsert({
    where: { id: "demo-menu" },
    update: {},
    create: {
      id: "demo-menu",
      restaurantId: restaurant.id,
      name: "תפריט ראשי",
    },
  });

  const category = await prisma.category.upsert({
    where: { id: "demo-category" },
    update: {},
    create: {
      id: "demo-category",
      menuId: menu.id,
      name: "מנות עיקריות",
    },
  });

  await prisma.item.upsert({
    where: { id: "demo-item-1" },
    update: {},
    create: {
      id: "demo-item-1",
      categoryId: category.id,
      name: "שניצל עוף",
      description: "שניצל עוף קריספי עם תוספת לבחירה",
      price: 68,
    },
  });

  await prisma.item.upsert({
    where: { id: "demo-item-2" },
    update: {},
    create: {
      id: "demo-item-2",
      categoryId: category.id,
      name: "פסטה ברוטב עגבניות",
      description: "פסטה פנה ברוטב עגבניות טרי",
      price: 55,
      isVegetarian: true,
      isVegan: true,
    },
  });

  console.log("✅ Demo menu, category and items created");
  console.log("\n🚀 Login credentials:");
  console.log("   Email: admin@menu4u.com");
  console.log("   Password: admin123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
