import { Injectable } from '@nestjs/common';
import type { CategoryView, CreateCategoryDto } from '@app/contracts';
import { rpcError } from '../common/rpc-error';
import { CategoriesRepository } from './categories.repository';

@Injectable()
export class CategoriesService {
  constructor(private readonly categoriesRepository: CategoriesRepository) {}

  list(): Promise<CategoryView[]> {
    return this.categoriesRepository.list();
  }

  async create(dto: CreateCategoryDto): Promise<CategoryView> {
    const created = await this.categoriesRepository.create(dto);
    if (!created) throw rpcError(409, 'Category name already exists');
    return created;
  }

  // Rejected while active products use it, so no product points to a deleted category
  async remove(id: string): Promise<void> {
    if (!(await this.categoriesRepository.existsActive(id))) {
      throw rpcError(404, 'Category not found');
    }
    if ((await this.categoriesRepository.countActiveProducts(id)) > 0) {
      throw rpcError(409, 'Category has active products');
    }
    // Still checked: it may have been deleted between both queries
    if (!(await this.categoriesRepository.softDelete(id))) {
      throw rpcError(404, 'Category not found');
    }
  }
}
