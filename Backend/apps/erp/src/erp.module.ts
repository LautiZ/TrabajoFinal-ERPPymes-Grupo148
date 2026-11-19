import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics/analytics.controller';
import { AnalyticsRepository } from './analytics/analytics.repository';
import { AnalyticsService } from './analytics/analytics.service';
import { ErpController } from './erp.controller';
import { ErpService } from './erp.service';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsRepository } from './products/products.repository';
import { ProductsController } from './products/products.controller';
import { ProductsService } from './products/products.service';
import { CategoriesController } from './categories/categories.controller';
import { CategoriesRepository } from './categories/categories.repository';
import { CategoriesService } from './categories/categories.service';
import { SalesController } from './sales/sales.controller';
import { SalesRepository } from './sales/sales.repository';
import { SalesService } from './sales/sales.service';
import { envs } from './config/envs';
import {
  SALE_EXPIRATION_OPTIONS,
  SaleExpirationJob,
  SaleExpirationOptions,
} from './sales/sale-expiration.job';

@Module({
  imports: [PrismaModule],
  controllers: [
    ErpController,
    ProductsController,
    CategoriesController,
    SalesController,
    AnalyticsController,
  ],
  providers: [
    AnalyticsRepository,
    AnalyticsService,
    ErpService,
    ProductsRepository,
    ProductsService,
    CategoriesRepository,
    CategoriesService,
    SalesRepository,
    SalesService,
    SaleExpirationJob,
    {
      provide: SALE_EXPIRATION_OPTIONS,
      useValue: {
        paymentWindowMinutes: envs.SALE_PAYMENT_WINDOW_MINUTES,
        intervalMs: 60_000,
      } satisfies SaleExpirationOptions,
    },
  ],
})
export class ErpModule {}
