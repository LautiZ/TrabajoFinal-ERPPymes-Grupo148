import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AUTH_SERVICE, ERP_SERVICE, PAYMENTS_SERVICE } from '@app/contracts';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthGuard } from './auth/auth.guard';
import { envs } from './config/envs';
import { RolesGuard } from './auth/roles.guard';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { RpcToHttpExceptionFilter } from './common/rpc-to-http-exception.filter';
import { AuthController } from './auth/auth.controller';
import { UsersController } from './users/users.controller';
import { ThrottlerModule } from '@nestjs/throttler';
import { ProductsController } from './products/products.controller';
import { CategoriesController } from './categories/categories.controller';
import { SalesController } from './sales/sales.controller';
import { StockMovementsController } from './stock-movements/stock-movements.controller';
import { AnalyticsController } from './analytics/analytics.controller';
import { PaymentsController } from './payments/payments.controller';
import { PaymentsWebhookController } from './payments/payments-webhook.controller';

@Module({
  imports: [
    // Policy only: the guard is bound on the login route, not globally
    ThrottlerModule.forRoot([
      { ttl: envs.LOGIN_THROTTLE_TTL_MS, limit: envs.LOGIN_THROTTLE_LIMIT },
    ]),
    ClientsModule.register([
      {
        name: AUTH_SERVICE,
        transport: Transport.TCP,
        options: { host: envs.AUTH_MS_HOST, port: envs.AUTH_MS_PORT },
      },
      {
        name: ERP_SERVICE,
        transport: Transport.TCP,
        options: { host: envs.ERP_MS_HOST, port: envs.ERP_MS_PORT },
      },
      {
        name: PAYMENTS_SERVICE,
        transport: Transport.TCP,
        options: { host: envs.PAYMENTS_MS_HOST, port: envs.PAYMENTS_MS_PORT },
      },
    ]),
  ],
  controllers: [
    AppController,
    AuthController,
    UsersController,
    ProductsController,
    CategoriesController,
    SalesController,
    StockMovementsController,
    AnalyticsController,
    PaymentsController,
    PaymentsWebhookController,
  ],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: RpcToHttpExceptionFilter },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
