import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreatePaymentDto, PAYMENTS_PATTERNS } from '@app/contracts';
import type { PaymentView } from '@app/contracts';
import { PaymentsService } from './payments.service';

@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @MessagePattern(PAYMENTS_PATTERNS.COUNT_PAYMENTS)
  countPayments(): Promise<number> {
    return this.paymentsService.countPayments();
  }

  @MessagePattern(PAYMENTS_PATTERNS.CREATE_PAYMENT)
  create(@Payload() dto: CreatePaymentDto): Promise<PaymentView> {
    return this.paymentsService.create(dto);
  }
}
