import {
  MovementType,
  PrismaClient,
  ProductUnit,
} from '../src/generated/prisma/client';

export type ErpSeedClient = Pick<PrismaClient, 'category' | 'product'>;

export interface ProductSeed {
  name: string;
  sku: string;
  price: number;
  unit: ProductUnit;
  stock: number;
}

export interface CategorySeed {
  name: string;
  description?: string;
  products: ProductSeed[];
}

export type CatalogSeed = CategorySeed[];

// Sample data with high, low and zero stock, plus fractional units (Kg, Meter)
export const SAMPLE_CATALOG: CatalogSeed = [
  {
    name: 'Almacén',
    description: 'Alimentos y bebidas',
    products: [
      {
        name: 'Arroz largo fino 1 kg',
        sku: 'ALM-001',
        price: 1850,
        unit: ProductUnit.Unit,
        stock: 40,
      },
      {
        name: 'Yerba mate 1 kg',
        sku: 'ALM-002',
        price: 4200,
        unit: ProductUnit.Unit,
        stock: 3,
      },
      {
        name: 'Queso cremoso',
        sku: 'ALM-003',
        price: 9800,
        unit: ProductUnit.Kg,
        stock: 7.25,
      },
    ],
  },
  {
    name: 'Ferretería',
    description: 'Herramientas y materiales',
    products: [
      {
        name: 'Cable unipolar 2,5 mm',
        sku: 'FER-001',
        price: 950,
        unit: ProductUnit.Meter,
        stock: 125.5,
      },
      {
        name: 'Pintura látex blanca',
        sku: 'FER-002',
        price: 15500,
        unit: ProductUnit.Liter,
        stock: 0,
      },
    ],
  },
];

// ownerId is a cross-service reference to auth.users.id, provided by the
// orchestrator: this seed never reads the auth database.
export async function seedErp(
  prisma: ErpSeedClient,
  ownerId: string,
  catalog: CatalogSeed = SAMPLE_CATALOG,
): Promise<void> {
  for (const categorySeed of catalog) {
    const categoryId = await findOrCreateCategory(prisma, categorySeed);

    for (const p of categorySeed.products) {
      // A product that already exists is skipped: seeding it again would add
      // another Income movement and double its stock.
      const existing = await prisma.product.findUnique({
        where: { sku: p.sku },
        select: { id: true },
      });
      if (existing) continue;

      // Nested write: the product and its Income movement are inserted in a
      // single transaction, so stock is always backed by a movement (RN-01).
      // Zero stock gets no movement, since an Income must be positive.
      await prisma.product.create({
        data: {
          name: p.name,
          sku: p.sku,
          price: p.price,
          unit: p.unit,
          stock: p.stock,
          categoryId,
          stockMovements:
            p.stock > 0
              ? {
                  create: {
                    typeMovement: MovementType.Income,
                    quantity: p.stock,
                    userId: ownerId,
                  },
                }
              : undefined,
        },
        select: { id: true },
      });
      console.log(`[seed:erp] Product created (${p.sku})`);
    }
  }
}

// The natural key is a partial unique index (deleted = false), which Prisma
// cannot target with upsert or findUnique.
async function findOrCreateCategory(
  prisma: ErpSeedClient,
  seed: CategorySeed,
): Promise<string> {
  const existing = await prisma.category.findFirst({
    where: { name: seed.name, deleted: false },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.category.create({
    data: { name: seed.name, description: seed.description },
    select: { id: true },
  });
  return created.id;
}
