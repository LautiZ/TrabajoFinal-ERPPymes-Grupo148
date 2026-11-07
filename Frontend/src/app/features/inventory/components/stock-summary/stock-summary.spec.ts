import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import type { Mock } from 'vitest';
import { NotificationService } from '../../../../shared/services/notification.service';
import { StockStatusFilter } from '../../models/product.model';
import {
  INVENTORY_STORAGE,
  LowStockThresholdService,
} from '../../services/low-stock-threshold.service';
import { StockSummaryService } from '../../services/stock-summary.service';
import { StockSummary } from './stock-summary';

describe('StockSummary', () => {
  let fixture: ComponentFixture<StockSummary>;
  let summaryService: { load: Mock };
  let notify: { error: Mock };
  let threshold: LowStockThresholdService;
  let filterChange: Mock;
  let thresholdChange: Mock;

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
    notify = { error: vi.fn() };
    filterChange = vi.fn();
    thresholdChange = vi.fn();

    await TestBed.configureTestingModule({
      imports: [StockSummary],
      providers: [
        { provide: INVENTORY_STORAGE, useValue: null },
        { provide: StockSummaryService, useValue: summaryService },
        { provide: NotificationService, useValue: notify },
      ],
    }).compileComponents();
    threshold = TestBed.inject(LowStockThresholdService);
    fixture = TestBed.createComponent(StockSummary);
    fixture.componentInstance.filterChange.subscribe(filterChange);
    fixture.componentInstance.thresholdChange.subscribe(thresholdChange);
    await settle();
  });

  it('muestra cuántos productos hay en cada estado', () => {
    expect(text()).toContain('Stock normal');
    expect(el('.tile__value--ok').textContent).toContain('14');
    expect(el('.tile__value--low').textContent).toContain('4');
    expect(el('.tile__value--out').textContent).toContain('2');
  });

  it('consulta el resumen con el umbral actual', () => {
    expect(summaryService.load).toHaveBeenCalledWith(10);
  });

  it('vuelve a consultar cuando cambia el token de refresco', async () => {
    threshold.set(30);
    fixture.componentRef.setInput('refreshToken', 1);
    await settle();

    expect(summaryService.load).toHaveBeenCalledTimes(2);
    expect(summaryService.load).toHaveBeenLastCalledWith(30);
  });

  it('muestra guiones mientras no hay datos y avisa si falla', async () => {
    TestBed.resetTestingModule();
    summaryService = { load: vi.fn(() => throwError(() => new Error('down'))) };
    await TestBed.configureTestingModule({
      imports: [StockSummary],
      providers: [
        { provide: INVENTORY_STORAGE, useValue: null },
        { provide: StockSummaryService, useValue: summaryService },
        { provide: NotificationService, useValue: notify },
      ],
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

  describe('umbral configurable', () => {
    const input = (): HTMLInputElement => el('#low-stock-threshold') as HTMLInputElement;

    function type(value: string): void {
      input().value = value;
      input().dispatchEvent(new Event('change'));
    }

    it('muestra el umbral actual', () => {
      expect(input().value).toBe('10');
    });

    it('al cambiarlo lo guarda y avisa para refrescar', () => {
      type('25');

      expect(threshold.value()).toBe(25);
      expect(thresholdChange).toHaveBeenCalledWith(25);
      expect(notify.error).not.toHaveBeenCalled();
    });

    it('rechaza valores inválidos, los revierte y avisa', () => {
      type('-3');

      expect(threshold.value()).toBe(10);
      expect(input().value).toBe('10');
      expect(thresholdChange).not.toHaveBeenCalled();
      expect(notify.error).toHaveBeenCalledTimes(1);
    });

    it('rechaza el campo vacío', () => {
      type('');

      expect(threshold.value()).toBe(10);
      expect(notify.error).toHaveBeenCalledTimes(1);
    });
  });
});
