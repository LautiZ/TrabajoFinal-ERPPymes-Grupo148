import { PATTERN_METADATA } from '@nestjs/microservices/constants';
import { ERP_PATTERNS } from '@app/contracts';
import { StockMovementsController } from './stock-movements.controller';
import { StockMovementsService } from './stock-movements.service';

describe('StockMovementsController (TCP patterns)', () => {
  const service = { list: jest.fn() };
  const controller = new StockMovementsController(
    service as unknown as StockMovementsService,
  );

  it('list answers the list pattern and forwards the query', () => {
    expect(
      Reflect.getMetadata(
        PATTERN_METADATA,
        // eslint-disable-next-line @typescript-eslint/unbound-method -- only read as a metadata key, never called
        StockMovementsController.prototype.list,
      ),
    ).toEqual([ERP_PATTERNS.LIST_STOCK_MOVEMENTS]);

    const query = { page: 1, limit: 10 };
    void controller.list(query);
    expect(service.list).toHaveBeenCalledWith(query);
  });
});
