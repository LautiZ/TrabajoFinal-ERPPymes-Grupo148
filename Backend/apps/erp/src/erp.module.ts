import { Module } from '@nestjs/common';
import { ErpController } from './erp.controller';
import { ErpService } from './erp.service';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsRepository } from './products/products.repository';

@Module({
  imports: [PrismaModule],
  controllers: [ErpController],
  providers: [ErpService, ProductsRepository],
})
export class ErpModule {}
