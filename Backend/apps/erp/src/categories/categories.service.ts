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
}
