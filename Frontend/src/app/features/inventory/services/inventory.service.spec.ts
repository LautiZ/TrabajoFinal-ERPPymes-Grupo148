import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PaginatedResponse } from '../../../core/models/pagination.model';
import { API_URL } from '../../../core/services/api.service';
import { Category, Product } from '../models/product.model';
import { InventoryService } from './inventory.service';

const BASE = 'http://api.test';

const rawProduct = {
  id: 'p1',
  name: 'Yerba Mate 1kg',
  sku: 'YER-001',
  price: '4500.00',
  stock: '25.500',
  unit: 'Kg',
  categoryId: 'c1',
  category: { id: 'c1', name: 'Almacén' },
  active: true,
  deleted: false,
};

describe('InventoryService', () => {
  let service: InventoryService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: BASE },
      ],
    });
    service = TestBed.inject(InventoryService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('list', () => {
    it('envía paginación, búsqueda, orden y filtros como query params', () => {
      service
        .list({
          page: 2,
          limit: 25,
          search: 'yerba',
          sortBy: 'price',
          sortOrder: 'desc',
          categoryId: 'c1',
          stockStatus: 'low',
          lowStockThreshold: 10,
        })
        .subscribe();

      const req = http.expectOne((r) => r.url === `${BASE}/products`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('limit')).toBe('25');
      expect(req.request.params.get('search')).toBe('yerba');
      expect(req.request.params.get('sortBy')).toBe('price');
      expect(req.request.params.get('sortOrder')).toBe('desc');
      expect(req.request.params.get('categoryId')).toBe('c1');
      expect(req.request.params.get('stockStatus')).toBe('low');
      expect(req.request.params.get('lowStockThreshold')).toBe('10');
      req.flush({ data: [], meta: { total: 0, page: 2, limit: 25, totalPages: 0 } });
    });

    it('usa página 1 y 10 por página por defecto y omite los filtros vacíos', () => {
      service.list().subscribe();

      const req = http.expectOne((r) => r.url === `${BASE}/products`);
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('limit')).toBe('10');
      expect(req.request.params.has('search')).toBe(false);
      expect(req.request.params.has('stockStatus')).toBe(false);
      req.flush({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } });
    });

    it('normaliza los decimales que llegan como string y conserva la paginación', () => {
      let result: PaginatedResponse<Product> | undefined;
      service.list().subscribe((r) => (result = r));

      http
        .expectOne((r) => r.url === `${BASE}/products`)
        .flush({ data: [rawProduct], meta: { total: 41, page: 1, limit: 10, totalPages: 5 } });

      expect(result?.meta.total).toBe(41);
      expect(result?.data[0]).toEqual({
        id: 'p1',
        name: 'Yerba Mate 1kg',
        sku: 'YER-001',
        price: 4500,
        stock: 25.5,
        unit: 'Kg',
        categoryId: 'c1',
        category: { id: 'c1', name: 'Almacén' },
        active: true,
        deleted: false,
      });
    });

    it('toma categoryId de la categoría anidada y asume activo si no viene el flag', () => {
      let product: Product | undefined;
      service.getById('p1').subscribe((p) => (product = p));

      const sinCampos = {
        id: rawProduct.id,
        name: rawProduct.name,
        sku: rawProduct.sku,
        price: rawProduct.price,
        stock: rawProduct.stock,
        unit: rawProduct.unit,
        category: rawProduct.category,
      };
      http.expectOne(`${BASE}/products/p1`).flush(sinCampos);

      expect(product?.categoryId).toBe('c1');
      expect(product?.active).toBe(true);
      expect(product?.deleted).toBe(false);
    });
  });

  it('getById consulta el producto y codifica el id en la URL', () => {
    service.getById('a/b').subscribe();

    const req = http.expectOne(`${BASE}/products/a%2Fb`);
    expect(req.request.method).toBe('GET');
    req.flush(rawProduct);
  });

  it('create envía el DTO por POST y devuelve el producto normalizado', () => {
    const dto = {
      name: 'Yerba',
      sku: 'YER-001',
      price: 4500,
      stock: 10,
      unit: 'Unit' as const,
      categoryId: 'c1',
    };
    let product: Product | undefined;
    service.create(dto).subscribe((p) => (product = p));

    const req = http.expectOne(`${BASE}/products`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush(rawProduct);

    expect(product?.price).toBe(4500);
  });

  it('update envía solo los campos indicados por PATCH', () => {
    service.update('p1', { price: 5000, active: false }).subscribe();

    const req = http.expectOne(`${BASE}/products/p1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ price: 5000, active: false });
    req.flush(rawProduct);
  });

  it('delete hace la baja por DELETE', () => {
    let done = false;
    service.delete('p1').subscribe(() => (done = true));

    const req = http.expectOne(`${BASE}/products/p1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(done).toBe(true);
  });

  it('adjustStock registra el movimiento con motivo y no depende de la respuesta', () => {
    const dto = { type: 'Outcome' as const, quantity: 3, reason: 'Merma' };
    let result: unknown = 'sin respuesta';
    service.adjustStock('p1', dto).subscribe((r) => (result = r));

    const req = http.expectOne(`${BASE}/products/p1/stock-movements`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush({ id: 'm1', typeMovement: 'Outcome' });

    expect(result).toBeUndefined();
  });

  describe('listCategories', () => {
    const categories: Category[] = [{ id: 'c1', name: 'Almacén' }];

    it('acepta un arreglo simple', () => {
      let result: Category[] | undefined;
      service.listCategories().subscribe((c) => (result = c));

      http.expectOne(`${BASE}/categories`).flush(categories);

      expect(result).toEqual(categories);
    });

    it('acepta una respuesta paginada', () => {
      let result: Category[] | undefined;
      service.listCategories().subscribe((c) => (result = c));

      http
        .expectOne(`${BASE}/categories`)
        .flush({ data: categories, meta: { total: 1, page: 1, limit: 10, totalPages: 1 } });

      expect(result).toEqual(categories);
    });
  });

  it('propaga los errores del servidor para que la UI los muestre', () => {
    let status: number | undefined;
    service
      .create({
        name: 'x',
        sku: 'dup',
        price: 1,
        stock: 0,
        unit: 'Unit',
        categoryId: 'c1',
      })
      .subscribe({ error: (e: { status: number }) => (status = e.status) });

    http
      .expectOne(`${BASE}/products`)
      .flush({ message: 'SKU duplicado' }, { status: 409, statusText: 'Conflict' });

    expect(status).toBe(409);
  });
});
