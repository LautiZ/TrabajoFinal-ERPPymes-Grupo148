import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../../../core/services/api.service';
import { StockCounts, StockSummaryService } from './stock-summary.service';

describe('StockSummaryService', () => {
  let service: StockSummaryService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: 'http://api.test' },
      ],
    });
    service = TestBed.inject(StockSummaryService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lee los conteos ya calculados por el backend (GET /products/stock-summary)', () => {
    let summary: StockCounts | undefined;
    service.load().subscribe((s) => (summary = s));

    const req = http.expectOne('http://api.test/products/stock-summary');
    expect(req.request.method).toBe('GET');
    req.flush({ total: 20, ok: 14, low: 4, out: 2 });

    expect(summary).toEqual({ total: 20, ok: 14, low: 4, out: 2 });
  });

  it('propaga el error si falla la consulta', () => {
    let failed = false;
    service.load().subscribe({ error: () => (failed = true) });

    http
      .expectOne('http://api.test/products/stock-summary')
      .flush({}, { status: 500, statusText: 'Server Error' });

    expect(failed).toBe(true);
  });
});
