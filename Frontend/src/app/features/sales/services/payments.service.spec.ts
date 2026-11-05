import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { Mock } from 'vitest';
import { API_URL } from '../../../core/services/api.service';
import { createMemoryStorage } from '../testing/factories';
import { CART_STORAGE } from './cart.service';
import { PENDING_SALE_KEY, PaymentsService } from './payments.service';

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

  it('arma las back_urls hacia las rutas de retorno del frontend', () => {
    const urls = service.buildBackUrls();

    expect(urls.success).toMatch(/\/sales\/payment\/success$/);
    expect(urls.failure).toMatch(/\/sales\/payment\/failure$/);
    expect(urls.pending).toMatch(/\/sales\/payment\/pending$/);
  });

  it('crea el pago enviando solo la venta (el monto lo resuelve el backend)', () => {
    const backUrls = service.buildBackUrls();
    let initPoint: string | undefined;

    service.createPayment({ saleId: 's1', backUrls }).subscribe((r) => (initPoint = r.initPoint));

    const req = http.expectOne('http://api.test/payments');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ saleId: 's1', backUrls });
    req.flush({ initPoint: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1' });

    expect(initPoint).toBe('https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1');
  });

  it('acepta init_point en snake_case', () => {
    let initPoint: string | undefined;
    service
      .createPayment({ saleId: 's1', backUrls: service.buildBackUrls() })
      .subscribe((r) => (initPoint = r.initPoint));

    http.expectOne('http://api.test/payments').flush({ init_point: 'https://mercadopago.com/x' });

    expect(initPoint).toBe('https://mercadopago.com/x');
  });

  it('falla si el backend no devuelve la URL de pago', () => {
    let error: unknown;
    service
      .createPayment({ saleId: 's1', backUrls: service.buildBackUrls() })
      .subscribe({ error: (e: unknown) => (error = e) });

    http.expectOne('http://api.test/payments').flush({});

    expect(error).toBeInstanceOf(Error);
  });

  it('redirige solo a dominios https de Mercado Pago', () => {
    service.redirectToCheckout('https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1');
    expect(navigate).toHaveBeenCalledTimes(1);

    expect(() => service.redirectToCheckout('https://evil.example.com/pay')).toThrow();
    expect(() => service.redirectToCheckout('https://mercadopago.com.evil.com/pay')).toThrow();
    expect(() => service.redirectToCheckout('http://www.mercadopago.com/pay')).toThrow();
    expect(() => service.redirectToCheckout('javascript:alert(1)')).toThrow();
    expect(() => service.redirectToCheckout('no es una url')).toThrow();
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('getPaymentBySale devuelve el pago normalizando el monto', () => {
    let payment: unknown;
    service.getPaymentBySale('s1').subscribe((p) => (payment = p));

    http
      .expectOne('http://api.test/payments/sale/s1')
      .flush({ id: 'pay1', saleId: 's1', paymentState: 'Paid', amount: '1500.00' });

    expect(payment).toEqual({ id: 'pay1', saleId: 's1', paymentState: 'Paid', amount: 1500 });
  });

  it('getPaymentBySale devuelve null si todavía no hay pago (404)', () => {
    let payment: unknown = 'sin respuesta';
    service.getPaymentBySale('s1').subscribe((p) => (payment = p));

    http
      .expectOne('http://api.test/payments/sale/s1')
      .flush({ message: 'not found' }, { status: 404, statusText: 'Not Found' });

    expect(payment).toBeNull();
  });

  it('getPaymentBySale propaga otros errores', () => {
    let error: unknown;
    service.getPaymentBySale('s1').subscribe({ error: (e: unknown) => (error = e) });

    http
      .expectOne('http://api.test/payments/sale/s1')
      .flush({}, { status: 500, statusText: 'Server Error' });

    expect(error).toBeTruthy();
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
