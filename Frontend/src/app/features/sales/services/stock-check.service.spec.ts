import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CatalogProduct } from '../models/product.model';
import { createMemoryStorage, createProduct } from '../testing/factories';
import { CART_STORAGE, CartService } from './cart.service';
import { CatalogService } from './catalog.service';
import { StockCheckService } from './stock-check.service';

describe('StockCheckService', () => {
  let cart: CartService;
  let service: StockCheckService;
  let fresh: (CatalogProduct | null)[];

  beforeEach(() => {
    fresh = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: CART_STORAGE, useValue: createMemoryStorage() },
        { provide: CatalogService, useValue: { getProducts: () => of(fresh) } },
      ],
    });
    cart = TestBed.inject(CartService);
    service = TestBed.inject(StockCheckService);
  });

  it('no reporta conflictos si el stock sigue alcanzando y refresca el stock conocido', () => {
    cart.addItem(createProduct({ stock: 10 }), 3);
    fresh = [createProduct({ stock: 8 })];

    let result: unknown;
    service.verify().subscribe((c) => (result = c));

    expect(result).toEqual([]);
    expect(cart.items()[0].stock).toBe(8);
  });

  it('reporta los ítems cuyo stock bajó por debajo de la cantidad pedida', () => {
    cart.addItem(createProduct({ stock: 10 }), 5);
    fresh = [createProduct({ stock: 2 })];

    let result: unknown;
    service.verify().subscribe((c) => (result = c));

    expect(result).toEqual([{ productId: 'p1', name: 'Yerba 1kg', requested: 5, available: 2 }]);
  });

  it('un producto pausado cuenta como sin stock', () => {
    cart.addItem(createProduct({ stock: 10 }), 1);
    fresh = [createProduct({ stock: 10, active: false })];

    let result: { available: number }[] = [];
    service.verify().subscribe((c) => (result = c));

    expect(result).toHaveLength(1);
    expect(result[0].available).toBe(0);
  });

  it('no marca como conflicto un producto que no se pudo leer (error de red)', () => {
    cart.addItem(createProduct({ stock: 10 }), 5);
    fresh = [null];

    let result: unknown;
    service.verify().subscribe((c) => (result = c));

    expect(result).toEqual([]);
    expect(cart.items()[0].stock).toBe(10);
  });

  it('adjustToAvailable ajusta la cantidad o quita el ítem sin stock', () => {
    cart.addItem(createProduct({ id: 'a', stock: 10 }), 6);
    cart.addItem(createProduct({ id: 'b', stock: 10 }), 4);

    service.adjustToAvailable([
      { productId: 'a', name: 'A', requested: 6, available: 2 },
      { productId: 'b', name: 'B', requested: 4, available: 0 },
    ]);

    expect(cart.items().map((i) => [i.productId, i.quantity])).toEqual([['a', 2]]);
  });

  it('adjustToAvailable redondea hacia abajo en productos por unidad', () => {
    cart.addItem(createProduct({ stock: 10 }), 6);

    service.adjustToAvailable([{ productId: 'p1', name: 'A', requested: 6, available: 2.7 }]);

    expect(cart.items()[0].quantity).toBe(2);
  });

  it('withNames completa los nombres que el backend no informó', () => {
    cart.addItem(createProduct(), 1);

    expect(
      service.withNames([
        { productId: 'p1', name: '', requested: 2, available: 1 },
        { productId: 'zz', name: '', requested: 2, available: 1 },
      ]),
    ).toEqual([
      { productId: 'p1', name: 'Yerba 1kg', requested: 2, available: 1 },
      { productId: 'zz', name: 'Producto', requested: 2, available: 1 },
    ]);
  });
});
