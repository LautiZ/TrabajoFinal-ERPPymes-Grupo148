import { TestBed } from '@angular/core/testing';
import { createMemoryStorage, createProduct } from '../testing/factories';
import { CART_STORAGE, CART_STORAGE_KEY, CartService } from './cart.service';

describe('CartService', () => {
  let storage: Storage;

  function createService(): CartService {
    return TestBed.inject(CartService);
  }

  beforeEach(() => {
    storage = createMemoryStorage();
    TestBed.configureTestingModule({
      providers: [{ provide: CART_STORAGE, useValue: storage }],
    });
  });

  it('empieza vacío', () => {
    const cart = createService();
    expect(cart.isEmpty()).toBe(true);
    expect(cart.total()).toBe(0);
    expect(cart.itemCount()).toBe(0);
  });

  it('agrega ítems y recalcula subtotal, total e itemCount', () => {
    const cart = createService();
    cart.addItem(createProduct({ id: 'a', price: 100 }), 2);
    cart.addItem(createProduct({ id: 'b', price: 50.5 }), 3);

    expect(cart.itemCount()).toBe(2);
    expect(cart.subtotal()).toBe(351.5);
    expect(cart.total()).toBe(351.5);
  });

  it('suma la cantidad cuando el producto ya está en el carrito', () => {
    const cart = createService();
    const product = createProduct({ stock: 10 });
    cart.addItem(product, 2);
    cart.addItem(product, 3);

    expect(cart.items()).toHaveLength(1);
    expect(cart.items()[0].quantity).toBe(5);
  });

  it('no permite superar el stock disponible', () => {
    const cart = createService();
    const product = createProduct({ stock: 3 });
    cart.addItem(product, 2);

    const result = cart.addItem(product, 2);

    expect(result).toEqual({ ok: false, reason: 'exceeds-stock', max: 3 });
    expect(cart.items()[0].quantity).toBe(2);
  });

  it('rechaza productos pausados, sin stock o con cantidades inválidas', () => {
    const cart = createService();

    expect(cart.addItem(createProduct({ active: false }))).toMatchObject({ reason: 'inactive' });
    expect(cart.addItem(createProduct({ stock: 0 }))).toMatchObject({ reason: 'out-of-stock' });
    expect(cart.addItem(createProduct(), 0)).toMatchObject({ reason: 'invalid-quantity' });
    expect(cart.addItem(createProduct(), -1)).toMatchObject({ reason: 'invalid-quantity' });
    expect(cart.addItem(createProduct(), Number.NaN)).toMatchObject({ reason: 'invalid-quantity' });
    expect(cart.isEmpty()).toBe(true);
  });

  it('exige cantidades enteras para Unit pero admite decimales en Kg (RN-05)', () => {
    const cart = createService();

    expect(cart.addItem(createProduct({ unit: 'Unit' }), 1.5)).toMatchObject({
      reason: 'integer-required',
    });
    expect(cart.addItem(createProduct({ id: 'k', unit: 'Kg', stock: 5 }), 1.25)).toEqual({
      ok: true,
    });
    expect(cart.items()[0].quantity).toBe(1.25);
  });

  it('updateQuantity cambia la cantidad y respeta el stock', () => {
    const cart = createService();
    cart.addItem(createProduct({ stock: 4 }), 1);

    expect(cart.updateQuantity('p1', 3)).toEqual({ ok: true });
    expect(cart.items()[0].quantity).toBe(3);
    expect(cart.updateQuantity('p1', 5)).toEqual({ ok: false, reason: 'exceeds-stock', max: 4 });
    expect(cart.items()[0].quantity).toBe(3);
    expect(cart.updateQuantity('nope', 1)).toMatchObject({ reason: 'not-found' });
  });

  it('updateQuantity con cantidad <= 0 quita el ítem', () => {
    const cart = createService();
    cart.addItem(createProduct(), 2);

    cart.updateQuantity('p1', 0);

    expect(cart.isEmpty()).toBe(true);
  });

  it('removeItem y clear vacían el carrito', () => {
    const cart = createService();
    cart.addItem(createProduct({ id: 'a' }));
    cart.addItem(createProduct({ id: 'b' }));

    cart.removeItem('a');
    expect(cart.items().map((i) => i.productId)).toEqual(['b']);

    cart.clear();
    expect(cart.isEmpty()).toBe(true);
  });

  it('setStock actualiza el stock conocido sin tocar la cantidad', () => {
    const cart = createService();
    cart.addItem(createProduct({ stock: 10 }), 4);

    cart.setStock('p1', 2);

    expect(cart.items()[0]).toMatchObject({ stock: 2, quantity: 4 });
  });

  it('persiste el carrito y lo restaura tras recargar', () => {
    createService().addItem(createProduct({ price: 200 }), 3);
    expect(storage.getItem(CART_STORAGE_KEY)).not.toBeNull();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: CART_STORAGE, useValue: storage }],
    });
    const restored = TestBed.inject(CartService);

    expect(restored.items()).toHaveLength(1);
    expect(restored.total()).toBe(600);
  });

  it('ignora contenido corrupto o inválido en el storage', () => {
    storage.setItem(CART_STORAGE_KEY, '{no es json');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: CART_STORAGE, useValue: storage }],
    });
    expect(TestBed.inject(CartService).isEmpty()).toBe(true);

    storage.setItem(CART_STORAGE_KEY, JSON.stringify([{ productId: 1 }, 'x', null]));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: CART_STORAGE, useValue: storage }],
    });
    expect(TestBed.inject(CartService).isEmpty()).toBe(true);
  });

  it('sigue funcionando en memoria si no hay storage', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: CART_STORAGE, useValue: null }] });
    const cart = TestBed.inject(CartService);

    expect(cart.addItem(createProduct())).toEqual({ ok: true });
    expect(cart.itemCount()).toBe(1);
  });
});
