import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { dashboardGuard } from './core/guards/auth.guard';

describe('rutas de la aplicación', () => {
  it('la vuelta de Mercado Pago (/payments/:result) es una pantalla pública: sin guards ni redirección', () => {
    const route = routes.find((r) => r.path === 'payments/:result');

    expect(route).toBeDefined();
    expect(route?.canActivate).toBeUndefined();
    expect(route?.redirectTo).toBeUndefined();
    expect(route?.loadComponent).toBeDefined();
  });

  it('un comprador sin sesión llega a "Gracias por su compra" y no al login', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/payments/success?external_reference=sale-1&status=approved');

    expect(TestBed.inject(Router).url).toBe(
      '/payments/success?external_reference=sale-1&status=approved',
    );
    expect((harness.routeNativeElement as HTMLElement).textContent).toContain(
      '¡Gracias por su compra!',
    );
  });

  it('success, failure y pending tienen su propio mensaje', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const harness = await RouterTestingHarness.create();
    const expected: Record<string, string> = {
      success: '¡Gracias por su compra!',
      pending: 'Estamos esperando su pago',
      failure: 'No pudimos procesar su pago',
    };

    for (const [result, text] of Object.entries(expected)) {
      await harness.navigateByUrl(`/payments/${result}`);

      expect((harness.routeNativeElement as HTMLElement).textContent).toContain(text);
    }
  });

  it('la alta de usuarios (/users/new) exige sesión y rol Owner o Admin', () => {
    const route = routes.flatMap((r) => r.children ?? []).find((r) => r.path === 'users/new');

    expect(route).toBeDefined();
    expect(route?.canActivate).toHaveLength(2);
    expect(route?.data?.['roles']).toEqual(['Owner', 'Admin']);
    expect(route?.data?.['roles']).not.toContain('Employee');
  });

  it('el panel principal (/dashboard) lo protege el dashboardGuard: el Employee no lo ve', () => {
    const route = routes.flatMap((r) => r.children ?? []).find((r) => r.path === 'dashboard');

    expect(route?.canActivate).toEqual([dashboardGuard]);
  });
});
