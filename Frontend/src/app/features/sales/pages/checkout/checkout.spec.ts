import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Sale } from '../../models/sale.model';
import { CART_STORAGE, CartService } from '../../services/cart.service';
import { PaymentsService } from '../../services/payments.service';
import { SalesService } from '../../services/sales.service';
import { StockCheckService } from '../../services/stock-check.service';
import { createMemoryStorage, createProduct } from '../../testing/factories';
import { Checkout } from './checkout';

const SALE: Sale = { id: 'sale-1', total: 3000, currentState: 'Ordered', createdAt: '' };
const MP_URL = 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1';

describe('Checkout', () => {
  let fixture: ComponentFixture<Checkout>;
  let cart: CartService;
  let sales: { createSale: ReturnType<typeof vi.fn> };
  let payments: {
    createPayment: ReturnType<typeof vi.fn>;
    buildBackUrls: ReturnType<typeof vi.fn>;
    redirectToCheckout: ReturnType<typeof vi.fn>;
    rememberPendingSale: ReturnType<typeof vi.fn>;
  };
  let stock: {
    verify: ReturnType<typeof vi.fn>;
    adjustToAvailable: ReturnType<typeof vi.fn>;
    withNames: ReturnType<typeof vi.fn>;
  };
  let dialog: { open: ReturnType<typeof vi.fn> };

  const nameInput = 'input[formControlName=customerName]';
  const emailInput = 'input[formControlName=customerEmail]';

  const submitForm = (): void => {
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
  };
  const setField = (selector: string, value: string): void => {
    const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    sales = { createSale: vi.fn(() => of(SALE)) };
    payments = {
      createPayment: vi.fn(() => of({ initPoint: MP_URL })),
      buildBackUrls: vi.fn(() => ({ success: 's', failure: 'f', pending: 'p' })),
      redirectToCheckout: vi.fn(),
      rememberPendingSale: vi.fn(),
    };
    stock = {
      verify: vi.fn(() => of([])),
      adjustToAvailable: vi.fn(),
      withNames: vi.fn((c: unknown) => c),
    };
    dialog = { open: vi.fn(() => ({ afterClosed: () => of('review') })) };

    await TestBed.configureTestingModule({
      imports: [Checkout],
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        { provide: CART_STORAGE, useValue: createMemoryStorage() },
        { provide: SalesService, useValue: sales },
        { provide: PaymentsService, useValue: payments },
        { provide: StockCheckService, useValue: stock },
        { provide: MatDialog, useValue: dialog },
      ],
    }).compileComponents();

    cart = TestBed.inject(CartService);
    cart.addItem(createProduct({ price: 1500, stock: 10 }), 2);
    fixture = TestBed.createComponent(Checkout);
    fixture.detectChanges();
    // Punto de partida: formulario válido. Cada test invalida lo que necesite.
    setField(nameInput, 'Ana Pérez');
    setField(emailInput, 'ana@example.com');
  });

  it('muestra el resumen de la orden con el total', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Yerba 1kg');
    expect(text).toContain('3,000.00');
  });

  it('con el carrito vacío no permite confirmar ni llama al backend', () => {
    cart.clear();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('form')).toBeNull();
    (fixture.componentInstance as unknown as { submit: () => void }).submit();

    expect(sales.createSale).not.toHaveBeenCalled();
    expect(payments.createPayment).not.toHaveBeenCalled();
  });

  it('con email inválido no envía la venta y muestra el error', () => {
    setField('input[type=email]', 'esto-no-es-un-email');

    submitForm();
    fixture.detectChanges();

    expect(sales.createSale).not.toHaveBeenCalled();
    expect(payments.createPayment).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Ingresá un email válido.');
  });

  it('exige nombre y email: con los campos vacíos no confirma y marca qué falta', () => {
    setField(nameInput, '');
    setField(emailInput, '');

    submitForm();
    fixture.detectChanges();

    expect(sales.createSale).not.toHaveBeenCalled();
    expect(payments.createPayment).not.toHaveBeenCalled();
    expect(payments.redirectToCheckout).not.toHaveBeenCalled();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('El nombre es obligatorio.');
    expect(text).toContain('El email es obligatorio.');
  });

  it('exige el nombre aunque el email sea válido', () => {
    setField(nameInput, '');

    submitForm();

    expect(sales.createSale).not.toHaveBeenCalled();
  });

  it('exige el email aunque el nombre sea válido', () => {
    setField(emailInput, '');

    submitForm();

    expect(sales.createSale).not.toHaveBeenCalled();
  });

  it('un nombre con solo espacios cuenta como vacío', () => {
    setField(nameInput, '     ');

    submitForm();

    expect(sales.createSale).not.toHaveBeenCalled();
  });

  it('el botón queda habilitado para poder ver los errores al tocarlo', () => {
    setField(nameInput, '');
    setField(emailInput, '');

    const button = fixture.nativeElement.querySelector('button[type=submit]') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it('crea la venta, el pago y redirige a Mercado Pago', () => {
    setField(nameInput, '  Ana  ');
    setField(emailInput, '  ana@example.com ');

    submitForm();

    expect(stock.verify).toHaveBeenCalled();
    expect(sales.createSale).toHaveBeenCalledWith(cart.items());
    expect(payments.rememberPendingSale).toHaveBeenCalledWith('sale-1');
    expect(payments.createPayment).toHaveBeenCalledWith({
      saleId: 'sale-1',
      backUrls: { success: 's', failure: 'f', pending: 'p' },
      payer: { name: 'Ana', email: 'ana@example.com' },
    });
    expect(payments.redirectToCheckout).toHaveBeenCalledWith(MP_URL);
  });

  it('si el stock bajó, avisa y no crea la venta', () => {
    stock.verify.mockReturnValue(
      of([{ productId: 'p1', name: 'Yerba 1kg', requested: 2, available: 1 }]),
    );

    submitForm();

    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(sales.createSale).not.toHaveBeenCalled();
    expect(payments.redirectToCheckout).not.toHaveBeenCalled();
  });

  it('si el backend rechaza por stock insuficiente muestra los ítems en conflicto', () => {
    sales.createSale.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: {
              code: 'INSUFFICIENT_STOCK',
              items: [{ productId: 'p1', requested: 2, available: 1 }],
            },
          }),
      ),
    );

    submitForm();

    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(dialog.open.mock.calls[0][1].data.conflicts).toEqual([
      { productId: 'p1', name: '', requested: 2, available: 1 },
    ]);
    expect(payments.createPayment).not.toHaveBeenCalled();
  });

  it('al elegir ajustar, corrige el carrito al stock disponible', () => {
    dialog.open.mockReturnValue({ afterClosed: () => of('adjust') });
    stock.verify.mockReturnValue(
      of([{ productId: 'p1', name: 'Yerba 1kg', requested: 2, available: 1 }]),
    );

    submitForm();

    expect(stock.adjustToAvailable).toHaveBeenCalledWith([
      { productId: 'p1', name: 'Yerba 1kg', requested: 2, available: 1 },
    ]);
  });

  it('si falla el pago, un reintento reutiliza la venta ya creada', () => {
    payments.createPayment.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );

    submitForm();
    expect(payments.redirectToCheckout).not.toHaveBeenCalled();

    submitForm();

    expect(sales.createSale).toHaveBeenCalledTimes(1);
    expect(payments.createPayment).toHaveBeenCalledTimes(2);
    expect(payments.redirectToCheckout).toHaveBeenCalledWith(MP_URL);
  });

  it('si la URL de pago es inválida no deja la pantalla bloqueada', () => {
    payments.redirectToCheckout.mockImplementation(() => {
      throw new Error('La URL de pago recibida no pertenece a Mercado Pago.');
    });

    submitForm();
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button[type=submit]') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });
});
