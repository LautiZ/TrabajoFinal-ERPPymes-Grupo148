import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Payment } from '../../models/payment.model';
import { Sale, SaleState } from '../../models/sale.model';
import { CART_STORAGE, CartService } from '../../services/cart.service';
import { PaymentsService } from '../../services/payments.service';
import { SalesService } from '../../services/sales.service';
import { createMemoryStorage, createProduct } from '../../testing/factories';
import { PAYMENT_POLL_CONFIG, PaymentResult } from './payment-result';

const sale = (currentState: SaleState): Sale => ({
  id: 'sale-1',
  total: 100,
  currentState,
  createdAt: '',
});

describe('PaymentResult', () => {
  let cart: CartService;
  let sales: { getSale: ReturnType<typeof vi.fn> };
  let payments: {
    getPaymentBySale: ReturnType<typeof vi.fn>;
    pendingSaleId: ReturnType<typeof vi.fn>;
    clearPendingSale: ReturnType<typeof vi.fn>;
  };

  async function render(
    result: string,
    query: Record<string, string> = { external_reference: 'sale-1' },
  ): Promise<ComponentFixture<PaymentResult>> {
    await TestBed.configureTestingModule({
      imports: [PaymentResult],
      providers: [
        provideRouter([]),
        { provide: CART_STORAGE, useValue: createMemoryStorage() },
        { provide: SalesService, useValue: sales },
        { provide: PaymentsService, useValue: payments },
        { provide: PAYMENT_POLL_CONFIG, useValue: { intervalMs: 1000, maxAttempts: 3 } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ result }),
              queryParamMap: convertToParamMap(query),
            },
          },
        },
      ],
    }).compileComponents();
    cart = TestBed.inject(CartService);
    cart.addItem(createProduct(), 1);
    const fixture = TestBed.createComponent(PaymentResult);
    fixture.detectChanges();
    return fixture;
  }

  const text = (fixture: ComponentFixture<PaymentResult>): string =>
    (fixture.nativeElement as HTMLElement).textContent ?? '';

  async function tick(fixture: ComponentFixture<PaymentResult>, ms: number): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    sales = { getSale: vi.fn(() => of(sale('Ordered'))) };
    payments = {
      getPaymentBySale: vi.fn(() => of(null)),
      pendingSaleId: vi.fn(() => null),
      clearPendingSale: vi.fn(),
    };
  });

  afterEach(() => vi.useRealTimers());

  it('aprobado: confirma con el backend, vacía el carrito y limpia la venta pendiente', async () => {
    sales.getSale.mockReturnValue(of(sale('Paid')));
    const fixture = await render('success');

    await tick(fixture, 0);

    expect(text(fixture)).toContain('Pago aprobado');
    expect(cart.isEmpty()).toBe(true);
    expect(payments.clearPendingSale).toHaveBeenCalled();
  });

  it('no confía solo en la URL: "success" con la venta aún pendiente no vacía el carrito', async () => {
    const fixture = await render('success');

    await tick(fixture, 0);

    expect(text(fixture)).toContain('Pago pendiente');
    expect(text(fixture)).not.toContain('Pago aprobado');
    expect(cart.isEmpty()).toBe(false);
  });

  it('rechazado: conserva el carrito y ofrece reintentar', async () => {
    sales.getSale.mockReturnValue(of(sale('Ordered')));
    payments.getPaymentBySale.mockReturnValue(
      of({ id: 'p', saleId: 'sale-1', paymentState: 'Rejected', amount: 100 } as Payment),
    );
    const fixture = await render('failure');

    await tick(fixture, 0);

    expect(text(fixture)).toContain('Pago rechazado');
    expect(text(fixture)).toContain('Reintentar');
    expect(cart.isEmpty()).toBe(false);
  });

  it('pendiente: reintenta (polling) y pasa a aprobado cuando el webhook confirma', async () => {
    const fixture = await render('pending');
    await tick(fixture, 0);
    expect(text(fixture)).toContain('Pago pendiente');

    sales.getSale.mockReturnValue(of(sale('Paid')));
    await tick(fixture, 1000);

    expect(text(fixture)).toContain('Pago aprobado');
    expect(cart.isEmpty()).toBe(true);
  });

  it('pendiente: deja de consultar al agotar los reintentos', async () => {
    const fixture = await render('pending');

    await tick(fixture, 10_000);

    expect(sales.getSale).toHaveBeenCalledTimes(3);
    expect(text(fixture)).toContain('todavía no confirmó');
  });

  it('muestra un error de verificación si el backend nunca responde', async () => {
    sales.getSale.mockReturnValue(throwError(() => new Error('down')));
    payments.getPaymentBySale.mockReturnValue(throwError(() => new Error('down')));
    const fixture = await render('success');

    await tick(fixture, 10_000);

    expect(text(fixture)).toContain('No pudimos verificar el pago');
    expect(cart.isEmpty()).toBe(false);
  });

  it('sin referencia de venta ni venta recordada, no consulta y avisa', async () => {
    const fixture = await render('success', {});

    expect(sales.getSale).not.toHaveBeenCalled();
    expect(text(fixture)).toContain('No pudimos verificar el pago');
  });

  it('usa la venta recordada si Mercado Pago no devuelve external_reference', async () => {
    payments.pendingSaleId.mockReturnValue('sale-1');
    sales.getSale.mockReturnValue(of(sale('Paid')));
    const fixture = await render('success', {});

    await tick(fixture, 0);

    expect(sales.getSale).toHaveBeenCalledWith('sale-1');
    expect(text(fixture)).toContain('Pago aprobado');
  });
});
