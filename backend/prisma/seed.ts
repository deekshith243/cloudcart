import bcrypt from 'bcrypt';
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole } from '@prisma/client';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set before seeding');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

const adminPassword = process.env.SEED_ADMIN_PASSWORD;
const customerPassword = process.env.SEED_CUSTOMER_PASSWORD;

if (!adminPassword || !customerPassword) {
  throw new Error('SEED_ADMIN_PASSWORD and SEED_CUSTOMER_PASSWORD must be set before seeding');
}

const categories = [
  { name: 'Desk Essentials', description: 'Thoughtful tools for focused workspaces.' },
  { name: 'Travel Goods', description: 'Durable companions for work and weekend travel.' },
  { name: 'Home Audio', description: 'Simple, considered sound for everyday rooms.' },
];

const products = [
  {
    name: 'Brass Desk Lamp',
    description: 'Warm task lighting with a weighted base.',
    price: 89.0,
    stock: 24,
    category: 'Desk Essentials',
  },
  {
    name: 'Wool Desk Mat',
    description: 'A soft, durable surface for daily work.',
    price: 48.0,
    stock: 41,
    category: 'Desk Essentials',
  },
  {
    name: 'Aluminium Notebook Stand',
    description: 'Raises your screen for a cleaner posture.',
    price: 72.0,
    stock: 18,
    category: 'Desk Essentials',
  },
  {
    name: 'Field Notes Set',
    description: 'Three pocket notebooks with recycled paper.',
    price: 16.0,
    stock: 80,
    category: 'Desk Essentials',
  },
  {
    name: 'Canvas Weekender',
    description: 'Structured carry-on with a leather handle.',
    price: 148.0,
    stock: 12,
    category: 'Travel Goods',
  },
  {
    name: 'Packable Rain Shell',
    description: 'Lightweight weather protection for city travel.',
    price: 119.0,
    stock: 27,
    category: 'Travel Goods',
  },
  {
    name: 'Passport Wallet',
    description: 'Slim vegetable-tanned leather organizer.',
    price: 54.0,
    stock: 33,
    category: 'Travel Goods',
  },
  {
    name: 'Merino Travel Blanket',
    description: 'A compact layer for long journeys.',
    price: 96.0,
    stock: 15,
    category: 'Travel Goods',
  },
  {
    name: 'Compact Bluetooth Speaker',
    description: 'Balanced sound in a small, durable body.',
    price: 129.0,
    stock: 22,
    category: 'Home Audio',
  },
  {
    name: 'Walnut Headphone Stand',
    description: 'Solid walnut stand with a felt base.',
    price: 64.0,
    stock: 19,
    category: 'Home Audio',
  },
  {
    name: 'Analog Alarm Clock',
    description: 'Quiet sweep movement and a soft wake light.',
    price: 42.0,
    stock: 29,
    category: 'Home Audio',
  },
];

const main = async () => {
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const customerPasswordHash = await bcrypt.hash(customerPassword, 12);

  await prisma.user.upsert({
    where: { email: 'admin@cloudcart.local' },
    update: { name: 'CloudCart Admin', passwordHash, role: UserRole.ADMIN },
    create: {
      name: 'CloudCart Admin',
      email: 'admin@cloudcart.local',
      passwordHash,
      role: UserRole.ADMIN,
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: 'customer@cloudcart.local' },
    update: { name: 'Demo Customer', passwordHash: customerPasswordHash, role: UserRole.CUSTOMER },
    create: {
      name: 'Demo Customer',
      email: 'customer@cloudcart.local',
      passwordHash: customerPasswordHash,
      role: UserRole.CUSTOMER,
    },
  });

  await prisma.cart.upsert({
    where: { userId: customer.id },
    update: {},
    create: { userId: customer.id },
  });

  const categoryRecords = new Map<string, string>();
  for (const category of categories) {
    const record = await prisma.category.upsert({
      where: { name: category.name },
      update: category,
      create: category,
    });
    categoryRecords.set(record.name, record.id);
  }

  for (const product of products) {
    const categoryId = categoryRecords.get(product.category);
    if (!categoryId) throw new Error(`Missing seeded category: ${product.category}`);
    await prisma.product.upsert({
      where: { categoryId_name: { categoryId, name: product.name } },
      update: {
        description: product.description,
        price: product.price,
        stock: product.stock,
        categoryId,
      },
      create: {
        name: product.name,
        description: product.description,
        price: product.price,
        stock: product.stock,
        categoryId,
      },
    });
  }

  console.log(`Seeded ${categories.length} categories, ${products.length} products, and 2 users.`);
};

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
