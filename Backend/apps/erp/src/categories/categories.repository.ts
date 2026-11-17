import { Injectable } from '@nestjs/common';
import type { CategoryView, CreateCategoryDto } from '@app/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { isUniqueViolation } from '../prisma/prisma-errors';

const CATEGORY_SELECT = { id: true, name: true, description: true };

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<CategoryView[]> {
    return this.prisma.category.findMany({
      where: { deleted: false },
      orderBy: { name: 'asc' },
      select: CATEGORY_SELECT,
    });
  }

  async existsActive(id: string): Promise<boolean> {
    const count = await this.prisma.category.count({
      where: { id, deleted: false },
    });
    return count > 0;
  }

  // Returns null when an active category already has that name (RN-19)
  async create(data: CreateCategoryDto): Promise<CategoryView | null> {
    try {
      return await this.prisma.category.create({
        data,
        select: CATEGORY_SELECT,
      });
    } catch (err) {
      if (isUniqueViolation(err)) return null;
      throw err;
    }
  }
}
