import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PrismaModule } from './prisma/prisma.module';
import { PaymentsRepository } from './payments/payments.repository';
import { MercadoPagoModule } from './mercadopago/mercadopago.module';

@Module({
  imports: [PrismaModule, MercadoPagoModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsRepository],
})
export class PaymentsModule {}
