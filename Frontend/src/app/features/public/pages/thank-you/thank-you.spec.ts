import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { PurchaseSnapshot } from '../../../sales/models/purchase-snapshot.model';
import { PurchaseSnapshotService } from '../../../sales/services/purchase-snapshot.service';
import { ThankYou } from './thank-you';

const SNAPSHOT: PurchaseSnapshot = {
  saleId: 'sale-1',
  items: [
    { name: 'Yerba 1kg', quantity: 2, unit: 'Unit' },
    { name: 'Queso cremoso', quantity: 0.75, unit: 'Kg' },
  ],
  total: 10450,
  createdAt: Date.now(),
};

describe('ThankYou (pantalla pública)', () => {
  let find: ReturnType<typeof vi.fn>;

  async function render(result: string, query: Record<string, string> = {}): Promise<HTMLElement> {
    find = vi.fn(() => SNAPSHOT);
    await TestBed.configureTestingModule({
      imports: [ThankYou],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ result }),
              queryParamMap: convertToParamMap(query),
            },
            paramMap: of(convertToParamMap({ result })),
            queryParamMap: of(convertToParamMap(query)),
          },
        },
        { provide: PurchaseSnapshotService, useValue: { find } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ThankYou);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('pago aprobado: agradece, muestra el detalle y despide al cliente', async () => {
    const el = await render('success', { external_reference: 'sale-1' });

    expect(el.textContent).toContain('¡Gracias por su compra!');
    expect(el.textContent).toContain('Te esperamos nuevamente');
    expect(el.textContent).toContain('Detalle de su compra');
    expect(el.textContent).toContain('2 u');
    expect(el.textContent).toContain('Yerba 1kg');
    expect(el.textContent).toContain('0.75 kg');
    expect(el.textContent).toContain('Queso cremoso');
    expect(el.textContent).toContain('10,450.00');
    expect(find).toHaveBeenCalledWith('sale-1');
    expect(el.querySelectorAll('.confetti span').length).toBeGreaterThan(0);
  });

  it('sin detalle disponible no muestra la sección', async () => {
    find = vi.fn(() => null);
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ThankYou],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ result: 'success' }),
              queryParamMap: convertToParamMap({}),
            },
            paramMap: of(convertToParamMap({ result: 'success' })),
            queryParamMap: of(convertToParamMap({})),
          },
        },
        { provide: PurchaseSnapshotService, useValue: { find } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ThankYou);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).not.toContain('Detalle de su compra');
    expect(el.textContent).toContain('Te esperamos nuevamente');
  });

  it('pago pendiente: avisa que se espera la confirmación, sin festejar', async () => {
    const el = await render('pending', { external_reference: 'sale-1' });

    expect(el.textContent).toContain('Estamos esperando su pago');
    expect(el.textContent).not.toContain('Te esperamos nuevamente');
    expect(el.querySelector('.confetti')).toBeNull();
  });

  it('pago rechazado: lo informa y no muestra el detalle de la compra', async () => {
    const el = await render('failure', { external_reference: 'sale-1' });

    expect(el.textContent).toContain('No pudimos procesar su pago');
    expect(el.textContent).not.toContain('Detalle de su compra');
    expect(el.querySelector('.confetti')).toBeNull();
  });

  it('un resultado desconocido muestra un agradecimiento neutro', async () => {
    const el = await render('otra-cosa');

    expect(el.textContent).toContain('¡Gracias por su visita!');
  });
});
