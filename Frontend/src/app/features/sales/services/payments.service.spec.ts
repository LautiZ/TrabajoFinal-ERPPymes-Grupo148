import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { Mock } from 'vitest';
import { API_URL } from '../../../core/services/api.service';
import { Payment } from '../models/payment.model';
import { createMemoryStorage } from '../testing/factories';
import { CART_STORAGE } from './cart.service';
import { PENDING_SALE_KEY, PaymentsService } from './payments.service';

const CHECKOUT = 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1';

/** Respuesta del Payments MS (PaymentView): el monto de PostgreSQL puede llegar como string. */
const rawPayment = {
  id: 'pay1',
  saleId: 's1',
  amount: '1500.00',
  state: 'Pending',
  checkoutUrl: CHECKOUT,
  createdAt: '2026-11-18T10:00:00.000Z',
};

describe('PaymentsService', () => {
  let service: PaymentsService;
  let http: HttpTestingController;
  let storage: Storage;
  let navigate: Mock<(url: string) => void>;

  beforeEach(() => {
    storage = createMemoryStorage();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: 'http://api.test' },
        { provide: CART_STORAGE, useValue: storage },
      ],
    });
    service = TestBed.inject(PaymentsService);
    http = TestBed.inject(HttpTestingController);
    navigate = vi.fn<(url: string) => void>();
    (service as unknown as { navigate: (url: string) => void }).navigate = navigate;
  });

  afterEach(() => http.verify());

  describe('createPayment', () => {
    it('envía solo el id de la venta: el Gateway rechaza cualquier otro campo', () => {
      service.createPayment('s1').subscribe();

      const req = http.expectOne('http://api.test/payments');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ saleId: 's1' });
      req.flush(rawPayment);
    });

    it('devuelve el pago normalizado con la URL del checkout y el estado', () => {
      let payment: Payment | undefined;
      service.createPayment('s1').subscribe((p) => (payment = p));

      http.expectOne('http://api.test/payments').flush(rawPayment);

      expect(payment).toEqual({
        id: 'pay1',
        saleId: 's1',
        amount: 1500,
        state: 'Pending',
        checkoutUrl: CHECKOUT,
        createdAt: '2026-11-18T10:00:00.000Z',
      });
    });

    it('si el intento ya se cerró, checkoutUrl llega nulo', () => {
      let payment: Payment | undefined;
      service.createPayment('s1').subscribe((p) => (payment = p));

      http
        .expectOne('http://api.test/payments')
        .flush({ ...rawPayment, state: 'Paid', checkoutUrl: null });

      expect(payment?.checkoutUrl).toBeNull();
      expect(payment?.state).toBe('Paid');
    });

    it('propaga los errores del backend (p. ej. 409 SALE_NOT_PAYABLE)', () => {
      let status: number | undefined;
      service
        .createPayment('s1')
        .subscribe({ error: (e: { status: number }) => (status = e.status) });

      http
        .expectOne('http://api.test/payments')
        .flush({ code: 'SALE_NOT_PAYABLE' }, { status: 409, statusText: 'Conflict' });

      expect(status).toBe(409);
    });
  });

  describe('redirectToCheckout', () => {
    it('redirige solo a dominios https de Mercado Pago', () => {
      service.redirectToCheckout(CHECKOUT);
      expect(navigate).toHaveBeenCalledTimes(1);

      expect(() => service.redirectToCheckout('https://evil.example.com/pay')).toThrow();
      expect(() => service.redirectToCheckout('https://mercadopago.com.evil.com/pay')).toThrow();
      expect(() => service.redirectToCheckout('http://www.mercadopago.com/pay')).toThrow();
      expect(() => service.redirectToCheckout('javascript:alert(1)')).toThrow();
      expect(() => service.redirectToCheckout('no es una url')).toThrow();
      expect(navigate).toHaveBeenCalledTimes(1);
    });

    it('acepta subdominios de Mercado Pago (p. ej. el sandbox)', () => {
      service.redirectToCheckout('https://sandbox.mercadopago.com.ar/checkout/v1/redirect');

      expect(navigate).toHaveBeenCalledTimes(1);
    });

    it('sin URL de pago lanza un error claro', () => {
      expect(() => service.redirectToCheckout(null)).toThrow(
        'El servidor no devolvió la URL de pago.',
      );
      expect(() => service.redirectToCheckout('')).toThrow();
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('getPaymentBySale', () => {
    it('devuelve el último intento normalizando el monto', () => {
      let payment: Payment | null | undefined;
      service.getPaymentBySale('s1').subscribe((p) => (payment = p));

      http
        .expectOne('http://api.test/payments/sale/s1')
        .flush({ ...rawPayment, state: 'Paid', checkoutUrl: null });

      expect(payment).toMatchObject({ id: 'pay1', saleId: 's1', state: 'Paid', amount: 1500 });
    });

    it('devuelve null si todavía no hay pago (404)', () => {
      let payment: Payment | null | undefined = undefined;
      service.getPaymentBySale('s1').subscribe((p) => (payment = p));

      http
        .expectOne('http://api.test/payments/sale/s1')
        .flush({ message: 'not found' }, { status: 404, statusText: 'Not Found' });

      expect(payment).toBeNull();
    });

    it('propaga otros errores', () => {
      let error: unknown;
      service.getPaymentBySale('s1').subscribe({ error: (e: unknown) => (error = e) });

      http
        .expectOne('http://api.test/payments/sale/s1')
        .flush({}, { status: 500, statusText: 'Server Error' });

      expect(error).toBeTruthy();
    });
  });

  it('recuerda y limpia la venta pendiente', () => {
    expect(service.pendingSaleId()).toBeNull();

    service.rememberPendingSale('s9');
    expect(storage.getItem(PENDING_SALE_KEY)).toBe('s9');
    expect(service.pendingSaleId()).toBe('s9');

    service.clearPendingSale();
    expect(service.pendingSaleId()).toBeNull();
  });
});
