import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import type { Mock } from 'vitest';
import { NotificationService } from '../../../../shared/services/notification.service';
import { ClipboardService } from '../../../../core/services/clipboard.service';
import { Payment } from '../../models/payment.model';
import { Sale } from '../../models/sale.model';
import { CART_STORAGE, CartService } from '../../services/cart.service';
import { PaymentsService } from '../../services/payments.service';
import { PurchaseSnapshotService } from '../../services/purchase-snapshot.service';
import { SalesService } from '../../services/sales.service';
import { StockCheckService } from '../../services/stock-check.service';
import { createMemoryStorage, createProduct } from '../../testing/factories';
import { Checkout } from './checkout';

const SALE: Sale = { id: 'sale-1', total: 3000, currentState: 'Ordered', createdAt: '' };
const MP_URL = 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1';
const PAYMENT: Payment = {
  id: 'pay-1',
  saleId: 'sale-1',
  amount: 3000,
  state: 'Pending',
  checkoutUrl: MP_URL,
  createdAt: '',
};

describe('Checkout', () => {
  let fixture: ComponentFixture<Checkout>;
  let cart: CartService;
  let sales: { createSale: Mock };
  let payments: {
    createPayment: Mock;
    validCheckoutUrl: Mock;
    rememberPendingSale: Mock;
    clearPendingSale: Mock;
  };
  let stock: { verify: Mock; adjustToAvailable: Mock; withNames: Mock };
  let dialog: { open: Mock };
  let notify: { error: Mock; info: Mock; success: Mock };
  let clipboard: { copy: Mock };
  let purchases: { save: Mock };

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const submitForm = (): void => {
    (root().querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
  };
  const linkPanel = (): HTMLElement | null => root().querySelector('.checkout__link');
  const button = (): HTMLButtonElement =>
    root().querySelector('button[type=submit]') as HTMLButtonElement;

  beforeEach(async () => {
    sales = { createSale: vi.fn(() => of(SALE)) };
    payments = {
      createPayment: vi.fn(() => of(PAYMENT)),
      validCheckoutUrl: vi.fn((url: string | null) => {
        if (!url) throw new Error('El servidor no devolvió la URL de pago.');
        return url;
      }),
      rememberPendingSale: vi.fn(),
      clearPendingSale: vi.fn(),
    };
    stock = {
      verify: vi.fn(() => of([])),
      adjustToAvailable: vi.fn(),
      withNames: vi.fn((c: unknown) => c),
    };
    dialog = { open: vi.fn(() => ({ afterClosed: () => of('review') })) };
    notify = { error: vi.fn(), info: vi.fn(), success: vi.fn() };
    clipboard = { copy: vi.fn(() => Promise.resolve(true)) };
    purchases = { save: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [Checkout],
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        { provide: CART_STORAGE, useValue: createMemoryStorage() },
        { provide: SalesService, useValue: sales },
        { provide: PaymentsService, useValue: payments },
        { provide: StockCheckService, useValue: stock },
        { provide: MatDialog, useValue: dialog },
        { provide: NotificationService, useValue: notify },
        { provide: ClipboardService, useValue: clipboard },
        { provide: PurchaseSnapshotService, useValue: purchases },
      ],
    }).compileComponents();

    cart = TestBed.inject(CartService);
    cart.addItem(createProduct({ price: 1500, stock: 10 }), 2);
    fixture = TestBed.createComponent(Checkout);
    fixture.detectChanges();
  });

  it('muestra el resumen de la orden con el total', () => {
    const text = root().textContent ?? '';
    expect(text).toContain('Yerba 1kg');
    expect(text).toContain('3,000.00');
  });

  it('explica que se genera un link para el cliente, no una redirección', () => {
    expect(root().textContent).toContain('se crea un link de Mercado Pago');
    expect(root().textContent).not.toContain('te llevamos');
  });

  it('no pide datos del cliente: el backend arma el cobro a partir de la venta', () => {
    expect(root().querySelector('input[type=email]')).toBeNull();
    expect(root().querySelector('input[type=text]')).toBeNull();
    expect(root().textContent).toContain('Mercado Pago');
  });

  it('el botón de cobro dice "Generar pago"', () => {
    expect(button().textContent?.trim()).toBe('Generar pago');
  });

  it('mientras procesa, el spinner y el texto van juntos en un bloque centrado', () => {
    payments.createPayment.mockReturnValue(new Subject());

    submitForm();
    fixture.detectChanges();

    const busy = button().querySelector('.checkout__submit-busy');
    expect(busy?.querySelector('mat-progress-spinner')).not.toBeNull();
    expect(busy?.textContent).toContain('Procesando...');
    expect(button().disabled).toBe(true);
  });

  it('con el carrito vacío no permite confirmar ni llama al backend', () => {
    cart.clear();
    fixture.detectChanges();

    expect(root().querySelector('form')).toBeNull();
    (fixture.componentInstance as unknown as { submit: () => void }).submit();

    expect(sales.createSale).not.toHaveBeenCalled();
    expect(payments.createPayment).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith('El carrito está vacío.');
  });

  it('crea la venta, genera el pago solo con el id de la venta y muestra el link (sin redirigir)', () => {
    submitForm();
    fixture.detectChanges();

    expect(stock.verify).toHaveBeenCalled();
    expect(sales.createSale).toHaveBeenCalledWith(cart.items());
    expect(payments.rememberPendingSale).toHaveBeenCalledWith('sale-1');
    expect(payments.createPayment).toHaveBeenCalledWith('sale-1');
    expect(linkPanel()?.textContent).toContain('Pago generado');
    expect((root().querySelector('.checkout__link-input') as HTMLInputElement).value).toBe(MP_URL);
    // Ya no hay formulario de cobro: el cliente paga desde el link.
    expect(root().querySelector('form')).toBeNull();
  });

  it('guarda el detalle de la compra (nombres y cantidades) para la pantalla "Gracias por su compra"', () => {
    submitForm();

    expect(purchases.save).toHaveBeenCalledWith(
      expect.objectContaining({
        saleId: 'sale-1',
        total: 3000,
        items: [{ name: 'Yerba 1kg', quantity: 2, unit: 'Unit' }],
      }),
    );
  });

  it('el botón "Copiar link" copia el link devuelto por el backend y lo confirma', async () => {
    submitForm();
    fixture.detectChanges();

    (root().querySelector('.checkout__copy') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(clipboard.copy).toHaveBeenCalledWith(MP_URL);
    expect(notify.success).toHaveBeenCalledWith('Link de pago copiado al portapapeles.');
    expect(root().querySelector('.checkout__copy')?.textContent).toContain('Copiado');
  });

  it('si no se puede copiar, lo avisa y deja el link seleccionable', async () => {
    clipboard.copy.mockResolvedValue(false);
    submitForm();
    fixture.detectChanges();

    (root().querySelector('.checkout__copy') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(notify.error).toHaveBeenCalledWith(
      'No se pudo copiar. Seleccioná el link y copialo manualmente.',
    );
    expect(root().querySelector('.checkout__link-input')).not.toBeNull();
  });

  it('"Ver estado del pago" lleva al resultado con la venta como referencia', () => {
    submitForm();
    fixture.detectChanges();

    const link = root().querySelector('a[href^="/sales/payment/pending"]');
    expect(link?.getAttribute('href')).toBe('/sales/payment/pending?external_reference=sale-1');
  });

  it('"Nueva venta" limpia el carrito y la venta en curso', () => {
    submitForm();
    fixture.detectChanges();

    const newSale = Array.from(root().querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Nueva venta'),
    ) as HTMLButtonElement;
    newSale.click();

    expect(cart.isEmpty()).toBe(true);
    expect(payments.clearPendingSale).toHaveBeenCalled();
  });

  it('si el pago llega sin checkoutUrl, lo informa y no deja la pantalla bloqueada', () => {
    payments.createPayment.mockReturnValue(of({ ...PAYMENT, checkoutUrl: null }));
    submitForm();
    fixture.detectChanges();

    expect(notify.error).toHaveBeenCalledWith('El servidor no devolvió la URL de pago.');
    expect(button().disabled).toBe(false);
  });

  it('si la URL de pago no es válida no deja la pantalla bloqueada', () => {
    payments.validCheckoutUrl.mockImplementation(() => {
      throw new Error('La URL de pago recibida no pertenece a Mercado Pago.');
    });

    submitForm();
    fixture.detectChanges();

    expect(button().disabled).toBe(false);
    expect(notify.error).toHaveBeenCalledWith(
      'La URL de pago recibida no pertenece a Mercado Pago.',
    );
  });

  describe('stock', () => {
    it('si el stock bajó, avisa y no crea la venta', () => {
      stock.verify.mockReturnValue(
        of([{ productId: 'p1', name: 'Yerba 1kg', requested: 2, available: 1 }]),
      );

      submitForm();

      expect(dialog.open).toHaveBeenCalledTimes(1);
      expect(sales.createSale).not.toHaveBeenCalled();
      expect(linkPanel()).toBeNull();
    });

    it('si el backend rechaza por stock insuficiente (409) muestra los ítems en conflicto', () => {
      sales.createSale.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 409,
              error: {
                statusCode: 409,
                message: 'Insufficient stock',
                code: 'INSUFFICIENT_STOCK',
                items: [{ productId: 'p1', name: 'Yerba 1kg', requested: 2, available: 1 }],
              },
            }),
        ),
      );

      submitForm();

      expect(dialog.open).toHaveBeenCalledTimes(1);
      expect(dialog.open.mock.calls[0][1].data.conflicts).toEqual([
        { productId: 'p1', name: 'Yerba 1kg', requested: 2, available: 1 },
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
  });

  describe('errores al generar el pago', () => {
    it('si falla el pago, un reintento reutiliza la venta ya creada', () => {
      payments.createPayment.mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ status: 500 })),
      );

      submitForm();
      fixture.detectChanges();
      expect(linkPanel()).toBeNull();

      submitForm();
      fixture.detectChanges();

      expect(sales.createSale).toHaveBeenCalledTimes(1);
      expect(payments.createPayment).toHaveBeenCalledTimes(2);
      expect(linkPanel()).not.toBeNull();
    });

    it('si la venta ya no se puede cobrar (409 SALE_NOT_PAYABLE) lo explica y el reintento arma una venta nueva', () => {
      payments.createPayment.mockReturnValueOnce(
        throwError(
          () => new HttpErrorResponse({ status: 409, error: { code: 'SALE_NOT_PAYABLE' } }),
        ),
      );

      submitForm();

      expect(notify.error).toHaveBeenCalledWith(expect.stringContaining('ya no se puede cobrar'));
      expect(payments.clearPendingSale).toHaveBeenCalled();

      submitForm();

      expect(sales.createSale).toHaveBeenCalledTimes(2);
    });

    it('si Mercado Pago o el servicio no responden, informa que no se cobró nada', () => {
      payments.createPayment.mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ status: 503 })),
      );

      submitForm();

      expect(notify.error).toHaveBeenCalledWith(expect.stringContaining('No se cobró nada'));
      expect(button().disabled).toBe(false);
    });

    it('si Mercado Pago rechaza la solicitud (502) lo informa', () => {
      payments.createPayment.mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ status: 502 })),
      );

      submitForm();

      expect(notify.error).toHaveBeenCalledWith(expect.stringContaining('Mercado Pago rechazó'));
    });
  });
});
