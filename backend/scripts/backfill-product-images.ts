import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { isPreviousProductImage, resolveProductImage } from '../src/data/product-images.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL must be set before backfilling product images');

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  }),
});

const hasUsableImageReference = (imageUrl: string | null): boolean => {
  if (!imageUrl?.trim()) return false;
  if (imageUrl.startsWith('s3://')) {
    const reference = imageUrl.slice('s3://'.length);
    return reference.includes('/') && reference.indexOf('/') > 0 && reference.length > reference.indexOf('/') + 1;
  }
  try {
    const url = new URL(imageUrl);
    return (url.protocol === 'https:' || url.protocol === 'http:') && Boolean(url.hostname);
  } catch {
    return false;
  }
};

const main = async () => {
  const dryRun = process.argv.includes('--dry-run');
  const products = await prisma.product.findMany({
    include: { category: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });
  let assigned = 0;
  let skipped = 0;
  let unmatched = 0;

  for (const product of products) {
    const needsCorrection =
      isPreviousProductImage(product.name, product.imageUrl) ||
      !hasUsableImageReference(product.imageUrl);
    if (!needsCorrection) {
      skipped += 1;
      continue;
    }

    const imageUrl = resolveProductImage(product.name, product.description, product.category.name);
    if (!imageUrl) {
      unmatched += 1;
      console.warn(`No image mapping found for "${product.name}"`);
      continue;
    }

    if (!dryRun) {
      await prisma.product.update({ where: { id: product.id }, data: { imageUrl } });
    }
    assigned += 1;
  }

  console.log(
    `${dryRun ? '[dry-run] ' : ''}Checked ${products.length} products; assigned ${assigned} images; preserved ${skipped} existing references; unmatched ${unmatched}.`,
  );
};

main()
  .catch((error: unknown) => {
    console.error('Product image backfill failed', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
