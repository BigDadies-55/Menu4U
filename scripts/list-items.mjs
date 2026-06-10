import { PrismaClient } from '../src/generated/prisma/index.js';
const prisma = new PrismaClient();
const items = await prisma.item.findMany({ select: { id: true, name: true, allergens: true }, orderBy: { name: 'asc' } });
items.forEach(i => console.log(i.id, JSON.stringify(i.name), JSON.stringify(i.allergens)));
await prisma.$disconnect();
