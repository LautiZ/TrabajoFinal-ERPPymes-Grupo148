import { PrismaService } from '../prisma/prisma.service';
import { PaymentsRepository } from './payments.repository';

describe('PaymentsRepository.findCurrentBySale', () => {
  const findFirst = jest.fn();
  const repository = new PaymentsRepository({
    payment: { findFirst },
  } as unknown as PrismaService);

  beforeEach(() => findFirst.mockReset());

  // A late payment can leave a newer Pending or Rejected attempt next to the
  // paid one: the paid attempt is the one that represents the sale
  it('prefers the first paid attempt over a newer one', async () => {
    const paid = { id: 'pay-1', paymentState: 'Paid' };
    findFirst.mockResolvedValueOnce(paid);

    await expect(repository.findCurrentBySale('sale-1')).resolves.toBe(paid);
    expect(findFirst).toHaveBeenCalledWith({
      where: { saleId: 'sale-1', paymentState: 'Paid' },
      orderBy: { createdAt: 'asc' },
    });
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it('falls back to the latest attempt when none is paid', async () => {
    const latest = { id: 'pay-2', paymentState: 'Rejected' };
    findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(latest);

    await expect(repository.findCurrentBySale('sale-1')).resolves.toBe(latest);
    expect(findFirst).toHaveBeenLastCalledWith({
      where: { saleId: 'sale-1' },
      orderBy: { createdAt: 'desc' },
    });
  });
});
