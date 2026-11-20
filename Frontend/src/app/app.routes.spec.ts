import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { dashboardGuard } from './core/guards/auth.guard';

@Component({ template: 'resultado' })
class Stub {}

describe('rutas de la aplicación', () => {
  it('declara la ruta de retorno de Mercado Pago (/payments/:result) como redirección', () => {
    const route = routes.find((r) => r.path === 'payments/:result');

    expect(route?.redirectTo).toBe('sales/payment/:result');
  });

  it('el retorno de Mercado Pago llega a la pantalla de resultado conservando los parámetros', async () => {
    const redirect = routes.find((r) => r.path === 'payments/:result');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: redirect?.path ?? '', redirectTo: redirect?.redirectTo ?? '' },
          { path: 'sales/payment/:result', component: Stub },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/payments/success?external_reference=sale-1&status=approved');

    expect(TestBed.inject(Router).url).toBe(
      '/sales/payment/success?external_reference=sale-1&status=approved',
    );
  });

  it('cada resultado de Mercado Pago (success, failure y pending) tiene su destino', async () => {
    const redirect = routes.find((r) => r.path === 'payments/:result');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: redirect?.path ?? '', redirectTo: redirect?.redirectTo ?? '' },
          { path: 'sales/payment/:result', component: Stub },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create();

    for (const result of ['success', 'failure', 'pending']) {
      await harness.navigateByUrl(`/payments/${result}`);

      expect(TestBed.inject(Router).url).toBe(`/sales/payment/${result}`);
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
