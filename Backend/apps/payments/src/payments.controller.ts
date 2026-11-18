import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  CreatePaymentDto,
  PAYMENTS_PATTERNS,
  PaymentNotificationMessage,
  SalePaymentMessage,
} from '@app/contracts';
import type { PaymentView } from '@app/contracts';
import { PaymentNotificationsService } from './payments/payment-notifications.service';
import { PaymentsService } from './payments.service';

@Controller()
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly notificationsService: PaymentNotificationsService,
  ) {}

  @MessagePattern(PAYMENTS_PATTERNS.COUNT_PAYMENTS)
  countPayments(): Promise<number> {
    return this.paymentsService.countPayments();
  }

  @MessagePattern(PAYMENTS_PATTERNS.CREATE_PAYMENT)
  create(@Payload() dto: CreatePaymentDto): Promise<PaymentView> {
    return this.paymentsService.create(dto);
  }

  @MessagePattern(PAYMENTS_PATTERNS.GET_SALE_PAYMENT)
  getBySale(@Payload() message: SalePaymentMessage): Promise<PaymentView> {
    return this.paymentsService.getBySale(message);
  }

  @MessagePattern(PAYMENTS_PATTERNS.HANDLE_NOTIFICATION)
  handleNotification(
    @Payload() notification: PaymentNotificationMessage,
  ): Promise<void> {
    return this.notificationsService.handle(notification);
  }
}
