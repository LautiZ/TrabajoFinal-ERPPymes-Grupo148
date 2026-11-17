import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import type { Mock } from 'vitest';
import { ConfirmDialog } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { NotificationService } from '../../../../shared/services/notification.service';
import { InventoryService } from '../../services/inventory.service';
import { createProduct } from '../../testing/factories';
import { AdjustStockDialog } from '../adjust-stock-dialog/adjust-stock-dialog';
import { ProductActions } from './product-actions';

describe('ProductActions', () => {
  let fixture: ComponentFixture<ProductActions>;
  let dialog: { open: Mock };
  let inventory: { delete: Mock; adjustStock: Mock };
  let notify: { success: Mock; error: Mock };
  let changed: Mock;

  const call = (method: string): void =>
    (fixture.componentInstance as unknown as Record<string, () => void>)[method]();

  beforeEach(async () => {
    dialog = { open: vi.fn(() => ({ afterClosed: () => of(true) })) };
    inventory = { delete: vi.fn(() => of(undefined)), adjustStock: vi.fn(() => of(undefined)) };
    notify = { success: vi.fn(), error: vi.fn() };
    changed = vi.fn();

    await TestBed.configureTestingModule({
      imports: [ProductActions],
      providers: [
        provideRouter([]),
        { provide: MatDialog, useValue: dialog },
        { provide: InventoryService, useValue: inventory },
        { provide: NotificationService, useValue: notify },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ProductActions);
    fixture.componentRef.setInput('product', createProduct({ id: 'p1', name: 'Yerba Mate 1kg' }));
    fixture.componentInstance.changed.subscribe(changed);
    fixture.detectChanges();
  });

  it('el botón del menú identifica a qué producto pertenece', () => {
    const button = (fixture.nativeElement as HTMLElement).querySelector('button');

    expect(button?.getAttribute('aria-label')).toBe('Acciones de Yerba Mate 1kg');
  });

  describe('eliminar', () => {
    it('pide confirmación mencionando el producto', () => {
      call('remove');

      expect(dialog.open).toHaveBeenCalledTimes(1);
      const [component, config] = dialog.open.mock.calls[0];
      expect(component).toBe(ConfirmDialog);
      expect(config.data.message).toContain('Yerba Mate 1kg');
    });

    it('si se confirma, da de baja el producto, avisa y pide refrescar la tabla', () => {
      call('remove');

      expect(inventory.delete).toHaveBeenCalledWith('p1');
      expect(notify.success).toHaveBeenCalledWith('"Yerba Mate 1kg" fue eliminado.');
      expect(changed).toHaveBeenCalledTimes(1);
    });

    it('si se cancela, no elimina nada', () => {
      dialog.open.mockReturnValue({ afterClosed: () => of(false) });

      call('remove');

      expect(inventory.delete).not.toHaveBeenCalled();
      expect(changed).not.toHaveBeenCalled();
    });

    it('si el servidor rechaza, muestra su mensaje y no refresca', () => {
      inventory.delete.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 409,
              error: { message: 'El producto tiene ventas asociadas' },
            }),
        ),
      );

      call('remove');

      expect(notify.error).toHaveBeenCalledWith('El producto tiene ventas asociadas');
      expect(notify.success).not.toHaveBeenCalled();
      expect(changed).not.toHaveBeenCalled();
    });
  });

  describe('ajustar stock', () => {
    const movement = { type: 'Outcome' as const, quantity: 3, reason: 'Merma' };

    beforeEach(() => {
      dialog.open.mockReturnValue({ afterClosed: () => of(movement) });
    });

    it('abre el diálogo con el producto', () => {
      call('adjustStock');

      const [component, config] = dialog.open.mock.calls[0];
      expect(component).toBe(AdjustStockDialog);
      expect(config.data.product.id).toBe('p1');
    });

    it('registra el movimiento, confirma al usuario y pide refrescar la tabla', () => {
      call('adjustStock');

      expect(inventory.adjustStock).toHaveBeenCalledWith('p1', movement);
      expect(notify.success).toHaveBeenCalledWith('Stock de "Yerba Mate 1kg" actualizado.');
      expect(changed).toHaveBeenCalledTimes(1);
    });

    it('si se cancela el diálogo, no registra nada', () => {
      dialog.open.mockReturnValue({ afterClosed: () => of(undefined) });

      call('adjustStock');

      expect(inventory.adjustStock).not.toHaveBeenCalled();
      expect(changed).not.toHaveBeenCalled();
    });

    it('si el servidor rechaza (p. ej. stock negativo), muestra su error', () => {
      inventory.adjustStock.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 400,
              error: { message: 'El stock no puede ser negativo' },
            }),
        ),
      );

      call('adjustStock');

      expect(notify.error).toHaveBeenCalledWith('El stock no puede ser negativo');
      expect(changed).not.toHaveBeenCalled();
    });

    it('si falla sin mensaje, usa uno genérico', () => {
      inventory.adjustStock.mockReturnValue(throwError(() => new Error('down')));

      call('adjustStock');

      expect(notify.error).toHaveBeenCalledWith('No se pudo registrar el ajuste de stock.');
    });
  });
});
