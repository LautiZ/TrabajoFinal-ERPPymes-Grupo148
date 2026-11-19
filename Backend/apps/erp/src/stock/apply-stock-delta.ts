import type { Prisma } from '../generated/prisma/client';

/**
 * Changes a product's stock by a signed delta inside the caller's transaction.
 * The stock check lives in the UPDATE itself (stock >= quantity), so Postgres
 * locks the row and two concurrent decrements can never both pass a stale
 * read (RN-02). Returns false when no row matched: missing, deleted, paused
 * (when onlyActive) or not enough stock.
 *
 * Shared by manual adjustments and sales so both enforce the same rule.
 */
export const applyStockDelta = async (
  tx: Prisma.TransactionClient,
  productId: string,
  delta: number,
  { onlyActive = false }: { onlyActive?: boolean } = {},
): Promise<boolean> => {
  const { count } = await tx.product.updateMany({
    where: {
      id: productId,
      deleted: false,
      ...(onlyActive && { active: true }),
      ...(delta < 0 && { stock: { gte: -delta } }),
    },
    data: { stock: { increment: delta } },
  });
  return count > 0;
};
