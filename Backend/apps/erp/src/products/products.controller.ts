import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  AdjustStockMessage,
  CreateProductMessage,
  ERP_PATTERNS,
  ListProductsDto,
  ProductIdMessage,
  UpdateProductMessage,
} from '@app/contracts';
import { ProductsService } from './products.service';

@Controller()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @MessagePattern(ERP_PATTERNS.LIST_PRODUCTS)
  list(@Payload() query: ListProductsDto) {
    return this.productsService.list(query);
  }

  @MessagePattern(ERP_PATTERNS.STOCK_SUMMARY)
  stockSummary() {
    return this.productsService.stockSummary();
  }

  @MessagePattern(ERP_PATTERNS.GET_PRODUCT)
  get(@Payload() { id }: ProductIdMessage) {
    return this.productsService.get(id);
  }

  @MessagePattern(ERP_PATTERNS.CREATE_PRODUCT)
  create(@Payload() message: CreateProductMessage) {
    return this.productsService.create(message);
  }

  @MessagePattern(ERP_PATTERNS.UPDATE_PRODUCT)
  update(@Payload() message: UpdateProductMessage) {
    return this.productsService.update(message);
  }

  @MessagePattern(ERP_PATTERNS.DELETE_PRODUCT)
  remove(@Payload() { id }: ProductIdMessage) {
    return this.productsService.remove(id);
  }

  @MessagePattern(ERP_PATTERNS.ADJUST_STOCK)
  adjustStock(@Payload() message: AdjustStockMessage) {
    return this.productsService.adjustStock(message);
  }
}
