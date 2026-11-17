import { Injectable } from '@nestjs/common';
import {
  paginate,
  type AdjustStockMessage,
  type CreateProductMessage,
  type ListProductsDto,
  type PaginatedResponse,
  type ProductUnit,
  type ProductView,
  type StockSummary,
  type UpdateProductMessage,
} from '@app/contracts';
import { CategoriesRepository } from '../categories/categories.repository';
import { rpcError } from '../common/rpc-error';
import { ProductsRepository } from './products.repository';

// RN-05: Unit is counted in whole items; Kg, Meter and Liter accept decimals
const assertQuantityFitsUnit = (
  unit: ProductUnit,
  quantity: number,
  field: string,
) => {
  if (unit === 'Unit' && !Number.isInteger(quantity)) {
    throw rpcError(400, `${field} must be a whole number for Unit products`);
  }
};

@Injectable()
export class ProductsService {
  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly categoriesRepository: CategoriesRepository,
  ) {}

  async list(query: ListProductsDto): Promise<PaginatedResponse<ProductView>> {
    const [data, total] = await this.productsRepository.list(query);
    return paginate(data, total, query);
  }

  stockSummary(): Promise<StockSummary> {
    return this.productsRepository.stockSummary();
  }

  async get(id: string): Promise<ProductView> {
    const product = await this.productsRepository.findById(id);
    if (!product) throw rpcError(404, 'Product not found');
    return product;
  }

  async create({
    userId,
    product,
  }: CreateProductMessage): Promise<ProductView> {
    assertQuantityFitsUnit(product.unit, product.stock, 'stock');
    assertQuantityFitsUnit(
      product.unit,
      product.lowStockThreshold ?? 0,
      'lowStockThreshold',
    );
    await this.assertCategoryExists(product.categoryId);

    const created = await this.productsRepository.create(product, userId);
    if (!created) throw rpcError(409, 'SKU already exists');
    return created;
  }

  async update({ id, product }: UpdateProductMessage): Promise<ProductView> {
    const current = await this.get(id);

    // Checked against the values the product will have after the update
    const unit = product.unit ?? current.unit;
    assertQuantityFitsUnit(unit, current.stock, 'stock');
    assertQuantityFitsUnit(
      unit,
      product.lowStockThreshold ?? current.lowStockThreshold,
      'lowStockThreshold',
    );
    if (product.categoryId && product.categoryId !== current.categoryId) {
      await this.assertCategoryExists(product.categoryId);
    }

    const updated = await this.productsRepository.update(id, product);
    if (!updated) throw rpcError(409, 'SKU already exists');
    return updated;
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.productsRepository.softDelete(id);
    if (!deleted) throw rpcError(404, 'Product not found');
  }

  // Manual adjustment: stored as a signed Adjustment with its reason (RN-01, RN-03)
  async adjustStock({
    id,
    userId,
    adjustment,
  }: AdjustStockMessage): Promise<ProductView> {
    const current = await this.get(id);
    assertQuantityFitsUnit(current.unit, adjustment.quantity, 'quantity');

    const delta =
      adjustment.type === 'Income' ? adjustment.quantity : -adjustment.quantity;
    const updated = await this.productsRepository.adjustStock(
      id,
      delta,
      adjustment.reason,
      userId,
    );
    if (updated) return updated;

    // The guarded UPDATE matched nothing: deleted in between, or not enough stock
    const stillThere = await this.productsRepository.findById(id);
    if (!stillThere) throw rpcError(404, 'Product not found');
    throw rpcError(409, 'Insufficient stock');
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    const exists = await this.categoriesRepository.existsActive(categoryId);
    if (!exists) throw rpcError(400, 'Category does not exist');
  }
}
