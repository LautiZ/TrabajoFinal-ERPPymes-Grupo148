import { Injectable } from '@nestjs/common';
import { ProductsRepository } from './products/products.repository';

@Injectable()
export class ErpService {
  constructor(private readonly productsRepository: ProductsRepository) {}

  countProducts(): Promise<number> {
    return this.productsRepository.count();
  }
}
