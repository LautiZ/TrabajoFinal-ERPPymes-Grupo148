import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { PAYMENTS_PATTERNS } from '@app/contracts';
import { PaymentsService } from './payments.service';

@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @MessagePattern(PAYMENTS_PATTERNS.COUNT_PAYMENTS)
  countPayments(): Promise<number> {
    return this.paymentsService.countPayments();
  }
}
