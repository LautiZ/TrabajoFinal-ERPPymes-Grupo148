import { PATTERN_METADATA } from '@nestjs/microservices/constants';
import { ERP_PATTERNS } from '@app/contracts';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

// The pattern each handler answers: a typo here would leave a message with
// no handler, which only fails at runtime as a timeout in the caller
const patternOf = (handler: keyof SalesController) =>
  Reflect.getMetadata(
    PATTERN_METADATA,
    // eslint-disable-next-line @typescript-eslint/unbound-method -- only read as a metadata key, never called
    SalesController.prototype[handler],
  ) as string[];

describe('SalesController (TCP patterns)', () => {
  const service = {
    create: jest.fn(),
    list: jest.fn(),
    get: jest.fn(),
    markPaid: jest.fn(),
    cancel: jest.fn(),
    cancelByUser: jest.fn(),
    dispatch: jest.fn(),
    receipt: jest.fn(),
  };
  const controller = new SalesController(service as unknown as SalesService);

  it.each([
    ['create', ERP_PATTERNS.CREATE_SALE],
    ['list', ERP_PATTERNS.LIST_SALES],
    ['get', ERP_PATTERNS.GET_SALE],
    ['markPaid', ERP_PATTERNS.MARK_SALE_PAID],
    ['cancel', ERP_PATTERNS.CANCEL_SALE],
    ['receipt', ERP_PATTERNS.GET_SALE_RECEIPT],
    ['cancelByUser', ERP_PATTERNS.CANCEL_SALE_BY_USER],
    ['dispatch', ERP_PATTERNS.DISPATCH_SALE],
  ] as const)('%s answers %s', (handler, pattern) => {
    expect(patternOf(handler)).toEqual([pattern]);
  });

  it('passes the create message as is (userId comes from the session)', () => {
    const message = {
      userId: 'user-1',
      sale: { items: [{ productId: 'p-1', quantity: 1 }] },
    };
    void controller.create(message);
    expect(service.create).toHaveBeenCalledWith(message);
  });

  it.each(['get', 'markPaid', 'cancel', 'receipt'] as const)(
    '%s forwards only the sale id',
    (handler) => {
      void controller[handler]({ id: 'sale-1' });
      expect(service[handler]).toHaveBeenCalledWith('sale-1');
    },
  );

  it.each(['cancelByUser', 'dispatch'] as const)(
    '%s forwards the sale id and the acting user',
    (handler) => {
      const message = { id: 'sale-1', userId: 'user-1' };
      void controller[handler](message);
      expect(service[handler]).toHaveBeenCalledWith(message);
    },
  );
});
