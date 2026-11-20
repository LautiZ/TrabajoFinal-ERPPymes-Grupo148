import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import type { Mock } from 'vitest';
import { StockStatusFilter } from '../../models/product.model';
import { StockSummaryService } from '../../services/stock-summary.service';
import { StockSummary } from './stock-summary';

describe('StockSummary', () => {
  let fixture: ComponentFixture<StockSummary>;
  let summaryService: { load: Mock };
  let filterChange: Mock;

  const text = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const el = (selector: string): HTMLElement =>
    (fixture.nativeElement as HTMLElement).querySelector(selector) as HTMLElement;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    summaryService = { load: vi.fn(() => of({ total: 20, ok: 14, low: 4, out: 2 })) };
    filterChange = vi.fn();

    await TestBed.configureTestingModule({
      imports: [StockSummary],
      providers: [{ provide: StockSummaryService, useValue: summaryService }],
    }).compileComponents();
    fixture = TestBed.createComponent(StockSummary);
    fixture.componentInstance.filterChange.subscribe(filterChange);
    await settle();
  });

  it('muestra cuántos productos hay en cada estado', () => {
    expect(text()).toContain('Stock normal');
    expect(el('.tile__value--ok').textContent).toContain('14');
    expect(el('.tile__value--low').textContent).toContain('4');
    expect(el('.tile__value--out').textContent).toContain('2');
  });

  it('consulta el resumen al backend, que usa el mínimo de cada producto', () => {
    expect(summaryService.load).toHaveBeenCalledWith();
  });

  it('no ofrece un umbral global: el mínimo se define en cada producto', () => {
    expect(el('#low-stock-threshold')).toBeNull();
  });

  it('vuelve a consultar cuando cambia el token de refresco', async () => {
    fixture.componentRef.setInput('refreshToken', 1);
    await settle();

    expect(summaryService.load).toHaveBeenCalledTimes(2);
  });

  it('muestra guiones mientras no hay datos y avisa si falla', async () => {
    TestBed.resetTestingModule();
    summaryService = { load: vi.fn(() => throwError(() => new Error('down'))) };
    await TestBed.configureTestingModule({
      imports: [StockSummary],
      providers: [{ provide: StockSummaryService, useValue: summaryService }],
    }).compileComponents();
    fixture = TestBed.createComponent(StockSummary);
    await settle();

    expect(el('.tile__value--low').textContent).toContain('—');
    expect(el('[role=alert]').textContent).toContain('No se pudo calcular el resumen');
  });

  describe('atajos de filtro', () => {
    const buttons = (): HTMLButtonElement[] =>
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button.tile--action'));

    it('elegir "stock bajo" o "sin stock" emite el filtro', () => {
      buttons()[0].click();
      buttons()[1].click();

      expect(filterChange).toHaveBeenNthCalledWith(1, 'low' as StockStatusFilter);
      expect(filterChange).toHaveBeenNthCalledWith(2, 'out' as StockStatusFilter);
    });

    it('marca el atajo activo y, al tocarlo de nuevo, quita el filtro', async () => {
      fixture.componentRef.setInput('activeFilter', 'low');
      await settle();

      expect(buttons()[0].getAttribute('aria-pressed')).toBe('true');
      expect(buttons()[1].getAttribute('aria-pressed')).toBe('false');
      expect(buttons()[0].textContent).toContain('Quitar filtro');

      buttons()[0].click();

      expect(filterChange).toHaveBeenCalledWith('');
    });
  });
});
