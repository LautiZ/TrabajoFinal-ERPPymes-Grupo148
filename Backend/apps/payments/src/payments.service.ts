import { Injectable } from '@nestjs/common';
import { PaymentsRepository } from './payments/payments.repository';

@Injectable()
export class PaymentsService {
  constructor(private readonly paymentsRepository: PaymentsRepository) {}

  countPayments(): Promise<number> {
    return this.paymentsRepository.count();
  }
}
