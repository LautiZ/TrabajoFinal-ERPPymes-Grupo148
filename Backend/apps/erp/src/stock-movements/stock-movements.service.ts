import { Injectable } from '@nestjs/common';
import {
  paginate,
  type ListStockMovementsDto,
  type PaginatedResponse,
  type StockMovementView,
} from '@app/contracts';
import {
  StockMovementsRepository,
  type StockMovementRow,
} from './stock-movements.repository';

// An Outcome always takes stock out; an Adjustment goes by its sign (RN-03)
const toView = ({ quantity, ...row }: StockMovementRow): StockMovementView => ({
  ...row,
  direction: row.type === 'Outcome' || quantity < 0 ? 'Out' : 'In',
  quantity: Math.abs(quantity),
});

@Injectable()
export class StockMovementsService {
  constructor(private readonly repository: StockMovementsRepository) {}

  async list(
    query: ListStockMovementsDto,
  ): Promise<PaginatedResponse<StockMovementView>> {
    const [rows, total] = await this.repository.list(query);
    return paginate(rows.map(toView), total, query);
  }
}
