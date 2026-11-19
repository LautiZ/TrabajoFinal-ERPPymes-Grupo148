import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ERP_SERVICE } from '@app/contracts';
import { envs } from './config/envs';
import { SalesClient } from './erp/sales.client';
import { MercadoPagoModule } from './mercadopago/mercadopago.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { CHECKOUT_OPTIONS } from './payments/checkout-options';
import { PaymentNotificationsService } from './payments/payment-notifications.service';
import type { CheckoutOptions } from './payments/checkout-options';
import { PaymentsRepository } from './payments/payments.repository';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    MercadoPagoModule,
    ClientsModule.register([
      {
        name: ERP_SERVICE,
        transport: Transport.TCP,
        options: { host: envs.ERP_MS_HOST, port: envs.ERP_MS_PORT },
      },
    ]),
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentNotificationsService,
    PaymentsRepository,
    SalesClient,
    {
      provide: CHECKOUT_OPTIONS,
      useValue: { frontendUrl: envs.FRONTEND_URL } satisfies CheckoutOptions,
    },
  ],
})
export class PaymentsModule {}
