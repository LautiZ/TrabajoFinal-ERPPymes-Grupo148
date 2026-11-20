import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StockSummaryCounts } from '../models/product.model';
import { InventoryService } from './inventory.service';

export type StockCounts = StockSummaryCounts;

/** Cantidad de productos en cada estado de stock, calculada por el backend (`GET /products/stock-summary`). */
@Injectable({
  providedIn: 'root',
})
export class StockSummaryService {
  private readonly inventory = inject(InventoryService);

  load(): Observable<StockCounts> {
    return this.inventory.stockSummary();
  }
}
