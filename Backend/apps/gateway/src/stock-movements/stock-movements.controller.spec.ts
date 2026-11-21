import { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import { ERP_PATTERNS } from '@app/contracts';
import { StockMovementsController } from './stock-movements.controller';

describe('StockMovementsController', () => {
  const erp = { send: jest.fn() };
  const controller = new StockMovementsController(
    erp as unknown as ClientProxy,
  );

  it('asks the ERP for the page of movements', async () => {
    const page = {
      data: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
    };
    erp.send.mockReturnValue(of(page));

    await expect(controller.list({ page: 1, limit: 10 })).resolves.toBe(page);
    expect(erp.send).toHaveBeenCalledWith(ERP_PATTERNS.LIST_STOCK_MOVEMENTS, {
      page: 1,
      limit: 10,
    });
  });
});
