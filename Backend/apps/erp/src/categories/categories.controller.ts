import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreateCategoryDto, ERP_PATTERNS } from '@app/contracts';
import { CategoriesService } from './categories.service';

@Controller()
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @MessagePattern(ERP_PATTERNS.LIST_CATEGORIES)
  list() {
    return this.categoriesService.list();
  }

  @MessagePattern(ERP_PATTERNS.CREATE_CATEGORY)
  create(@Payload() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }
}
